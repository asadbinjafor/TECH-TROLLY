"use client";
import React from "react";
import type { Language, Receipt } from "@tech-trolley/contracts";
import { invoiceSellerName } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
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
      {!invoiceSellerName(receipt.seller?.name) && (
        <p className="notice invoice-name-warning" role="status">
          {t("invoiceSellerNameMissing", lang)}
        </p>
      )}
      <div
        className="receipt-paper"
        dangerouslySetInnerHTML={{ __html: renderInvoiceBody(receipt, lang) }}
      />
    </>
  );
}
