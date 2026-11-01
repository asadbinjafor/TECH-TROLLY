import { z } from "zod";
import { individualSellerSchema } from "./purchase-declaration";
import {
  phoneSpecFields,
  validatePhoneSpecs,
  storageOptions,
  ramOptions,
  normalizeCapacity,
  type PhoneType,
} from "./phone-specs";
export * from "./phone-specs";
export * from "./purchase-declaration";
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
// Keep passwords as strings: leading zeroes are significant. Current-password
// checks still accept legacy credentials so a policy update cannot lock users out.
export const newPassword = z
  .string()
  .length(4, "PASSWORD_FORMAT")
  .regex(/^[0-9]{4}$/, "PASSWORD_FORMAT");
export const loginSchema = z
  .object({ identity: text, password: currentPassword })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword,
    password: newPassword,
  })
  .strict();
export const verifyPasswordSchema = z.strictObject({
  password: currentPassword,
});
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
export const calendarDate = z.iso
  .date()
  .refine((d) => d >= "1900-01-01", "HISTORY_DATE_INVALID");
const datedFields = { businessDate: calendarDate.optional() };
export const openingKinds = [
  "opening",
  "openingStock",
  "openingDue",
  "openingAdjustment",
] as const;
export const historyControlKinds = [
  "historyStart",
  "historyLock",
  "historyFinish",
  "openingStock",
  "openingDue",
  "openingAdjustment",
] as const;
export const isOpeningKind = (kind: string) =>
  (openingKinds as readonly string[]).includes(kind);
export const isHistoryControl = (kind: string) =>
  (historyControlKinds as readonly string[]).includes(kind);
