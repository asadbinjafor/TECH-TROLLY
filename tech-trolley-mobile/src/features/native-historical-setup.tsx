import React from "react";
import { t, currency } from "@tech-trolley/i18n";
import { type CommandKind } from "@tech-trolley/contracts";
import { useShop } from "../contexts/shop-context";
import { Panel, Txt, Button } from "../components/ui";
export function NativeHistoricalSetup({ navigation }: any) {
  const { state, user, lang } = useShop();
  if (
    !state ||
    user?.role !== "OWNER" ||
    state.shop.history_version === undefined
  )
    return null;
  const s = state.shop,
    tr = (k: string) => t(k, lang);
  const action = (kind: CommandKind, params: Record<string, string> = {}) => (
    <Button
      key={kind}
      label={tr(kind)}
      onPress={() => navigation.navigate("Command", { kind, ...params })}
    />
  );
  return (
    <Panel>
      <Txt style={{ fontSize: 20, fontWeight: "600" }}>
        {tr("historySetup")}
      </Txt>
      {!s.opened_at ? (
        <>
          <Txt>{tr("historyIntro")}</Txt>
          {action("historyStart")}
        </>
      ) : !s.history_from ? (
        <Txt>{tr("historyNoRestart")}</Txt>
      ) : (
        <>
          <Txt>
            {tr("historyPeriod")}: {s.history_from} — {s.history_to}
          </Txt>
          <Txt>
            {tr("historyLastDate")}: {s.history_last_date}
          </Txt>
          <Txt>
            {tr(s.history_active ? "historyActive" : "historyComplete")}
          </Txt>
          {s.history_active && (
            <>
              <Txt>
                {tr(
                  s.history_locked ? "historyEntryHelp" : "historyBaselineHelp",
                )}
              </Txt>
              {[
                "cash",
                "bank",
                "inventory",
                "receivable",
                "payable",
                "loan",
                "advance",
                "supplierReceivable",
              ].map((a) => (
                <Txt key={a}>
                  {tr(a === "loan" ? "loanOutstanding" : a)}:{" "}
                  {currency(state.balances[a] || "0", lang)}
                </Txt>
              ))}
              {!s.history_locked ? (
                <>
                  {action("openingStock")}
                  {action("openingDue")}
                  {action("openingAdjustment")}
                  <Txt>{tr("historyOpeningList")}</Txt>
                  {state.documents
                    .filter(
                      (d) =>
                        ["openingStock", "openingDue"].includes(d.kind) &&
                        !d.reversed_by,
                    )
                    .map((d) => (
                      <Panel key={d.id}>
                        <Txt>
                          {d.number} · {tr(d.kind)} ·{" "}
                          {String(
                            d.snapshot.model || d.snapshot.partyName || "",
                          )}{" "}
                          · {currency(d.total, lang)}
                        </Txt>
                        {d.kind === "openingStock" &&
                          action("stockEdit", { unitId: d.unit_id! })}
                        {action("reversal", { documentId: d.id })}
                      </Panel>
                    ))}
                  <Txt>{tr("historyOpeningReview")}</Txt>
                  {action("historyLock")}
                </>
              ) : (
                <>
                  <Txt>{tr("historyFinishHelp")}</Txt>
                  {action("historyFinish")}
                </>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
