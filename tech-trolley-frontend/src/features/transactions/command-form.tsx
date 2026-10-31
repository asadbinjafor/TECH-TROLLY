"use client";
import { useEffect, useId, useRef, useState } from "react";
import { FormField, FormGrid } from "@/components/forms/form-field";
import { useBackLayer } from "@/components/navigation/navigation-provider";
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
  changeFormValue,
  returnPreview,
  sellerFormValues,
  purchaseDeclarationTerms,
  type IndividualSeller,
  type Party,
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
  embedded = false,
}: {
  kind: CommandKind;
  initialUnit?: string;
  initialDocument?: string;
  initialParty?: string;
  embedded?: boolean;
  onClose: () => void;
  onSaved: (id: string, kind: CommandKind) => void;
}) {
  const { state, lang, user, refresh, connection } = useShop();
  const formTitleId = useId();
  const sellerSelection = useRef(0);
  useEffect(
    () => () => {
      sellerSelection.current++;
    },
    [],
  );
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
          state,
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
  useBackLayer(!embedded, onClose);
  useBackLayer(review && !pending, () => setReview(false), false);
  useBackLayer(!!partyField, () => setPartyField(null));
  useEffect(() => {
    sessionStorage.setItem(storage, JSON.stringify(values));
  }, [storage, values]);
  if (!state) return null;
  const selectSeller = (id: string, selected?: Party) => {
    const serial = ++sellerSelection.current;
    const base = sellerFormValues(
      selected || state.parties.find((p) => p.id === id),
    );
    setValues((v) => ({ ...v, supplierId: id, ...base }));
    if (!id) return;
    void api
      .request<{ seller: IndividualSeller | null }>(
        `/purchases/sellers/${encodeURIComponent(id)}`,
      )
      .then(({ seller }) => {
        if (!seller || serial !== sellerSelection.current) return;
        setValues((v) =>
          v.supplierId !== id
            ? v
            : {
                ...v,
                ...Object.fromEntries(
                  Object.entries(seller).filter(
                    ([key]) => v[key] === base[key],
                  ),
                ),
              },
        );
      })
      .catch((e) => {
        if (serial === sellerSelection.current)
          setError(e.code || "NETWORK_ERROR");
      });
  };
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
    } else if (kind === "individualPurchase") {
      preview = {
        total: decimal(minor(values.cost || "0")),
        due: decimal(
          minor(values.cost || "0") -
            minor(values.cash || "0") -
            minor(values.bank || "0"),
        ),
      };
    }
  } catch {}
  let returnSummary: Record<string, string> | null = null;
  try {
    if (kind === "purchaseReturn") returnSummary = returnPreview(state, values);
  } catch {}
  return (
    <div className={embedded ? "command-embedded" : "modal-backdrop"}>
      <section
        className={embedded ? "command-card panel" : "modal"}
        inert={partyField ? true : undefined}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-labelledby={formTitleId}
      >
        <header>
          <div>
            <span className="eyebrow">TECH TROLLEY</span>
            <h2 id={formTitleId}>{t(kind, lang)}</h2>
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
          <FormGrid>
            {formFields(kind, values).map((field) => {
              const required = fieldRequired(kind, field, values, state);
              const partySource = partyKindForSource(field.source);
              const options =
                field.type === "select"
                  ? choices(field, state, lang, values)
                  : [];
              const empty = field.type === "select" && !options.length;
              const help = empty
                ? t(
                    partySource
                      ? field.key === "customerId" && !required
                        ? "emptyOptionalCustomerSelection"
                        : "emptyPartySelection"
                      : emptySelectionMessage(field, values),
                    lang,
                  )
                : field.key === "customerId" && required
                  ? t("CUSTOMER_REQUIRED", lang)
                  : undefined;
              const issue =
                issues[field.key] ||
                (!pending && blockers[field.key] === "SELECTION_UNAVAILABLE"
                  ? "SELECTION_UNAVAILABLE"
                  : "");
              return (
                <FormField
                  key={field.key}
                  label={t(
                    field.key === "customerId"
                      ? "customer"
                      : kind === "expense" && field.key === "note"
                        ? "expenseDetails"
                        : field.label,
                    lang,
                  )}
                  optional={!required}
                  optionalText={t("optional", lang)}
                  wide={[
                    "note",
                    "customerAddress",
                    "presentAddress",
                    "permanentAddress",
                  ].includes(field.key)}
                  hint={help}
                  hintRole={empty ? "status" : undefined}
                  error={
                    issue
                      ? t(
                          /^[A-Z_]+$/.test(issue) ? issue : "VALIDATION_ERROR",
                          lang,
                        )
                      : undefined
                  }
                  action={
                    partySource && !review && !pending ? (
                      <button
                        type="button"
                        className="text-button party-manage-button"
                        onClick={() => setPartyField(field)}
                      >
                        {t("manageParties", lang)}
                      </button>
                    ) : undefined
                  }
                >
                  {field.type === "select" ? (
                    <select
                      name={field.key}
                      value={values[field.key] || ""}
                      required={required}
                      disabled={!!pending || review}
                      onChange={(e) =>
                        kind === "individualPurchase" &&
                        field.key === "supplierId"
                          ? selectSeller(e.target.value)
                          : setValues((v) =>
                              changeFormValue(
                                kind,
                                v,
                                field.key,
                                e.target.value,
                                state,
                              ),
                            )
                      }
                    >
                      <option value="">
                        {t(
                          field.key === "customerId" ? "walkIn" : "select",
                          lang,
                        )}
                      </option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {field.options ? t(o.label, lang) : o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={values[field.key] || ""}
                      name={field.key}
                      required={required}
                      disabled={!!pending || review}
                      type={
                        field.type === "password"
                          ? "password"
                          : field.type === "month"
                            ? "month"
                            : field.type === "date"
                              ? "date"
                              : "text"
                      }
                      max={field.type === "date" ? state.today : undefined}
                      inputMode={
                        field.type === "money"
                          ? "decimal"
                          : field.key === "customerPhone"
                            ? "tel"
                            : field.type === "password" ||
                                field.type === "number" ||
                                field.key === "imei"
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
                </FormField>
              );
            })}
          </FormGrid>
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
          {kind === "individualPurchase" && review && (
            <section className="notice">
              <b>{t("purchasePolicy", lang)}</b>
              <p>{purchaseDeclarationTerms}</p>
              <p>{t("purchasePrintHint", lang)}</p>
            </section>
          )}
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
                if (
                  kind === "individualPurchase" &&
                  partyField.key === "supplierId"
                ) {
                  selectSeller(p.id, p);
                  setPartyField(null);
                  return;
                }
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
