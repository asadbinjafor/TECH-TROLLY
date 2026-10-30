"use client";
import { useEffect, useRef, useState } from "react";
import type { Language } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { api } from "@/services/api";

export function PdfDownload({
  id,
  number,
  lang,
  purchase = false,
}: {
  id: string;
  number: string;
  lang: Language;
  purchase?: boolean;
}) {
  const { user } = useShop();
  const context = `${user?.id}:${purchase}:${id}`;
  const current = useRef(context);
  current.current = context;
  const request = useRef<AbortController | null>(null);
  const resource = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [prepared, setPrepared] = useState<{
    context: string;
    url: string;
  } | null>(null);
  const filename =
    (number.replace(/[^A-Za-z0-9_-]/g, "_") || "Tech-Trolley") +
    (purchase ? "-purchase" : "") +
    ".pdf";
  useEffect(() => {
    setBusy(false);
    setError("");
    setPrepared(null);
    return () => {
      request.current?.abort();
      request.current = null;
      if (resource.current) URL.revokeObjectURL(resource.current);
      resource.current = null;
    };
  }, [context]);
  const download = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setPrepared(null);
    if (resource.current) URL.revokeObjectURL(resource.current);
    resource.current = null;
    try {
      const bytes = await api.receiptPdf(id, purchase, controller.signal);
      if (controller.signal.aborted || current.current !== context) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      resource.current = url;
      setPrepared({ context, url });
      // Keep a real ready-to-save link too. Some mobile browsers require a
      // second user gesture after a slow render rather than an async click.
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e: any) {
      if (!controller.signal.aborted && current.current === context)
        setError(e.code || "NETWORK_ERROR");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  return (
    <div className="pdf-download" aria-busy={busy}>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy && <span className="spinner" aria-hidden="true" />}
        {t(
          busy
            ? "preparingPdf"
            : error
              ? "retryPdfDownload"
              : "downloadInvoicePdf",
          lang,
        )}
      </button>
      {busy && <p role="status">{t("preparingPdfHelp", lang)}</p>}
      {error && (
        <p className="error" role="alert">
          {t(error, lang)}
        </p>
      )}
      {prepared?.context === context && (
        <>
          <p role="status">{t("pdfReadyHelp", lang)}</p>
          <a className="button primary" href={prepared.url} download={filename}>
            {t("savePdfFile", lang)}
          </a>
        </>
      )}
    </div>
  );
}
