// Regenerate the public hand-fillable form without touching saved purchases.
// Run after npm run build:shared. No database or authentication is involved.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";
import { purchaseDeclarationTerms } from "@tech-trolley/contracts";
import { renderPurchaseHtml, fitPurchaseLayout } from "@tech-trolley/invoice";

const root = fileURLToPath(new URL("../", import.meta.url));
const font =
  "data:font/ttf;base64," +
  (
    await readFile(
      resolve(root, "tech-trolley-backend/assets/NotoSansBengali.ttf"),
    )
  ).toString("base64");
// Formatter-only zeros are removed from the DOM before any PDF is written.
const form = {
  id: "",
  number: "",
  date: "0000-00-00",
  reversed: false,
  buyer: { name: "", role: "OWNER" },
  seller: {
    sellerName: "",
    sellerPhone: "",
    fatherName: "",
    motherName: "",
    presentAddress: "",
    permanentAddress: "",
    identityNumber: "",
    nomineeName: "",
    nomineePhone: "",
  },
  unit: {
    brand: "",
    model: "",
    storage: "",
    color: "",
    variant: "",
    imei: "",
    condition: "",
    battery: null,
    box: "without",
    accessories: "",
  },
  total: "0",
  cash: "0",
  bank: "0",
  originalDue: "0",
  terms: purchaseDeclarationTerms,
};
const blankStyles =
  ".tt-purchase__fill,.tt-purchase__value{min-height:6mm}.tt-purchase__payments strong{display:inline-block;min-width:24mm;min-height:5mm;border-bottom:.35mm dotted #555}";
const html = renderPurchaseHtml(form, { font }).replace(
  "</head>",
  `<style>${blankStyles}</style></head>`,
);
const windows = process.platform === "win32";
chromium.setGraphicsMode = false;
const browser = await puppeteer.launch({
  executablePath: windows
    ? resolve(
        process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
        "Microsoft/Edge/Application/msedge.exe",
      )
    : await chromium.executablePath(),
  args: windows ? [] : chromium.args,
  headless: true,
});
let bytes;
try {
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.emulateMediaType("print");
  await page.setContent(html);
  const empty = await page.evaluate(() => {
    const slots = [
      ...document.querySelectorAll(
        ".tt-purchase__fill,.tt-purchase__value,.tt-purchase__digits span,.tt-purchase__payments strong",
      ),
    ];
    for (const slot of slots) slot.textContent = "";
    document.title = "Tech Trolley - Blank A4 purchase form";
    return (
      slots.length >= 25 &&
      slots.every((slot) => slot.textContent === "") &&
      document.querySelectorAll(".tt-purchase__digits span").length === 8
    );
  });
  assert.ok(
    empty,
    "All dynamic fields, date boxes and payment amounts must be empty",
  );
  assert.ok(
    await page.evaluate(fitPurchaseLayout),
    "Blank form must fit without consuming signature areas",
  );
  bytes = await page.pdf({
    format: "A4",
    preferCSSPageSize: true,
    printBackground: true,
  });
} finally {
  await browser.close();
}
const pdf = await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(), 1);
assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.276) < 1);
assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 1);
pdf.setTitle("Tech Trolley - Blank A4 purchase form");
pdf.setProducer("Tech Trolley");
const output = await pdf.save();
await mkdir(resolve(root, "output/pdf"), { recursive: true });
await mkdir(resolve(root, "tech-trolley-frontend/public/samples"), {
  recursive: true,
});
for (const file of [
  "output/pdf/tech-trolley-blank-a4.pdf",
  "tech-trolley-frontend/public/samples/tech-trolley-purchase-blank-a4.pdf",
  // Older app tabs can still request the original sample path.
  "tech-trolley-frontend/public/samples/tech-trolley-purchase-sample.pdf",
])
  await writeFile(resolve(root, file), output);
console.log(
  JSON.stringify({
    generated: "blank A4 purchase form",
    pages: 1,
    allInputFieldsEmpty: true,
  }),
);
