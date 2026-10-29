import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceShop, type Receipt } from "@tech-trolley/contracts";
import { renderInvoiceBody, renderInvoiceHtml } from "@tech-trolley/invoice";

const receipt: Receipt = {
  shop: invoiceShop({ name: "Tech Trolley", address: "", phone: "" }),
  number: "TT-000167",
  createdAt: "2026-10-29T19:00:00Z",
  date: "2026-10-30",
  reversed: false,
  customer: "নমুনা ক্রেতা",
  phone: "01700-000000",
  address: "বনশ্রী, ঢাকা",
  seller: { id: "synthetic-seller", name: "Sample Staff", role: "STAFF" },
  unit: {
    model: "iPad (A16)",
    brand: "Apple",
    variant: "128 GB / Blue",
    imei: "000000000000167",
    internalId: "ST-000167",
    battery: null,
    box: "with",
    condition: "new",
    category: "phone",
  },
  price: "57000.00",
  discount: "1000.00",
  total: "56000.00",
  cash: "30000.00",
  bank: "20000.00",
  paid: "50000.00",
  originalDue: "6000.00",
  outstandingDue: "4000.00",
};
test("memo contains customer, original seller, serial, exact totals and approved shop policy", () => {
  const html = renderInvoiceHtml(receipt, "en");
  for (const value of [
    receipt.customer!,
    receipt.phone!,
    receipt.address!,
    receipt.seller.name,
    "Staff",
    "30 / 10 / 2026",
    "SUB TOTAL",
    "ADVANCE / PAID",
    "DUE AT SALE",
    "CURRENT DUE",
    "57,000",
    "56,000",
    "50,000",
    "6,000",
    "4,000",
    "25%",
    "2 Years Service Warranty",
    "<svg",
  ])
    assert.ok(html.includes(value), "Missing invoice detail: " + value);
  assert.ok(!html.includes("SAMPLE DATA"));
  assert.ok(
    renderInvoiceBody({
      ...receipt,
      seller: { ...receipt.seller, role: "OWNER" },
    }).includes("Owner"),
  );
  const large = renderInvoiceBody({ ...receipt, price: "999999999999.99" });
  assert.ok(large.includes("999,999,999,999.99"));
});
test("invoice escapes customer input and tolerates older API receipts without guessing a seller role", () => {
  const html = renderInvoiceBody({
    ...receipt,
    customer: '<img src=x onerror="attack()">',
    address: "<script>alert(1)</script>",
    seller: { ...receipt.seller, name: "A & B <Owner>", role: null },
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("A &amp; B &lt;Owner&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  const old = { ...receipt, shop: { ...receipt.shop } } as any;
  delete old.seller;
  delete old.paid;
  delete old.shop.warrantyPolicy;
  delete old.shop.qrUrl;
  const compatible = renderInvoiceBody(old);
  assert.ok(compatible.includes("SOLD BY"));
  assert.ok(compatible.includes("50,000"));
  assert.ok(!compatible.includes("undefined"));
});
