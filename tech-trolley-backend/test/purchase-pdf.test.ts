import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { renderPurchaseBody, renderPurchaseHtml } from "@tech-trolley/invoice";
import { samplePurchase } from "./fixtures/purchase";

test(
  "individual purchase PDF is one complete A4 page with two genuinely empty signature areas and frozen payment facts",
  { timeout: 90000 },
  async () => {
    const {
      InvoicePdfService,
    } = require("../dist/documents/invoice-pdf.service");
    const service = new InvoicePdfService();
    const pending = service.renderPurchase(samplePurchase),
      repeat = service.renderPurchase(samplePurchase);
    await assert.rejects(
      service.renderPurchase({ ...samplePurchase, number: "another" }),
      (e: any) => e.getResponse().code === "PDF_BUSY",
    );
    const [bytes, again] = await Promise.all([pending, repeat]);
    assert.equal(bytes, again);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.276) < 1);
    assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < 1);
    const html = renderPurchaseBody(samplePurchase);
    assert.equal(
      (html.match(/class="tt-purchase__signature-space"><\/div>/g) || [])
        .length,
      2,
    );
    assert.ok(!html.includes(samplePurchase.buyer.name));
    assert.ok(html.includes("5,000/="));
    assert.ok(html.includes("Tech Trolley</em>"));
    assert.ok(!html.includes("Tech Trolly"));
    assert.ok(html.includes("20 / 05 / 1995"));
    assert.ok(html.includes("tt-purchase__identity-pair"));
    assert.ok(html.includes("<strong>40,000/=</strong>"));
    const escaped = renderPurchaseHtml({
      ...samplePurchase,
      seller: {
        ...samplePurchase.seller,
        sellerName: '<img src="https://example.invalid/secret">',
      },
    });
    assert.ok(escaped.includes("&lt;img"));
    assert.ok(!escaped.includes('<img src="https://'));
    const long = {
      ...samplePurchase,
      number: "LONG-INPUT-QA",
      seller: {
        ...samplePurchase.seller,
        sellerName: "ন".repeat(80),
        fatherName: "প".repeat(80),
        motherName: "ম".repeat(80),
        presentAddress: "ঢাকা ".repeat(48),
        permanentAddress: "ঢাকা ".repeat(48),
        identityNumber: "X".repeat(60),
        nomineeName: "ন".repeat(80),
      },
      unit: {
        ...samplePurchase.unit,
        brand: "B".repeat(60),
        model: "M".repeat(100),
        storage: "S".repeat(40),
        color: "C".repeat(40),
        variant: "V".repeat(80),
        accessories: "A".repeat(120),
      },
    };
    const maximum = await service.renderPurchase(long);
    assert.equal((await PDFDocument.load(maximum)).getPageCount(), 1);
    const wide = {
      ...long,
      number: "WIDE-INPUT-QA",
      seller: {
        ...long.seller,
        sellerName: "W".repeat(80),
        fatherName: "W".repeat(80),
        motherName: "W".repeat(80),
        presentAddress: "W".repeat(240),
        permanentAddress: "W".repeat(240),
        nomineeName: "W".repeat(80),
      },
    };
    const wideBytes = await service.renderPurchase(wide);
    assert.equal((await PDFDocument.load(wideBytes)).getPageCount(), 1);
    const legacy = {
      ...samplePurchase,
      number: "LEGACY-PURCHASE-QA",
      seller: { ...samplePurchase.seller },
    };
    delete legacy.seller.dateOfBirth;
    delete legacy.seller.permanentAddress;
    assert.equal(
      (
        await PDFDocument.load(await service.renderPurchase(legacy))
      ).getPageCount(),
      1,
    );
  },
);
