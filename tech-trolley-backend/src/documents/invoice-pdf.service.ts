import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";
import { renderInvoiceHtml } from "@tech-trolley/invoice";
import type { Receipt } from "@tech-trolley/contracts";
import { fail } from "../common/errors";
import { invoiceRendererHash } from "./invoice-version";

@Injectable()
export class InvoicePdfService {
  private readonly font =
    "data:font/ttf;base64," +
    readFileSync(
      resolve(__dirname, "../../assets/NotoSansBengali.ttf"),
    ).toString("base64");
  private readonly cache = new Map<
    string,
    { bytes: Buffer; expires: number }
  >();
  private running?: { key: string; result: Promise<Buffer> };

  async render(receipt: Receipt): Promise<Buffer> {
    const key = createHash("sha256")
      .update(invoiceRendererHash + JSON.stringify(receipt))
      .digest("hex");
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.bytes;
    if (this.running) {
      if (this.running.key === key) return this.running.result;
      fail("PDF_BUSY", 503);
    }
    const result = this.generate(receipt)
      .then((bytes) => {
        this.cache.set(key, { bytes, expires: Date.now() + 10 * 60_000 });
        while (this.cache.size > 4)
          this.cache.delete(this.cache.keys().next().value!);
        return bytes;
      })
      .finally(() => {
        this.running = undefined;
      });
    this.running = { key, result };
    return result;
  }

  private async generate(receipt: Receipt): Promise<Buffer> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    let stage = "launch";
    try {
      const windows = process.platform === "win32";
      chromium.setGraphicsMode = false;
      browser = await puppeteer.launch({
        executablePath: windows
          ? resolve(
              process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
              "Microsoft/Edge/Application/msedge.exe",
            )
          : await chromium.executablePath(),
        args: windows ? [] : chromium.args,
        headless: true,
        timeout: 20_000,
      });
      const page = await browser.newPage();
      stage = "render";
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        // The template, vector artwork and font are entirely inline. No remote
        // URLs, local files, user HTML or page scripts can be fetched/executed.
        if (
          request.url().startsWith("data:") ||
          request.url() === "about:blank"
        )
          void request.continue();
        else void request.abort();
      });
      await page.setContent(
        renderInvoiceHtml(receipt, "en", { font: this.font }),
        { waitUntil: "load", timeout: 15_000 },
      );
      await page.emulateMediaType("print");
      const fits = await page.evaluate(async () => {
        await document.fonts.ready;
        const rect = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect();
        const body = document.querySelector(
          ".tt-memo__items-body",
        ) as HTMLElement;
        const front = rect(".tt-memo__front"),
          back = rect(".tt-memo__back");
        return (
          body.scrollHeight <= body.clientHeight + 1 &&
          Array.from(document.querySelectorAll(".tt-memo__product-row")).every(
            (row) =>
              row.getBoundingClientRect().bottom <=
              body.getBoundingClientRect().bottom + 1,
          ) &&
          rect(".tt-memo__accounting").bottom <
            rect(".tt-memo__authorised").top &&
          rect(".tt-memo__warranty ul").bottom <=
            rect(".tt-memo__warranty").bottom + 1 &&
          rect(".tt-memo__terms").bottom < rect(".tt-memo__delivery").top &&
          rect(".tt-memo__thanks").bottom <= front.bottom + 1 &&
          rect(".tt-memo__back-footer").bottom <= back.bottom + 1
        );
      });
      if (!fits) return fail("PDF_LAYOUT_ERROR", 503);
      const bytes = await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
        waitForFonts: true,
        timeout: 30_000,
      });
      const pdf = await PDFDocument.load(bytes);
      stage = "validate";
      if (
        pdf.getPageCount() !== 2 ||
        pdf
          .getPages()
          .some(
            (page) =>
              Math.abs(page.getWidth() - 595.276) > 1 ||
              Math.abs(page.getHeight() - 841.89) > 1,
          )
      )
        fail("PDF_LAYOUT_ERROR", 503);
      pdf.setTitle(`${receipt.number} - ${receipt.shop.name}`);
      pdf.setCreator("Tech Trolley");
      pdf.setProducer("Tech Trolley");
      return Buffer.from(await pdf.save());
    } catch (error: any) {
      if (error?.getStatus) throw error;
      console.error("Invoice PDF generation failed", {
        type: error?.constructor?.name,
        stage,
        ...(stage === "launch"
          ? { launch: String(error?.message || "").slice(0, 600) }
          : {}),
      });
      return fail("PDF_GENERATION_FAILED", 503);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
