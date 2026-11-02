"use client";
import React, { useEffect, useRef } from "react";
import type { Language, Receipt } from "@tech-trolley/contracts";
import { invoiceSellerName } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import {
  fitInvoiceLayout,
  invoiceStyles,
  renderInvoiceBody,
} from "@tech-trolley/invoice";

export function Invoice({
  receipt,
  lang,
}: {
  receipt: Receipt;
  lang: Language;
}) {
  const paper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = paper.current;
    if (!node) return;
    let active = true;
    const fit = () => {
      if (active) void fitInvoiceLayout(node);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    fit();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [receipt, lang]);
  return (
    <>
      <style>{invoiceStyles}</style>
      {!invoiceSellerName(receipt.seller?.name) && (
        <p className="notice invoice-name-warning" role="status">
          {t("invoiceSellerNameMissing", lang)}
        </p>
      )}
      <div
        ref={paper}
        className="receipt-paper"
        dangerouslySetInnerHTML={{ __html: renderInvoiceBody(receipt, lang) }}
      />
    </>
  );
}
