import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { PurchasesController } from "./purchases.controller";
import { PurchaseImagesController } from "./purchase-images.controller";
@Module({
  imports: [DocumentsModule],
  controllers: [PurchasesController, PurchaseImagesController],
})
export class PurchasesModule {}
