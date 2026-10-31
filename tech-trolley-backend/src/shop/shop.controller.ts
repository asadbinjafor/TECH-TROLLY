import { Inject } from "@nestjs/common";
import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { decimal, shopSchema } from "@tech-trolley/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { db } from "../database/database";
import { fail } from "../common/errors";
import { documentsSql, documentView } from "../accounts/posting.service";
import { ReportsService } from "../reports/reports.service";
@Controller("shop")
@UseGuards(AuthGuard)
export class ShopController {
  constructor(
    @Inject(ReportsService) private readonly reports: ReportsService,
  ) {}
  @Get("state") async state(@Req() req: any) {
    return db.transaction("REPEATABLE READ", async (em) => {
      const [shop] = await em.query(
        "SELECT name,address,phone,opened_at,history_active,history_from,history_to,history_last_date,history_locked,history_version,history_finished_at FROM shop WHERE id=1",
      );
      const [{ now, today }] = await em.query(
        "SELECT now() AS now,to_char(now() AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS today",
      );
      const balances: Record<string, string> = {
        cash: "0.00",
        bank: "0.00",
        inventory: "0.00",
        receivable: "0.00",
        supplierReceivable: "0.00",
        payable: "0.00",
        loan: "0.00",
        advance: "0.00",
      };
      for (const row of await em.query(
        "SELECT account,sum(amount) AS amount FROM journal_line GROUP BY account",
      ))
        if (req.user.role === "OWNER" || Object.hasOwn(balances, row.account))
          balances[row.account] = decimal(
            row.account === "payable" ? -BigInt(row.amount) : row.amount,
          );
      const { sessionHash, ...user } = req.user;
      return {
        user,
        shop,
        now,
        today,
        balances,
        units: (
          await em.query(
            "SELECT * FROM inventory_unit ORDER BY internal_id DESC",
          )
        ).map(({ phone_type, ...u }: any) => ({
          ...u,
          phoneType: phone_type,
          cost: decimal(u.cost),
        })),
        documents: (
          await em.query(
            `${documentsSql} WHERE ($1::boolean OR d.business_date=$2::date) ORDER BY d.business_date DESC,d.created_at DESC,d.id`,
            [req.user.role === "OWNER", today],
          )
        ).map(documentView),
        parties: await em.query(
          "SELECT * FROM party WHERE NOT is_walk_in ORDER BY name,id",
        ),
        categories: await em.query(
          "SELECT * FROM expense_category ORDER BY en,id",
        ),
        staff: await em.query(
          "SELECT id,name,role FROM app_user WHERE role='STAFF' ORDER BY name",
        ),
        counts: await em.query(
          "SELECT c.*,d.created_at,d.actor_name,d.business_date FROM cash_count c JOIN document d ON d.id=c.document_id WHERE ($1::boolean OR d.business_date=$2::date) ORDER BY d.created_at DESC",
          [req.user.role === "OWNER", today],
        ),
        report: await this.reports.report(req.user, { period: "today" }, em),
      };
    });
  }
  @Patch() async update(@Body() body: unknown, @Req() req: any) {
    if (req.user.role !== "OWNER") fail("FORBIDDEN", 403);
    const v = shopSchema.parse(body);
    await db.transaction(async (em) => {
      await em.query("UPDATE shop SET name=$1,address=$2,phone=$3 WHERE id=1", [
        v.name,
        v.address,
        v.phone,
      ]);
      await em.query(
        "INSERT INTO audit_event(actor_id,action) VALUES($1,'shop_updated')",
        [req.user.id],
      );
    });
    return { ok: true };
  }
}
