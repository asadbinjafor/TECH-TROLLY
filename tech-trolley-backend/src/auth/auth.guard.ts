import { Inject } from "@nestjs/common";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { fail } from "../common/errors";
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = await this.auth.authenticate(req);
    if (
      req.user.must_change &&
      !["/auth/me", "/auth/password", "/auth/logout", "/auth/refresh"].includes(
        req.path,
      )
    )
      fail("PASSWORD_CHANGE_REQUIRED", 403);
    return true;
  }
}
