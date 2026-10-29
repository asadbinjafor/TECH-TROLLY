import {
  decimal,
  type ExpenseEntry,
  type ExpenseGroup,
  type ProfitEntry,
  type ProductProfit,
  type MoneyEntry,
} from "@tech-trolley/contracts";

// Amounts come from journal lines, including signed linked corrections in this period.
export function reportDetails(
  rows: any[],
  openingCash: bigint,
  openingBank: bigint,
) {
  const products = new Map<
    string,
    {
      brand: string;
      model: string;
      quantity: number;
      cost: bigint;
      sales: bigint;
    }
  >();
  const categories = new Map<
    string,
    { bn: string; en: string; amount: bigint }
  >();
  const profitStatement: ProfitEntry[] = [],
    expenseStatement: ExpenseEntry[] = [],
    moneyStatement: MoneyEntry[] = [];
  let cashBalance = openingCash,
    bankBalance = openingBank,
    purchases = 0n;
  for (const row of rows) {
    const s = row.source_snapshot,
      kind = row.source_kind;
    const date = String(row.date).slice(0, 10);
    const base = {
      id: row.id,
      number: row.number,
      sourceNumber: row.source_number,
      date,
      actor: row.actor_name,
    };
    const cost = BigInt(row.cogs),
      sales = -BigInt(row.revenue),
      expense = BigInt(row.expense);
    const quantity = row.kind === "reversal" ? -1 : 1;
    if (kind === "purchase")
      purchases += BigInt(row.source_total) * BigInt(quantity);
    if (kind === "sale") {
      const brand = s.brand || "",
        model = s.model || "";
      const key = JSON.stringify([brand, model]);
      const product = products.get(key) || {
        brand,
        model,
        quantity: 0,
        cost: 0n,
        sales: 0n,
      };
      product.quantity += quantity;
      product.cost += cost;
      product.sales += sales;
      products.set(key, product);
      profitStatement.push({
        ...base,
        brand,
        model,
        storage: s.storage || "",
        color: s.color || "",
        variant: s.variant || "",
        serial: s.imei || s.internalId || "",
        quantity,
        purchaseCost: decimal(cost),
        sales: decimal(sales),
        grossProfit: decimal(sales - cost),
      });
    }
    if (expense !== 0n) {
      const labels =
        kind === "expense"
          ? s.categoryLabels || { bn: "অন্যান্য", en: "Other" }
          : kind === "salary"
            ? { bn: "বেতন", en: "Salary" }
            : { bn: "পরিবহন / কুরিয়ার", en: "Procurement / courier" };
      const key =
        kind === "expense"
          ? s.categoryId === "custom"
            ? "custom:" + String(s.expenseName).toLocaleLowerCase()
            : s.categoryId || "other"
          : kind;
      const category = categories.get(key) || { ...labels, amount: 0n };
      category.amount += expense;
      categories.set(key, category);
      expenseStatement.push({
        ...base,
        ...labels,
        note: s.note || "",
        amount: decimal(expense),
      });
    }
    const cash = BigInt(row.cash),
      bank = BigInt(row.bank);
    if (row.kind !== "opening" && (cash !== 0n || bank !== 0n)) {
      cashBalance += cash;
      bankBalance += bank;
      moneyStatement.push({
        ...base,
        kind: row.kind,
        note: row.note || "",
        cashIn: decimal(cash > 0n ? cash : 0n),
        cashOut: decimal(cash < 0n ? -cash : 0n),
        bankIn: decimal(bank > 0n ? bank : 0n),
        bankOut: decimal(bank < 0n ? -bank : 0n),
        cashBalance: decimal(cashBalance),
        bankBalance: decimal(bankBalance),
      });
    }
  }
  const productProfit: ProductProfit[] = Array.from(products.values())
    .sort((a, b) =>
      a.sales - a.cost > b.sales - b.cost
        ? -1
        : a.sales - a.cost < b.sales - b.cost
          ? 1
          : a.model.localeCompare(b.model),
    )
    .map((p) => ({
      brand: p.brand,
      model: p.model,
      quantity: p.quantity,
      purchaseCost: decimal(p.cost),
      sales: decimal(p.sales),
      grossProfit: decimal(p.sales - p.cost),
    }));
  const expenseBreakdown: ExpenseGroup[] = Array.from(categories.entries())
    .sort((a, b) =>
      a[1].amount > b[1].amount
        ? -1
        : a[1].amount < b[1].amount
          ? 1
          : a[0].localeCompare(b[0]),
    )
    .map(([key, c]) => ({ key, ...c, amount: decimal(c.amount) }));
  return {
    productProfit,
    profitStatement,
    expenseBreakdown,
    expenseStatement,
    moneyStatement,
    purchases: decimal(purchases),
  };
}
