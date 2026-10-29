import { Global, Module } from "@nestjs/common";
import { PostingService } from "./posting.service";
import { CommandsController } from "./commands.controller";
@Global()
@Module({
  providers: [PostingService],
  controllers: [CommandsController],
  exports: [PostingService],
})
export class AccountsModule {}
