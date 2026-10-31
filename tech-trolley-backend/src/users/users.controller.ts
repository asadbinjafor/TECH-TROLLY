import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { userSchema, userUpdateSchema, z } from "@tech-trolley/contracts";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../database/database";
import { fail } from "../common/errors";
import { AuthGuard } from "../auth/auth.guard";
import { safeUser } from "../auth/auth.service";
import type { Response } from "express";
import { updateProfile, profileDetails } from "./profile";
import { sessionCookieOptions } from "../auth/cookies";
import { verifyCurrentPassword } from "../auth/password-check";
@Controller("users")
@UseGuards(AuthGuard)
export class UsersController {
  @Get() async list(@Req() req: any) {
    if (req.user.role !== "OWNER") fail("FORBIDDEN", 403);
    return (await db.query("SELECT * FROM app_user ORDER BY created_at")).map(
      safeUser,
    );
  }
  @Post() async create(@Body() body: unknown, @Req() req: any) {
    if (req.user.role !== "OWNER") fail("FORBIDDEN", 403);
    const v = userSchema.parse(body),
      id = randomUUID(),
      hash = await bcrypt.hash(v.password, 12);
    return db.transaction(async (em) => {
      await em.query("SELECT pg_advisory_xact_lock(74819322)");
      const [actor] = await em.query(
        "SELECT role,active FROM app_user WHERE id=$1",
        [req.user.id],
      );
      if (!actor?.active || actor.role !== "OWNER") fail("FORBIDDEN", 403);
      const [u] = await em.query(
        "INSERT INTO app_user(id,name,login,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          id,
          v.name,
          v.login,
          v.email?.trim().toLowerCase() || null,
          hash,
          v.role,
        ],
      );
      for (const value of new Set(
        [v.login, v.email?.trim().toLowerCase()].filter(Boolean),
      ))
        await em.query("INSERT INTO identity(value,user_id) VALUES($1,$2)", [
          value,
          id,
        ]);
      await em.query(
        "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'user_created',$2,$3)",
        [req.user.id, id, { role: v.role }],
      );
      return safeUser(u);
    });
  }
  @Patch(":id") async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user.role !== "OWNER") fail("FORBIDDEN", 403);
    z.uuid().parse(id);
    const v = userUpdateSchema.parse(body),
      hash = v.password ? await bcrypt.hash(v.password, 12) : null;
    const verifiedHash = await verifyCurrentPassword(
      req.user.id,
      v.currentPassword,
    );
    return db.transaction(async (em) => {
      await em.query("SELECT pg_advisory_xact_lock(74819322)");
      const [actor] = await em.query(
        "SELECT * FROM app_user WHERE id=$1 FOR UPDATE",
        [req.user.id],
      );
      if (!actor?.active || actor.role !== "OWNER") fail("FORBIDDEN", 403);
      const [u] = await em.query(
        "SELECT * FROM app_user WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!u) fail("NOT_FOUND", 404);
      const profile = await updateProfile(em, u, v, actor, verifiedHash);
      const [{ count }] = await em.query(
        "SELECT count(*) FROM app_user WHERE role='OWNER' AND active",
      );
      if (
        u.active &&
        u.role === "OWNER" &&
        Number(count) === 1 &&
        (v.role === "STAFF" || v.active === false)
      )
        fail("LAST_OWNER", 409);
      const [result] = await em.query(
        "WITH saved AS (UPDATE app_user SET role=$2,active=$3,password_hash=COALESCE($4,password_hash),must_change=CASE WHEN $4::text IS NULL THEN must_change ELSE false END WHERE id=$1 RETURNING *) SELECT * FROM saved",
        [id, v.role ?? u.role, v.active ?? u.active, hash],
      );
      const securityChanged =
        !!hash ||
        profile.identityChanged ||
        (v.role !== undefined && v.role !== u.role) ||
        (v.active !== undefined && v.active !== u.active);
      if (securityChanged)
        await em.query("DELETE FROM session WHERE user_id=$1", [id]);
      await em.query(
        "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'user_updated',$2,$3)",
        [
          req.user.id,
          id,
          {
            role: result.role,
            active: result.active,
            passwordReset: !!hash,
            ...(profile.changed
              ? {
                  profileBefore: profileDetails(u),
                  profileAfter: profileDetails(result),
                  identityChanged: profile.identityChanged,
                }
              : {}),
          },
        ],
      );
      const requiresLogin = req.user.id === id && securityChanged;
      if (requiresLogin) res.clearCookie("tt_session", sessionCookieOptions);
      return { ...safeUser(result), requiresLogin };
    });
  }
}
