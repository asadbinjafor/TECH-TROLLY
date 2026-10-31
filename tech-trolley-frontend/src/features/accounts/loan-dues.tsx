"use client";
import { FormField } from "@/components/forms/form-field";
import { useState } from "react";
import { useBackLayer } from "@/components/navigation/navigation-provider";
import {
  decimal,
  loanAccounts,
  minor,
  type CommandKind,
  type Document,
} from "@tech-trolley/contracts";
import { currency, t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { PartyManager } from "@/features/settings/party-manager";

export function LoanDues({
  onCommand,
  onDetails,
}: {
  onCommand: (kind: CommandKind, partyId?: string, documentId?: string) => void;
  onDetails: (document: Document) => void;
}) {
  const { state, lang } = useShop();
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  useBackLayer(!!selected, () => setSelected(null), false);
  useBackLayer(manage, () => setManage(false), false);
  if (!state) return null;
  const tr = (key: string) => t(key, lang);
  const money = (value: string) => currency(value, lang);
  const accounts = loanAccounts(state);
  const account = accounts.find((a) => a.partyId === selected);
  const totals = Object.fromEntries(
    ["given", "received", "due"].map((key) => [
      key,
      decimal(
        accounts.reduce(
          (sum, a) => sum + minor(a[key as "given" | "received" | "due"]),
          0n,
        ),
      ),
    ]),
  );
  const summary = (values: {
    given: string;
    received: string;
    due: string;
  }) => (
    <div className="metrics-grid three">
      {[
        ["totalLent", values.given],
        ["totalRepaid", values.received],
        ["loanOutstanding", values.due],
      ].map(([label, value]) => (
        <article className="metric" key={label}>
          <div className="metric-label">{tr(label)}</div>
          <strong className="amount">{money(value)}</strong>
        </article>
      ))}
    </div>
  );
  return (
    <>
      <p className="notice">{tr("loanDuesHelp")}</p>
      {state.user.role === "STAFF" && (
        <p className="notice">{tr("loanScopeToday")}</p>
      )}
      <div className="section-tools loan-tools">
        <button className="button primary" onClick={() => onCommand("loan")}>
          {tr("loan")}
        </button>
        <button
          className="button"
          aria-expanded={manage}
          onClick={() => setManage(!manage)}
        >
          {tr("manageBorrowers")}
        </button>
        {selected && (
          <button className="button" onClick={() => setSelected(null)}>
            {tr("close")}
          </button>
        )}
      </div>
      {manage && (
        <section className="panel">
          <PartyManager kind="person" />
        </section>
      )}
      {account ? (
        <>
          <section className="panel loan-person-heading">
            <h2>{account.name}</h2>
            <p className="muted">{account.phone}</p>
            {account.active && (
              <button
                className="button"
                onClick={() => onCommand("loan", account.partyId)}
              >
                {tr("lendAgain")}
              </button>
            )}
          </section>
          {summary(account)}
          <section className="panel">
            <h2>{tr("openLoans")}</h2>
            {account.loans
              .filter((d) => !d.reversed_by && minor(d.due) > 0n)
              .map((d) => (
                <div className="loan-open-row" key={d.id}>
                  <div>
                    <b>{d.number}</b>
                    <p className="muted">
                      {d.business_date} · {tr(String(d.snapshot.account))}
                    </p>
                  </div>
                  <strong>{money(d.due)}</strong>
                  <button
                    className="button primary"
                    onClick={() => onCommand("loanRepayment", undefined, d.id)}
                  >
                    {tr("receiveRepayment")}
                  </button>
                </div>
              ))}
            {minor(account.due) === 0n && <p>{tr("loanCleared")}</p>}
          </section>
          <section className="panel">
            <h2>{tr("loanHistory")}</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "date",
                      "kind",
                      "account",
                      "amount",
                      "actor",
                      "note",
                      "details",
                    ].map((key) => (
                      <th key={key}>{tr(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {account.history.map((d) => {
                    const original = d.snapshot.originalSnapshot as
                      Record<string, unknown> | undefined;
                    return (
                      <tr key={d.id}>
                        <td data-label={tr("date")}>
                          {d.business_date}
                          <small>
                            {new Date(d.created_at).toLocaleTimeString(
                              lang === "bn" ? "bn-BD" : "en-GB",
                              {
                                timeZone: "Asia/Dhaka",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </small>
                        </td>
                        <td data-label={tr("kind")}>
                          {tr(d.kind)}
                          <small>{d.number}</small>
                          {d.reversed_by && (
                            <span className="badge muted">
                              {tr("reversed")}
                            </span>
                          )}
                        </td>
                        <td data-label={tr("account")}>
                          {tr(
                            String(
                              d.snapshot.account || original?.account || "",
                            ),
                          )}
                        </td>
                        <td data-label={tr("amount")}>{money(d.total)}</td>
                        <td data-label={tr("actor")}>{d.actor_name}</td>
                        <td data-label={tr("note")}>
                          {String(d.snapshot.note || "—")}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => onDetails(d)}
                          >
                            {tr("details")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          {summary(totals as { given: string; received: string; due: string })}
          <div className="section-tools loan-tools">
            <FormField
              label={tr("loanSearch")}
              className="filter-field loan-search"
            >
              <input
                aria-label={tr("loanSearch")}
                placeholder={tr("loanSearch")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormField>
            <button
              className={!showAll ? "button primary" : "button"}
              aria-pressed={!showAll}
              onClick={() => setShowAll(false)}
            >
              {tr("openLoans")}
            </button>
            <button
              className={showAll ? "button primary" : "button"}
              aria-pressed={showAll}
              onClick={() => setShowAll(true)}
            >
              {tr("allLoans")}
            </button>
          </div>
          <div className="loan-accounts">
            {accounts
              .filter(
                (a) =>
                  (showAll || minor(a.due) > 0n) &&
                  `${a.name} ${a.phone}`
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
              )
              .map((a) => (
                <article className="panel" key={a.partyId}>
                  <h2>{a.name}</h2>
                  <p className="muted">{a.phone}</p>
                  {[
                    ["totalLent", a.given],
                    ["totalRepaid", a.received],
                    ["loanOutstanding", a.due],
                  ].map(([key, value]) => (
                    <div className="pnl-row" key={key}>
                      <span>{tr(key)}</span>
                      <b>{money(value)}</b>
                    </div>
                  ))}
                  <div className="loan-tools section-tools">
                    <button
                      className="button primary"
                      onClick={() => setSelected(a.partyId)}
                    >
                      {minor(a.due) > 0n
                        ? tr("receiveRepayment")
                        : tr("loanHistory")}
                    </button>
                    {a.active && (
                      <button
                        className="button"
                        onClick={() => onCommand("loan", a.partyId)}
                      >
                        {tr("lendAgain")}
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {!accounts.some(
            (a) =>
              (showAll || minor(a.due) > 0n) &&
              `${a.name} ${a.phone}`
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
          ) && <p className="empty-state">{tr("noLoanAccounts")}</p>}
        </>
      )}
    </>
  );
}
