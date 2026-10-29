import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import type { Request } from "express";
import { db } from "../database/database";
import { fail } from "../common/errors";
import type { User } from "@tech-trolley/contracts";
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
    const valid = await bcrypt.compare(
      password,
      u?.password_hash ||
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
    const hash = await bcrypt.hash(password, 12);
    await db.transaction(async (em) => {
      const [u] = await em.query(
        "SELECT * FROM app_user WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (!(await bcrypt.compare(current, u.password_hash)))
        fail("INVALID_CREDENTIALS", 401);
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
