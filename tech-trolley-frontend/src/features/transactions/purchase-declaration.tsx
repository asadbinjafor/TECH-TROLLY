"use client";
import { useEffect, useState } from "react";
import type {
  Language,
  PurchaseDeclaration as Declaration,
} from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import {
  renderPurchaseBody,
  purchaseStyles,
  fitPurchaseLayout,
} from "@tech-trolley/invoice";
import { api, apiBase } from "@/services/api";

export function PurchaseDeclaration({
  id,
  lang,
  onClose,
}: {
  id: string;
  lang: Language;
  onClose: () => void;
}) {
  const [data, setData] = useState<Declaration | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void api
      .request<Declaration>(`/purchases/${encodeURIComponent(id)}/declaration`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.code || "NETWORK_ERROR");
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  useEffect(() => {
    if (data) void fitPurchaseLayout();
  }, [data]);
  return (
    <div className="modal-backdrop receipt-backdrop">
      <section
        className="modal receipt"
        role="dialog"
        aria-modal="true"
        aria-label={t("purchaseDeclaration", lang)}
      >
        <header>
          <h2>
            {t("purchaseDeclaration", lang)}
            {data ? ` · ${data.number}` : ""}
          </h2>
          <button
            className="icon-button"
            aria-label={t("close", lang)}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {error && (
          <p role="alert" className="error">
            {t(error, lang)}{" "}
            <button className="button" onClick={() => setAttempt((n) => n + 1)}>
              {t("retry", lang)}
            </button>
          </p>
        )}
        {!data && !error && <p>{t("loading", lang)}</p>}
        {data && (
          <>
            <p>
              {t("recordedBy", lang)}: {data.buyer.name} ·{" "}
              {t(data.buyer.role, lang)}
            </p>
            {data.reversed && <p className="notice">{t("reversed", lang)}</p>}
            <style>{purchaseStyles}</style>
            <div
              className="purchase-preview"
              dangerouslySetInnerHTML={{ __html: renderPurchaseBody(data) }}
            />
            <footer>
              <p className="receipt-print-hint">
                {t("purchasePrintHint", lang)}
              </p>
              <a
                className="button primary"
                href={`${apiBase}/purchases/${encodeURIComponent(id)}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("openInvoicePdf", lang)}
              </a>
              <a
                className="button"
                href={`${apiBase}/purchases/${encodeURIComponent(id)}/pdf?download=1`}
                download
              >
                {t("downloadInvoicePdf", lang)}
              </a>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