export function dueKind(d: {
  kind: string;
  snapshot: Record<string, unknown>;
}) {
  if (d.kind === "openingStock") return "purchase";
  return d.kind === "openingDue"
    ? (
        {
          customer: "sale",
          supplier: "purchase",
          person: "loan",
          advance: "advance",
          refund: "purchaseReturn",
        } as Record<string, string>
      )[String(d.snapshot.dueType)]
    : d.kind;
}
export const commands = {
  historyStart: z.strictObject({
    startDate: calendarDate,
    endDate: calendarDate,
    cash: money,
    bank: money,
  }),
  historyLock: z.strictObject({ setupVersion: z.number().int().min(0) }),
  historyFinish: z.strictObject({
    cash: money,
    bank: money,
    setupVersion: z.number().int().min(0),
  }),
  openingAdjustment: z.strictObject({ cash: money, bank: money, note: text }),
  openingDue: z.strictObject({
    dueType: z.enum(["customer", "supplier", "person", "refund", "advance"]),
    partyId: id,
    amount: money,
    note,
  }),
  openingStock: z
    .strictObject({
      ...phoneSpecFields,
      model: text,
      brand: text,
      storage: z.string().trim().max(60).optional(),
      color: z.string().trim().max(60).optional(),
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
      supplierId: id.nullable().optional(),
      supplierDue: money.default("0"),
      cost: money,
      note,
    })
    .superRefine((v, c) => {
      validatePhoneSpecs(v, c);
      if (minor(v.supplierDue) > minor(v.cost))
        c.addIssue({
          code: "custom",
          path: ["supplierDue"],
          message: "PAYMENT_INVALID",
        });
      if (minor(v.supplierDue) > 0n && !v.supplierId)
        c.addIssue({
          code: "custom",
          path: ["supplierId"],
          message: "SUPPLIER_REQUIRED",
        });
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
  opening: z.strictObject({ ...datedFields, cash: money, bank: money }),
  stockEdit: z
    .strictObject({
      ...datedFields,
      unitId: id,
      revision: z.number().int().min(0),
      ...phoneSpecFields,
      model: text,
      brand: text,
      storage: z.string().trim().max(60),
      color: z.string().trim().max(60),
      variant: z.string().trim().max(120),
      category: z.enum(["phone", "accessory"]),
      condition: z.enum(["new", "used", "refurbished"]),
      imei: z
        .string()
        .regex(/^\d{15}$/)
        .nullable(),
      battery: z.number().int().min(0).max(100).nullable(),
      box: z.enum(["with", "without", "unspecified"]),
      note: text,
    })
    .superRefine((v, c) => {
      validatePhoneSpecs(v, c);
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
  purchaseReturn: z.strictObject({
    ...datedFields,
    unitId: id,
    revision: z.number().int().min(0),
    returnValue: money,
    note: text,
  }),
  supplierRefund: z.strictObject({
    ...datedFields,
    documentId: id,
    amount: money,
    account,
    note,
  }),
  purchase: z
    .strictObject({
      ...datedFields,
      ...phoneSpecFields,
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
      validatePhoneSpecs(v, c);
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
  individualPurchase: z
    .strictObject({
      ...datedFields,
      ...individualSellerSchema.shape,
      ...phoneSpecFields,
      supplierId: id.optional(),
      brand: text.max(60).regex(/^[^\r\n\t]+$/),
      model: text.max(100).regex(/^[^\r\n\t]+$/),
      storage: z
        .string()
        .trim()
        .max(40)
        .regex(/^[^\r\n\t]*$/)
        .default(""),
      color: z
        .string()
        .trim()
        .max(40)
        .regex(/^[^\r\n\t]*$/)
        .default(""),
      variant: z
        .string()
        .trim()
        .max(80)
        .regex(/^[^\r\n\t]*$/)
        .default(""),
      category: z.literal("phone").default("phone"),
      condition: z.enum(["new", "used", "refurbished"]),
      imei: z.string().regex(/^\d{15}$/),
      battery: z.number().int().min(0).max(100).nullable().default(null),
      box: z.enum(["with", "without"]),
      accessories: z
        .string()
        .trim()
        .max(120)
        .regex(/^[^\r\n\t]*$/)
        .default(""),
      cost: money,
      cash: money,
      bank: money,
      note,
    })
    .superRefine((value, context) => {
      validatePhoneSpecs(value, context);
      if (!value.supplierId && !value.dateOfBirth)
        context.addIssue({
          code: "custom",
          path: ["dateOfBirth"],
          message: "BIRTH_DATE_INVALID",
        });
    }),
  sale: z
    .strictObject({
      ...datedFields,
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
  collection: z.strictObject({
    ...datedFields,
    documentId: id,
    amount: money,
    account,
    note,
  }),
  supplierPayment: z.strictObject({
    ...datedFields,
    documentId: id,
    amount: money,
    account,
    note,
  }),
  expense: z
    .strictObject({
      ...datedFields,
      categoryId: z.union([id, z.literal("custom")]),
      expenseName: z.string().trim().max(180).optional(),
      amount: money,
      account,
      note,
    })
    .superRefine((v, c) => {
      if (v.categoryId === "custom" && !v.expenseName)
        c.addIssue({
          code: "custom",
          path: ["expenseName"],
          message: "EXPENSE_NAME_REQUIRED",
        });
    }),
  transfer: z.strictObject({
    ...datedFields,
    from: account,
    amount: money,
    note,
  }),
  contribution: z.strictObject({
    ...datedFields,
    account,
    amount: money,
    note: text,
  }),
  withdrawal: z.strictObject({
    ...datedFields,
    account,
    amount: money,
    note: text,
  }),
  loan: z.strictObject({
    ...datedFields,
    partyId: id,
    account,
    amount: money,
    note: text,
  }),
  loanRepayment: z.strictObject({
    ...datedFields,
    documentId: id,
    account,
    amount: money,
    note,
  }),
  advance: z.strictObject({
    ...datedFields,
    staffId: id,
    account,
    amount: money,
    note: text,
  }),
  advanceRepayment: z.strictObject({
    ...datedFields,
    documentId: id,
    account,
    amount: money,
    note,
  }),
  salary: z.strictObject({
    ...datedFields,
    staffId: id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount: money,
    applyAdvance: money,
    account,
    note,
  }),
  cashCount: z.strictObject({ ...datedFields, counted: money, note }),
  reversal: z.strictObject({ ...datedFields, documentId: id, note: text }),
} as const;
export type CommandKind = keyof typeof commands;
export type CommandInput<K extends CommandKind> = z.input<(typeof commands)[K]>;
export type CommandData<K extends CommandKind> = z.output<(typeof commands)[K]>;
export interface Unit {
  phoneType?: PhoneType | null;
  ram?: string | null;
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
  status: "IN_STOCK" | "SOLD" | "REVERSED" | "RETURNED";
  revision: number;
  sale_id: string | null;
  previous_unit_id?: string | null;
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
  purchaseReturns?: string;
  closingSupplierRefund?: string;
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
  phoneType?: PhoneType | null;
  ram?: string | null;
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
    history_active?: boolean;
    history_from?: string | null;
    history_to?: string | null;
    history_last_date?: string | null;
    history_locked?: boolean;
    history_version?: number;
    history_finished_at?: string | null;
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
  type?: "money" | "text" | "select" | "password" | "number" | "month" | "date";
  source?:
    | "units"
    | "editableUnits"
    | "customers"
    | "suppliers"
    | "persons"
    | "categories"
    | "staff"
    | "salesDue"
    | "purchasesDue"
    | "supplierRefundsDue"
    | "loansDue"
    | "advancesDue"
    | "documents";
  options?: string[];
  optional?: boolean;
  default?: string;
  emptyValue?: string;
  uiOnly?: boolean;
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
const phoneFields = (uiOnly = false): Field[] => [
  f("phoneType", "select", {
    options: ["android", "iphone"],
    optional: true,
    uiOnly,
  }),
  f("ram", "select", { options: [...ramOptions], optional: true, uiOnly }),
  f("storage", "select", {
    options: [...storageOptions],
    optional: true,
    uiOnly,
  }),
];
export const forms: Record<CommandKind, Field[]> = {
  stockEdit: [
    f("unitId", "select", { source: "editableUnits" }),
    f("revision", "number"),
    ...phoneFields(),
    f("model"),
    f("brand"),
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
    f("note"),
  ],
  purchaseReturn: [
    f("unitId", "select", { source: "editableUnits" }),
    f("revision", "number"),
    f("returnValue", "money"),
    f("note"),
  ],
  supplierRefund: [
    f("documentId", "select", { source: "supplierRefundsDue" }),
    amount,
    a,
    n,
  ],
  historyStart: [
    f("startDate", "date", { label: "historyStartDate" }),
    f("endDate", "date", { label: "historyEndDate" }),
    optionalMoney("cash", { label: "openingCash" }),
    optionalMoney("bank", { label: "openingBank" }),
  ],
  historyLock: [f("setupVersion", "number")],
  historyFinish: [
    f("cash", "money", { label: "verifiedCash" }),
    f("bank", "money", { label: "verifiedBank" }),
    f("setupVersion", "number"),
  ],
  openingAdjustment: [
    optionalMoney("cash", { label: "openingCash" }),
    optionalMoney("bank", { label: "openingBank" }),
    f("note"),
  ],
  openingDue: [
    f("dueType", "select", {
      options: ["customer", "supplier", "person", "refund", "advance"],
    }),
    f("partyId", "select", { source: "customers", label: "dueParty" }),
    amount,
    n,
  ],
  openingStock: [], // Populated from the same stock fields as a supplier purchase below.
  opening: [
    optionalMoney("cash", { label: "openingCash" }),
    optionalMoney("bank", { label: "openingBank" }),
  ],
  purchase: [
    ...phoneFields(),
    f("model"),
    f("brand"),
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
  individualPurchase: [
    ...[
      "sellerName",
      "sellerPhone",
      "fatherName",
      "motherName",
      "presentAddress",
    ].map((key) => f(key)),
    f("permanentAddress", "text", { optional: true }),
    f("identityNumber"),
    f("dateOfBirth", "date"),
    f("nomineeName"),
    f("nomineePhone"),
    ...phoneFields(),
    f("model"),
    f("brand"),
    f("color", "text", { optional: true }),
    f("variant", "text", { optional: true }),
    f("condition", "select", {
      options: ["new", "used", "refurbished"],
      default: "used",
    }),
    f("imei"),
    f("battery", "number", { optional: true }),
    f("box", "select", { options: ["with", "without"] }),
    f("accessories", "text", { optional: true }),
    f("cost", "money"),
    optionalMoney("cash", { label: "cashPaid" }),
    optionalMoney("bank", { label: "bankPaid" }),
    n,
  ],
  sale: [
    ...phoneFields(true),
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
    n,
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
// Keep stock input geometry and phone validation identical to ordinary purchases.
forms.openingStock = forms.purchase
  .filter(
    (f) => !["procurement", "treatment", "paid", "account"].includes(f.key),
  )
  .map((f) => (f.key === "supplierId" ? { ...f, optional: true } : f));
forms.openingStock.splice(
  forms.openingStock.findIndex((f) => f.key === "cost") + 1,
  0,
  optionalMoney("supplierDue", { label: "openingStockPayable" }),
);
export function commandFields(
  kind: CommandKind,
  values: Record<string, string>,
  state: State,
) {
  const fields = formFields(kind, values);
  return state.shop?.history_active &&
    state.shop.history_locked &&
    !isHistoryControl(kind) &&
    kind !== "opening"
    ? [f("businessDate", "date"), ...fields]
    : fields;
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
  return forms[kind]
    .map((field) =>
      kind === "openingDue" && field.key === "partyId"
        ? {
            ...field,
            source:
              (
                {
                  customer: "customers",
                  supplier: "suppliers",
                  refund: "suppliers",
                  advance: "staff",
                  person: "persons",
                } as const
              )[values.dueType as "customer"] || "customers",
          }
        : field,
    )
    .filter(
      (f) =>
        f.key !== "revision" &&
        f.key !== "setupVersion" &&
        (f.key !== "expenseName" || values.categoryId === "custom") &&
        (f.key !== "ram" || values.phoneType === "android") &&
        (!["phoneType", "ram"].includes(f.key) ||
          values.category !== "accessory") &&
        (!(kind === "sale" && f.key === "storage") || !!values.phoneType) &&
        !(
          ["purchase", "openingStock", "stockEdit"].includes(kind) &&
          f.key === "imei" &&
          values.category === "accessory"
        ),
    )
    .map((field) =>
      field.key === "storage" &&
      ((kind === "stockEdit" && !values.phoneType) ||
        values.category === "accessory")
        ? { ...field, type: "text" as const, options: undefined }
        : field,
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
  state?: State | null,
) {
  const values = { ...formDefaults(kind, today), ...draft };
  if (kind === "individualPurchase") delete values.supplierId;
  if (
    state?.shop?.history_active &&
    state.shop.history_locked &&
    !isHistoryControl(kind) &&
    kind !== "opening"
  )
    values.businessDate ||=
      state.shop.history_last_date || state.shop.history_from || "";
  else delete values.businessDate;
  if (["historyLock", "historyFinish"].includes(kind))
    values.setupVersion = String(state?.shop?.history_version || 0);
  if (values.phoneType && values.storage)
    values.storage = normalizeCapacity(values.storage);
  if (kind === "sale" && state && values.unitId) {
    const unit = state.units.find((u) => u.id === values.unitId);
    if (unit)
      Object.assign(values, {
        phoneType: unit.phoneType || "",
        ram: unit.ram || "",
        storage: unit.storage || "",
      });
  }
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
  if (
    ["purchase", "openingStock", "individualPurchase", "stockEdit"].includes(
      kind,
    )
  ) {
    if (field.key === "phoneType")
      return kind !== "stockEdit" && values.category !== "accessory";
    if (field.key === "ram")
      return values.phoneType === "android" && values.category !== "accessory";
    if (field.key === "storage")
      return !!values.phoneType && values.category !== "accessory";
  }
  if (kind === "openingStock" && field.key === "supplierId")
    return (
      money.safeParse(values.supplierDue).success &&
      minor(values.supplierDue) > 0n
    );
  if (kind === "sale" && field.key === "customerId")
    return saleNeedsCustomer(values);
  if (
    ["purchase", "openingStock", "stockEdit"].includes(kind) &&
    field.key === "imei"
  )
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
  if (kind === "individualPurchase") return "individualPaymentHelp";
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
  if (field.type === "date") return 10;
  if (kind === "individualPurchase") {
    const limit = (
      { brand: 60, model: 100, storage: 40, color: 40, variant: 80 } as Record<
        string,
        number
      >
    )[field.key];
    if (limit) return limit;
  }
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
        sellerName: 80,
        sellerPhone: 30,
        fatherName: 80,
        motherName: 80,
        presentAddress: 240,
        permanentAddress: 240,
        identityNumber: 60,
        nomineeName: 80,
        nomineePhone: 30,
        accessories: 120,
      } as Record<string, number>
    )[field.key] ?? (field.key === "note" && !field.optional ? 180 : 300)
  );
}
export function emptySelectionMessage(
  field: Field,
  values?: Record<string, string>,
) {
  if (field.source === "units" && values?.phoneType)
    return "emptyPhoneStockSelection";
  return (
    (
      {
        units: "emptyStockSelection",
        editableUnits: "emptyStockSelection",
        supplierRefundsDue: "emptySupplierRefundSelection",
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
  const historyError = historyCommandError(kind, state);
  if (historyError) issues._history = historyError;
  for (const field of formFields(kind, values).filter(
    (f) => f.type === "select",
  )) {
    const options = choices(field, state, "en", values);
    if (!options.length && fieldRequired(kind, field, values, state))
      issues[field.key] = emptySelectionMessage(field, values);
    else if (
      values[field.key] &&
      !options.some((o) => o.value === values[field.key])
    )
      issues[field.key] = "SELECTION_UNAVAILABLE";
  }
  return issues;
}
export function historyCommandError(kind: CommandKind, state: State) {
  if (!state.shop?.history_active) return "";
  if (state.user.role !== "OWNER") return "HISTORY_OWNER_ONLY";
  if (
    !state.shop.history_locked &&
    !isHistoryControl(kind) &&
    !["stockEdit", "reversal"].includes(kind)
  )
    return "HISTORY_LOCK_REQUIRED";
  return "";
}
export function prepareForm(
  kind: CommandKind,
  values: Record<string, string>,
  state: State,
) {
  const blocked = selectionBlockers(kind, values, state);
  if (
    state.shop?.history_active &&
    state.shop.history_locked &&
    !isHistoryControl(kind) &&
    kind !== "opening"
  ) {
    const date = values.businessDate;
    if (
      !calendarDate.safeParse(date).success ||
      date < (state.shop.history_last_date || "") ||
      date > (state.shop.history_to || "")
    )
      blocked.businessDate = "HISTORY_DATE_INVALID";
  }
  for (const field of formFields(kind, values))
    if (
      ["phoneType", "storage", "ram"].includes(field.key) &&
      fieldRequired(kind, field, values, state) &&
      !values[field.key]
    )
      blocked[field.key] = "PHONE_SPEC_INVALID";
  if (
    ["supplierRefund", "loanRepayment"].includes(kind) &&
    money.safeParse(values.amount).success
  ) {
    const target = state.documents.find((d) => d.id === values.documentId);
    if (target && minor(values.amount) > minor(target.due))
      blocked.amount = "DUE_EXCEEDED";
  }
  if (["stockEdit", "purchaseReturn"].includes(kind)) {
    const unit = state.units.find((u) => u.id === values.unitId);
    if (!unit || Number(values.revision) !== (unit.revision ?? 0))
      blocked.unitId = "STOCK_CHANGED";
    if (
      kind === "purchaseReturn" &&
      money.safeParse(values.returnValue).success
    ) {
      const purchase = state.documents.find(
        (d) =>
          ["purchase", "openingStock"].includes(d.kind) &&
          d.unit_id === unit?.id,
      );
      if (purchase && minor(values.returnValue) > minor(purchase.total))
        blocked.returnValue = "RETURN_VALUE_INVALID";
    }
  }
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
  // Ordinary new forms use direct seller entry. Frozen pending commands bypass
  // preparation and retain their original supplier ID and idempotency hash.
  if (kind === "individualPurchase") delete data.supplierId;
  if (
    ["purchase", "openingStock", "stockEdit"].includes(kind) &&
    raw.category === "accessory"
  )
    data.imei = null;
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
  for (const field of forms[kind]) if (field.uiOnly) delete data[field.key];
  if (
    ["purchase", "openingStock", "individualPurchase", "stockEdit"].includes(
      kind,
    )
  ) {
    if (data.category === "accessory" || !data.phoneType) {
      if (kind === "stockEdit") {
        data.phoneType = null;
        data.ram = null;
      } else {
        delete data.phoneType;
        delete data.ram;
      }
    } else {
      if (typeof data.storage === "string")
        data.storage = normalizeCapacity(data.storage);
      if (data.phoneType === "iphone" || !data.ram) data.ram = null;
    }
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
  if (kind === "openingStock" && !data.supplierId) data.supplierId = null;
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
    kind === "individualPurchase" &&
    minor(String(values.cash)) + minor(String(values.bank)) >
      minor(String(values.cost))
  ) {
    issue("cash", "PAYMENT_INVALID");
    issue("bank", "PAYMENT_INVALID");
  }
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
  values: Record<string, string> = {},
): { value: string; label: string }[] {
  if (field.options)
    return field.options.map((value) => ({
      value,
      label:
        field.key === "dueType"
          ? "openingDue_" + value
          : value === "phone"
            ? "phoneProduct"
            : value === "cash"
              ? "cashAccount"
              : value === "bank"
                ? "bankAccount"
                : value,
    }));
  if (field.source === "units" || field.source === "editableUnits")
    return state.units
      .filter(
        (u) =>
          u.status === "IN_STOCK" &&
          (field.source !== "units" || matchesPhoneFilter(u, values)) &&
          (field.source !== "editableUnits" || canChangeStock(u, state)),
      )
      .map((u) => ({
        value: u.id,
        label: `${u.model}${productDetails(u) ? " · " + productDetails(u) : ""} · ${u.imei || u.internal_id}`,
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
      supplierRefundsDue: "purchaseReturn",
      loansDue: "loan",
      advancesDue: "advance",
    } as Record<string, string>
  )[field.source || ""];
  return state.documents
    .filter(
      (d) =>
        !d.reversed_by &&
        (dk
          ? dueKind(d) === dk && minor(d.due) > 0n
          : correctableDocument(d, state)),
    )
    .map((d) => ({
      value: d.id,
      label: `${d.number} · ${String(d.snapshot.model || d.snapshot.partyName || d.kind)} · ${d.due}`,
    }));
}
export function correctableDocument(d: Document, state: State) {
  if (
    isOpeningKind(d.kind) &&
    d.kind !== "opening" &&
    !(state.shop.history_active && !state.shop.history_locked)
  )
    return false;
  if (["historyLock", "historyFinish", "openingAdjustment"].includes(d.kind))
    return false;
  if (
    d.reversed_by ||
    [
      "opening",
      "cashCount",
      "reversal",
      "stockEdit",
      "purchaseReturn",
    ].includes(d.kind)
  )
    return false;
  if (
    d.kind === "supplierPayment" &&
    state.documents.some(
      (r) =>
        r.kind === "purchaseReturn" &&
        Array.isArray(r.snapshot.paymentIds) &&
        r.snapshot.paymentIds.includes(d.id),
    )
  )
    return false;
  const unit = state.units.find((u) => u.id === d.unit_id);
  if (
    ["purchase", "openingStock"].includes(d.kind) &&
    unit &&
    unit.status !== "IN_STOCK"
  )
    return false;
  if (d.kind === "sale" && unit && unit.sale_id !== d.id) return false;
  if (d.kind === "sale" && unit) {
    const descendants = new Set([unit.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cycle of state.units)
        if (
          cycle.previous_unit_id &&
          descendants.has(cycle.previous_unit_id) &&
          !descendants.has(cycle.id)
        ) {
          descendants.add(cycle.id);
          changed = true;
        }
    }
    if (
      state.units.some(
        (u) =>
          u.id !== unit.id && descendants.has(u.id) && u.status !== "REVERSED",
      )
    )
      return false;
  }
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

export function canChangeStock(unit: Unit, state: State) {
  return (
    unit.status === "IN_STOCK" &&
    (state.user.role === "OWNER" ||
      state.documents.some(
        (d) =>
          d.kind === "purchase" &&
          d.unit_id === unit.id &&
          d.business_date === state.today,
      ))
  );
}
export function acquisitionCycleIds(unitId: string, units: Unit[]) {
  const ids = new Set([unitId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of units)
      if (
        unit.previous_unit_id &&
        (ids.has(unit.id) || ids.has(unit.previous_unit_id))
      )
        for (const id of [unit.id, unit.previous_unit_id])
          if (!ids.has(id)) {
            ids.add(id);
            changed = true;
          }
  }
  return ids;
}
export function unitFormValues(
  kind: CommandKind,
  unit?: Unit,
): Record<string, string> {
  if (kind === "sale")
    return {
      price: "",
      discount: "",
      cash: "",
      bank: "",
      phoneType: unit?.phoneType || "",
      ram: unit?.ram || "",
      storage: unit?.storage || "",
    };
  if (!["stockEdit", "purchaseReturn"].includes(kind)) return {};
  const values: Record<string, string> = {
    revision: String(unit?.revision ?? 0),
    ...(kind === "stockEdit"
      ? { phoneType: unit?.phoneType || "", ram: unit?.ram || "" }
      : {}),
  };
  if (kind === "stockEdit")
    for (const key of [
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
    ] as const)
      values[key] = unit?.[key] == null ? "" : String(unit[key]);
  return values;
}

function matchesPhoneFilter(unit: Unit, values: Record<string, string>) {
  return (
    (!values.phoneType || unit.phoneType === values.phoneType) &&
    (!values.phoneType ||
      !values.storage ||
      normalizeCapacity(unit.storage) === values.storage) &&
    (values.phoneType !== "android" || !values.ram || unit.ram === values.ram)
  );
}
export function changeFormValue(
  kind: CommandKind,
  before: Record<string, string>,
  key: string,
  value: string,
  state: State,
) {
  let next = { ...before, [key]: value };
  if (key === "unitId")
    return {
      ...next,
      ...unitFormValues(
        kind,
        state.units.find((u) => u.id === value),
      ),
    };
  if (key === "customerId")
    return {
      ...next,
      ...customerInvoiceFields(state.parties.find((p) => p.id === value)),
    };
  if (key === "phoneType") {
    if (value !== "android") next.ram = "";
    if (next.storage) next.storage = normalizeCapacity(next.storage);
  }
  if (key === "category" && value === "accessory") {
    next.phoneType = "";
    next.ram = "";
  }
  if (
    kind === "sale" &&
    ["phoneType", "storage", "ram"].includes(key) &&
    next.unitId
  ) {
    const unit = state.units.find((u) => u.id === next.unitId);
    if (!unit || !matchesPhoneFilter(unit, next))
      next = {
        ...next,
        unitId: "",
        price: "",
        discount: "",
        cash: "",
        bank: "",
      };
  }
  if (kind === "openingDue" && key === "dueType") next.partyId = "";
  return next;
}

export function returnPreview(state: State, values: Record<string, string>) {
  const unit = state.units.find((u) => u.id === values.unitId);
  const purchase = state.documents.find(
    (d) =>
      ["purchase", "openingStock"].includes(d.kind) && d.unit_id === unit?.id,
  );
  if (!unit || !purchase) return null;
  if (!values.returnValue)
    return {
      purchaseAmount: purchase.total,
      returnOffset: "",
      refundDue: "",
      returnLoss: "",
    };
  const credit = minor(values.returnValue || "0");
  const payable = minor(purchase.due);
  const offset = credit < payable ? credit : payable;
  return {
    purchaseAmount: purchase.total,
    returnOffset: decimal(offset),
    refundDue: decimal(credit - offset),
    returnLoss: decimal(minor(unit.cost) - credit),
  };
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
  "sale",
  "purchases",
  "transactions",
  "money",
  "dues",
  "staff",
  "reports",
  "profit",
  "settings",
] as const;
export interface LoanAccount {
  partyId: string;
  name: string;
  phone: string;
  active: boolean;
  given: string;
  received: string;
  due: string;
  loans: Document[];
  history: Document[];
}
// A read projection of the caller's authorized documents. PostingService remains
// authoritative; never group by mutable names or turn salary advances into loans.
export function loanAccounts(
  state: Pick<State, "documents" | "parties">,
): LoanAccount[] {
  const accounts = new Map<string, LoanAccount>();
  for (const d of [...state.documents].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.number.localeCompare(a.number),
  )) {
    if (dueKind(d) !== "loan" || !d.party_id) continue;
    let group = accounts.get(d.party_id);
    if (!group) {
      const party = state.parties.find((p) => p.id === d.party_id);
      group = {
        partyId: d.party_id,
        name: party?.name || String(d.snapshot.partyName || ""),
        phone: party?.phone || String(d.snapshot.partyPhone || ""),
        active: party?.active !== false,
        given: "0.00",
        received: "0.00",
        due: "0.00",
        loans: [],
        history: [],
      };
      accounts.set(d.party_id, group);
    }
    group.loans.push(d);
    if (!d.reversed_by) {
      group.given = decimal(minor(group.given) + minor(d.total));
      group.due = decimal(minor(group.due) + minor(d.due));
      group.received = decimal(
        minor(group.received) + minor(d.total) - minor(d.due),
      );
    }
  }
  for (const group of accounts.values())
    group.history = state.documents
      .filter(
        (d) =>
          d.party_id === group.partyId &&
          (["loan", "loanRepayment"].includes(dueKind(d)) ||
            (d.kind === "reversal" &&
              ["loan", "loanRepayment"].includes(
                String(d.snapshot.originalKind),
              ))),
      )
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) ||
          b.number.localeCompare(a.number),
      );
  return [...accounts.values()].sort((a, b) =>
    minor(a.due) === minor(b.due)
      ? a.name.localeCompare(b.name)
      : minor(a.due) > minor(b.due)
        ? -1
        : 1,
  );
}
export function productDetails(unit: {
  phoneType?: string | null;
  ram?: string | null;
  storage?: string;
  color?: string;
  variant?: string;
}) {
  return [
    unit.phoneType === "android" && unit.ram ? "RAM " + unit.ram : "",
    unit.storage,
    unit.color,
    unit.variant,
  ]
    .filter(Boolean)
    .join(" · ");
}
