import { Module } from "@nestjs/common";
import { PartiesController } from "./parties.controller";
@Module({ controllers: [PartiesController] })
export class PartiesModule {}
