import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { invoiceShop, type Receipt } from "@tech-trolley/contracts";

test(
  "downloaded invoices are prepared as two complete A4 PDF pages, coalesce repeat reads and refresh changed seller data",
  { timeout: 90000 },
  async () => {
    const {
      InvoicePdfService,
    } = require("../dist/documents/invoice-pdf.service");
    const service = new InvoicePdfService();
    const receipt: Receipt = {
      id: "00000000-0000-4000-8000-000000000001",
      number: "TT-PDF-TEST",
      date: "2026-10-30",
      createdAt: "2026-10-30T06:00:00Z",
      reversed: false,
      shop: invoiceShop({ name: "Tech Trolley", address: "", phone: "" }),
      seller: { id: "saved-seller", name: "Taki", role: "OWNER" },
      customer: '<img src="https://example.invalid/private"> & Sample',
      phone: "01700-000000",
      address: "নমুনা ঠিকানা, ঢাকা",
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
        internalId: "ST-PDF",
      },
      price: "58000",
      discount: "0",
      cash: "58000",
      bank: "0",
      paid: "58000",
      total: "58000",
      originalDue: "0",
      outstandingDue: "0",
    };
    const pending = service.render(receipt),
      repeat = service.render(receipt);
    await assert.rejects(
      service.render({ ...receipt, number: "OTHER-PDF" }),
      (e: any) => e.getResponse().code === "PDF_BUSY",
    );
    const [first, duplicate] = await Promise.all([pending, repeat]);
    assert.equal(first, duplicate);
    assert.equal(await service.render(receipt), first);
    assert.equal(first.subarray(0, 5).toString(), "%PDF-");
    const doc = await PDFDocument.load(first, { updateMetadata: false });
    assert.equal(doc.getPageCount(), 2);
    assert.equal(doc.getTitle(), "TT-PDF-TEST - Tech Trolley");
    assert.equal(doc.getProducer(), "Tech Trolley");
    for (const page of doc.getPages()) {
      assert.ok(Math.abs(page.getWidth() - 595.276) < 1);
      assert.ok(Math.abs(page.getHeight() - 841.89) < 1);
    }
    const changed = await service.render({
      ...receipt,
      seller: { ...receipt.seller, name: "Saved Staff Name", role: "STAFF" },
    });
    assert.ok(!changed.equals(first));
    assert.equal((await PDFDocument.load(changed)).getPageCount(), 2);
  },
);
