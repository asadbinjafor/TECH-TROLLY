import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { PurchasesController } from "./purchases.controller";
@Module({ imports: [DocumentsModule], controllers: [PurchasesController] })
export class PurchasesModule {}
