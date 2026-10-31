import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import {
  commands,
  minor,
  decimal,
  z,
  invoiceShop,
  individualSellerSchema,
  individualSellerKeys,
  purchaseDeclarationTerms,
  isHistoryControl,
  isOpeningKind,
  dueKind,
  type CommandKind,
  type User,
} from "@tech-trolley/contracts";
import { db } from "../database/database";
import { fail } from "../common/errors";
type Tx = EntityManager;
const positive = (n: bigint) => {
  if (n <= 0n) fail("POSITIVE_REQUIRED");
  return n;
};
export const documentsSql = `SELECT d.*,r.id AS reversed_by,CASE WHEN r.id IS NOT NULL THEN 0 ELSE d.original_due-COALESCE((SELECT sum(a.amount) FROM allocation a WHERE a.target_id=d.id),0) END AS due FROM document d LEFT JOIN document r ON r.reversal_of=d.id`;
export const documentView = (d: any) => ({
  ...d,
  total: decimal(d.total),
  due: decimal(d.due),
  original_due: undefined,
  business_date:
    typeof d.business_date === "string"
      ? d.business_date.slice(0, 10)
      : d.business_date.toISOString().slice(0, 10),
});
@Injectable()
export class PostingService {
  async status(user: User, key: string) {
    z.uuid().parse(key);
    const [r] = await db.query(
      "SELECT result FROM command_result WHERE actor_id=$1 AND key=$2",
      [user.id, key],
    );
    return r ? { found: true, result: r.result } : { found: false };
  }
  async execute(kind: CommandKind, input: unknown, user: User, key: string) {
    if (!Object.hasOwn(commands, kind)) fail("NOT_FOUND", 404);
    z.uuid().parse(key);
    const data = commands[kind].parse(input) as any;
    const hash = createHash("sha256")
      .update(JSON.stringify({ kind, data }))
      .digest("hex");
    for (let attempt = 0; attempt < 3; attempt++)
      try {
        return await db.transaction(async (tx) => {
          const [shop] = await tx.query(
            "SELECT * FROM shop WHERE id=1 FOR UPDATE",
          );
          const [actor] = await tx.query(
            "SELECT * FROM app_user WHERE id=$1 FOR SHARE",
            [user.id],
          );
          if (!actor?.active) fail("SESSION_EXPIRED", 401);
          if (actor.must_change) fail("PASSWORD_CHANGE_REQUIRED", 403);
          const [old] = await tx.query(
            "SELECT * FROM command_result WHERE actor_id=$1 AND key=$2",
            [user.id, key],
          );
          if (old) {
            if (old.request_hash !== hash) fail("IDEMPOTENCY_CONFLICT", 409);
            return old.result;
          }
          if (kind === "opening" || kind === "historyStart") {
            if (actor.role !== "OWNER") fail("FORBIDDEN", 403);
            if (shop.opened_at) fail("ALREADY_OPENED", 409);
            if (
              kind === "historyStart" &&
              (await tx.query("SELECT 1 FROM document LIMIT 1")).length
            )
              fail("ALREADY_OPENED", 409);
          } else if (!shop.opened_at) fail("OPENING_REQUIRED", 409);
          const [{ instant, date: today }] = await tx.query(
            `WITH stamp AS MATERIALIZED(SELECT clock_timestamp() AS instant) SELECT instant,to_char(instant AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS date FROM stamp`,
          );
          const baseline = shop.history_active && !shop.history_locked;
          const control = isHistoryControl(kind);
          let date = today;
          if (kind === "historyStart") {
            if (data.startDate > data.endDate || data.endDate > today)
              fail("HISTORY_DATE_INVALID");
            date = data.startDate;
          } else if (control) {
            if (actor.role !== "OWNER") fail("FORBIDDEN", 403);
            if (!shop.history_active) fail("HISTORY_NOT_ACTIVE", 409);
            if (
              [
                "openingStock",
                "openingDue",
                "openingAdjustment",
                "historyLock",
              ].includes(kind) &&
              !baseline
            )
              fail("HISTORY_OPENING_LOCKED", 409);
            if (kind === "historyFinish" && !shop.history_locked)
              fail("HISTORY_LOCK_REQUIRED", 409);
            date =
              kind === "historyFinish" ? shop.history_to : shop.history_from;
          } else if (shop.history_active) {
            if (actor.role !== "OWNER") fail("HISTORY_OWNER_ONLY", 403);
            // Before confirming opening, only audited metadata corrections or
            // reversal of an opening stock/due entry may be posted.
            if (baseline) {
              if (!["stockEdit", "reversal"].includes(kind))
                fail("HISTORY_LOCK_REQUIRED", 409);
              date = shop.history_from;
            } else {
              if (
                !data.businessDate ||
                data.businessDate < shop.history_last_date ||
                data.businessDate > shop.history_to ||
                data.businessDate > today
              )
                fail("HISTORY_DATE_INVALID");
              date = data.businessDate;
            }
          } else if (data.businessDate !== undefined)
            fail("HISTORY_NOT_ACTIVE", 409);
          const id = randomUUID(),
            [{ seq }] = await tx.query(
              "SELECT nextval('document_number') AS seq",
            ),
            number = `TT-${String(seq).padStart(6, "0")}`;
          let total = 0n,
            due = 0n,
            partyId: string | null = null,
            unitId: string | null = null,
            reversalOf: string | null = null;
          const individual = kind === "individualPurchase";
          const openingStock = kind === "openingStock";
          const isPurchase = kind === "purchase" || individual || openingStock;
          const documentKind =
            kind === "historyStart"
              ? "opening"
              : individual
                ? "purchase"
                : kind;
          // Do not spread NID/nominee/parent/address fields into public state.
          let snapshot: any = Object.fromEntries(
              Object.entries(data).filter(
                ([key]) =>
                  !individual || !individualSellerKeys.includes(key as any),
              ),
            ),
            entries: Record<string, bigint> = {};
          let previousUnitId: string | null = null;
          const line = (account: string, n: bigint) => {
            entries[account] = (entries[account] || 0n) + n;
          };
          const amount = () => positive(minor(data.amount));
          const party = async (pid: string, kind: string) => {
            const [p] = await tx.query(
              "SELECT * FROM party WHERE id=$1 AND kind=$2 AND active AND NOT is_walk_in",
              [pid, kind],
            );
            if (!p) fail("NOT_FOUND", 404);
            snapshot.partyName = p.name;
            snapshot.partyPhone = p.phone;
            snapshot.partyAddress = p.address;
            return p;
          };
          const staff = async () => {
            const [s] = await tx.query(
              "SELECT id,name FROM app_user WHERE id=$1 AND role='STAFF'",
              [data.staffId],
            );
            if (!s) fail("NOT_FOUND", 404);
            snapshot.staffName = s.name;
          };
          const allocations: { target: string; amount: bigint }[] = [];
          if (kind === "historyLock" || kind === "historyFinish") {
            if (data.setupVersion !== shop.history_version)
              fail("HISTORY_CHANGED", 409);
            const balances = await tx.query(
              "SELECT account,sum(amount) AS amount FROM journal_line GROUP BY account",
            );
            snapshot.balances = Object.fromEntries(
              balances.map((r: any) => [
                r.account,
                decimal(r.account === "payable" ? -BigInt(r.amount) : r.amount),
              ]),
            );
            snapshot.from = shop.history_from;
            snapshot.to = shop.history_to;
            snapshot.lastDate = shop.history_last_date;
            if (kind === "historyFinish") {
              if (
                minor(data.cash) !== minor(snapshot.balances.cash || "0") ||
                minor(data.bank) !== minor(snapshot.balances.bank || "0")
              )
                fail("HISTORY_BALANCE_MISMATCH", 409);
              await tx.query(
                "UPDATE shop SET history_active=false,history_finished_at=$1,history_last_date=history_to WHERE id=1",
                [instant],
              );
            } else
              await tx.query("UPDATE shop SET history_locked=true WHERE id=1");
          } else if (kind === "opening" || kind === "historyStart") {
            const cash = minor(data.cash),
              bank = minor(data.bank);
            total = cash + bank;
            line("cash", cash);
            line("bank", bank);
            line("equity", -total);
            await tx.query(
              "UPDATE shop SET opened_at=$1,opening_date=$2 WHERE id=1",
              [instant, date],
            );
            if (kind === "historyStart") {
              snapshot.historical = true;
              await tx.query(
                "UPDATE shop SET history_active=true,history_from=$1,history_to=$2,history_last_date=$1 WHERE id=1",
                [data.startDate, data.endDate],
              );
            }
          } else if (kind === "openingAdjustment") {
            const balances = await tx.query(
              "SELECT account,sum(amount) AS amount FROM journal_line WHERE account IN ('cash','bank') GROUP BY account",
            );
            const cash =
              minor(data.cash) -
              BigInt(
                balances.find((r: any) => r.account === "cash")?.amount || 0,
              );
            const bank =
              minor(data.bank) -
              BigInt(
                balances.find((r: any) => r.account === "bank")?.amount || 0,
              );
            line("cash", cash);
            line("bank", bank);
            line("equity", -cash - bank);
            snapshot.before = Object.fromEntries(
              balances.map((r: any) => [r.account, decimal(r.amount)]),
            );
            total = minor(data.cash) + minor(data.bank);
          } else if (kind === "openingDue") {
            if (data.dueType === "advance") {
              const [target] = await tx.query(
                "SELECT id,name FROM app_user WHERE id=$1 AND role='STAFF' AND active",
                [data.partyId],
              );
              if (!target) fail("NOT_FOUND", 404);
              snapshot.staffId = target.id;
              snapshot.staffName = target.name;
            } else {
              await party(
                data.partyId,
                data.dueType === "refund" ? "supplier" : data.dueType,
              );
              partyId = data.partyId;
            }
            total = amount();
            due = total;
            const payable = data.dueType === "supplier";
            line(
              payable
                ? "payable"
                : data.dueType === "customer"
                  ? "receivable"
                  : data.dueType === "refund"
                    ? "supplierReceivable"
                    : data.dueType === "advance"
                      ? "advance"
                      : "loan",
              payable ? -total : total,
            );
            line("equity", payable ? total : -total);
          } else if (kind === "stockEdit" || kind === "purchaseReturn") {
            const [unit] = await tx.query(
              "SELECT * FROM inventory_unit WHERE id=$1 FOR UPDATE",
              [data.unitId],
            );
            if (!unit) fail("NOT_FOUND", 404);
            const [purchase] = await tx.query(`${documentsSql} WHERE d.id=$1`, [
              unit.purchase_id,
            ]);
            if (documentView(purchase).business_date > date)
              fail("HISTORY_DATE_INVALID");
            if (
              kind === "purchaseReturn" &&
              purchase.kind === "openingStock" &&
              !purchase.party_id
            )
              fail("OPENING_STOCK_RETURN", 409);
            if (
              actor.role === "STAFF" &&
              documentView(purchase).business_date !== date
            )
              fail("STAFF_TODAY_ONLY", 403);
            if (unit.status !== "IN_STOCK") fail("STOCK_CONFLICT", 409);
            if (unit.revision !== data.revision) fail("STOCK_CHANGED", 409);
            unitId = unit.id;
            partyId = purchase.party_id;
            const metadataKeys = [
              "model",
              "brand",
              "storage",
              "color",
              "variant",
              "category",
              "condition",
              "imei",
              "battery",
              "box",
            ];
            const before = Object.fromEntries(
              metadataKeys.map((k) => [k, unit[k]]),
            );
            Object.assign(before, {
              phoneType: unit.phone_type,
              ram: unit.ram,
            });
            snapshot.purchaseId = purchase.id;
            snapshot.originalNumber = purchase.number;
            snapshot.partyName = purchase.snapshot.partyName;
            if (kind === "stockEdit") {
              if (
                data.imei &&
                (
                  await tx.query(
                    "SELECT 1 FROM inventory_unit WHERE imei=$1 AND status='IN_STOCK' AND id<>$2",
                    [data.imei, unit.id],
                  )
                ).length
              )
                fail("IMEI_IN_STOCK", 409);
              snapshot.before = before;
              snapshot.after = Object.fromEntries(
                metadataKeys.map((k) => [k, data[k]]),
              );
              const specs = {
                phoneType:
                  data.category === "accessory"
                    ? null
                    : Object.hasOwn(data, "phoneType")
                      ? data.phoneType
                      : unit.phone_type,
                ram:
                  data.category === "accessory"
                    ? null
                    : Object.hasOwn(data, "ram")
                      ? data.ram
                      : unit.ram,
              };
              commands.stockEdit.parse({ ...data, ...specs });
              Object.assign(snapshot.after, specs);
              await tx.query(
                `UPDATE inventory_unit SET model=$2,brand=$3,storage=$4,color=$5,variant=$6,category=$7,condition=$8,imei=$9,battery=$10,box=$11,phone_type=$12,ram=$13,revision=revision+1 WHERE id=$1`,
                [
                  unit.id,
                  ...metadataKeys.map((k) => data[k]),
                  specs.phoneType,
                  specs.ram,
                ],
              );
            } else {
              const credit = minor(data.returnValue);
              if (credit > BigInt(purchase.total)) fail("RETURN_VALUE_INVALID");
              const payable = BigInt(purchase.due);
              const offset = credit < payable ? credit : payable;
              total = credit;
              due = credit - offset;
              snapshot = {
                ...snapshot,
                ...before,
                internalId: unit.internal_id,
                purchaseAmount: decimal(purchase.total),
                acquisitionCost: decimal(unit.cost),
                returnOffset: decimal(offset),
                refundDue: decimal(due),
                returnLoss: decimal(BigInt(unit.cost) - credit),
              };
              snapshot.paymentIds = (
                await tx.query(
                  "SELECT a.document_id FROM allocation a JOIN document d ON d.id=a.document_id WHERE a.target_id=$1 AND a.amount>0 AND d.kind='supplierPayment'",
                  [purchase.id],
                )
              ).map((r: any) => r.document_id);
              line("inventory", -BigInt(unit.cost));
              line("payable", offset);
              line("supplierReceivable", due);
              line("expense", BigInt(unit.cost) - credit);
              if (offset > 0n)
                allocations.push({ target: purchase.id, amount: offset });
            }
          } else if (isPurchase) {
            partyId = data.supplierId || null;
            if (individual && !partyId) {
              // Direct seller entry must create/link its payable atomically with
              // stock, the private declaration and the persisted command result.
              // Never merge people on a name/phone alone or pick an ambiguous match.
              const matches = await tx.query(
                `SELECT p.id FROM party p JOIN individual_seller_profile s ON s.party_id=p.id
                 WHERE p.kind='supplier' AND p.active AND NOT p.is_walk_in
                   AND s.details->>'identityNumber'=$1 AND s.details->>'sellerName'=$2
                   AND s.details->>'sellerPhone'=$3 LIMIT 2`,
                [data.identityNumber, data.sellerName, data.sellerPhone],
              );
              partyId = matches.length === 1 ? matches[0].id : randomUUID();
              if (matches.length !== 1) {
                await tx.query(
                  "INSERT INTO party(id,name,phone,address,kind) VALUES($1,$2,$3,'','supplier')",
                  [partyId, data.sellerName, data.sellerPhone],
                );
                await tx.query(
                  "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'individual_supplier_created',$2,$3)",
                  [actor.id, partyId, { source: "individualPurchase" }],
                );
              }
              snapshot.supplierId = partyId;
            }
            if (partyId) await party(partyId, "supplier");
            if (data.imei) {
              if (
                (
                  await tx.query(
                    "SELECT 1 FROM inventory_unit WHERE imei=$1 AND status='IN_STOCK'",
                    [data.imei],
                  )
                ).length
              )
                fail("IMEI_IN_STOCK", 409);
              const [previous] = await tx.query(
                "SELECT u.id FROM inventory_unit u JOIN document p ON p.id=u.purchase_id WHERE u.imei=$1 AND u.status<>'REVERSED' ORDER BY p.created_at DESC,p.id DESC LIMIT 1",
                [data.imei],
              );
              previousUnitId = previous?.id || null;
              if (previousUnitId) snapshot.previousUnitId = previousUnitId;
            }
            const cost = positive(minor(data.cost)),
              courier =
                individual || openingStock ? 0n : minor(data.procurement),
              paid = openingStock
                ? cost - minor(data.supplierDue)
                : individual
                  ? minor(data.cash) + minor(data.bank)
                  : minor(data.paid);
            if (paid > cost) fail("PAYMENT_INVALID");
            total = cost;
            due = cost - paid;
            unitId = randomUUID();
            snapshot.unitId = unitId;
            snapshot.acquisitionCost = decimal(
              cost + (data.treatment === "capitalize" ? courier : 0n),
            );
            line(
              "inventory",
              cost + (data.treatment === "capitalize" ? courier : 0n),
            );
            if (data.treatment === "expense") line("expense", courier);
            if (individual) {
              snapshot.purchaseSource = "individual";
              snapshot.partyName = data.sellerName;
              snapshot.partyPhone = data.sellerPhone;
              snapshot.paid = decimal(paid);
              snapshot.actorRole = actor.role;
              line("cash", -minor(data.cash));
              line("bank", -minor(data.bank));
            } else if (openingStock) line("equity", -paid);
            else line(data.account, -paid - courier);
            line("payable", -due);
          } else if (kind === "sale") {
            const [u] = await tx.query(
              "SELECT * FROM inventory_unit WHERE id=$1 FOR UPDATE",
              [data.unitId],
            );
            if (!u) fail("NOT_FOUND", 404);
            if (u.status !== "IN_STOCK") fail("STOCK_CONFLICT", 409);
            const [source] = await tx.query(
              "SELECT to_char(business_date,'YYYY-MM-DD') AS date FROM document WHERE id=$1",
              [u.purchase_id],
            );
            if (source.date > date) fail("HISTORY_DATE_INVALID");
            unitId = u.id;
            const price = positive(minor(data.price)),
              discount = minor(data.discount),
              cash = minor(data.cash),
              bank = minor(data.bank);
            total = price - discount;
            if (total <= 0n || cash + bank > total) fail("PAYMENT_INVALID");
            due = total - cash - bank;
            if (due > 0n && !data.customerId) fail("CUSTOMER_REQUIRED");
            if (data.customerId) {
              await party(data.customerId, "customer");
              partyId = data.customerId;
            } else {
              const [walkIn] = await tx.query(
                `INSERT INTO party(id,name,phone,kind,is_walk_in) VALUES($1,'Walk-in','','customer',true) ON CONFLICT(is_walk_in) WHERE is_walk_in DO UPDATE SET is_walk_in=true RETURNING id`,
                [randomUUID()],
              );
              partyId = walkIn.id;
              snapshot.partyName = null;
            }
            snapshot = {
              ...snapshot,
              partyName: data.customerName || snapshot.partyName || null,
              partyPhone: data.customerPhone || snapshot.partyPhone || null,
              partyAddress:
                data.customerAddress || snapshot.partyAddress || null,
              actorRole: actor.role,
              invoiceShop: invoiceShop(shop),
              model: u.model,
              phoneType: u.phone_type,
              ram: u.ram,
              brand: u.brand,
              variant: u.variant,
              storage: u.storage,
              color: u.color,
              imei: u.imei,
              internalId: u.internal_id,
              battery: u.battery,
              box: u.box,
              condition: u.condition,
              category: u.category,
              cogs: decimal(u.cost),
            };
            line("cash", cash);
            line("bank", bank);
            line("receivable", due);
            line("revenue", -total);
            line("cogs", BigInt(u.cost));
            line("inventory", -BigInt(u.cost));
          } else if (
            [
              "collection",
              "supplierPayment",
              "supplierRefund",
              "loanRepayment",
              "advanceRepayment",
            ].includes(kind)
          ) {
            const expected = (
              {
                collection: "sale",
                supplierPayment: "purchase",
                supplierRefund: "purchaseReturn",
                loanRepayment: "loan",
                advanceRepayment: "advance",
              } as Record<string, string>
            )[kind];
            const [target] = await tx.query(`${documentsSql} WHERE d.id=$1`, [
              data.documentId,
            ]);
            if (!target || dueKind(target) !== expected) fail("NOT_FOUND", 404);
            if (documentView(target).business_date > date)
              fail("HISTORY_DATE_INVALID");
            if (
              actor.role === "STAFF" &&
              documentView(target).business_date !== date
            )
              fail("STAFF_TODAY_ONLY", 403);
            total = amount();
            if (target.reversed_by || total > BigInt(target.due))
              fail("DUE_EXCEEDED", 409);
            partyId = target.party_id;
            snapshot.originalNumber = target.number;
            snapshot.partyName =
              target.snapshot.partyName || target.snapshot.staffName;
            const isOut = kind === "supplierPayment";
            line(data.account, isOut ? -total : total);
            line(
              (
                {
                  collection: "receivable",
                  supplierPayment: "payable",
                  supplierRefund: "supplierReceivable",
                  loanRepayment: "loan",
                  advanceRepayment: "advance",
                } as any
              )[kind],
              isOut ? total : -total,
            );
            allocations.push({ target: target.id, amount: total });
          } else if (kind === "expense") {
            const [category] =
              data.categoryId === "custom"
                ? [{ bn: data.expenseName, en: data.expenseName }]
                : await tx.query(
                    "SELECT * FROM expense_category WHERE id=$1 AND active",
                    [data.categoryId],
                  );
            if (!category) fail("CATEGORY_INACTIVE");
            snapshot.categoryLabels = { bn: category.bn, en: category.en };
            total = amount();
            line("expense", total);
            line(data.account, -total);
          } else if (kind === "transfer") {
            total = amount();
            line(data.from, -total);
            line(data.from === "cash" ? "bank" : "cash", total);
          } else if (kind === "contribution") {
            total = amount();
            line(data.account, total);
            line("equity", -total);
          } else if (kind === "withdrawal") {
            total = amount();
            line(data.account, -total);
            line("drawing", total);
          } else if (kind === "loan") {
            await party(data.partyId, "person");
            partyId = data.partyId;
            total = amount();
            due = total;
            line("loan", total);
            line(data.account, -total);
          } else if (kind === "advance") {
            await staff();
            total = amount();
            due = total;
            line("advance", total);
            line(data.account, -total);
          } else if (kind === "salary") {
            await staff();
            total = amount();
            const apply = minor(data.applyAdvance);
            if (apply > total) fail("PAYMENT_INVALID");
            let remaining = apply;
            const advances = await tx.query(
              `${documentsSql} WHERE (d.kind='advance' OR (d.kind='openingDue' AND d.snapshot->>'dueType'='advance')) AND d.snapshot->>'staffId'=$1 AND r.id IS NULL ORDER BY d.created_at,d.id`,
              [data.staffId],
            );
            for (const a of advances) {
              const used =
                remaining < BigInt(a.due) ? remaining : BigInt(a.due);
              if (used > 0n) allocations.push({ target: a.id, amount: used });
              remaining -= used;
            }
            if (remaining > 0n) fail("DUE_EXCEEDED", 409);
            line("expense", total);
            line("advance", -apply);
            line(data.account, -(total - apply));
          } else if (kind === "cashCount") {
            const [{ balance }] = await tx.query(
              "SELECT COALESCE(sum(amount),0) AS balance FROM journal_line WHERE account='cash'",
            );
            const expected = BigInt(balance),
              counted = minor(data.counted);
            if (counted !== expected && !data.note) fail("REASON_REQUIRED");
            snapshot.expected = decimal(expected);
            snapshot.difference = decimal(counted - expected);
            total = counted;
          } else if (kind === "reversal") {
            const [target] = await tx.query(`${documentsSql} WHERE d.id=$1`, [
              data.documentId,
            ]);
            if (!target) fail("NOT_FOUND", 404);
            if (documentView(target).business_date > date)
              fail("HISTORY_DATE_INVALID");
            if (
              baseline &&
              !["openingStock", "openingDue"].includes(target.kind)
            )
              fail("DEPENDENCY_CONFLICT", 409);
            if (
              ["historyLock", "historyFinish", "openingAdjustment"].includes(
                target.kind,
              ) ||
              (isOpeningKind(target.kind) && !baseline)
            )
              fail("DEPENDENCY_CONFLICT", 409);
            if (
              actor.role === "STAFF" &&
              documentView(target).business_date !== date
            )
              fail("STAFF_TODAY_ONLY", 403);
            if (
              target.reversed_by ||
              [
                "opening",
                "reversal",
                "cashCount",
                "stockEdit",
                "purchaseReturn",
              ].includes(target.kind)
            )
              fail("DEPENDENCY_CONFLICT", 409);
            const [{ used }] = await tx.query(
              "SELECT COALESCE(sum(amount),0) AS used FROM allocation WHERE target_id=$1",
              [target.id],
            );
            if (BigInt(used) !== 0n) fail("DEPENDENCY_CONFLICT", 409);
            if (
              target.kind === "supplierPayment" &&
              (
                await tx.query(
                  `SELECT 1 FROM document r WHERE r.kind='purchaseReturn' AND r.snapshot->'paymentIds' ? $1::text LIMIT 1`,
                  [target.id],
                )
              ).length
            )
              fail("DEPENDENCY_CONFLICT", 409);
            if (target.unit_id) {
              const [unit] = await tx.query(
                "SELECT * FROM inventory_unit WHERE id=$1 FOR UPDATE",
                [target.unit_id],
              );
              if (
                ["purchase", "openingStock"].includes(target.kind) &&
                unit.status !== "IN_STOCK"
              )
                fail("DEPENDENCY_CONFLICT", 409);
              if (target.kind === "sale" && unit.sale_id !== target.id)
                fail("DEPENDENCY_CONFLICT", 409);
              if (target.kind === "sale") {
                const [later] = await tx.query(
                  `WITH RECURSIVE cycles AS (
                  SELECT id,status FROM inventory_unit WHERE previous_unit_id=$1
                  UNION ALL SELECT u.id,u.status FROM inventory_unit u JOIN cycles c ON u.previous_unit_id=c.id
                ) SELECT 1 FROM cycles WHERE status<>'REVERSED'
                UNION ALL SELECT 1 FROM inventory_unit u JOIN document p ON p.id=u.purchase_id
                  WHERE u.id<>$1 AND u.imei=$2 AND u.status<>'REVERSED' AND p.created_at>(SELECT created_at FROM document WHERE id=$3) LIMIT 1`,
                  [unit.id, unit.imei, target.id],
                );
                if (later) fail("LATER_ACQUISITION", 409);
                if (
                  unit.imei &&
                  (
                    await tx.query(
                      "SELECT 1 FROM inventory_unit WHERE imei=$1 AND status='IN_STOCK' AND id<>$2",
                      [unit.imei, unit.id],
                    )
                  ).length
                )
                  fail("IMEI_IN_STOCK", 409);
              }
              unitId = unit.id;
            }
            const source = await tx.query(
              "SELECT account,amount FROM journal_line WHERE document_id=$1",
              [target.id],
            );
            for (const e of source) line(e.account, -BigInt(e.amount));
            const sourceAllocations = await tx.query(
              "SELECT * FROM allocation WHERE document_id=$1",
              [target.id],
            );
            for (const a of sourceAllocations)
              allocations.push({
                target: a.target_id,
                amount: -BigInt(a.amount),
              });
            reversalOf = target.id;
            partyId = target.party_id;
            total = BigInt(target.total);
            snapshot = {
              ...snapshot,
              originalNumber: target.number,
              originalKind: target.kind,
              originalSnapshot: target.snapshot,
            };
            // Counts retain their original book cutoff. A linked correction flags affected later counts.
            await tx.query(
              "UPDATE cash_count c SET needs_review=true FROM document d WHERE c.document_id=d.id AND d.created_at>=$1",
              [target.created_at],
            );
          }
          if (Object.values(entries).reduce((a, b) => a + b, 0n) !== 0n)
            throw new Error("UNBALANCED_COMMAND");
          for (const account of [
            "cash",
            "bank",
            "inventory",
            "receivable",
            "supplierReceivable",
            "loan",
            "advance",
          ]) {
            if ((entries[account] || 0n) < 0n) {
              const [{ balance }] = await tx.query(
                "SELECT COALESCE(sum(amount),0) AS balance FROM journal_line WHERE account=$1",
                [account],
              );
              if (BigInt(balance) + (entries[account] || 0n) < 0n)
                fail("INSUFFICIENT_FUNDS", 409);
            }
          }
          await tx.query(
            `INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,party_id,unit_id,snapshot,reversal_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              id,
              number,
              documentKind,
              actor.id,
              actor.name,
              instant,
              date,
              String(total),
              String(due),
              partyId,
              unitId,
              snapshot,
              reversalOf,
            ],
          );
          if (kind === "salary") {
            const rows = await tx.query(
              `INSERT INTO salary_settlement(staff_id,month,document_id) VALUES($1,$2,$3) ON CONFLICT(staff_id,month) DO UPDATE SET document_id=EXCLUDED.document_id WHERE salary_settlement.document_id IS NULL RETURNING document_id`,
              [data.staffId, data.month, id],
            );
            if (rows.length === 0) fail("DUPLICATE", 409);
          }
          if (kind === "reversal" && snapshot.originalKind === "salary")
            await tx.query(
              "UPDATE salary_settlement SET document_id=NULL WHERE document_id=$1",
              [reversalOf],
            );
          if (individual) {
            const seller = individualSellerSchema.parse(
              Object.fromEntries(
                individualSellerKeys.map((key) => [key, data[key]]),
              ),
            );
            await tx.query(
              "INSERT INTO purchase_declaration(document_id,seller,terms,buyer_role) VALUES($1,$2,$3,$4)",
              [id, seller, purchaseDeclarationTerms, actor.role],
            );
            await tx.query(
              "INSERT INTO individual_seller_profile(party_id,details,updated_at) VALUES($1,$2,$3) ON CONFLICT(party_id) DO UPDATE SET details=EXCLUDED.details,updated_at=EXCLUDED.updated_at",
              [partyId, seller, instant],
            );
          }
          if (isPurchase) {
            const [{ seq: unitNumber }] = await tx.query(
              "SELECT nextval('unit_number') AS seq",
            );
            await tx.query(
              `INSERT INTO inventory_unit(id,internal_id,model,brand,variant,category,condition,imei,battery,box,cost,status,purchase_id,storage,color,previous_unit_id,phone_type,ram) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'IN_STOCK',$12,$13,$14,$15,$16,$17)`,
              [
                unitId,
                `ST-${String(unitNumber).padStart(6, "0")}`,
                data.model,
                data.brand,
                data.variant,
                data.category,
                data.condition,
                data.imei,
                data.battery,
                data.box,
                String(minor(snapshot.acquisitionCost)),
                id,
                data.storage || "",
                data.color || "",
                previousUnitId,
                data.phoneType || null,
                data.ram || null,
              ],
            );
            await tx.query(
              "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,1)",
              [unitId, id],
            );
          } else if (kind === "purchaseReturn") {
            await tx.query(
              "UPDATE inventory_unit SET status='RETURNED',revision=revision+1 WHERE id=$1",
              [unitId],
            );
            await tx.query(
              "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)",
              [unitId, id],
            );
          } else if (kind === "sale") {
            await tx.query(
              "UPDATE inventory_unit SET status='SOLD',sale_id=$2 WHERE id=$1",
              [unitId, id],
            );
            await tx.query(
              "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)",
              [unitId, id],
            );
          } else if (kind === "reversal" && unitId) {
            if (snapshot.originalKind === "sale") {
              await tx.query(
                "UPDATE inventory_unit SET status='IN_STOCK',sale_id=NULL WHERE id=$1",
                [unitId],
              );
              await tx.query(
                "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,1)",
                [unitId, id],
              );
            } else {
              await tx.query(
                "UPDATE inventory_unit SET status='REVERSED' WHERE id=$1",
                [unitId],
              );
              await tx.query(
                "INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)",
                [unitId, id],
              );
            }
          }
          for (const [account, n] of Object.entries(entries))
            if (n !== 0n)
              await tx.query(
                "INSERT INTO journal_line(document_id,account,amount) VALUES($1,$2,$3)",
                [id, account, String(n)],
              );
          for (const a of allocations)
            await tx.query(
              "INSERT INTO allocation(document_id,target_id,amount) VALUES($1,$2,$3)",
              [id, a.target, String(a.amount)],
            );
          if (shop.history_active && shop.history_locked && !control)
            await tx.query("UPDATE shop SET history_last_date=$1 WHERE id=1", [
              date,
            ]);
          if (shop.history_active || kind === "historyStart")
            await tx.query(
              "UPDATE shop SET history_version=history_version+1 WHERE id=1",
            );
          if (kind === "cashCount")
            await tx.query(
              `INSERT INTO cash_count(document_id,expected,counted,difference,cutoff) SELECT $1,$2,$3,$4,COALESCE(max(id),0) FROM journal_line`,
              [
                id,
                String(minor(snapshot.expected)),
                String(total),
                String(total - minor(snapshot.expected)),
              ],
            );
          const result = { id, number };
          await tx.query(
            "INSERT INTO command_result(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4)",
            [actor.id, key, hash, result],
          );
          await tx.query(
            "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'financial_posted',$2,$3)",
            [actor.id, id, { kind, number }],
          );
          return result;
        });
      } catch (error: any) {
        if (["40001", "40P01"].includes(error?.code) && attempt < 2) continue;
        throw error;
      }
    throw new Error("RETRY_EXHAUSTED");
  }
}
