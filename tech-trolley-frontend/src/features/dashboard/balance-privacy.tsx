"use client";
import { FormField } from "@/components/forms/form-field";
import { useCallback, useEffect, useState, useRef } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { verifyPasswordSchema, type Language } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { api } from "@/services/api";

export function useBalancePrivacy(key: string) {
  const [grant, setGrant] = useState<{ key: string; until: number } | null>(
    null,
  );
  const hide = useCallback(() => setGrant(null), []);
  const reveal = useCallback(
    () => setGrant({ key, until: Date.now() + 60000 }),
    [key],
  );
  useEffect(hide, [hide, key]);
  useEffect(() => {
    const timer = grant
      ? setTimeout(hide, Math.max(0, grant.until - Date.now()))
      : undefined;
    const hidden = () => {
      if (document.visibilityState !== "visible") hide();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", hide);
      window.removeEventListener("pagehide", hide);
    };
  }, [grant, hide]);
  return {
    visible: !!grant && grant.key === key && grant.until > Date.now(),
    reveal,
    hide,
  };
}
export function BalanceToggle({
  visible,
  onClick,
  lang,
}: {
  visible: boolean;
  onClick: () => void;
  lang: Language;
}) {
  return (
    <button className="balance-toggle" onClick={onClick}>
      {visible ? (
        <EyeOff size={15} aria-hidden="true" />
      ) : (
        <Eye size={15} aria-hidden="true" />
      )}
      {t(visible ? "hideBalance" : "tapBalance", lang)}
    </button>
  );
}
export function RevealBalances({
  lang,
  onClose,
  onVerified,
}: {
  lang: Language;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="modal reveal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-title"
      >
        <header>
          <h2 id="reveal-title">{t("revealDashboard", lang)}</h2>
          <button
            className="icon-button"
            aria-label={t("close", lang)}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <p className="muted">{t("revealPasswordHelp", lang)}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const secret = password;
            setPassword("");
            try {
              const body = verifyPasswordSchema.parse({ password: secret });
              const result = await api.request<{ ok: boolean }>(
                "/auth/verify-password",
                "POST",
                body,
              );
              if (result.ok && active.current) onVerified();
            } catch (e: any) {
              if (active.current)
                setError(
                  e.code || (e.issues ? "VALIDATION_ERROR" : "NETWORK_ERROR"),
                );
            } finally {
              if (active.current) setBusy(false);
            }
          }}
        >
          <FormField
            label={t("currentPassword", lang)}
            error={error ? t(error, lang) : undefined}
          >
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <footer>
            <button className="button" type="button" onClick={onClose}>
              {t("cancel", lang)}
            </button>
            <button className="button primary" disabled={busy}>
              {t(busy ? "saving" : "revealSubmit", lang)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
