import { z } from "zod";
export { z };
export { ZodError } from "zod";
export {
  invoiceShop,
  invoiceSellerName,
  memoProfile,
  type Receipt,
} from "./invoice";
export type Role = "OWNER" | "STAFF";
export type Language = "bn" | "en";
export interface User {
  id: string;
  name: string;
  login: string;
  email: string | null;
  role: Role;
  active: boolean;
  must_change: boolean;
}
export const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/, "MONEY_PRECISION");
export function minor(value: string): bigint {
  if (!money.safeParse(value).success) throw new Error("MONEY_PRECISION");
  const [a, b = ""] = value.split(".");
  return BigInt(a) * 100n + BigInt(b.padEnd(2, "0"));
}
export function decimal(value: bigint | string): string {
  const n = BigInt(value);
  return `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 100n}.${String((n < 0n ? -n : n) % 100n).padStart(2, "0")}`;
}
export const account = z.enum(["cash", "bank"]);
const text = z.string().trim().min(1).max(180);
const id = z.string().uuid();
const note = z.string().trim().max(300).default("");
const withinBcryptLimit = (v: string) =>
  Array.from(v).reduce((n, c) => {
    const p = c.codePointAt(0)!;
    return n + (p > 65535 ? 4 : p > 2047 ? 3 : p > 127 ? 2 : 1);
  }, 0) <= 72;
const currentPassword = z
  .string()
  .min(1)
  .max(72)
  .refine(withinBcryptLimit, "PASSWORD_LENGTH");
export const newPassword = z
  .string()
  .min(8)
  .max(72)
  .refine(withinBcryptLimit, "PASSWORD_LENGTH");
export const loginSchema = z
  .object({ identity: text, password: currentPassword })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword,
    password: newPassword,
  })
  .strict();
export const userSchema = z
  .object({
    name: text,
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,60}$/),
    email: z.union([z.email(), z.literal("")]).optional(),
    role: z.enum(["OWNER", "STAFF"]),
    password: newPassword,
  })
  .strict();
export const userUpdateSchema = z
  .object({
    name: text.optional(),
    login: userSchema.shape.login.optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.union([z.email(), z.literal("")]))
      .optional(),
    currentPassword: z.union([currentPassword, z.literal("")]).optional(),
    role: z.enum(["OWNER", "STAFF"]).optional(),
    active: z.boolean().optional(),
    password: newPassword.optional(),
  })
  .strict();
export const profileSchema = userUpdateSchema
  .pick({ name: true, login: true, email: true, currentPassword: true })
  .required({ name: true, login: true });
export function profileIdentityChanged(
  before: { login?: string; email?: string | null },
  after: { login?: string; email?: string | null },
) {
  return (
    (before.login || "").trim().toLowerCase() !==
      (after.login || "").trim().toLowerCase() ||
    (before.email || "").trim().toLowerCase() !==
      (after.email || "").trim().toLowerCase()
  );
}
export const partySchema = z
  .object({
    name: text,
    phone: z.string().trim().max(30).default(""),
    address: z.string().trim().max(300).default(""),
    kind: z.enum(["customer", "supplier", "person"]),
  })
  .strict();
export const categorySchema = z
  .object({ bn: text, en: text, active: z.boolean().default(true) })
  .strict();
export const partyUpdateSchema = partySchema.omit({ kind: true });
export const partyActiveSchema = z.strictObject({ active: z.boolean() });
export const shopSchema = z
  .object({
    name: text,
    address: z.string().max(300),
    phone: z.string().max(30),
  })
  .strict();
