// Generate the actual web Invoice component inside its real modal/CSS wrapper.
// Render these local HTML files with a browser PDF renderer; no database writes.
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { invoiceShop, type Receipt } from "@tech-trolley/contracts";
import { renderInvoiceHtml } from "@tech-trolley/invoice";
import { Invoice } from "../tech-trolley-frontend/src/features/transactions/invoice";

const directory = path.resolve("tmp/pdfs");
fs.mkdirSync(directory, { recursive: true });
const font =
  "data:font/ttf;base64," +
  fs
    .readFileSync("tech-trolley-frontend/public/fonts/NotoSansBengali.ttf")
    .toString("base64");
const css = fs.readFileSync(
  "tech-trolley-frontend/src/app/globals.css",
  "utf8",
);
const sample: Receipt = {
  shop: invoiceShop({ name: "Tech Trolley", address: "", phone: "" }),
  number: "PREVIEW-000001",
  date: "2026-10-30",
  createdAt: "2026-10-30T06:00:00Z",
  reversed: false,
  customer: "Sample Customer",
  phone: "01700-000000",
  address: "Dhaka",
  seller: { id: "sample", name: "Sample Seller", role: "STAFF" },
  unit: {
    brand: "Apple",
    model: "iPhone 17 Pro Max",
    storage: "512",
    color: "Silver",
    variant: "Australia",
    battery: 100,
    box: "with",
    condition: "used",
    category: "phone",
    imei: "000000000000001",
    internalId: "ST-PREVIEW",
  },
  price: "140000",
  discount: "0",
  total: "140000",
  paid: "140000",
  cash: "40000",
  bank: "100000",
  originalDue: "0",
  outstandingDue: "0",
};
const long: Receipt = {
  ...sample,
  customer: "নমুনা গ্রাহকের দীর্ঘ নাম ".repeat(8).slice(0, 180),
  address: "বাসা ১২, রোড ৪, বনশ্রী, রামপুরা, ঢাকা ১২১৯। "
    .repeat(9)
    .slice(0, 300),
  seller: {
    ...sample.seller,
    name: "নমুনা বিক্রয় প্রতিনিধির দীর্ঘ নাম ".repeat(7).slice(0, 180),
  },
  unit: {
    ...sample.unit,
    brand: "Sample Brand ".repeat(15).slice(0, 180),
    model: "Sample model name ".repeat(12).slice(0, 180),
    storage: "512 GB",
    color: "Deep Blue",
    variant: "International region ".repeat(6).slice(0, 120),
  },
  price: "999999999999.99",
  total: "999999999999.99",
  paid: "999999999999.99",
  cash: "999999999999.99",
  bank: "0",
};
const multiple: Receipt = {
  ...sample,
  items: [
    { unit: sample.unit, quantity: 1, price: "140000" },
    {
      unit: {
        ...sample.unit,
        brand: "Test",
        model: "Protective Case",
        storage: "",
        color: "Blue",
        variant: "",
        battery: null,
        box: "unspecified",
        category: "accessory",
      },
      quantity: 2,
      price: "2000",
    },
  ],
  price: "142000",
  total: "142000",
  paid: "142000",
  cash: "42000",
};
const four: Receipt = {
  ...sample,
  items: Array.from({ length: 4 }, (_, i) => ({
    unit: { ...sample.unit, model: "iPhone 17 Pro " + (i + 1) },
    quantity: 1,
    price: "35000",
  })),
};
const wrapped: Receipt = {
  ...multiple,
  seller: long.seller,
  items: multiple.items!.map((item, index) =>
    index
      ? item
      : {
          ...item,
          unit: {
            ...item.unit,
            model:
              "iPhone 17 Pro Max with a long saved product description and individually tracked specifications",
            color: "Natural Titanium Silver",
          },
        },
  ),
};
const cases: Record<string, Receipt> = {
  sample,
  long,
  multiple,
  four,
  wrapped,
};
const source = process.argv[2];
if (source) cases.corrected = JSON.parse(fs.readFileSync(source, "utf8"));
for (const [name, receipt] of Object.entries(cases)) {
  const title = `${receipt.number} - ${receipt.shop.name}`.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
  const body = renderToStaticMarkup(
    React.createElement(Invoice, { receipt, lang: "en" }),
  );
  const watermark =
    name === "corrected"
      ? ""
      : '<div style="position:absolute;top:1mm;left:60mm;font-size:7pt;color:#99701c;z-index:5">PREVIEW / SAMPLE DATA - NOT A REAL SALE</div>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>@font-face{font-family:InvoiceBangla;src:url("${font}") format("truetype");font-weight:100 900}${css}</style></head><body><div class="app"><aside class="sidebar">App navigation</aside><main class="workspace">Workspace</main><div class="modal-backdrop receipt-backdrop"><section class="modal receipt"><header>Invoice controls</header>${watermark}${body}<footer>Print controls</footer></section></div></div></body></html>`;
  fs.writeFileSync(path.join(directory, `invoice-${name}-web.html`), html);
}
fs.writeFileSync(
  path.join(directory, "invoice-native.html"),
  renderInvoiceHtml(sample, "bn", { font, sample: true }),
);
console.log(
  JSON.stringify({
    prepared: Object.keys(cases),
    nativeStandalone: true,
    businessWrites: 0,
  }),
);
