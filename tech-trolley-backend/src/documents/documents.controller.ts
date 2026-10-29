import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "@tech-trolley/contracts";
import { db } from "../database/database";
import { AuthGuard } from "../auth/auth.guard";
import { documentsSql, documentView } from "../accounts/posting.service";
import { fail } from "../common/errors";
@Controller("documents")
@UseGuards(AuthGuard)
export class DocumentsController {
  @Get(":id/receipt") async receipt(
    @Param("id") id: string,
    @Query("lang") lang: string,
  ) {
    z.uuid().parse(id);
    const [raw] = await db.query(
      `${documentsSql} WHERE d.id=$1 AND d.kind='sale'`,
      [id],
    );
    if (!raw) fail("NOT_FOUND", 404);
    const d = documentView(raw),
      s = d.snapshot;
    const [shop] = await db.query(
      "SELECT name,address,phone FROM shop WHERE id=1",
    );
    return {
      shop,
      number: d.number,
      createdAt: d.created_at,
      date: d.business_date,
      reversed: !!d.reversed_by,
      customer: s.partyName || null,
      phone: s.partyPhone || null,
      unit: {
        model: s.model,
        brand: s.brand,
        variant: s.variant,
        imei: s.imei,
        internalId: s.internalId,
        battery: s.battery,
        box: s.box,
      },
      price: s.price,
      discount: s.discount,
      total: d.total,
      cash: s.cash,
      bank: s.bank,
      originalDue:
        (BigInt(raw.original_due) / 100n).toString() +
        "." +
        String(BigInt(raw.original_due) % 100n).padStart(2, "0"),
      outstandingDue: d.due,
    };
  }
}
