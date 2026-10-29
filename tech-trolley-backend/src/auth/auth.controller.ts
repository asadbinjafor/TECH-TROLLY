import { Inject } from "@nestjs/common";
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { loginSchema, passwordSchema } from "@tech-trolley/contracts";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { db } from "../database/database";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 7 * 86400000,
};
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("login")
  @ApiBody({
    schema: {
      type: "object",
      required: ["identity", "password"],
      properties: {
        identity: { type: "string" },
        password: { type: "string", format: "password" },
      },
    },
  })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = loginSchema.parse(body),
      result = await this.auth.login(
        v.identity,
        v.password,
        req.ip || "unknown",
      );
    if (req.headers["x-native-client"] === "1") return result;
    res.cookie("tt_session", result.token, cookieOptions);
    return { user: result.user };
  }
  @Get("me") @UseGuards(AuthGuard) me(@Req() req: any) {
    const { sessionHash, ...user } = req.user;
    return user;
  }
  @Post("password") @UseGuards(AuthGuard) async password(
    @Body() body: unknown,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = passwordSchema.parse(body);
    const result = await this.auth.change(
      req.user,
      v.currentPassword,
      v.password,
    );
    res.clearCookie("tt_session", cookieOptions);
    return result;
  }
  @Post("refresh") @UseGuards(AuthGuard) async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.refresh(req.user.sessionHash);
    if (req.headers["x-native-client"] === "1") return { token };
    res.cookie("tt_session", token, cookieOptions);
    return { ok: true };
  }
  @Post("logout") @UseGuards(AuthGuard) async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await db.query("DELETE FROM session WHERE token_hash=$1", [
      req.user.sessionHash,
    ]);
    res.clearCookie("tt_session", cookieOptions);
    return { ok: true };
  }
}
