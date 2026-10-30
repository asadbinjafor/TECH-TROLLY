import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  z,
  decimal,
  individualSellerSchema,
  type PurchaseDeclaration,
} from "@tech-trolley/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { db } from "../database/database";
import { documentsSql, documentView } from "../accounts/posting.service";
import { fail } from "../common/errors";
import { InvoicePdfService } from "../documents/invoice-pdf.service";

@Controller("purchases")
@UseGuards(AuthGuard)
export class PurchasesController {
  constructor(
    @Inject(InvoicePdfService) private readonly pdfs: InvoicePdfService,
  ) {}
  @Get("sellers/:id") async seller(@Param("id") id: string, @Req() req: any) {
    z.uuid().parse(id);
    const [profile] = await db.query(
      `SELECT p.details FROM individual_seller_profile p JOIN party c ON c.id=p.party_id WHERE p.party_id=$1 AND c.active AND c.kind='supplier' AND ($2::boolean OR (p.updated_at AT TIME ZONE 'Asia/Dhaka')::date=(now() AT TIME ZONE 'Asia/Dhaka')::date)`,
      [id, req.user.role === "OWNER"],
    );
    return {
      seller: profile ? individualSellerSchema.parse(profile.details) : null,
    };
  }
  @Get(":id/declaration") async declaration(
    @Param("id") id: string,
    @Req() req: any,
  ): Promise<PurchaseDeclaration> {
    z.uuid().parse(id);
    const [raw] = await db.query(
      `${documentsSql} WHERE d.id=$1 AND d.kind='purchase' AND ($2::boolean OR d.business_date=(now() AT TIME ZONE 'Asia/Dhaka')::date)`,
      [id, req.user.role === "OWNER"],
    );
    if (!raw) fail("NOT_FOUND", 404);
    const [privateData] = await db.query(
      "SELECT seller,terms,buyer_role FROM purchase_declaration WHERE document_id=$1",
      [id],
    );
    if (!privateData) fail("NOT_FOUND", 404);
    const d = documentView(raw),
      s = d.snapshot;
    return {
      id: d.id,
      number: d.number,
      date: d.business_date,
      reversed: !!d.reversed_by,
      buyer: { name: d.actor_name, role: privateData.buyer_role },
      seller: individualSellerSchema.parse(privateData.seller),
      unit: {
        phoneType: s.phoneType || undefined,
        ram: s.ram || undefined,
        brand: s.brand,
        model: s.model,
        storage: s.storage || "",
        color: s.color || "",
        variant: s.variant || "",
        imei: s.imei,
        condition: s.condition,
        battery: s.battery,
        box: s.box,
        accessories: s.accessories || "",
      },
      total: d.total,
      cash: s.cash,
      bank: s.bank,
      originalDue: decimal(raw.original_due),
      terms: privateData.terms,
    };
  }
  @Get(":id/pdf") async pdf(
    @Param("id") id: string,
    @Query("download") download: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Always reauthorize before the shared, bounded PDF cache.
    const declaration = await this.declaration(id, req);
    const bytes = await this.pdfs.renderPurchase(declaration);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename="${declaration.number.replace(/[^A-Za-z0-9_-]/g, "_")}-purchase.pdf"`,
    );
    return res.type("application/pdf").send(bytes);
  }
}
