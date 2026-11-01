"use client";
import { FormField } from "@/components/forms/form-field";
import { useState } from "react";
import {
  ArrowDownLeft,
  ChevronRight,
  HandCoins,
  Plus,
  Users,
} from "lucide-react";
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
    <section className="loan-summary">
      <div className="loan-summary-heading">
        <span className="loan-summary-icon">
          <Users size={24} aria-hidden="true" />
        </span>
        <div>
          <p>{tr("loanOutstanding")}</p>
          <strong>{money(values.due)}</strong>
          {!selected && (
            <small>
              {accounts
                .filter((a) => minor(a.due) > 0n)
                .length.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}{" "}
              {lang === "bn"
                ? "জনের কাছে পাওনা"
                : "people with outstanding loans"}
            </small>
          )}
        </div>
      </div>
      <div className="loan-summary-totals">
        <span>
          {tr("totalLent")}
          <b>{money(values.given)}</b>
        </span>
        <span>
          {tr("totalRepaid")}
          <b>{money(values.received)}</b>
        </span>
      </div>
    </section>
  );
  return (
    <div className="loans-view">
      {state.user.role === "STAFF" && (
        <p className="notice">{tr("loanScopeToday")}</p>
      )}
      <div className="section-tools loan-tools">
        <button className="button primary" onClick={() => onCommand("loan")}>
          <Plus size={18} aria-hidden="true" />
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
                <article className="panel loan-account-card" key={a.partyId}>
                  <div className="loan-account-heading">
                    <span className="loan-person-avatar" aria-hidden="true">
                      {a.name.slice(0, 1)}
                    </span>
                    <div className="loan-person-identity">
                      <h2>{a.name}</h2>
                      {a.phone && <p className="muted">{a.phone}</p>}
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`${tr("details")} · ${a.name}`}
                      onClick={() => setSelected(a.partyId)}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <div className="loan-outstanding">
                    <span>{tr("loanOutstanding")}</span>
                    <strong>{money(a.due)}</strong>
                    <span
                      className={`badge ${minor(a.due) === 0n ? "cleared" : "unpaid"}`}
                    >
                      {minor(a.due) === 0n
                        ? tr("loanCleared")
                        : minor(a.received) > 0n
                          ? lang === "bn"
                            ? "আংশিক ফেরত"
                            : "Part paid"
                          : tr("openLoans")}
                    </span>
                  </div>
                  <div className="loan-card-totals">
                    {[
                      ...new Set(
                        a.loans
                          .filter((d) => !d.reversed_by)
                          .map((d) => String(d.snapshot.account || ""))
                          .filter(
                            (value) => value === "cash" || value === "bank",
                          ),
                      ),
                    ].map((value) => (
                      <span className="loan-source" key={value}>
                        {tr(value)}
                      </span>
                    ))}
                    <span>
                      {tr("totalLent")} <b>{money(a.given)}</b>
                    </span>
                    <span>
                      {tr("totalRepaid")} <b>{money(a.received)}</b>
                    </span>
                  </div>
                  <div className="loan-card-actions">
                    <button
                      className="text-button"
                      onClick={() => setSelected(a.partyId)}
                    >
                      {tr("details")}{" "}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="text-button receive-loan"
                      onClick={() => setSelected(a.partyId)}
                    >
                      <ArrowDownLeft size={17} aria-hidden="true" />
                      {minor(a.due) > 0n
                        ? tr("receiveRepayment")
                        : tr("loanHistory")}
                    </button>
                    {a.active && (
                      <button
                        className="text-button"
                        onClick={() => onCommand("loan", a.partyId)}
                      >
                        <HandCoins size={17} aria-hidden="true" />
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
      <p className="notice">{tr("loanDuesHelp")}</p>
    </div>
  );
}
