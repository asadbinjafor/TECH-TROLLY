import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { InvoicePdfService } from "./invoice-pdf.service";
@Module({
  controllers: [DocumentsController],
  providers: [InvoicePdfService],
  exports: [InvoicePdfService],
})
export class DocumentsModule {}
