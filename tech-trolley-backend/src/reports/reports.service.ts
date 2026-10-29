import type { EntityManager } from "typeorm";
import { Injectable } from "@nestjs/common";
import { decimal, z, type User, type Report } from "@tech-trolley/contracts";
import { reportDetails } from "./report-details";
import { db } from "../database/database";
import { fail } from "../common/errors";
import { documentsSql, documentView } from "../accounts/posting.service";
export function shift(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const periodSchema = z
  .object({
    lang: z.enum(["bn", "en"]).default("en"),
    period: z.enum(["today", "week", "month", "range"]).default("today"),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();
@Injectable()
export class ReportsService {
  async report(
    user: User,
    input: unknown,
    em?: EntityManager,
  ): Promise<Report> {
    if (!em)
      return db.transaction("REPEATABLE READ", (tx) =>
        this.report(user, input, tx),
      );
    const v = periodSchema.parse(input);
    const [{ today }] = await em.query(
      "SELECT to_char(now() AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS today",
    );
    if (v.date && v.period !== "today") fail("VALIDATION_ERROR");
    if (v.period === "range" ? !v.from || !v.to : v.from || v.to)
      fail("VALIDATION_ERROR");
    const validDate = (d: string) =>
      Number.isFinite(new Date(`${d}T00:00:00Z`).valueOf()) &&
      new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d &&
      d <= today;
    const to = v.period === "range" ? v.to! : v.date || today;
    const from =
      v.period === "range"
        ? v.from!
        : v.period === "week"
          ? shift(today, -6)
          : v.period === "month"
            ? today.slice(0, 8) + "01"
            : to;
    if (!validDate(from) || !validDate(to) || from > to)
      fail("VALIDATION_ERROR");
    if (
      user.role !== "OWNER" &&
      (v.period !== "today" || from !== today || to !== today)
    )
      fail("STAFF_TODAY_ONLY", 403);
    const [shop] = await em.query("SELECT opening_date FROM shop WHERE id=1");
    const sums = await em.query(
      `SELECT l.account,COALESCE(sum(l.amount) FILTER(WHERE d.business_date<$1::date OR (d.business_date BETWEEN $1::date AND $2::date AND d.kind='opening')),0) AS opening,COALESCE(sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date),0) AS activity,COALESCE(sum(l.amount) FILTER(WHERE d.business_date<=$2::date),0) AS closing,COALESCE(sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date AND l.amount>0 AND d.kind<>'opening'),0) AS inflow,COALESCE(-sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date AND l.amount<0 AND d.kind<>'opening'),0) AS outflow FROM journal_line l JOIN document d ON d.id=l.document_id GROUP BY l.account`,
      [from, to],
    );
    const get = (a: string, k: string) =>
        BigInt(sums.find((s: any) => s.account === a)?.[k] || 0),
      revenue = -get("revenue", "activity"),
      cogs = get("cogs", "activity"),
      expense = get("expense", "activity");
    const documents = (
      await em.query(
        `${documentsSql} WHERE d.business_date BETWEEN $1 AND $2 ORDER BY d.created_at DESC,d.id`,
        [from, to],
      )
    ).map(documentView);
    // Net cash+bank per document removes transfers. Grouping also handles linked reversals.
    const [external] = await em.query(
      `SELECT COALESCE(sum(n) FILTER(WHERE n>0),0) AS inflow,COALESCE(-sum(n) FILTER(WHERE n<0),0) AS outflow FROM (SELECT sum(l.amount) AS n FROM journal_line l JOIN document d ON d.id=l.document_id WHERE l.account IN ('cash','bank') AND d.business_date BETWEEN $1 AND $2 AND d.kind<>'opening' GROUP BY d.id) x`,
      [from, to],
    );
    const openingDate = shop.opening_date
      ? String(
          shop.opening_date instanceof Date
            ? shop.opening_date.toISOString()
            : shop.opening_date,
        ).slice(0, 10)
      : null;
    const details = reportDetails(
      await em.query(
        `SELECT d.id,d.number,d.kind,d.actor_name,to_char(d.business_date,'YYYY-MM-DD') AS date,d.snapshot->>'note' AS note,
      COALESCE(o.kind,d.kind) AS source_kind,COALESCE(o.number,d.number) AS source_number,COALESCE(o.snapshot,d.snapshot) AS source_snapshot,COALESCE(o.total,d.total) AS source_total,
      COALESCE(sum(l.amount) FILTER(WHERE l.account='revenue'),0) AS revenue,
      COALESCE(sum(l.amount) FILTER(WHERE l.account='cogs'),0) AS cogs,
      COALESCE(sum(l.amount) FILTER(WHERE l.account='expense'),0) AS expense,
      COALESCE(sum(l.amount) FILTER(WHERE l.account='cash'),0) AS cash,
      COALESCE(sum(l.amount) FILTER(WHERE l.account='bank'),0) AS bank
      FROM document d LEFT JOIN document o ON o.id=d.reversal_of LEFT JOIN journal_line l ON l.document_id=d.id
      WHERE d.business_date BETWEEN $1::date AND $2::date
      GROUP BY d.id,o.id ORDER BY d.created_at,d.id`,
        [from, to],
      ),
      get("cash", "opening"),
      get("bank", "opening"),
    );
    return {
      ...details,
      from,
      to,
      available: !!openingDate && to >= openingDate,
      revenue: decimal(revenue),
      cogs: decimal(cogs),
      expense: decimal(expense),
      grossProfit: decimal(revenue - cogs),
      netProfit: decimal(revenue - cogs - expense),
      openingCash: decimal(get("cash", "opening")),
      openingBank: decimal(get("bank", "opening")),
      closingCash: decimal(get("cash", "closing")),
      closingBank: decimal(get("bank", "closing")),
      cashIn: decimal(get("cash", "inflow")),
      cashOut: decimal(get("cash", "outflow")),
      bankIn: decimal(get("bank", "inflow")),
      bankOut: decimal(get("bank", "outflow")),
      externalIn: decimal(external.inflow),
      externalOut: decimal(external.outflow),
      documents,
    };
  }
}
