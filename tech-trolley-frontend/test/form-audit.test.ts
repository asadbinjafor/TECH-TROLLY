import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commands,
  forms,
  choices,
  formDefaults,
  formFields,
  fieldRequired,
  fieldMaxLength,
  selectionBlockers,
  prepareForm,
  profileSchema,
  profileIdentityChanged,
  correctableDocument,
  type State,
  type CommandKind,
} from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("profile forms distinguish a display-name edit from a normalized login identity change", () => {
  const before = { login: "owner", email: "owner@example.test" };
  assert.equal(
    profileIdentityChanged(before, {
      login: " OWNER ",
      email: "Owner@Example.Test ",
    }),
    false,
  );
  assert.equal(
    profileIdentityChanged(before, { ...before, login: "new.owner" }),
    true,
  );
  assert.equal(profileIdentityChanged(before, { ...before, email: "" }), true);
  assert.equal(
    profileIdentityChanged(
      { login: "staff", email: null },
      { login: "staff", email: "" },
    ),
    false,
  );
  const data = { name: "Name", ...before, currentPassword: "" };
  assert.ok(profileSchema.safeParse(data).success);
  for (const invalid of [
    { name: " " },
    { login: "bad login" },
    { email: "invalid" },
    { role: "OWNER" },
    { currentPassword: "x".repeat(73) },
  ])
    assert.equal(
      profileSchema.safeParse({ ...data, ...invalid }).success,
      false,
    );
});
const empty = {
  today: "2026-10-30",
  balances: { cash: "0.00" },
  units: [],
  parties: [],
  categories: [],
  staff: [],
  documents: [],
} as unknown as State;
const populated = {
  ...empty,
  units: [
    { id: id(1), model: "Phone", status: "IN_STOCK", imei: "123456789012345" },
  ],
  parties: ["supplier", "customer", "person"].map((kind, i) => ({
    id: id(i + 2),
    name: kind,
    kind,
    phone: "",
    address: "",
    active: true,
  })),
  staff: [{ id: id(5), name: "Staff", role: "STAFF" }],
  documents: [
    "sale",
    "purchase",
    "loan",
    "advance",
    "opening",
    "cashCount",
    "reversal",
  ].map((kind, i) => ({
    id: id(i + 6),
    kind,
    number: `TT-${i}`,
    due: "1.00",
    snapshot: {},
  })),
} as unknown as State;
const fields = (kind: CommandKind, overrides: Record<string, string> = {}) => ({
  ...formDefaults(kind, empty.today),
  ...overrides,
});
const scenarios: Record<CommandKind, Record<string, string>> = {
  opening: { cash: "0", bank: "0" },
  purchase: {
    model: "Phone",
    brand: "Brand",
    imei: "123456789012345",
    supplierId: id(2),
    cost: "1",
    paid: "0",
  },
  sale: { unitId: id(1), price: "1", cash: "1" },
  collection: { documentId: id(6), amount: "1" },
  supplierPayment: { documentId: id(7), amount: "1" },
  expense: {
    categoryId: "custom",
    expenseName: "Custom cost",
    amount: "1",
    note: "Reason",
  },
  transfer: { amount: "1" },
  contribution: { amount: "1", note: "Reason" },
  withdrawal: { amount: "1", note: "Reason" },
  loan: { partyId: id(4), amount: "1", note: "Reason" },
  loanRepayment: { documentId: id(8), amount: "1" },
  advance: { staffId: id(5), amount: "1", note: "Reason" },
  advanceRepayment: { documentId: id(9), amount: "1" },
  salary: { staffId: id(5), amount: "1" },
  cashCount: { counted: "0" },
  reversal: { documentId: id(6), note: "Correction reason" },
};
test("every transaction form supplies a valid payload with consistent English/Bengali fields", () => {
  assert.deepEqual(Object.keys(scenarios).sort(), Object.keys(commands).sort());
  for (const kind of Object.keys(scenarios) as CommandKind[]) {
    const raw = fields(kind, scenarios[kind]);
    const parsed = prepareForm(kind, raw, populated);
    assert.ok(commands[kind].safeParse(parsed).success, kind);
    for (const field of formFields(kind, raw)) {
      for (const lang of ["en", "bn"] as const)
        assert.notEqual(
          t(field.label, lang),
          field.label,
          `${kind}.${field.key} translation`,
        );
      assert.ok(
        field.type === "select" ||
          fieldMaxLength(kind, field) >= String(raw[field.key] || "").length,
      );
    }
  }
});
test("empty source lists explain the prerequisite and prevent a dead-end submission", () => {
  for (const kind of Object.keys(forms) as CommandKind[]) {
    const raw = fields(kind);
    const blockers = selectionBlockers(kind, raw, empty);
    for (const f of formFields(kind, raw).filter(
      (f) =>
        f.type === "select" && f.source && fieldRequired(kind, f, raw, empty),
    )) {
      if (!choices(f, empty, "en").length) {
        assert.ok(blockers[f.key], `${kind}.${f.key}`);
        assert.notEqual(t(blockers[f.key], "bn"), blockers[f.key]);
      }
    }
  }
  assert.equal(choices(forms.expense[0], empty, "bn")[0].value, "custom");
  assert.equal(
    selectionBlockers("sale", fields("sale", scenarios.sale), populated)
      .customerId,
    undefined,
  );
});
test("every required input rejects a blank and every fixed dropdown option remains valid", () => {
  for (const kind of Object.keys(scenarios) as CommandKind[]) {
    const raw = fields(kind, scenarios[kind]);
    for (const field of formFields(kind, raw)) {
      if (fieldRequired(kind, field, raw, populated)) {
        assert.throws(
          () => prepareForm(kind, { ...raw, [field.key]: "" }, populated),
          `${kind}.${field.key} blank`,
        );
      }
      for (const value of field.options || []) {
        assert.ok(
          prepareForm(kind, { ...raw, [field.key]: value }, populated),
          `${kind}.${field.key}=${value}`,
        );
      }
    }
  }
});
test("conditional contact, IMEI, reason and stale selection validation preserves optional blanks", () => {
  const sale = fields("sale", { ...scenarios.sale, cash: "0" });
  assert.throws(
    () => prepareForm("sale", sale, populated),
    /CUSTOMER_REQUIRED/,
  );
  assert.ok(prepareForm("sale", { ...sale, customerId: id(3) }, populated));
  const accessory = fields("purchase", {
    ...scenarios.purchase,
    category: "accessory",
  });
  assert.ok(!formFields("purchase", accessory).some((f) => f.key === "imei"));
  assert.equal(
    (prepareForm("purchase", accessory, populated) as any).imei,
    null,
  );
  assert.throws(() =>
    prepareForm(
      "purchase",
      fields("purchase", {
        ...scenarios.purchase,
        imei: "123",
        battery: "101",
      }),
      populated,
    ),
  );
  assert.throws(
    () =>
      prepareForm(
        "expense",
        fields("expense", {
          categoryId: "custom",
          amount: "1",
          note: "Reason",
        }),
        populated,
      ),
    /EXPENSE_NAME_REQUIRED/,
  );
  assert.throws(
    () =>
      prepareForm(
        "sale",
        fields("sale", { ...scenarios.sale, customerId: id(99) }),
        populated,
      ),
    /SELECTION_UNAVAILABLE/,
  );
  assert.equal(
    fieldRequired(
      "cashCount",
      forms.cashCount[1],
      fields("cashCount", { counted: "1" }),
      empty,
    ),
    true,
  );
  assert.equal(
    fieldRequired(
      "cashCount",
      forms.cashCount[1],
      fields("cashCount", { counted: "0" }),
      empty,
    ),
    false,
  );
  assert.equal(fields("salary").month, "2026-10");
  assert.throws(
    () =>
      prepareForm("cashCount", fields("cashCount", { counted: "1" }), empty),
    /REASON_REQUIRED/,
  );
  assert.ok(
    prepareForm("cashCount", fields("cashCount", { counted: "0" }), empty),
  );
});
test("correction choices exclude document types the API can never correct", () => {
  const options = choices(forms.reversal[0], populated, "en");
  assert.deepEqual(
    options.map((o) => o.value),
    [id(6), id(7), id(8), id(9)],
  );
  assert.ok(
    !choices(
      forms.reversal[0],
      { ...empty, documents: populated.documents.slice(4) },
      "bn",
    ).length,
  );
  const purchase = {
    ...populated.documents[1],
    unit_id: id(1),
    total: "10",
    due: "5",
    snapshot: { cost: "10", paid: "0" },
  };
  assert.equal(
    correctableDocument(purchase, populated),
    false,
    "paid portions must be corrected first",
  );
  assert.equal(
    correctableDocument(
      { ...purchase, due: "10" },
      { ...populated, units: [{ ...populated.units[0], status: "SOLD" }] },
    ),
    false,
    "a sold purchase cannot be corrected before its sale",
  );
});
