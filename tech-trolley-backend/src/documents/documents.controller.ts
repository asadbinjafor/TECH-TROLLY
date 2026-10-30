import {
  Controller,
  Get,
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
  minor,
  invoiceShop,
  invoiceSellerName,
} from "@tech-trolley/contracts";
import { db } from "../database/database";
import { AuthGuard } from "../auth/auth.guard";
import { documentsSql, documentView } from "../accounts/posting.service";
import { fail } from "../common/errors";
import { InvoicePdfService } from "./invoice-pdf.service";
@Controller("documents")
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly pdfs: InvoicePdfService) {}
  @Get(":id/receipt") async receipt(
    @Param("id") id: string,
    @Query("lang") lang: string,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    const [raw] = await db.query(
      `${documentsSql} WHERE d.id=$1 AND d.kind='sale' AND ($2::boolean OR d.business_date=(now() AT TIME ZONE 'Asia/Dhaka')::date)`,
      [id, req.user.role === "OWNER"],
    );
    if (!raw) fail("NOT_FOUND", 404);
    const d = documentView(raw),
      s = d.snapshot;
    const [shop] = await db.query(
      "SELECT name,address,phone FROM shop WHERE id=1",
    );
    let sellerName = invoiceSellerName(d.actor_name);
    if (
      !sellerName ||
      /^(owner|staff|shop owner|shop staff|মালিক|স্টাফ|কর্মী)$/iu.test(
        sellerName,
      )
    ) {
      const [seller] = await db.query("SELECT name FROM app_user WHERE id=$1", [
        d.actor_id,
      ]);
      sellerName = invoiceSellerName(d.actor_name, seller?.name);
    }
    return {
      id: d.id,
      shop: s.invoiceShop || invoiceShop(shop),
      number: d.number,
      createdAt: d.created_at,
      date: d.business_date,
      reversed: !!d.reversed_by,
      customer: s.partyName || null,
      phone: s.partyPhone || null,
      address: s.partyAddress || null,
      seller: {
        id: d.actor_id,
        name: sellerName,
        nameMissing: !sellerName,
        role: ["OWNER", "STAFF"].includes(s.actorRole) ? s.actorRole : null,
      },
      unit: {
        model: s.model,
        brand: s.brand,
        variant: s.variant,
        storage: s.storage || "",
        color: s.color || "",
        imei: s.imei,
        internalId: s.internalId,
        battery: s.battery,
        box: s.box,
        condition: s.condition || null,
        category: s.category || null,
      },
      price: s.price,
      discount: s.discount,
      total: d.total,
      cash: s.cash,
      bank: s.bank,
      paid: decimal(minor(s.cash) + minor(s.bank)),
      originalDue:
        (BigInt(raw.original_due) / 100n).toString() +
        "." +
        String(BigInt(raw.original_due) % 100n).padStart(2, "0"),
      outstandingDue: d.due,
    };
  }

  @Get(":id/pdf") async pdf(
    @Param("id") id: string,
    @Query("lang") lang: string,
    @Query("download") download: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Reuse the authenticated/date-scoped read before consulting any PDF cache.
    const receipt = await this.receipt(id, lang, req);
    const bytes = await this.pdfs.render(receipt);
    const filename = receipt.number.replace(/[^A-Za-z0-9_-]/g, "_") + ".pdf";
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename="${filename}"`,
    );
    return res.type("application/pdf").send(bytes);
  }
}
