import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  invoiceShop,
  invoiceSellerName,
  type Receipt,
} from "@tech-trolley/contracts";
import {
  renderInvoiceBody,
  renderInvoiceHtml,
  invoiceProductDescription,
  invoiceStyles,
} from "@tech-trolley/invoice";
import { memoQrSvg, memoQrUrl } from "../../packages/invoice/src/artwork";

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
    storage: "128 GB",
    color: "Blue",
    variant: "International",
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
    "30 / 10 / 2026",
    "SUB TOTAL",
    "ADVANCE",
    "DUE",
    "CURRENT DUE",
    "57,000",
    "56,000",
    "50,000",
    "6,000",
    "4,000",
    "25%",
    "2 Years Service Warranty",
    "<svg",
    "Storage: 128 GB · Color: Blue",
    "Variant: International",
    "Box Included",
    "TERMS &amp; CONDITIONS FOR AFTER SALES SERVICE",
    "CUSTOMER SIGNATURE",
    "DELIVERY TYPE",
    "বিক্রিত পণ্য অফেরতযোগ্য।",
  ])
    assert.ok(html.includes(value), "Missing invoice detail: " + value);
  assert.ok(!html.includes("SAMPLE DATA"));
  assert.equal(
    renderInvoiceBody({
      ...receipt,
      seller: { ...receipt.seller, role: "OWNER" },
    }),
    renderInvoiceBody(receipt),
  );
  assert.ok(!html.includes("SOLD BY"));
  assert.ok(!html.includes("data-seller-role"));
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
  delete old.shop.afterSalesTerms;
  const compatible = renderInvoiceBody(old);
  assert.ok(!compatible.includes("SOLD BY"));
  assert.ok(compatible.includes('class="tt-memo__seller"><strong></strong>'));
  assert.ok(compatible.includes("50,000"));
  assert.ok(!compatible.includes("undefined"));
});

test("seller names preserve real history and only legacy role placeholders use the same seller's profile", () => {
  assert.equal(
    invoiceSellerName("Original seller", "Renamed profile"),
    "Original seller",
  );
  for (const saved of ["Owner", "STAFF", " মালিক ", "", "—", undefined]) {
    assert.equal(invoiceSellerName(saved, "Actual Seller"), "Actual Seller");
    assert.equal(invoiceSellerName(saved, "Owner"), "Owner");
  }
  const html = renderInvoiceBody({
    ...receipt,
    seller: { ...receipt.seller, name: "Owner" },
  });
  assert.ok(html.includes('class="tt-memo__seller"><strong>Owner</strong>'));
});

test("product descriptions label supplied specifications, normalize capacity and avoid duplicate brands", () => {
  const unit = {
    ...receipt.unit,
    brand: "Iphone",
    model: "iphone 17 pro max",
    storage: "512",
    battery: 100,
  };
  assert.deepEqual(invoiceProductDescription(unit), {
    name: "iphone 17 pro max",
    lines: [
      "Storage: 512 GB · Color: Blue",
      "Variant: International",
      "Battery Health: 100% · Box Included",
    ],
  });
  assert.equal(
    invoiceProductDescription({ ...unit, storage: "1tb" }).lines[0],
    "Storage: 1 TB · Color: Blue",
  );
  assert.deepEqual(
    invoiceProductDescription({
      ...unit,
      brand: "",
      model: "Case",
      storage: "",
      color: "",
      variant: "",
      battery: null,
      box: "unspecified",
    }),
    { name: "Case", lines: [] },
  );
  assert.ok(
    invoiceProductDescription({ ...unit, battery: 0 })
      .lines.at(-1)
      ?.includes("0%"),
  );
});

test("one merged body has one full-logo watermark while each supplied product retains its own aligned row", () => {
  const html = renderInvoiceBody({
    ...receipt,
    items: [
      { unit: receipt.unit, quantity: 1, price: "57000" },
      {
        unit: { ...receipt.unit, model: "Case", brand: "Test" },
        quantity: 2,
        price: "900",
      },
    ],
  });
  assert.equal((html.match(/class="tt-memo__watermark"/g) || []).length, 1);
  assert.equal(
    (html.match(/role="row" class="tt-memo__product-row"/g) || []).length,
    2,
  );
  assert.ok(html.includes('tt-memo__quantity">2</div>'));
  assert.ok(html.includes('tt-memo__price">900/=</div>'));
  assert.ok(html.includes("Apple iPad (A16)"));
  assert.ok(html.includes("Test Case"));
  assert.ok(!html.includes('rowspan="4"'));
  assert.ok(!invoiceStyles.includes("repeating-linear-gradient"));
  assert.ok(invoiceStyles.includes("--mm:1mm"));
  assert.ok(!invoiceStyles.includes("overflow:hidden"));
});

test("two A4 sides retain the supplied memo headings and all 12 policy clauses in either UI language", () => {
  const html = renderInvoiceBody(receipt, "bn");
  assert.equal((html.match(/<article /g) || []).length, 2);
  assert.equal((html.match(/<li>/g) || []).length, 16);
  assert.ok(html.includes("INVOICE NO:"));
  assert.ok(html.includes("OUR WARRANTY POLICY:"));
  assert.ok(!html.includes("tech-trolley-logo.png"));
  const escaped = renderInvoiceBody({
    ...receipt,
    shop: { ...receipt.shop, afterSalesTerms: ["<script>bad()</script>"] },
  });
  assert.ok(escaped.includes("&lt;script&gt;bad()&lt;/script&gt;"));
  assert.ok(!escaped.includes("<script>"));
});

test("new-sale QR preserves the supplied scan destination and every source module", () => {
  assert.equal(
    memoQrUrl,
    "https://www.facebook.com/share/1CWzbVs5hb/?mibextid=wwXIfr",
  );
  assert.equal(receipt.shop.qrUrl, memoQrUrl);
  const cells = Array.from({ length: 37 }, () => Array(37).fill("0"));
  for (const match of memoQrSvg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    const x = Number(match[1]) - 4,
      y = Number(match[2]) - 4;
    assert.ok(x >= 0 && x < 37 && y >= 0 && y < 37);
    cells[y][x] = "1";
  }
  const hash = createHash("sha256")
    .update(cells.map((row) => row.join("")).join("\n"))
    .digest("hex");
  assert.equal(
    hash,
    "3dfa5a614eb2d6ab2727e567a02e02e919322bbe370b0ec15800d42652a43454",
  );
});