export const commands = {
  opening: z.strictObject({ cash: money, bank: money }),
  purchase: z
    .strictObject({
      model: text,
      brand: text,
      variant: z.string().max(120).default(""),
      storage: z.string().trim().max(60).optional(),
      color: z.string().trim().max(60).optional(),
      category: z.enum(["phone", "accessory"]),
      condition: z.enum(["new", "used", "refurbished"]),
      imei: z
        .string()
        .regex(/^\d{15}$/)
        .nullable()
        .default(null),
      battery: z.number().int().min(0).max(100).nullable().default(null),
      box: z.enum(["with", "without", "unspecified"]).default("unspecified"),
      supplierId: id,
      cost: money,
      procurement: money.default("0"),
      treatment: z.enum(["capitalize", "expense"]),
      paid: money,
      account,
      note,
    })
    .superRefine((v, c) => {
      if (v.category === "phone" && !v.imei)
        c.addIssue({
          code: "custom",
          path: ["imei"],
          message: "IMEI_REQUIRED",
        });
      if (v.category === "accessory" && v.imei)
        c.addIssue({
          code: "custom",
          path: ["imei"],
          message: "ACCESSORY_IMEI",
        });
    }),
  sale: z
    .strictObject({
      unitId: id,
      price: money,
      discount: money.default("0"),
      cash: money,
      bank: money,
      customerId: id.nullable().default(null),
      customerName: z.string().trim().max(180).optional(),
      customerPhone: z.string().trim().max(30).optional(),
      customerAddress: z.string().trim().max(300).optional(),
      note,
    })
    .superRefine((v, c) => {
      if (saleNeedsCustomer(v) && !v.customerId)
        c.addIssue({
          code: "custom",
          path: ["customerId"],
          message: "CUSTOMER_REQUIRED",
        });
    }),
  collection: z.strictObject({ documentId: id, amount: money, account, note }),
  supplierPayment: z.strictObject({
    documentId: id,
    amount: money,
    account,
    note,
  }),
  expense: z
    .strictObject({
      categoryId: z.union([id, z.literal("custom")]),
      expenseName: z.string().trim().max(180).optional(),
      amount: money,
      account,
      note: text,
    })
    .superRefine((v, c) => {
      if (v.categoryId === "custom" && !v.expenseName)
        c.addIssue({
          code: "custom",
          path: ["expenseName"],
          message: "EXPENSE_NAME_REQUIRED",
        });
    }),
  transfer: z.strictObject({ from: account, amount: money, note }),
  contribution: z.strictObject({ account, amount: money, note: text }),
  withdrawal: z.strictObject({ account, amount: money, note: text }),
  loan: z.strictObject({ partyId: id, account, amount: money, note: text }),
  loanRepayment: z.strictObject({
    documentId: id,
    account,
    amount: money,
    note,
  }),
  advance: z.strictObject({ staffId: id, account, amount: money, note: text }),
  advanceRepayment: z.strictObject({
    documentId: id,
    account,
    amount: money,
    note,
  }),
  salary: z.strictObject({
    staffId: id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount: money,
    applyAdvance: money,
    account,
    note,
  }),
  cashCount: z.strictObject({ counted: money, note }),
  reversal: z.strictObject({ documentId: id, note: text }),
} as const;
export type CommandKind = keyof typeof commands;
export type CommandInput<K extends CommandKind> = z.input<(typeof commands)[K]>;
export type CommandData<K extends CommandKind> = z.output<(typeof commands)[K]>;
export interface Unit {
  id: string;
  internal_id: string;
  model: string;
  brand: string;
  variant: string;
  storage: string;
  color: string;
  category: string;
  condition: string;
  imei: string | null;
  battery: number | null;
  box: string;
  cost: string;
  status: "IN_STOCK" | "SOLD" | "REVERSED";
  sale_id: string | null;
}
export interface Document {
  id: string;
  number: string;
  kind: CommandKind;
  actor_id: string;
  actor_name: string;
  created_at: string;
  business_date: string;
  total: string;
  due: string;
  snapshot: Record<string, unknown>;
  reversed_by: string | null;
  reversal_of: string | null;
  party_id: string | null;
  unit_id: string | null;
}
export interface Party {
  id: string;
  name: string;
  phone: string;
  address: string;
  kind: string;
  active?: boolean;
}
export interface Category {
  id: string;
  bn: string;
  en: string;
  active: boolean;
}
export interface Report {
  from: string;
  to: string;
  available: boolean;
  revenue: string;
  cogs: string;
  expense: string;
  grossProfit: string;
  netProfit: string;
  openingCash: string;
  openingBank: string;
  closingCash: string;
  closingBank: string;
  cashIn: string;
  cashOut: string;
  bankIn: string;
  bankOut: string;
  externalIn: string;
  externalOut: string;
  documents: Document[];
  productProfit: ProductProfit[];
  profitStatement: ProfitEntry[];
  expenseBreakdown: ExpenseGroup[];
  expenseStatement: ExpenseEntry[];
  moneyStatement: MoneyEntry[];
  purchases: string;
}
export interface ProductProfit {
  brand: string;
  model: string;
  quantity: number;
  purchaseCost: string;
  sales: string;
  grossProfit: string;
}
export interface ProfitEntry {
  id: string;
  number: string;
  sourceNumber: string;
  date: string;
  actor: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  variant: string;
  serial: string;
  quantity: number;
  purchaseCost: string;
  sales: string;
  grossProfit: string;
}
export interface ExpenseGroup {
  key: string;
  bn: string;
  en: string;
  amount: string;
}
export interface ExpenseEntry {
  id: string;
  number: string;
  sourceNumber: string;
  date: string;
  actor: string;
  bn: string;
  en: string;
  note: string;
  amount: string;
}
export interface MoneyEntry {
  id: string;
  number: string;
  sourceNumber: string;
  date: string;
  actor: string;
  kind: string;
  note: string;
  cashIn: string;
  cashOut: string;
  bankIn: string;
  bankOut: string;
  cashBalance: string;
  bankBalance: string;
}
export interface State {
  user: User;
  now: string;
  today: string;
  shop: {
    name: string;
    address: string;
    phone: string;
    opened_at: string | null;
  };
  balances: Record<string, string>;
  units: Unit[];
  documents: Document[];
  parties: Party[];
  categories: Category[];
  staff: Pick<User, "id" | "name" | "role">[];
  counts: Record<string, unknown>[];
  report: Report;
}
export interface Field {
  key: string;
  label: string;
  type?: "money" | "text" | "select" | "password" | "number" | "month";
  source?:
    | "units"
    | "customers"
    | "suppliers"
    | "persons"
    | "categories"
    | "staff"
    | "salesDue"
    | "purchasesDue"
    | "loansDue"
    | "advancesDue"
    | "documents";
  options?: string[];
  optional?: boolean;
  default?: string;
  emptyValue?: string;
}
const f = (
  key: string,
  type: Field["type"] = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label: key, type, ...extra });
