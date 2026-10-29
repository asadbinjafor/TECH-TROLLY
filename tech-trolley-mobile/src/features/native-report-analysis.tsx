import React from "react";
import type { Language, Report } from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";
import { Txt, Panel } from "../components/ui";
export function NativeReportAnalysis({
  report: r,
  lang,
  withMoney = false,
}: {
  report: Report;
  lang: Language;
  withMoney?: boolean;
}) {
  const tr = (key: string) => t(key, lang),
    money = (value: string) => currency(value, lang);
  return (
    <>
      <Panel>
        <Txt>{tr("profitHelp")}</Txt>
      </Panel>
      <Txt style={{ fontWeight: "600", marginVertical: 12 }}>
        {tr("productProfit")}
      </Txt>
      {(r.productProfit || []).map((p, i) => (
        <Panel key={i}>
          <Txt style={{ fontWeight: "600" }}>
            {p.brand} {p.model}
          </Txt>
          <Txt>
            {tr("quantity")}: {p.quantity}
          </Txt>
          <Txt>
            {tr("purchaseCost")}: {money(p.purchaseCost)}
          </Txt>
          <Txt>
            {tr("sales")}: {money(p.sales)}
          </Txt>
          <Txt>
            {tr("grossProfit")}: {money(p.grossProfit)}
          </Txt>
        </Panel>
      ))}
      <Txt style={{ fontWeight: "600", marginVertical: 12 }}>
        {tr("profitStatement")}
      </Txt>
      {(r.profitStatement || []).map((p) => (
        <Panel key={p.id}>
          <Txt>
            {p.date} · {p.number} · {p.actor}
          </Txt>
          <Txt>
            {p.brand} {p.model}
          </Txt>
          <Txt>
            {tr("storage")}: {p.storage || "—"} · {tr("color")}:{" "}
            {p.color || "—"}
          </Txt>
          <Txt>
            {tr("variant")}: {p.variant || "—"} · {p.serial}
          </Txt>
          <Txt>
            {tr("purchaseCost")}: {money(p.purchaseCost)}
          </Txt>
          <Txt>
            {tr("sales")}: {money(p.sales)} · {tr("grossProfit")}:{" "}
            {money(p.grossProfit)}
          </Txt>
          {p.sourceNumber !== p.number && (
            <Txt>
              {tr("sourceNumber")}: {p.sourceNumber}
            </Txt>
          )}
        </Panel>
      ))}
      <Txt style={{ fontWeight: "600", marginVertical: 12 }}>
        {tr("expenseBreakdown")}
      </Txt>
      {(r.expenseBreakdown || []).map((e) => (
        <Panel key={e.key}>
          <Txt>
            {e[lang]} · {money(e.amount)}
          </Txt>
        </Panel>
      ))}
      <Txt style={{ fontWeight: "600", marginVertical: 12 }}>
        {tr("expenseStatement")}
      </Txt>
      {(r.expenseStatement || []).map((e) => (
        <Panel key={e.id}>
          <Txt>
            {e.date} · {e.number} · {e.actor}
          </Txt>
          <Txt>
            {e[lang]} · {money(e.amount)}
          </Txt>
          <Txt>{e.note}</Txt>
          {e.sourceNumber !== e.number && (
            <Txt>
              {tr("sourceNumber")}: {e.sourceNumber}
            </Txt>
          )}
        </Panel>
      ))}
      {withMoney && (
        <>
          <Txt style={{ fontWeight: "600", marginVertical: 12 }}>
            {tr("moneyStatement")}
          </Txt>
          {(r.moneyStatement || []).map((e) => (
            <Panel key={e.id}>
              <Txt>
                {e.date} · {e.number} · {tr(e.kind)} · {e.actor}
              </Txt>
              <Txt>{e.note}</Txt>
              <Txt>
                {tr("cashIn")}: {money(e.cashIn)} · {tr("cashOut")}:{" "}
                {money(e.cashOut)}
              </Txt>
              <Txt>
                {tr("closingCash")}: {money(e.cashBalance)}
              </Txt>
              <Txt>
                {tr("bankIn")}: {money(e.bankIn)} · {tr("bankOut")}:{" "}
                {money(e.bankOut)}
              </Txt>
              <Txt>
                {tr("closingBank")}: {money(e.bankBalance)}
              </Txt>
            </Panel>
          ))}
        </>
      )}
    </>
  );
}
