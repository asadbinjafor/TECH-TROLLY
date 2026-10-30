import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commands,
  forms,
  choices,
  formDefaults,
  restoreFormDraft,
  paymentHelp,
  formFields,
  fieldRequired,
  fieldMaxLength,
  selectionBlockers,
  prepareForm,
  profileSchema,
  profileIdentityChanged,
  correctableDocument,
  unitFormValues,
  returnPreview,
  changeFormValue,
  ramOptions,
  storageOptions,
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
  user: { role: "OWNER" },
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
    "purchaseReturn",
  ].map((kind, i) => ({
    id: id(i + 6),
    kind,
    number: `TT-${i}`,
    due: "1.00",
    total: "1.00",
    unit_id: kind === "purchase" ? id(1) : null,
    snapshot: {},
  })),
} as unknown as State;
const fields = (kind: CommandKind, overrides: Record<string, string> = {}) => ({
  ...formDefaults(kind, empty.today),
  ...overrides,
});
const scenarios: Record<CommandKind, Record<string, string>> = {
  stockEdit: {
    unitId: id(1),
    revision: "0",
    model: "Phone",
    brand: "Brand",
    imei: "123456789012345",
    note: "Correct label",
  },
  purchaseReturn: {
    unitId: id(1),
    revision: "0",
    returnValue: "1",
    note: "Faulty item accepted by supplier",
  },
  supplierRefund: { documentId: id(13), amount: "1" },
  opening: { cash: "0", bank: "0" },
  purchase: {
    phoneType: "iphone",
    storage: "128 GB",
    model: "Phone",
    brand: "Brand",
    imei: "123456789012345",
    supplierId: id(2),
    cost: "1",
    paid: "0",
  },
  individualPurchase: {
    phoneType: "iphone",
    storage: "128 GB",
    sellerName: "Seller",
    sellerPhone: "01700000000",
    fatherName: "Father",
    motherName: "Mother",
    presentAddress: "Dhaka",
    permanentAddress: "Dhaka",
    identityNumber: "QA-NID-ONLY",
    dateOfBirth: "1995-05-20",
    nomineeName: "Nominee",
    nomineePhone: "01800000000",
    model: "Phone",
    brand: "Brand",
    imei: "123456789012346",
    box: "without",
    cost: "1",
    cash: "1",
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
test("stock review uses current details, rejects stale revisions and keeps refunds within their actual due", () => {
  const stock = {
    ...populated.units[0],
    cost: "105.00",
    revision: 7,
    brand: "QA",
    variant: "Japan",
    storage: "128",
    color: "Blue",
    category: "phone",
    condition: "used",
    battery: 80,
    box: "with",
  };
  const state = {
    ...populated,
    units: [stock],
    documents: populated.documents.map((d) =>
      d.kind === "purchase" ? { ...d, total: "100.00", due: "30.00" } : d,
    ),
  } as State;
  const draft = {
    ...unitFormValues("stockEdit", stock),
    unitId: stock.id,
    note: "Correct physical label",
  };
  const changed = prepareForm(
    "stockEdit",
    { ...draft, variant: "USA" },
    state,
  ) as any;
  assert.equal(changed.revision, 7);
  assert.equal(changed.variant, "USA");
  assert.ok(!("cost" in changed));
  assert.throws(() =>
    prepareForm("stockEdit", { ...draft, revision: "6" }, state),
  );
  const raw = {
    unitId: stock.id,
    revision: "7",
    returnValue: "80",
    note: "Supplier accepted return with deduction",
  };
  assert.deepEqual(returnPreview(state, raw), {
    purchaseAmount: "100.00",
    returnOffset: "30.00",
    refundDue: "50.00",
    returnLoss: "25.00",
  });
  assert.ok(prepareForm("purchaseReturn", raw, state));
  assert.throws(() =>
    prepareForm("purchaseReturn", { ...raw, returnValue: "100.01" }, state),
  );
  assert.ok(prepareForm("purchaseReturn", { ...raw, returnValue: "0" }, state));
  assert.throws(() =>
    prepareForm("purchaseReturn", { ...raw, returnValue: "" }, state),
  );
  assert.throws(() =>
    prepareForm(
      "supplierRefund",
      fields("supplierRefund", { documentId: id(13), amount: "1.01" }),
      state,
    ),
  );
  assert.equal(choices(forms.supplierRefund[0], state, "en")[0].value, id(13));
});
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
        if (field.uiOnly || ["phoneType", "ram", "storage"].includes(field.key))
          continue;
        assert.ok(
          prepareForm(kind, { ...raw, [field.key]: value }, populated),
          `${kind}.${field.key}=${value}`,
        );
      }
    }
  }
});
test("phone selection shows only Android RAM, uses exact capacities and filters sale stock without posting UI metadata", () => {
  for (const kind of ["purchase", "individualPurchase"] as const) {
    const base = fields(kind, scenarios[kind]);
    assert.ok(!formFields(kind, base).some((f) => f.key === "ram"));
    for (const storage of storageOptions)
      assert.ok(prepareForm(kind, { ...base, storage }, populated));
    for (const ram of ramOptions)
      assert.ok(
        prepareForm(kind, { ...base, phoneType: "android", ram }, populated),
      );
    assert.throws(() =>
      prepareForm(kind, { ...base, phoneType: "android", ram: "" }, populated),
    );
    assert.throws(() =>
      prepareForm(kind, { ...base, storage: "32 GB" }, populated),
    );
    const iphone = changeFormValue(
      kind,
      { ...base, phoneType: "android", ram: "8 GB" },
      "phoneType",
      "iphone",
      populated,
    );
    assert.equal(iphone.ram, "");
    assert.ok(!formFields(kind, iphone).some((f) => f.key === "ram"));
  }
  const android = {
    ...populated.units[0],
    phoneType: "android" as const,
    ram: "8 GB",
    storage: "256 GB",
  };
  const iphone = {
    ...android,
    id: id(22),
    phoneType: "iphone" as const,
    ram: null,
  };
  const state = { ...populated, units: [android, iphone] };
  const unitField = forms.sale.find((f) => f.key === "unitId")!;
  assert.deepEqual(
    choices(unitField, state, "en", {
      phoneType: "android",
      ram: "8 GB",
      storage: "256 GB",
    }).map((o) => o.value),
    [android.id],
  );
  const selected = {
    ...fields("sale", scenarios.sale),
    ...unitFormValues("sale", android),
    unitId: android.id,
    price: "10",
    cash: "10",
  };
  const payload = prepareForm("sale", selected, state) as any;
  for (const key of ["phoneType", "ram", "storage"])
    assert.equal(payload[key], undefined);
  const changed = changeFormValue(
    "sale",
    selected,
    "phoneType",
    "iphone",
    state,
  );
  assert.equal(changed.unitId, "");
  assert.equal(changed.price, "");
  assert.equal(changed.ram, "");
  assert.equal(choices(unitField, state, "en").length, 2);
});
test("all numeric inputs start empty; old optional-zero drafts reopen empty without losing real input", () => {
  for (const kind of Object.keys(forms) as CommandKind[])
    for (const field of forms[kind].filter(
      (f) => f.type === "money" || f.type === "number",
    ))
      assert.equal(fields(kind)[field.key], "", `${kind}.${field.key}`);
  const draft = restoreFormDraft(
    "sale",
    {
      unitId: id(1),
      price: "25.00",
      discount: "0",
      cash: "25.00",
      bank: "0.00",
    },
    empty.today,
  );
  assert.deepEqual(
    [draft.price, draft.discount, draft.cash, draft.bank],
    ["25.00", "", "25.00", ""],
  );
  assert.equal(
    restoreFormDraft("cashCount", { counted: "0" }, empty.today).counted,
    "0",
  );
  assert.equal(
    restoreFormDraft("sale", { discount: "invalid" }, empty.today).discount,
    "invalid",
  );
});
test("sale accepts blank discount and either unused payment side, mixed payments and tracked credit", () => {
  for (const [cash, bank, discount] of [
    ["100", "", ""],
    ["", "100", ""],
    ["60.25", "39.75", ""],
    ["90", "", "10"],
    ["", "90", "10"],
    ["60", "30", "10"],
    ["999999999999.99", "", ""],
  ] as const) {
    const price = cash === "999999999999.99" ? cash : "100";
    const raw = fields("sale", { unitId: id(1), price, cash, bank, discount });
    const parsed = prepareForm("sale", raw, populated) as any;
    assert.equal(parsed.discount, discount || "0");
    assert.equal(parsed.cash, cash || "0");
    assert.equal(parsed.bank, bank || "0");
    assert.equal(parsed.customerId, null);
    for (const key of ["cash", "bank", "discount", "customerId"])
      assert.equal(
        fieldRequired(
          "sale",
          forms.sale.find((f) => f.key === key)!,
          raw,
          populated,
        ),
        false,
      );
  }
  assert.equal(
    paymentHelp("sale", fields("sale", { price: "100", cash: "100" })),
    "fullCashPaymentHelp",
  );
  assert.equal(
    paymentHelp("sale", fields("sale", { price: "100", bank: "100" })),
    "fullBankPaymentHelp",
  );
  const partials: Record<string, string>[] = [
    {},
    { cash: "40" },
    { bank: "40" },
  ];
  for (const payments of partials) {
    const raw = fields("sale", { unitId: id(1), price: "100", ...payments });
    assert.equal(paymentHelp("sale", raw), "creditPaymentHelp");
    assert.throws(
      () => prepareForm("sale", raw, populated),
      /CUSTOMER_REQUIRED/,
    );
    assert.ok(prepareForm("sale", { ...raw, customerId: id(3) }, populated));
  }
  const invalidPayments: Record<string, string>[] = [
    { cash: "101" },
    { cash: "60", bank: "41" },
    { discount: "100" },
    { discount: "101" },
    { cash: "-1" },
    { cash: "1.001" },
    { discount: "oops" },
    { price: "" },
    { price: "0" },
  ];
  for (const invalid of invalidPayments)
    assert.throws(() =>
      prepareForm(
        "sale",
        fields("sale", {
          unitId: id(1),
          price: "100",
          customerId: id(3),
          ...invalid,
        }),
        populated,
      ),
    );
});
test("zero-allowed dependencies stay optional while actual payments require their account", () => {
  const purchase = fields("purchase", {
    ...scenarios.purchase,
    paid: "",
    procurement: "",
    account: "",
    treatment: "",
  });
  const parsed = prepareForm("purchase", purchase, populated) as any;
  assert.deepEqual(
    [parsed.paid, parsed.procurement, parsed.account, parsed.treatment],
    ["0", "0", "cash", "capitalize"],
  );
  for (const key of ["paid", "procurement", "account", "treatment"])
    assert.equal(
      fieldRequired(
        "purchase",
        forms.purchase.find((f) => f.key === key)!,
        purchase,
        populated,
      ),
      false,
    );
  assert.ok(
    prepareForm(
      "purchase",
      { ...purchase, paid: "0.00", procurement: "0.00" },
      populated,
    ),
  );
  assert.throws(() =>
    prepareForm("purchase", { ...purchase, paid: "1" }, populated),
  );
  assert.throws(() =>
    prepareForm("purchase", { ...purchase, procurement: "1" }, populated),
  );
  assert.ok(
    prepareForm(
      "purchase",
      { ...purchase, paid: "1", account: "bank" },
      populated,
    ),
  );
  assert.ok(
    prepareForm(
      "purchase",
      { ...purchase, procurement: "1", treatment: "expense", account: "cash" },
      populated,
    ),
  );
  assert.throws(
    () =>
      prepareForm(
        "purchase",
        { ...purchase, paid: "2", account: "cash" },
        populated,
      ),
    /PAYMENT_INVALID/,
  );
  const opening = prepareForm(
    "opening",
    fields("opening", { bank: "100" }),
    populated,
  ) as any;
  assert.deepEqual(opening, { cash: "0", bank: "100" });
  assert.deepEqual(prepareForm("opening", fields("opening"), populated), {
    cash: "0",
    bank: "0",
  });
  const salary = fields("salary", { ...scenarios.salary, account: "" });
  assert.throws(() => prepareForm("salary", salary, populated));
  assert.equal(
    (prepareForm("salary", { ...salary, account: "cash" }, populated) as any)
      .applyAdvance,
    "0",
  );
  assert.ok(prepareForm("salary", { ...salary, applyAdvance: "1" }, populated));
  assert.throws(
    () =>
      prepareForm(
        "salary",
        { ...salary, applyAdvance: "2", account: "cash" },
        populated,
      ),
    /PAYMENT_INVALID/,
  );
  assert.throws(() => prepareForm("cashCount", fields("cashCount"), populated));
  assert.ok(
    prepareForm("cashCount", fields("cashCount", { counted: "0" }), populated),
  );
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
test("individual purchase needs no supplier list, keeps permanent address optional and validates birth date", () => {
  const keys = forms.individualPurchase.map((f) => f.key);
  assert.ok(!keys.includes("supplierId"));
  assert.equal(keys.indexOf("dateOfBirth"), keys.indexOf("identityNumber") + 1);
  const raw = fields("individualPurchase", {
    ...scenarios.individualPurchase,
    permanentAddress: "",
    supplierId: id(2),
  });
  const prepared: any = prepareForm("individualPurchase", raw, empty);
  assert.equal(prepared.permanentAddress, "");
  assert.equal(prepared.supplierId, undefined);
  assert.equal(prepared.dateOfBirth, "1995-05-20");
  assert.equal(
    restoreFormDraft("individualPurchase", raw, empty.today).supplierId,
    undefined,
  );
  for (const dateOfBirth of ["", "2025-02-29", "2026-02-30", "2999-01-01"])
    assert.throws(() =>
      prepareForm("individualPurchase", { ...raw, dateOfBirth }, empty),
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