const a = f("account", "select", {
    options: ["cash", "bank"],
    default: "cash",
  }),
  n = f("note", "text", { optional: true }),
  amount = f("amount", "money");
// Blank input is a UI choice. Financial payloads still carry decimal strings.
const optionalMoney = (key: string, extra: Partial<Field> = {}) =>
  f(key, "money", { optional: true, emptyValue: "0", ...extra });
export const forms: Record<CommandKind, Field[]> = {
  opening: [
    optionalMoney("cash", { label: "openingCash" }),
    optionalMoney("bank", { label: "openingBank" }),
  ],
  purchase: [
    f("model"),
    f("brand"),
    f("storage", "text", { optional: true }),
    f("color", "text", { optional: true }),
    f("variant", "text", { optional: true }),
    f("category", "select", {
      options: ["phone", "accessory"],
      default: "phone",
    }),
    f("condition", "select", {
      options: ["new", "used", "refurbished"],
      default: "used",
    }),
    f("imei", "text", { optional: true }),
    f("battery", "number", { optional: true }),
    f("box", "select", {
      options: ["unspecified", "with", "without"],
      default: "unspecified",
    }),
    f("supplierId", "select", { source: "suppliers" }),
    f("cost", "money"),
    optionalMoney("procurement"),
    f("treatment", "select", {
      options: ["capitalize", "expense"],
      default: "capitalize",
      optional: true,
    }),
    optionalMoney("paid"),
    { ...a, optional: true },
    n,
  ],
  sale: [
    f("unitId", "select", { source: "units" }),
    f("customerId", "select", { source: "customers", optional: true }),
    f("customerName", "text", { optional: true }),
    f("customerPhone", "text", { optional: true }),
    f("customerAddress", "text", { optional: true }),
    f("price", "money"),
    optionalMoney("discount"),
    optionalMoney("cash", { label: "cashReceived" }),
    optionalMoney("bank", { label: "bankReceived" }),
    n,
  ],
  collection: [f("documentId", "select", { source: "salesDue" }), amount, a, n],
  supplierPayment: [
    f("documentId", "select", { source: "purchasesDue" }),
    amount,
    a,
    n,
  ],
  expense: [
    f("categoryId", "select", { source: "categories" }),
    f("expenseName"),
    amount,
    a,
    f("note"),
  ],
  transfer: [
    f("from", "select", { options: ["cash", "bank"], default: "cash" }),
    amount,
    n,
  ],
  contribution: [a, amount, f("note")],
  withdrawal: [a, amount, f("note")],
  loan: [f("partyId", "select", { source: "persons" }), a, amount, f("note")],
  loanRepayment: [
    f("documentId", "select", { source: "loansDue" }),
    a,
    amount,
    n,
  ],
  advance: [f("staffId", "select", { source: "staff" }), a, amount, f("note")],
  advanceRepayment: [
    f("documentId", "select", { source: "advancesDue" }),
    a,
    amount,
    n,
  ],
  salary: [
    f("staffId", "select", { source: "staff" }),
    f("month", "month"),
    amount,
    optionalMoney("applyAdvance"),
    { ...a, optional: true },
    n,
  ],
  cashCount: [f("counted", "money"), n],
  reversal: [f("documentId", "select", { source: "documents" }), f("note")],
};
export function customerInvoiceFields(customer?: Party) {
  return {
    customerName: customer?.name || "",
    customerPhone: customer?.phone || "",
    customerAddress: customer?.address || "",
  };
}
export function saleNeedsCustomer(values: {
  price?: string;
  discount?: string;
  cash?: string;
  bank?: string;
}) {
  try {
    return (
      minor(values.price || "0") - minor(values.discount || "0") >
      minor(values.cash || "0") + minor(values.bank || "0")
    );
  } catch {
    return false;
  }
}
export function formFields(kind: CommandKind, values: Record<string, string>) {
  return forms[kind].filter(
    (f) =>
      (f.key !== "expenseName" || values.categoryId === "custom") &&
      !(
        kind === "purchase" &&
        f.key === "imei" &&
        values.category === "accessory"
      ),
  );
}
export function formDefaults(kind: CommandKind, today: string) {
  return Object.fromEntries(
    forms[kind].map((f) => [
      f.key,
      f.default ?? (f.type === "month" ? today.slice(0, 7) : ""),
    ]),
  );
}
export function restoreFormDraft(
  kind: CommandKind,
  draft: Record<string, string> | null,
  today: string,
) {
  const values = { ...formDefaults(kind, today), ...draft };
  // Replace old seeded zeros only in ordinary drafts, never pending commands.
  for (const field of forms[kind])
    if (
      field.emptyValue === "0" &&
      money.safeParse(values[field.key]).success &&
      minor(values[field.key]) === 0n
    )
      values[field.key] = "";
  return values;
}
export function fieldRequired(
  kind: CommandKind,
  field: Field,
  values: Record<string, string>,
  state: State,
) {
  if (kind === "sale" && field.key === "customerId")
    return saleNeedsCustomer(values);
  if (kind === "purchase" && field.key === "imei")
    return values.category === "phone";
  if (kind === "purchase" && ["account", "treatment"].includes(field.key)) {
    try {
      return (
        minor(values.procurement || "0") > 0n ||
        (field.key === "account" && minor(values.paid || "0") > 0n)
      );
    } catch {
      return true;
    }
  }
  if (kind === "salary" && field.key === "account") {
    try {
      return minor(values.amount || "0") !== minor(values.applyAdvance || "0");
    } catch {
      return true;
    }
  }
  if (kind === "cashCount" && field.key === "note") {
    try {
      return minor(values.counted || "0") !== minor(state.balances.cash);
    } catch {
      return false;
    }
  }
  return !field.optional;
}
export function paymentHelp(kind: CommandKind, values: Record<string, string>) {
  if (kind !== "sale") return null;
  try {
    const total = minor(values.price || "0") - minor(values.discount || "0"),
      cash = minor(values.cash || "0"),
      bank = minor(values.bank || "0");
    if (total > 0n && cash === total && bank === 0n)
      return "fullCashPaymentHelp";
    if (total > 0n && bank === total && cash === 0n)
      return "fullBankPaymentHelp";
    if (total > cash + bank) return "creditPaymentHelp";
  } catch {}
  return "salePaymentHelp";
}
export function fieldMaxLength(kind: CommandKind, field: Field) {
  if (field.type === "money") return 15;
  if (field.type === "month") return 7;
  return (
    (
      {
        imei: 15,
        battery: 3,
        model: 180,
        brand: 180,
        storage: 60,
        color: 60,
        variant: 120,
        customerName: 180,
        customerPhone: 30,
        customerAddress: 300,
        expenseName: 180,
      } as Record<string, number>
    )[field.key] ?? (field.key === "note" && !field.optional ? 180 : 300)
  );
}
export function emptySelectionMessage(field: Field) {
  return (
    (
      {
        units: "emptyStockSelection",
        staff: "emptyStaffSelection",
        salesDue: "emptySalesDueSelection",
        purchasesDue: "emptyPurchasesDueSelection",
        loansDue: "emptyLoansDueSelection",
        advancesDue: "emptyAdvancesDueSelection",
        documents: "emptyCorrectionSelection",
      } as Record<string, string>
    )[field.source || ""] || "emptyPartySelection"
  );
}
export function selectionBlockers(
  kind: CommandKind,
  values: Record<string, string>,
  state: State,
) {
  const issues: Record<string, string> = {};
  for (const field of formFields(kind, values).filter(
    (f) => f.type === "select",
  )) {
    const options = choices(field, state, "en");
    if (!options.length && fieldRequired(kind, field, values, state))
      issues[field.key] = emptySelectionMessage(field);
    else if (
      values[field.key] &&
      !options.some((o) => o.value === values[field.key])
    )
      issues[field.key] = "SELECTION_UNAVAILABLE";
  }
  return issues;
}
export function prepareForm(
  kind: CommandKind,
  values: Record<string, string>,
  state: State,
) {
  const blocked = selectionBlockers(kind, values, state);
  if (
    kind === "cashCount" &&
    fieldRequired(kind, forms.cashCount[1], values, state) &&
    !values.note?.trim()
  )
    blocked.note = "REASON_REQUIRED";
  if (Object.keys(blocked).length)
    throw new z.ZodError(
      Object.entries(blocked).map(([key, message]) => ({
        code: "custom",
        path: [key],
        message,
      })),
    );
  return prepare(kind, values);
}
export function prepare(kind: CommandKind, raw: Record<string, string>) {
  const data: Record<string, unknown> = { ...raw };
  if (kind === "purchase" && raw.category === "accessory") data.imei = null;
  for (const field of forms[kind]) {
    if (field.emptyValue !== undefined && !data[field.key])
      data[field.key] = field.emptyValue;
    if (field.optional && !data[field.key])
      data[field.key] =
        field.key === "imei" ||
        field.key === "battery" ||
        field.key === "customerId"
          ? null
          : "";
    if (field.type === "number" && data[field.key] !== null)
      data[field.key] = Number(data[field.key]);
  }
  const zero = (value: unknown) =>
    money.safeParse(value).success && minor(String(value)) === 0n;
  if (kind === "purchase") {
    if (!data.treatment && zero(data.procurement))
      data.treatment = "capitalize";
    if (!data.account && zero(data.paid) && zero(data.procurement))
      data.account = "cash";
  }
  if (
    kind === "salary" &&
    !data.account &&
    money.safeParse(data.amount).success &&
    money.safeParse(data.applyAdvance).success &&
    minor(String(data.amount)) === minor(String(data.applyAdvance))
  )
    data.account = "cash";
  const parsed = commands[kind].parse(data);
  const values = parsed as Record<string, unknown>;
  const issues: z.core.$ZodIssue[] = [];
  const issue = (key: string, message: string) =>
    issues.push({ code: "custom", path: [key], message });
  // Match existing PostingService constraints before asking for confirmation.
  for (const key of ["price", "cost", "amount"])
    if (key in values && minor(String(values[key])) === 0n)
      issue(key, "POSITIVE_REQUIRED");
  if (kind === "sale") {
    const total = minor(String(values.price)) - minor(String(values.discount));
    if (total <= 0n) issue("discount", "PAYMENT_INVALID");
    else if (minor(String(values.cash)) + minor(String(values.bank)) > total) {
      issue("cash", "PAYMENT_INVALID");
      issue("bank", "PAYMENT_INVALID");
    }
  }
  if (
    kind === "purchase" &&
    minor(String(values.paid)) > minor(String(values.cost))
  )
    issue("paid", "PAYMENT_INVALID");
  if (
    kind === "salary" &&
    minor(String(values.applyAdvance)) > minor(String(values.amount))
  )
    issue("applyAdvance", "PAYMENT_INVALID");
  if (issues.length) throw new z.ZodError(issues);
  return parsed;
}
export function choices(
  field: Field,
  state: State,
  lang: Language,
): { value: string; label: string }[] {
  if (field.options)
    return field.options.map((value) => ({
      value,
      label:
        value === "phone"
          ? "phoneProduct"
          : value === "cash"
            ? "cashAccount"
            : value === "bank"
              ? "bankAccount"
              : value,
    }));
  if (field.source === "units")
    return state.units
      .filter((u) => u.status === "IN_STOCK")
      .map((u) => ({
        value: u.id,
        label: `${u.model} · ${u.imei || u.internal_id}`,
      }));
  if (field.source === "categories")
    return state.categories
      .filter((c) => c.active)
      .map((c) => ({ value: c.id, label: c[lang] }))
      .concat([
        {
          value: "custom",
          label:
            lang === "bn" ? "অন্যান্য / Custom খরচ" : "Other / custom expense",
        },
      ]);
  if (field.source === "staff")
    return state.staff.map((u) => ({ value: u.id, label: u.name }));
  const pk = (
    {
      customers: "customer",
      suppliers: "supplier",
      persons: "person",
    } as Record<string, string>
  )[field.source || ""];
  if (pk)
    return state.parties
      .filter((p) => p.kind === pk && p.active !== false)
      .map((p) => ({
        value: p.id,
        label: [p.name, p.phone].filter(Boolean).join(" · "),
      }));
  const dk = (
    {
      salesDue: "sale",
      purchasesDue: "purchase",
      loansDue: "loan",
      advancesDue: "advance",
    } as Record<string, string>
  )[field.source || ""];
  return state.documents
    .filter(
      (d) =>
        !d.reversed_by &&
        (dk
          ? d.kind === dk && minor(d.due) > 0n
          : correctableDocument(d, state)),
    )
    .map((d) => ({
      value: d.id,
      label: `${d.number} · ${String(d.snapshot.model || d.snapshot.partyName || d.kind)} · ${d.due}`,
    }));
}
export function correctableDocument(d: Document, state: State) {
  if (d.reversed_by || ["opening", "cashCount", "reversal"].includes(d.kind))
    return false;
  const unit = state.units.find((u) => u.id === d.unit_id);
  if (d.kind === "purchase" && unit && unit.status !== "IN_STOCK") return false;
  if (d.kind === "sale" && unit && unit.sale_id !== d.id) return false;
  try {
    const s = d.snapshot;
    const originalDue =
      d.kind === "purchase"
        ? minor(String(s.cost)) - minor(String(s.paid))
        : d.kind === "sale"
          ? minor(String(s.price)) -
            minor(String(s.discount)) -
            minor(String(s.cash)) -
            minor(String(s.bank))
          : ["loan", "advance"].includes(d.kind)
            ? minor(d.total)
            : null;
    if (originalDue !== null && originalDue > minor(d.due)) return false;
  } catch {
    /* Older incomplete snapshots still defer to the authoritative API. */
  }
  return true;
}
export function partyKindForSource(
  source?: string,
): "supplier" | "customer" | "person" | undefined {
  return source === "suppliers"
    ? "supplier"
    : source === "customers"
      ? "customer"
      : source === "persons"
        ? "person"
        : undefined;
}
export const pages = [
  "overview",
  "daybook",
  "inventory",
  "purchases",
  "transactions",
  "money",
  "staff",
  "reports",
  "profit",
  "settings",
] as const;
export function productDetails(unit: {
  storage?: string;
  color?: string;
  variant?: string;
}) {
  return [unit.storage, unit.color, unit.variant].filter(Boolean).join(" · ");
}
