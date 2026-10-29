import { Inject } from "@nestjs/common";
import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { ReportsService, periodSchema } from "./reports.service";
import { t } from "@tech-trolley/i18n";
const csv = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
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
        t(key === "expense" ? "expenses" : key, lang),
        (r as any)[key],
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
