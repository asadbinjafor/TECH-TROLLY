import { z } from "zod";
export { z };
export { ZodError } from "zod";
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
    role: z.enum(["OWNER", "STAFF"]).optional(),
    active: z.boolean().optional(),
    password: newPassword.optional(),
  })
  .strict();
export const partySchema = z
  .object({
    name: text,
    phone: z.string().trim().max(30).default(""),
    kind: z.enum(["customer", "supplier", "person"]),
  })
  .strict();
export const categorySchema = z
  .object({ bn: text, en: text, active: z.boolean().default(true) })
  .strict();
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
  sale: z.strictObject({
    unitId: id,
    price: money,
    discount: money.default("0"),
    cash: money,
    bank: money,
    customerId: id.nullable().default(null),
    note,
  }),
  collection: z.strictObject({ documentId: id, amount: money, account, note }),
  supplierPayment: z.strictObject({
    documentId: id,
    amount: money,
    account,
    note,
  }),
  expense: z.strictObject({
    categoryId: id,
    amount: money,
    account,
    note: text,
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
  kind: string;
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
export const forms: Record<CommandKind, Field[]> = {
  opening: [
    f("cash", "money", { label: "openingCash" }),
    f("bank", "money", { label: "openingBank" }),
  ],
  purchase: [
    f("model"),
    f("brand"),
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
    f("procurement", "money", { default: "0" }),
    f("treatment", "select", {
      options: ["capitalize", "expense"],
      default: "capitalize",
    }),
    f("paid", "money"),
    a,
    n,
  ],
  sale: [
    f("unitId", "select", { source: "units" }),
    f("price", "money"),
    f("discount", "money", { default: "0" }),
    f("cash", "money", { label: "cashReceived" }),
    f("bank", "money", { label: "bankReceived" }),
    f("customerId", "select", { source: "customers", optional: true }),
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
    f("applyAdvance", "money", { default: "0" }),
    a,
    n,
  ],
  cashCount: [f("counted", "money"), n],
  reversal: [f("documentId", "select", { source: "documents" }), f("note")],
};
export function prepare(kind: CommandKind, raw: Record<string, string>) {
  const data: Record<string, unknown> = { ...raw };
  for (const field of forms[kind]) {
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
  return commands[kind].parse(data);
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
      .map((c) => ({ value: c.id, label: c[lang] }));
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
      .filter((p) => p.kind === pk)
      .map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.phone || p.id.slice(0, 8)}`,
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
      (d) => !d.reversed_by && (!dk || (d.kind === dk && minor(d.due) > 0n)),
    )
    .map((d) => ({
      value: d.id,
      label: `${d.number} · ${String(d.snapshot.model || d.snapshot.partyName || d.kind)} · ${d.due}`,
    }));
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
  "settings",
] as const;
