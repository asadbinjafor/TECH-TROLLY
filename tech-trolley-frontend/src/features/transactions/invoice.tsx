"use client";
import type { Language, Receipt } from "@tech-trolley/contracts";
import { invoiceStyles, renderInvoiceBody } from "@tech-trolley/invoice";

export function Invoice({
  receipt,
  lang,
}: {
  receipt: Receipt;
  lang: Language;
}) {
  return (
    <>
      <style>{invoiceStyles}</style>
      <div
        className="receipt-paper"
        dangerouslySetInnerHTML={{ __html: renderInvoiceBody(receipt, lang) }}
      />
    </>
  );
}
