"use client";
import { useEffect, useState } from "react";
import {
  choices,
  prepareForm,
  formFields,
  restoreFormDraft,
  paymentHelp,
  fieldRequired,
  fieldMaxLength,
  selectionBlockers,
  emptySelectionMessage,
  minor,
  decimal,
  customerInvoiceFields,
  partyKindForSource,
  unitFormValues,
  returnPreview,
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
  initialDocument,
  initialParty,
}: {
  kind: CommandKind;
  initialUnit?: string;
  initialDocument?: string;
  initialParty?: string;
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
        const v = restoreFormDraft(
          kind,
          JSON.parse(sessionStorage.getItem(storage) || "null"),
          state?.today || "",
        );
        if (initialUnit && v.unitId !== initialUnit)
          Object.assign(v, {
            unitId: initialUnit,
            ...unitFormValues(
              kind,
              state?.units.find((u) => u.id === initialUnit),
            ),
          });
        if (
          initialDocument &&
          ["supplierRefund", "loanRepayment"].includes(kind) &&
          v.documentId !== initialDocument
        )
          Object.assign(v, { documentId: initialDocument, amount: "" });
        if (initialParty && kind === "loan" && v.partyId !== initialParty)
          Object.assign(v, { partyId: initialParty, amount: "", note: "" });
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
  const blockers = selectionBlockers(kind, values, state);
  const blocked = !pending && Object.keys(blockers).length > 0;
  const paymentHint = paymentHelp(kind, values);
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
        p = {
          key: crypto.randomUUID(),
          data: prepareForm(kind, values, state),
        };
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
        if (["STOCK_CHANGED", "STOCK_CONFLICT"].includes(e.code))
          await refresh();
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
  let returnSummary: Record<string, string> | null = null;
  try {
    if (kind === "purchaseReturn") returnSummary = returnPreview(state, values);
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
        {["stockEdit", "purchaseReturn", "supplierRefund"].includes(kind) && (
          <p className="notice">{t(kind + "Help", lang)}</p>
        )}
        {["stockEdit", "purchaseReturn"].includes(kind) &&
          values.unitId &&
          !review &&
          !pending && (
            <button
              type="button"
              className="button"
              onClick={() =>
                setValues((v) => ({
                  ...v,
                  ...unitFormValues(
                    kind,
                    state.units.find((u) => u.id === v.unitId),
                  ),
                }))
              }
            >
              {t("reloadStock", lang)}
            </button>
          )}
        {paymentHint && (
          <p className="notice" role="status">
            {t(paymentHint, lang)}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (review || pending) void submit();
            else {
              try {
                prepareForm(kind, values, state);
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
            {formFields(kind, values).map((field) => (
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
                {!fieldRequired(kind, field, values, state) && (
                  <small className="muted"> · {t("optional", lang)}</small>
                )}
                {field.type === "select" ? (
                  <select
                    aria-label={t(field.label, lang)}
                    value={values[field.key] || ""}
                    required={fieldRequired(kind, field, values, state)}
                    disabled={!!pending || review}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.key]: e.target.value,
                        ...(field.key === "unitId"
                          ? unitFormValues(
                              kind,
                              state.units.find((u) => u.id === e.target.value),
                            )
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
                    required={fieldRequired(kind, field, values, state)}
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
                    maxLength={fieldMaxLength(kind, field)}
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
                        {t(
                          field.key === "customerId" &&
                            !fieldRequired(kind, field, values, state)
                            ? "emptyOptionalCustomerSelection"
                            : "emptyPartySelection",
                          lang,
                        )}
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
                {field.type === "select" &&
                  !partyKindForSource(field.source) &&
                  !choices(field, state, lang).length && (
                    <small className="notice" role="status">
                      {t(emptySelectionMessage(field), lang)}
                    </small>
                  )}
                {!pending &&
                  blockers[field.key] === "SELECTION_UNAVAILABLE" && (
                    <small className="error" role="alert">
                      {t("SELECTION_UNAVAILABLE", lang)}
                    </small>
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
          {returnSummary && (
            <section className="notice" aria-label={t("purchaseReturn", lang)}>
              {Object.entries(returnSummary)
                .filter(([, v]) => v !== "")
                .map(([k, v]) => (
                  <div className="pnl-row" key={k}>
                    <span>{t(k, lang)}</span>
                    <b>{currency(v, lang)}</b>
                  </div>
                ))}
            </section>
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
              disabled={busy || connection !== "ready" || blocked}
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
