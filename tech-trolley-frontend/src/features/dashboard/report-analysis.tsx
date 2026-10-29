"use client";
import type { Language, Report } from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";

export function ReportAnalysis({
  report: r,
  lang,
  withMoney = false,
}: {
  report: Report;
  lang: Language;
  withMoney?: boolean;
}) {
  const tr = (key: string) => t(key, lang),
    money = (v: string) => currency(v, lang);
  const table = (
    title: string,
    headers: string[],
    rows: (string | number)[][],
  ) => (
    <section className="panel report-detail">
      <h2>{tr(title)}</h2>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{tr(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i}>
                  {cells.map((cell, j) => (
                    <td key={j} data-label={tr(headers[j])}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">{tr("empty")}</p>
      )}
    </section>
  );
  return (
    <div className="report-analysis">
      <p className="notice">{tr("profitHelp")}</p>
      {table(
        "productProfit",
        ["model", "quantity", "purchaseCost", "sales", "grossProfit"],
        (r.productProfit || []).map((p) => [
          [p.brand, p.model].filter(Boolean).join(" "),
          p.quantity,
          money(p.purchaseCost),
          money(p.sales),
          money(p.grossProfit),
        ]),
      )}
      {table(
        "profitStatement",
        [
          "date",
          "number",
          "model",
          "storage",
          "color",
          "variant",
          "imei",
          "actor",
          "purchaseCost",
          "sales",
          "grossProfit",
        ],
        (r.profitStatement || []).map((p) => [
          p.date,
          p.number +
            (p.number !== p.sourceNumber ? " ← " + p.sourceNumber : ""),
          [p.brand, p.model].join(" "),
          p.storage || "—",
          p.color || "—",
          p.variant || "—",
          p.serial,
          p.actor,
          money(p.purchaseCost),
          money(p.sales),
          money(p.grossProfit),
        ]),
      )}
      {table(
        "expenseBreakdown",
        ["categoryId", "amount"],
        (r.expenseBreakdown || []).map((e) => [e[lang], money(e.amount)]),
      )}
      {table(
        "expenseStatement",
        ["date", "number", "categoryId", "expenseDetails", "actor", "amount"],
        (r.expenseStatement || []).map((e) => [
          e.date,
          e.number +
            (e.number !== e.sourceNumber ? " ← " + e.sourceNumber : ""),
          e[lang],
          e.note,
          e.actor,
          money(e.amount),
        ]),
      )}
      {withMoney &&
        table(
          "moneyStatement",
          [
            "date",
            "number",
            "kind",
            "actor",
            "note",
            "cashIn",
            "cashOut",
            "closingCash",
            "bankIn",
            "bankOut",
            "closingBank",
          ],
          (r.moneyStatement || []).map((e) => [
            e.date,
            e.number,
            tr(e.kind),
            e.actor,
            e.note,
            money(e.cashIn),
            money(e.cashOut),
            money(e.cashBalance),
            money(e.bankIn),
            money(e.bankOut),
            money(e.bankBalance),
          ]),
        )}
    </div>
  );
}
