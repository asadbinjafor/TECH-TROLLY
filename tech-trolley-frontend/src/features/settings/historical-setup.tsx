"use client";
import Link from "next/link";
import { type CommandKind } from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";

export function HistoricalSetup({
  onAction,
}: {
  onAction: (kind: CommandKind, id?: string) => void;
}) {
  const { state, user, lang } = useShop();
  if (
    !state ||
    user?.role !== "OWNER" ||
    state.shop.history_version === undefined
  )
    return null;
  const s = state.shop,
    tr = (key: string) => t(key, lang);
  const action = (kind: CommandKind) => (
    <button type="button" className="button" onClick={() => onAction(kind)}>
      {tr(kind)}
    </button>
  );
  return (
    <section className="panel history-setup" aria-label={tr("historySetup")}>
      <h2>{tr("historySetup")}</h2>
      {!s.opened_at ? (
        <>
          <p>{tr("historyIntro")}</p>
          {action("historyStart")}
        </>
      ) : !s.history_from ? (
        <p>{tr("historyNoRestart")}</p>
      ) : (
        <>
          <p>
            {tr("historyPeriod")}:{" "}
            <b>
              {s.history_from} — {s.history_to}
            </b>
          </p>
          <p>
            {tr("historyLastDate")}: <b>{s.history_last_date}</b>
          </p>
          <p className="notice" role="status">
            {tr(s.history_active ? "historyActive" : "historyComplete")}
          </p>
          {s.history_active && (
            <>
              <p>
                {tr(
                  s.history_locked ? "historyEntryHelp" : "historyBaselineHelp",
                )}
              </p>
              <dl className="history-balances">
                {[
                  "cash",
                  "bank",
                  "inventory",
                  "receivable",
                  "payable",
                  "loan",
                  "supplierReceivable",
                  "advance",
                ].map((account) => (
                  <div key={account}>
                    <dt>
                      {tr(account === "loan" ? "loanOutstanding" : account)}
                    </dt>
                    <dd>{currency(state.balances[account] || "0", lang)}</dd>
                  </div>
                ))}
              </dl>
              {!s.history_locked ? (
                <>
                  <div className="history-actions">
                    {action("openingStock")}
                    {action("openingDue")}
                    {action("openingAdjustment")}
                  </div>
                  <h3>{tr("historyOpeningList")}</h3>
                  <div className="history-opening-list">
                    {state.documents
                      .filter(
                        (d) =>
                          ["openingStock", "openingDue"].includes(d.kind) &&
                          !d.reversed_by,
                      )
                      .map((d) => (
                        <article key={d.id}>
                          <div>
                            <b>
                              {String(
                                d.snapshot.model || d.snapshot.partyName || "",
                              )}
                            </b>
                            <p>
                              {tr(d.kind)} · {d.number} ·{" "}
                              {String(d.snapshot.imei || "")}
                              {d.kind === "openingDue"
                                ? " · " + tr(String(d.snapshot.dueType))
                                : ""}
                            </p>
                          </div>
                          <strong>{currency(d.total, lang)}</strong>
                          <div className="history-actions">
                            {d.kind === "openingStock" && (
                              <button
                                type="button"
                                className="button"
                                onClick={() =>
                                  onAction("stockEdit", d.unit_id!)
                                }
                              >
                                {tr("stockEdit")}
                              </button>
                            )}
                            <button
                              type="button"
                              className="button"
                              onClick={() => onAction("reversal", d.id)}
                            >
                              {tr("reversal")}
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                  <p>{tr("historyOpeningReview")}</p>
                  {action("historyLock")}
                </>
              ) : (
                <>
                  <div className="history-actions">
                    {["purchases", "sale", "transactions", "money", "dues"].map(
                      (page) => (
                        <Link key={page} className="button" href={"/" + page}>
                          {tr(page)}
                        </Link>
                      ),
                    )}
                    <Link className="button" href="/reports">
                      {tr("reports")}
                    </Link>
                  </div>
                  <p>{tr("historyFinishHelp")}</p>
                  {action("historyFinish")}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
