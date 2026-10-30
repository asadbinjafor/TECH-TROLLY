import { Inject } from "@nestjs/common";
import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { ReportsService, periodSchema } from "./reports.service";
import { t } from "@tech-trolley/i18n";
const csv = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d{1,2})?$/.test(s))
    s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}
  @Get() report(@Req() req: any, @Query() query: unknown) {
    return this.reports.report(req.user, query);
  }
  @Get("export") async export(
    @Req() req: any,
    @Query() query: unknown,
    @Res() res: Response,
  ) {
    const r = await this.reports.report(req.user, query);
    const { lang } = periodSchema.parse(query);
    const rows = [
      ["Tech Trolley", r.from, r.to],
      [
        t("number", lang),
        t("kind", lang),
        t("date", lang),
        t("actor", lang),
        t("total", lang) + " BDT",
        t("due", lang) + " BDT",
        t("details", lang),
      ],
      ...r.documents.map((d: any) => [
        d.number,
        t(d.kind, lang),
        d.business_date,
        d.actor_name,
        d.total,
        d.due,
        d.snapshot.note,
      ]),
      [],
      ...[
        "revenue",
        "cogs",
        "grossProfit",
        "expense",
        "netProfit",
        "purchases",
        "purchaseReturns",
        "closingSupplierRefund",
        "openingCash",
        "closingCash",
        "openingBank",
        "closingBank",
        "cashIn",
        "cashOut",
        "bankIn",
        "bankOut",
        "externalIn",
        "externalOut",
      ].map((key) => [
        t(
          key === "expense"
            ? "expenses"
            : key === "purchases"
              ? "purchasesTotal"
              : key,
          lang,
        ),
        (r as any)[key],
      ]),
      [],
      [t("productProfit", lang)],
      ["model", "quantity", "purchaseCost", "sales", "grossProfit"].map((k) =>
        t(k, lang),
      ),
      ...r.productProfit.map((p) => [
        [p.brand, p.model].join(" "),
        p.quantity,
        p.purchaseCost,
        p.sales,
        p.grossProfit,
      ]),
      [],
      [t("profitStatement", lang)],
      [
        "date",
        "number",
        "sourceNumber",
        "brand",
        "model",
        "storage",
        "color",
        "variant",
        "imei",
        "actor",
        "quantity",
        "purchaseCost",
        "sales",
        "grossProfit",
      ].map((k) => t(k, lang)),
      ...r.profitStatement.map((p) => [
        p.date,
        p.number,
        p.sourceNumber,
        p.brand,
        p.model,
        p.storage,
        p.color,
        p.variant,
        "'" + p.serial,
        p.actor,
        p.quantity,
        p.purchaseCost,
        p.sales,
        p.grossProfit,
      ]),
      [],
      [t("expenseBreakdown", lang)],
      [t("categoryId", lang), t("amount", lang) + " BDT"],
      ...r.expenseBreakdown.map((e) => [e[lang], e.amount]),
      [],
      [t("expenseStatement", lang)],
      [
        "date",
        "number",
        "sourceNumber",
        "categoryId",
        "expenseDetails",
        "actor",
        "amount",
      ].map((k) => t(k, lang)),
      ...r.expenseStatement.map((e) => [
        e.date,
        e.number,
        e.sourceNumber,
        e[lang],
        e.note,
        e.actor,
        e.amount,
      ]),
      [],
      [t("moneyStatement", lang)],
      [
        "date",
        "number",
        "kind",
        "actor",
        "note",
        "cashIn",
        "cashOut",
        "closingCash",
        "bankIn",
        "bankOut",
        "closingBank",
      ].map((k) => t(k, lang)),
      ...r.moneyStatement.map((e) => [
        e.date,
        e.number,
        t(e.kind, lang),
        e.actor,
        e.note,
        e.cashIn,
        e.cashOut,
        e.cashBalance,
        e.bankIn,
        e.bankOut,
        e.bankBalance,
      ]),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tech-trolley-${r.from}-${r.to}.csv"`,
    );
    res.send("\uFEFF" + rows.map((row) => row.map(csv).join(",")).join("\r\n"));
  }
}
