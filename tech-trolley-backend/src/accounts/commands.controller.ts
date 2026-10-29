import { Inject } from "@nestjs/common";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import type { CommandKind } from "@tech-trolley/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { PostingService } from "./posting.service";
@ApiTags("Financial commands")
@Controller("commands")
@UseGuards(AuthGuard)
export class CommandsController {
  constructor(
    @Inject(PostingService) private readonly posting: PostingService,
  ) {}
  @Get("status/:key") status(@Param("key") key: string, @Req() req: any) {
    return this.posting.status(req.user, key);
  }
  @Post(":kind")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  execute(
    @Param("kind") kind: CommandKind,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string,
    @Req() req: any,
  ) {
    return this.posting.execute(kind, body, req.user, key);
  }
}
