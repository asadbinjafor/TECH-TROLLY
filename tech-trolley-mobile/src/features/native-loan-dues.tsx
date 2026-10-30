import React, { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { decimal, loanAccounts, minor } from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";
import { useShop } from "../contexts/shop-context";
import { Button, Input, Panel, Txt, useColors } from "../components/ui";
import { NativePartyManager } from "./native-party-manager";

export function NativeLoanDues({ navigation }: any) {
  const { state, lang } = useShop();
  const c = useColors();
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  if (!state) return null;
  const tr = (key: string) => t(key, lang),
    money = (value: string) => currency(value, lang);
  const accounts = loanAccounts(state),
    account = accounts.find((a) => a.partyId === selected);
  const summary = (values: {
    given: string;
    received: string;
    due: string;
  }) => (
    <Panel>
      {[
        ["totalLent", values.given],
        ["totalRepaid", values.received],
        ["loanOutstanding", values.due],
      ].map(([key, value]) => (
        <View key={key} style={{ marginVertical: 6 }}>
          <Txt>{tr(key)}</Txt>
          <Txt style={{ fontSize: 20, lineHeight: 30 }}>{money(value)}</Txt>
        </View>
      ))}
    </Panel>
  );
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
  ) as { given: string; received: string; due: string };
  return (
    <>
      <Panel>
        <Txt>{tr("loanDuesHelp")}</Txt>
        {state.user.role === "STAFF" && <Txt>{tr("loanScopeToday")}</Txt>}
      </Panel>
      <Button
        primary
        label={tr("loan")}
        onPress={() => navigation.navigate("Command", { kind: "loan" })}
      />
      <Button label={tr("manageBorrowers")} onPress={() => setManage(true)} />
      {account ? (
        <>
          <Button label={tr("close")} onPress={() => setSelected(null)} />
          <Panel>
            <Txt style={{ fontSize: 20 }}>{account.name}</Txt>
            <Txt>{account.phone}</Txt>
            {account.active && (
              <Button
                label={tr("lendAgain")}
                onPress={() =>
                  navigation.navigate("Command", {
                    kind: "loan",
                    partyId: account.partyId,
                  })
                }
              />
            )}
          </Panel>
          {summary(account)}
          <Txt style={{ marginVertical: 12 }}>{tr("openLoans")}</Txt>
          {account.loans
            .filter((d) => !d.reversed_by && minor(d.due) > 0n)
            .map((d) => (
              <Panel key={d.id}>
                <Txt>
                  {d.number} · {d.business_date}
                </Txt>
                <Txt>
                  {tr(String(d.snapshot.account))} · {money(d.due)}
                </Txt>
                <Button
                  primary
                  label={tr("receiveRepayment")}
                  onPress={() =>
                    navigation.navigate("Command", {
                      kind: "loanRepayment",
                      documentId: d.id,
                    })
                  }
                />
              </Panel>
            ))}
          {minor(account.due) === 0n && <Txt>{tr("loanCleared")}</Txt>}
          <Txt style={{ marginVertical: 12 }}>{tr("loanHistory")}</Txt>
          {account.history.map((d) => {
            const original = d.snapshot.originalSnapshot as
              Record<string, unknown> | undefined;
            return (
              <Panel key={d.id}>
                <Txt>
                  {d.number} · {tr(d.kind)}
                </Txt>
                <Txt>
                  {d.business_date} ·{" "}
                  {new Date(d.created_at).toLocaleTimeString(
                    lang === "bn" ? "bn-BD" : "en-GB",
                    {
                      timeZone: "Asia/Dhaka",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}{" "}
                  · {d.actor_name}
                </Txt>
                <Txt>
                  {tr(String(d.snapshot.account || original?.account || ""))} ·{" "}
                  {money(d.total)}
                </Txt>
                <Txt>{String(d.snapshot.note || "—")}</Txt>
                {d.reversed_by && <Txt>{tr("reversed")}</Txt>}
              </Panel>
            );
          })}
        </>
      ) : (
        <>
          {summary(totals)}
          <Input label={tr("loanSearch")} value={search} onChange={setSearch} />
          <Button
            primary={!all}
            label={tr("openLoans")}
            onPress={() => setAll(false)}
          />
          <Button
            primary={all}
            label={tr("allLoans")}
            onPress={() => setAll(true)}
          />
          {accounts
            .filter(
              (a) =>
                (all || minor(a.due) > 0n) &&
                `${a.name} ${a.phone}`
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
            )
            .map((a) => (
              <Panel key={a.partyId}>
                <Txt style={{ fontSize: 20 }}>{a.name}</Txt>
                <Txt>{a.phone}</Txt>
                <Txt>
                  {tr("totalLent")}: {money(a.given)}
                </Txt>
                <Txt>
                  {tr("totalRepaid")}: {money(a.received)}
                </Txt>
                <Txt>
                  {tr("loanOutstanding")}: {money(a.due)}
                </Txt>
                <Button
                  primary
                  label={
                    minor(a.due) > 0n
                      ? tr("receiveRepayment")
                      : tr("loanHistory")
                  }
                  onPress={() => setSelected(a.partyId)}
                />
                {a.active && (
                  <Button
                    label={tr("lendAgain")}
                    onPress={() =>
                      navigation.navigate("Command", {
                        kind: "loan",
                        partyId: a.partyId,
                      })
                    }
                  />
                )}
              </Panel>
            ))}
          {!accounts.some(
            (a) =>
              (all || minor(a.due) > 0n) &&
              `${a.name} ${a.phone}`
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
          ) && <Txt>{tr("noLoanAccounts")}</Txt>}
        </>
      )}
      <Modal
        visible={manage}
        animationType="slide"
        onRequestClose={() => setManage(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Button label={tr("close")} onPress={() => setManage(false)} />
            <NativePartyManager kind="person" />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
