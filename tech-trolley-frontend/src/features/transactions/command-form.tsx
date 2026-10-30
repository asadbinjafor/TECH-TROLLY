"use client";
import { useEffect, useState } from "react";
import {
  choices,
  forms,
  prepare,
  minor,
  decimal,
  customerInvoiceFields,
  partyKindForSource,
  type Field,
  type CommandKind,
} from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";
import { api } from "@/services/api";
import { useShop } from "@/contexts/shop-context";
import { PartyManager } from "@/features/settings/party-manager";
export function CommandForm({
  kind,
  onClose,
  onSaved,
  initialUnit,
}: {
  kind: CommandKind;
  initialUnit?: string;
  onClose: () => void;
  onSaved: (id: string, kind: CommandKind) => void;
}) {
  const { state, lang, user, refresh, connection } = useShop();
  const storage = `tt-${user!.id}-draft-${kind}`,
    pendingKey = `tt-${user!.id}-pending-${kind}`;
  const [values, setValues] = useState<Record<string, string>>(() => {
      try {
        const p = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
        if (p)
          return Object.fromEntries(
            Object.entries(p.data).map(([k, v]) => [
              k,
              v === null ? "" : String(v),
            ]),
          );
        const v =
          JSON.parse(sessionStorage.getItem(storage) || "null") ||
          Object.fromEntries(forms[kind].map((f) => [f.key, f.default ?? ""]));
        if (initialUnit && v.unitId !== initialUnit)
          Object.assign(v, {
            unitId: initialUnit,
            price: "",
            discount: "0",
            cash: "",
            bank: "",
          });
        return v;
      } catch {
        return {};
      }
    }),
    [pending, setPending] = useState<{ key: string; data: any } | null>(() => {
      try {
        return JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      } catch {
        return null;
      }
    }),
    [error, setError] = useState(""),
    [issues, setIssues] = useState<Record<string, string>>({}),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [partyField, setPartyField] = useState<Field | null>(null);
  useEffect(() => {
    sessionStorage.setItem(storage, JSON.stringify(values));
  }, [storage, values]);
  if (!state) return null;
  const persist = (p: typeof pending) => {
    setPending(p);
    if (p) sessionStorage.setItem(pendingKey, JSON.stringify(p));
    else sessionStorage.removeItem(pendingKey);
  };
  const finish = async (id: string) => {
    sessionStorage.removeItem(storage);
    persist(null);
    await refresh();
    onSaved(id, kind);
  };
  const submit = async () => {
    if (connection !== "ready") {
      setError("UPSTREAM_UNAVAILABLE");
      return;
    }
    setBusy(true);
    setError("");
    setIssues({});
    let p = pending;
    try {
      if (!p) {
        p = { key: crypto.randomUUID(), data: prepare(kind, values) };
        persist(p);
      }
      const result = await api.command(kind, p.data, p.key);
      await finish(result.id);
    } catch (e: any) {
      if (e.issues) {
        setIssues(
          Object.fromEntries(e.issues.map((i: any) => [i.path[0], i.message])),
        );
        setError("VALIDATION_ERROR");
      } else {
        setError(e.code || "SERVER_ERROR");
        if (e.status >= 400 && e.status < 500) persist(null);
        if (e.details)
          setIssues(
            Object.fromEntries(e.details.map((i: any) => [i.field, i.code])),
          );
      }
    } finally {
      setBusy(false);
    }
  };
  let preview: null | { total: string; due: string; profit?: string } = null;
  try {
    if (kind === "sale") {
      const total = minor(values.price || "0") - minor(values.discount || "0"),
        due = total - minor(values.cash || "0") - minor(values.bank || "0"),
        unit = state.units.find((u) => u.id === values.unitId);
      preview = {
        total: decimal(total),
        due: decimal(due),
        profit: unit ? decimal(total - minor(unit.cost)) : undefined,
      };
    }
  } catch {}
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        inert={partyField ? true : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <header>
          <div>
            <span className="eyebrow">TECH TROLLEY</span>
            <h2 id="form-title">{t(kind, lang)}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={t("close", lang)}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p className="date-stamp">{state.today} · Asia/Dhaka</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (review || pending) void submit();
            else {
              try {
                prepare(kind, values);
                setIssues({});
                setReview(true);
              } catch (e: any) {
                setError("VALIDATION_ERROR");
                setIssues(
                  Object.fromEntries(
                    e.issues.map((i: any) => [i.path[0], i.message]),
                  ),
                );
              }
            }
          }}
        >
          <div className="form-grid">
            {forms[kind]
              .filter(
                (field) =>
                  field.key !== "expenseName" || values.categoryId === "custom",
              )
              .map((field) => (
                <label
                  key={field.key}
                  className={
                    field.key === "note" || field.key === "customerAddress"
                      ? "wide"
                      : ""
                  }
                >
                  {t(
                    kind === "expense" && field.key === "note"
                      ? "expenseDetails"
                      : field.label,
                    lang,
                  )}
                  {field.optional &&
                    !(field.key === "imei" && values.category === "phone") && (
                      <small className="muted"> · {t("optional", lang)}</small>
                    )}
                  {field.type === "select" ? (
                    <select
                      aria-label={t(field.label, lang)}
                      value={values[field.key] || ""}
                      required={
                        !field.optional ||
                        (field.key === "imei" && values.category === "phone")
                      }
                      disabled={!!pending || review}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [field.key]: e.target.value,
                          ...(field.key === "unitId"
                            ? { price: "", discount: "0", cash: "", bank: "" }
                            : {}),
                          ...(field.key === "customerId"
                            ? customerInvoiceFields(
                                state.parties.find(
                                  (p) => p.id === e.target.value,
                                ),
                              )
                            : {}),
                        }))
                      }
                    >
                      <option value="">
                        {field.key === "customerId"
                          ? t("walkIn", lang)
                          : t("select", lang)}
                      </option>
                      {choices(field, state, lang).map((o) => (
                        <option key={o.value} value={o.value}>
                          {field.options ? t(o.label, lang) : o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={values[field.key] || ""}
                      name={field.key}
                      required={
                        !field.optional ||
                        (field.key === "imei" && values.category === "phone")
                      }
                      disabled={!!pending || review}
                      type={
                        field.type === "password"
                          ? "password"
                          : field.type === "month"
                            ? "month"
                            : "text"
                      }
                      inputMode={
                        field.type === "money"
                          ? "decimal"
                          : field.key === "customerPhone"
                            ? "tel"
                            : field.type === "number" || field.key === "imei"
                              ? "numeric"
                              : undefined
                      }
                      maxLength={
                        field.key === "imei"
                          ? 15
                          : field.key === "customerPhone"
                            ? 30
                            : field.type === "money"
                              ? 15
                              : 300
                      }
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {partyKindForSource(field.source) && !review && !pending && (
                    <>
                      {!choices(field, state, lang).length && (
                        <small className="notice">
                          {t("emptyPartySelection", lang)}
                        </small>
                      )}
                      <button
                        type="button"
                        className="text-button party-manage-button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPartyField(field);
                        }}
                      >
                        {t("manageParties", lang)}
                      </button>
                    </>
                  )}
                  {issues[field.key] && (
                    <small className="error">
                      {t(
                        /^[A-Z_]+$/.test(issues[field.key])
                          ? issues[field.key]
                          : "VALIDATION_ERROR",
                        lang,
                      )}
                    </small>
                  )}
                </label>
              ))}
          </div>
          {preview && (
            <div className="review-strip">
              <span>
                {t("total", lang)} <b>{currency(preview.total, lang)}</b>
              </span>
              <span>
                {t("due", lang)} <b>{currency(preview.due, lang)}</b>
              </span>
              {preview.profit !== undefined && (
                <span
                  className={
                    Number(preview.profit) < 0 ? "negative" : "positive"
                  }
                >
                  {t("grossProfit", lang)}{" "}
                  <b>{currency(preview.profit, lang)}</b>
                </span>
              )}
            </div>
          )}
          {review && <p className="notice">{t("review", lang)}</p>}
          {pending && !busy && (
            <div className="notice">
              <p>{t("uncertain", lang)}</p>
              <code>{pending.key}</code>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api.status(pending.key);
                    if (r.found) await finish(r.result!.id);
                    else setError("notFound");
                  } catch (e: any) {
                    setError(e.code);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("checkStatus", lang)}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {t(error, lang)}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="button"
              onClick={() =>
                review && !pending ? setReview(false) : onClose()
              }
            >
              {t("cancel", lang)}
            </button>
            <button
              className="button primary"
              disabled={busy || connection !== "ready"}
            >
              {t(
                busy ? "saving" : review || pending ? "confirm" : "review",
                lang,
              )}
            </button>
          </footer>
        </form>
      </section>
      {partyField && (
        <div className="modal-backdrop party-modal">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="party-title"
          >
            <header>
              <h2 id="party-title">
                {t("manageParties", lang)} ·{" "}
                {t(partyKindForSource(partyField.source)!, lang)}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label={t("close", lang)}
                onClick={() => setPartyField(null)}
              >
                ×
              </button>
            </header>
            <PartyManager
              kind={partyKindForSource(partyField.source)}
              onSelect={(p) => {
                setValues((v) => ({
                  ...v,
                  [partyField.key]: p.id,
                  ...(partyField.key === "customerId"
                    ? customerInvoiceFields(p)
                    : {}),
                }));
                setPartyField(null);
              }}
              onArchive={(id) =>
                setValues((v) =>
                  v[partyField.key] === id ? { ...v, [partyField.key]: "" } : v,
                )
              }
            />
          </section>
        </div>
      )}
    </div>
  );
}
