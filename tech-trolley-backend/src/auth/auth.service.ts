import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import type { Request } from "express";
import { db } from "../database/database";
import { fail } from "../common/errors";
import type { User } from "@tech-trolley/contracts";
import { updateProfile, profileDetails } from "../users/profile";
import { verifyAccountPassword, verifyCurrentPassword } from "./password-check";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const safeUser = (u: any): User => ({
  id: u.id,
  name: u.name,
  login: u.login,
  email: u.email,
  role: u.role,
  active: u.active,
  must_change: u.must_change,
});
@Injectable()
export class AuthService {
  async verifyPassword(user: User & { sessionHash: string }, password: string) {
    const [u] = await db.query(
      "SELECT id,password_hash FROM app_user WHERE id=$1",
      [user.id],
    );
    if (!u || !(await verifyAccountPassword(u, password)))
      fail("CURRENT_PASSWORD_INVALID", 400);
    return db.transaction(async (em) => {
      const [fresh] = await em.query(
        "SELECT u.password_hash FROM app_user u JOIN session s ON s.user_id=u.id WHERE u.id=$1 AND u.active AND s.token_hash=$2 AND s.expires_at>now() AND s.absolute_expires_at>now() FOR SHARE OF u,s",
        [user.id, user.sessionHash],
      );
      if (!fresh || fresh.password_hash !== u.password_hash)
        fail("SESSION_EXPIRED", 401);
      return { ok: true, revealForSeconds: 60 };
    });
  }
  async login(identity: string, password: string, ip: string) {
    const normalized = identity.trim().toLowerCase().normalize("NFC");
    const key = digest(`${ip}:${normalized}`);
    const [attempt] = await db.query(
      `INSERT INTO auth_attempt(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempt.reset_at<now() THEN 1 ELSE auth_attempt.count+1 END,reset_at=CASE WHEN auth_attempt.reset_at<now() THEN now()+interval '15 minutes' ELSE auth_attempt.reset_at END RETURNING count`,
      [key],
    );
    if (attempt.count > 10) fail("RATE_LIMIT", 429);
    const [u] = await db.query(
      "SELECT u.* FROM app_user u JOIN identity i ON i.user_id=u.id WHERE i.value=$1",
      [normalized],
    );
    const valid = u
      ? await verifyAccountPassword(u, password)
      : await bcrypt.compare(
          password,
          "$2b$12$Zuc0ypmVn4HXFg1H8.VLF.26KLlrQHTeE9FSEVpmJlgyKlw8.0Hny",
        );
    if (!u || !valid || !u.active) fail("INVALID_CREDENTIALS", 401);
    return db.transaction(async (em) => {
      await em.query("SELECT id FROM app_user WHERE id=$1 FOR UPDATE", [u.id]);
      const [fresh] = await em.query("SELECT * FROM app_user WHERE id=$1", [
        u.id,
      ]);
      if (!fresh.active || fresh.password_hash !== u.password_hash)
        fail("INVALID_CREDENTIALS", 401);
      const [identity] = await em.query(
        "SELECT user_id FROM identity WHERE value=$1 AND user_id=$2",
        [normalized, fresh.id],
      );
      if (!identity) fail("INVALID_CREDENTIALS", 401);
      const token = randomBytes(32).toString("base64url");
      await em.query(
        `INSERT INTO session(token_hash,user_id,expires_at,absolute_expires_at) VALUES($1,$2,now()+interval '30 minutes',now()+interval '7 days')`,
        [digest(token), u.id],
      );
      return { user: safeUser(fresh), token };
    });
  }
  async authenticate(req: Request) {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies?.tt_session;
    if (!token) fail("SESSION_EXPIRED", 401);
    const [u] = await db.query(
      `SELECT u.*,s.token_hash FROM session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.absolute_expires_at>now() AND u.active`,
      [digest(token)],
    );
    if (!u) fail("SESSION_EXPIRED", 401);
    return { ...safeUser(u), sessionHash: u.token_hash };
  }
  async change(
    user: User & { sessionHash: string },
    current: string,
    password: string,
  ) {
    const verifiedHash = await verifyCurrentPassword(
      user.id,
      current,
      "INVALID_CREDENTIALS",
      401,
    );
    const hash = await bcrypt.hash(password, 12);
    await db.transaction(async (em) => {
      const [u] = await em.query(
        "SELECT * FROM app_user WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (!u?.active || u.password_hash !== verifiedHash)
        fail("SESSION_EXPIRED", 401);
      await em.query(
        "UPDATE app_user SET password_hash=$2,must_change=false WHERE id=$1",
        [user.id, hash],
      );
      await em.query("DELETE FROM session WHERE user_id=$1", [user.id]);
      await em.query(
        "INSERT INTO audit_event(actor_id,action,subject_id) VALUES($1,'password_changed',$2)",
        [user.id, user.id],
      );
    });
    return { ok: true };
  }
  async profile(user: User, values: Parameters<typeof updateProfile>[2]) {
    const verifiedHash = await verifyCurrentPassword(
      user.id,
      values.currentPassword,
    );
    return db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(74819322)");
      const [actor] = await tx.query(
        "SELECT * FROM app_user WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (!actor?.active) fail("SESSION_EXPIRED", 401);
      const result = await updateProfile(
        tx,
        actor,
        values,
        actor,
        verifiedHash,
      );
      if (result.identityChanged)
        await tx.query("DELETE FROM session WHERE user_id=$1", [user.id]);
      if (result.changed)
        await tx.query(
          "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'profile_updated',$2,$3)",
          [
            user.id,
            user.id,
            {
              before: profileDetails(actor),
              after: profileDetails(result.user),
              identityChanged: result.identityChanged,
            },
          ],
        );
      return {
        user: safeUser(result.user),
        requiresLogin: result.identityChanged,
      };
    });
  }
  async refresh(hash: string) {
    return db.transaction(async (em) => {
      const [s] = await em.query(
        "SELECT * FROM session WHERE token_hash=$1 AND expires_at>now() AND absolute_expires_at>now() FOR UPDATE",
        [hash],
      );
      if (!s) fail("SESSION_EXPIRED", 401);
      const token = randomBytes(32).toString("base64url");
      await em.query(
        `UPDATE session SET token_hash=$2,expires_at=LEAST(now()+interval '30 minutes',absolute_expires_at) WHERE token_hash=$1`,
        [hash, digest(token)],
      );
      return token;
    });
  }
}
