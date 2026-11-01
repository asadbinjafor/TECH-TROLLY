import React, { useEffect, useState } from "react";
import { ScrollView, View, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";
import { t, currency, dateLabel, detailValue } from "@tech-trolley/i18n";
import {
  productDetails,
  canChangeStock,
  acquisitionCycleIds,
  type CommandKind,
  type Report,
  type Document,
} from "@tech-trolley/contracts";
import { NativeReportAnalysis } from "./native-report-analysis";
import { NativeLoanDues } from "./native-loan-dues";
import { useNativeDashboardPrivacy } from "./native-dashboard-privacy";
import { NativeQuickActions } from "./native-quick-actions";
import { useShop } from "../contexts/shop-context";
import { Button, Txt, Panel, Input, Empty, useColors } from "../components/ui";
import { api, tokenKey } from "../services/api";
export function NativePage({ navigation, route, section: initial }: any) {
  const section = route?.params?.section || initial || "overview";
  const { state, user, lang, dark, setDark, setLang, error, refresh, logout } =
      useShop(),
    c = useColors(),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("inStock"),
    [purchaseTab, setPurchaseTab] = useState("allPurchases"),
    [historyUnit, setHistoryUnit] = useState<string | null>(null),
    [date, setDate] = useState(""),
    [showDate, setShowDate] = useState(false),
    [period, setPeriod] = useState(section === "profit" ? "month" : "today"),
    [rangeFrom, setRangeFrom] = useState(""),
    [rangeTo, setRangeTo] = useState(""),
    [report, setReport] = useState<Report | null>(null),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  const privacy = useNativeDashboardPrivacy(
    `${user?.id || ""}:${section}`,
    navigation,
  );
  const tr = (k: string) => t(k, lang),
    money = (v: string) =>
      section === "overview" && !privacy.visible
        ? "৳ ••••••"
        : currency(v, lang);
  const command = (kind: CommandKind) =>
    navigation.navigate("Command", { kind });
  const query = new URLSearchParams({
    lang,
    period: user?.role !== "OWNER" || section === "daybook" ? "today" : period,
    ...(user?.role === "OWNER" && section === "daybook" && date
      ? { date }
      : {}),
    ...(user?.role === "OWNER" && section !== "daybook" && period === "range"
      ? {
          from: rangeFrom || state?.today || "",
          to: rangeTo || state?.today || "",
        }
      : {}),
  }).toString();
  useEffect(() => {
    let active = true;
    if (state && ["reports", "daybook", "profit"].includes(section)) {
      setProblem("loading");
      void api
        .request<Report>("/reports?" + query)
        .then((r) => {
          if (!active) return;
          setReport(r);
          setProblem("");
        })
        .catch((e) => {
          if (active) setProblem(e.code);
        });
    }
    return () => {
      active = false;
    };
  }, [section, query, state]);
  if (!state)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}>
        <Txt>{tr(error || "loading")}</Txt>
        <Button label={tr("retry")} onPress={() => void refresh()} />
      </SafeAreaView>
    );
  const r = section === "overview" ? state.report : report || state.report;
  const historyIds = historyUnit
    ? acquisitionCycleIds(historyUnit, state.units)
    : new Set<string>();
  const actions = (kinds: CommandKind[]) =>
    kinds.map((k) => (
      <Button key={k} label={tr(k)} onPress={() => command(k)} />
    ));
  const metric = (key: string, value: string) => (
    <View key={key} style={{ width: "48%" }}>
      <Panel>
        <Txt style={{ fontSize: 11, color: c.muted }}>{tr(key)}</Txt>
        <Txt
          style={{
            fontSize: 22,
            fontWeight: "600",
            marginTop: 12,
            lineHeight: 32,
            color: key === "netProfit" ? "#208768" : c.text,
          }}
        >
          {money(value)}
        </Txt>
        {section === "overview" && privacy.control}
      </Panel>
    </View>
  );
  const docList = (docs: Document[]) =>
    docs.length ? (
      docs
        .filter((d) =>
          (section === "overview" && !privacy.visible
            ? `${d.number} ${d.kind} ${d.actor_name} ${d.snapshot.model || ""}`
            : JSON.stringify(d)
          )
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((d) => (
          <Panel key={d.id}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Txt style={{ fontWeight: "600" }}>{d.number}</Txt>
              <Txt style={{ fontSize: 11, color: c.muted }}>
                {tr(
                  d.kind === "purchase" &&
                    d.snapshot.purchaseSource === "individual"
                    ? "individualPurchase"
                    : d.kind,
                )}
              </Txt>
            </View>
            <Txt style={{ marginVertical: 6 }}>
              {String(
                d.snapshot.model ||
                  d.snapshot.partyName ||
                  d.snapshot.staffName ||
                  d.snapshot.note ||
                  "",
              )}
            </Txt>
            <Txt style={{ fontSize: 11, color: c.muted }}>
              {d.business_date} · {d.actor_name}
            </Txt>
            {d.kind !== "stockEdit" && (
              <Txt style={{ fontSize: 20, marginTop: 12, lineHeight: 30 }}>
                {money(d.total)}
              </Txt>
            )}
            {Number(d.due) > 0 && (
              <Txt style={{ fontSize: 12, color: "#b95050" }}>
                {tr("due")}: {money(d.due)}
              </Txt>
            )}
            {d.reversed_by && <Txt>{tr("reversed")}</Txt>}
            {d.kind === "stockEdit" &&
              Object.entries(d.snapshot.after as Record<string, unknown>).map(
                ([k, v]) => (
                  <Txt key={k}>
                    {tr(k)}:{" "}
                    {detailValue(
                      k,
                      (d.snapshot.before as Record<string, unknown>)[k],
                      lang,
                    )}{" "}
                    → {detailValue(k, v, lang)}
                  </Txt>
                ),
              )}
            {d.kind === "purchaseReturn" &&
              Number(
                state.documents.find((current) => current.id === d.id)?.due ||
                  "0",
              ) > 0 && (
                <Button
                  label={tr("supplierRefund")}
                  onPress={() =>
                    navigation.navigate("Command", {
                      kind: "supplierRefund",
                      documentId: d.id,
                    })
                  }
                />
              )}
            {d.kind === "sale" && (
              <Button
                label={tr("receipt")}
                onPress={() =>
                  section === "overview" && !privacy.visible
                    ? privacy.toggle()
                    : navigation.navigate("Receipt", { id: d.id })
                }
              />
            )}
            {d.kind === "purchase" &&
              d.snapshot.purchaseSource === "individual" && (
                <Button
                  label={tr("purchaseDeclaration")}
                  onPress={() =>
                    section === "overview" && !privacy.visible
                      ? privacy.toggle()
                      : navigation.navigate("PurchaseDeclaration", { id: d.id })
                  }
                />
              )}
          </Panel>
        ))
    ) : (
      <Empty />
    );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      edges={["left", "right", ...(initial ? ["top" as const] : [])]}
    >
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => {
              setBusy(true);
              void refresh().finally(() => setBusy(false));
            }}
            tintColor="#e9ba4b"
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <View>
            <Txt style={{ fontSize: 23, fontWeight: "700", lineHeight: 36 }}>
              {tr(section === "more" ? "workspace" : section)}
            </Txt>
            <Txt style={{ fontSize: 10, color: c.muted }}>
              {dateLabel(state.today, lang)}
            </Txt>
          </View>
          {section === "overview" && (
            <View>
              <Button
                label={tr("sale")}
                primary
                onPress={() => command("sale")}
              />
              <Button
                label={tr("cashCount")}
                onPress={() => command("cashCount")}
              />
            </View>
          )}
        </View>
        {state.shop.history_version !== undefined &&
          (!state.shop.opened_at || state.shop.history_active) && (
            <Panel>
              <Txt>
                {tr(
                  state.shop.history_active
                    ? "historyActive"
                    : "historyStartHint",
                )}
              </Txt>
              {user?.role === "OWNER" && (
                <Button
                  label={tr("historySetup")}
                  onPress={() =>
                    navigation.navigate("Administration", { mode: "settings" })
                  }
                />
              )}
            </Panel>
          )}
        {(error || problem) && (
          <Panel>
            <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
              {tr(error ? "offline" : problem)}
            </Txt>
            <Button label={tr("retry")} onPress={() => void refresh()} />
          </Panel>
        )}
        {!state.shop.opened_at && (
          <Panel>
            <Txt>{tr("openingNotice")}</Txt>
            {user?.role === "OWNER" && (
              <Button
                label={tr("opening")}
                primary
                onPress={() => command("opening")}
              />
            )}
          </Panel>
        )}
        {section === "overview" && (
          <>
            <View
              style={{
                backgroundColor: "#24272b",
                padding: 24,
                borderRadius: 17,
                marginBottom: 16,
              }}
            >
              <Txt style={{ color: "#c8c8c3", fontSize: 12 }}>{tr("cash")}</Txt>
              <Txt
                style={{
                  color: "#e9ba4b",
                  fontSize: 36,
                  fontWeight: "600",
                  lineHeight: 55,
                  marginTop: 15,
                }}
              >
                {money(state.balances.cash)}
              </Txt>
              {privacy.control}
              <Txt style={{ color: "#c8c8c3", fontSize: 11, marginTop: 15 }}>
                {tr("cashIn")} +{money(r.cashIn)} · {tr("cashOut")} −
                {money(r.cashOut)}
              </Txt>
            </View>
            <Panel>
              <Txt style={{ color: c.muted, fontSize: 12 }}>{tr("bank")}</Txt>
              <Txt style={{ fontSize: 30, lineHeight: 45, marginTop: 12 }}>
                {money(state.balances.bank)}
              </Txt>
              {privacy.control}
              <Button
                label={tr("transfer")}
                onPress={() => command("transfer")}
              />
            </Panel>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              {metric("revenue", r.revenue)}
              {metric("netProfit", r.netProfit)}
              {metric("expenses", r.expense)}
              {metric("stockCost", state.balances.inventory)}
            </View>
            <Txt style={{ fontWeight: "600", marginBottom: 10 }}>
              {tr("quick")}
            </Txt>
            <NativeQuickActions lang={lang} onAction={command} />
            <Txt style={{ fontWeight: "600", marginVertical: 15 }}>
              {tr("recent")}
            </Txt>
            {docList(state.documents.slice(0, 5))}
          </>
        )}
        {section === "inventory" && (
          <>
            {tab === "inStock" &&
              !state.units.some((u) => u.status === "IN_STOCK") && (
                <Panel>
                  <Txt>{tr("emptyStockSelection")}</Txt>
                </Panel>
              )}
            {state.units.some((u) => u.variant && !u.storage && !u.color) && (
              <Panel>
                <Txt>{tr("legacyVariant")}</Txt>
              </Panel>
            )}
            <Input label={tr("search")} value={search} onChange={setSearch} />
            <View
              style={{
                flexDirection: "row",
                gap: 7,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {["inStock", "stockOut", "all"].map((k) => (
                <Button
                  key={k}
                  label={tr(k)}
                  primary={tab === k}
                  onPress={() => setTab(k)}
                />
              ))}
            </View>
            {state.units.length ? (
              state.units
                .filter(
                  (u) =>
                    (tab === "all" ||
                      (tab === "inStock"
                        ? u.status === "IN_STOCK"
                        : u.status !== "IN_STOCK")) &&
                    `${u.model} ${u.brand} ${productDetails(u)} ${u.imei} ${u.internal_id}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((u) => {
                  const sale = state.documents.find((d) => d.id === u.sale_id);
                  return (
                    <Panel key={u.id}>
                      <Txt style={{ fontSize: 18, fontWeight: "600" }}>
                        {u.model}
                      </Txt>
                      <Txt style={{ fontSize: 12, color: c.muted }}>
                        {u.brand} · {u.internal_id}
                      </Txt>
                      <Txt>
                        {tr("storage")}: {u.storage || "—"}
                      </Txt>
                      <Txt>
                        {tr("color")}: {u.color || "—"}
                      </Txt>
                      {u.phoneType && (
                        <Txt>
                          {tr(u.phoneType)}
                          {u.ram ? ` · RAM ${u.ram}` : ""}
                        </Txt>
                      )}
                      <Txt>
                        {tr("variant")}: {u.variant || "—"}
                      </Txt>
                      <Txt style={{ fontSize: 13, marginVertical: 10 }}>
                        {u.imei || "—"}
                      </Txt>
                      <Txt>
                        {tr("cost")}: {money(u.cost)}
                      </Txt>
                      <Txt>
                        {tr(u.status)} ·{" "}
                        {u.battery === null ? "—" : u.battery + "%"} ·{" "}
                        {tr(u.box)}
                      </Txt>
                      {sale && (
                        <>
                          <Txt>
                            {tr("price")}: {money(sale.total)} ·{" "}
                            {sale.business_date} · {sale.actor_name}
                          </Txt>
                          <Button
                            label={tr("receipt")}
                            onPress={() =>
                              navigation.navigate("Receipt", { id: sale.id })
                            }
                          />
                        </>
                      )}
                      {canChangeStock(u, state) && (
                        <>
                          <Button
                            label={tr("stockEdit")}
                            onPress={() =>
                              navigation.navigate("Command", {
                                kind: "stockEdit",
                                unitId: u.id,
                              })
                            }
                          />
                          <Button
                            label={tr("purchaseReturn")}
                            onPress={() =>
                              navigation.navigate("Command", {
                                kind: "purchaseReturn",
                                unitId: u.id,
                              })
                            }
                          />
                        </>
                      )}
                      <Button
                        label={tr("stockHistory")}
                        onPress={() => setHistoryUnit(u.id)}
                      />
                      {u.status === "IN_STOCK" && (
                        <Button
                          label={tr("sale")}
                          primary
                          onPress={() =>
                            navigation.navigate("Command", {
                              kind: "sale",
                              unitId: u.id,
                            })
                          }
                        />
                      )}
                    </Panel>
                  );
                })
            ) : (
              <Empty />
            )}
          </>
        )}
        {section === "inventory" && historyUnit && (
          <>
            <Button label={tr("close")} onPress={() => setHistoryUnit(null)} />
            {docList(
              state.documents.filter(
                (d) => d.unit_id && historyIds.has(d.unit_id),
              ),
            )}
          </>
        )}
        {section === "purchases" && (
          <>
            {actions(["purchase", "individualPurchase"])}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["allPurchases", "supplierPurchases", "individualPurchases"].map(
                (tab) => (
                  <Button
                    key={tab}
                    label={tr(tab)}
                    primary={purchaseTab === tab}
                    onPress={() => setPurchaseTab(tab)}
                  />
                ),
              )}
            </View>
            {docList(
              state.documents.filter(
                (d) =>
                  d.kind === "purchase" &&
                  (purchaseTab === "allPurchases" ||
                    (purchaseTab === "individualPurchases") ===
                      (d.snapshot.purchaseSource === "individual")),
              ),
            )}
          </>
        )}
        {section === "transactions" && (
          <>
            <Input label={tr("search")} value={search} onChange={setSearch} />
            {actions(["expense", "reversal"])}
            {docList(state.documents)}
          </>
        )}
        {section === "money" && (
          <>
            <Button
              primary
              label={tr("dues")}
              onPress={() => navigation.navigate("Page", { section: "dues" })}
            />
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              {[
                "cash",
                "bank",
                "receivable",
                "payable",
                "supplierReceivable",
              ].map((k) => metric(k, state.balances[k] || "0.00"))}
            </View>
            {actions([
              "collection",
              "supplierPayment",
              "supplierRefund",
              "transfer",
              "contribution",
              "withdrawal",
              "loan",
              "loanRepayment",
            ])}
            <Button
              label={tr("createParty")}
              onPress={() =>
                navigation.navigate("Administration", { mode: "parties" })
              }
            />
            {docList(state.documents.filter((d) => Number(d.due) > 0))}
          </>
        )}
        {section === "dues" && <NativeLoanDues navigation={navigation} />}
        {section === "staff" && (
          <>
            {actions(["advance", "advanceRepayment", "salary"])}
            {state.staff.map((s) => (
              <Panel key={s.id}>
                <Txt>{s.name}</Txt>
                <Txt>{tr(s.role)}</Txt>
              </Panel>
            ))}
            {docList(
              state.documents.filter((d) =>
                ["advance", "advanceRepayment", "salary"].includes(d.kind),
              ),
            )}
          </>
        )}
        {["daybook", "reports", "profit"].includes(section) && (
          <>
            {user?.role !== "OWNER" ? (
              <Panel>
                <Txt>{tr("monthlyNotice")}</Txt>
              </Panel>
            ) : section === "daybook" ? (
              <>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    label="‹"
                    onPress={() => {
                      const d = new Date((date || state.today) + "T12:00:00Z");
                      d.setUTCDate(d.getUTCDate() - 1);
                      setDate(d.toISOString().slice(0, 10));
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Button
                      label={date || state.today}
                      onPress={() => setShowDate(true)}
                    />
                  </View>
                  <Button
                    label="›"
                    disabled={(date || state.today) >= state.today}
                    onPress={() => {
                      const d = new Date(date + "T12:00:00Z");
                      d.setUTCDate(d.getUTCDate() + 1);
                      setDate(d.toISOString().slice(0, 10));
                    }}
                  />
                </View>
                <Button label={tr("today")} onPress={() => setDate("")} />
                {showDate && (
                  <DateTimePicker
                    value={new Date((date || state.today) + "T12:00:00")}
                    maximumDate={new Date(state.today + "T23:59:59")}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, d) => {
                      setShowDate(false);
                      if (d)
                        setDate(
                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                        );
                    }}
                  />
                )}
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>
                {["today", "week", "month", "range"].map((p) => (
                  <Button
                    key={p}
                    label={tr(p === "month" ? "monthReport" : p)}
                    primary={p === period}
                    onPress={() => setPeriod(p)}
                  />
                ))}
              </View>
            )}
            {user?.role === "OWNER" &&
              section !== "daybook" &&
              period === "range" && (
                <Panel>
                  <Input
                    label={tr("startDate") + " (YYYY-MM-DD)"}
                    value={rangeFrom || state.today}
                    onChange={setRangeFrom}
                  />
                  <Input
                    label={tr("endDate") + " (YYYY-MM-DD)"}
                    value={rangeTo || state.today}
                    onChange={setRangeTo}
                  />
                </Panel>
              )}
            {r.available && !problem ? (
              <>
                <Txt
                  style={{ fontSize: 11, color: c.muted, marginVertical: 12 }}
                >
                  {r.from} — {r.to}
                </Txt>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                  }}
                >
                  {metric("revenue", r.revenue)}
                  {metric("cogs", r.cogs)}
                  {metric("grossProfit", r.grossProfit)}
                  {metric("expenses", r.expense)}
                  {metric("netProfit", r.netProfit)}
                  {metric("purchasesTotal", r.purchases || "0.00")}
                  {metric("purchaseReturns", r.purchaseReturns || "0.00")}
                  {metric(
                    "closingSupplierRefund",
                    r.closingSupplierRefund || "0.00",
                  )}
                </View>
                {section !== "profit" && (
                  <Panel>
                    {[
                      "openingCash",
                      "cashIn",
                      "cashOut",
                      "closingCash",
                      "openingBank",
                      "bankIn",
                      "bankOut",
                      "closingBank",
                      "grossProfit",
                      "externalIn",
                      "externalOut",
                    ].map((k) => (
                      <View
                        key={k}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          borderBottomWidth: 1,
                          borderBottomColor: c.line,
                          paddingVertical: 10,
                          gap: 12,
                        }}
                      >
                        <Txt style={{ fontSize: 12 }}>{tr(k)}</Txt>
                        <Txt style={{ fontSize: 12 }}>
                          {money((r as any)[k])}
                        </Txt>
                      </View>
                    ))}
                  </Panel>
                )}
                {section !== "profit" && docList(r.documents)}
                <NativeReportAnalysis
                  report={r}
                  lang={lang}
                  withMoney={section !== "profit"}
                />
              </>
            ) : (
              <Panel>
                <Txt>{tr(problem || "unavailable")}</Txt>
              </Panel>
            )}
            <Button
              label={tr("download")}
              disabled={!!problem}
              onPress={() => {
                void (async () => {
                  try {
                    const token = await SecureStore.getItemAsync(tokenKey);
                    const file = await File.downloadFileAsync(
                      `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/reports/export?${query}`,
                      new File(
                        Paths.cache,
                        `trolley-${r.from}-${r.to}-${Date.now()}.csv`,
                      ),
                      { headers: { Authorization: `Bearer ${token}` } },
                    );
                    if (await Sharing.isAvailableAsync())
                      await Sharing.shareAsync(file.uri, {
                        mimeType: "text/csv",
                      });
                  } catch (e: any) {
                    setProblem(e.code || "NETWORK_ERROR");
                  }
                })();
              }}
            />
            {section === "daybook" &&
              state.counts
                .filter(
                  (count: any) =>
                    String(count.business_date).slice(0, 10) ===
                    (date || state.today),
                )
                .map((count: any) => (
                  <Panel key={count.document_id}>
                    <Txt>
                      {tr("cashCount")} · {count.actor_name}
                    </Txt>
                    <Txt>
                      {tr("expected")}:{" "}
                      {money((Number(count.expected) / 100).toFixed(2))}
                    </Txt>
                    <Txt>
                      {tr("counted")}:{" "}
                      {money((Number(count.counted) / 100).toFixed(2))}
                    </Txt>
                    <Txt>
                      {tr("difference")}:{" "}
                      {money((Number(count.difference) / 100).toFixed(2))}
                    </Txt>
                    {count.needs_review && (
                      <Txt style={{ color: "#b95050" }}>
                        {tr("needsReview")}
                      </Txt>
                    )}
                  </Panel>
                ))}
          </>
        )}
        {section === "more" && (
          <>
            {[
              "sale",
              "purchases",
              "transactions",
              "money",
              "dues",
              "staff",
              "reports",
              "profit",
            ].map((s) => (
              <Button
                key={s}
                label={tr(s)}
                onPress={() =>
                  s === "sale"
                    ? command("sale")
                    : navigation.navigate("Page", { section: s })
                }
              />
            ))}
            <Button
              label={tr("settings")}
              onPress={() =>
                navigation.navigate("Administration", { mode: "settings" })
              }
            />
            <Button
              label={tr("categories")}
              onPress={() =>
                navigation.navigate("Administration", { mode: "categories" })
              }
            />
            <Button
              label={tr("createParty")}
              onPress={() =>
                navigation.navigate("Administration", { mode: "parties" })
              }
            />
            {user?.role === "OWNER" && (
              <Button
                label={tr("users")}
                onPress={() =>
                  navigation.navigate("Administration", { mode: "users" })
                }
              />
            )}
            <Button
              label={tr("changePassword")}
              onPress={() =>
                navigation.navigate("Administration", { mode: "password" })
              }
            />
            <Button
              label={lang === "bn" ? "English" : "বাংলা"}
              onPress={() => setLang(lang === "bn" ? "en" : "bn")}
            />
            <Button
              label={tr(dark ? "light" : "dark")}
              onPress={() => setDark(!dark)}
            />
            <Button
              label={tr("logout")}
              onPress={() =>
                void logout().catch((e: any) => setProblem(e.code))
              }
            />
          </>
        )}
        <Txt
          style={{
            fontSize: 10,
            color: c.muted,
            textAlign: "center",
            marginTop: 25,
          }}
        >
          {tr("connected")} · Tech Trolley
        </Txt>
      </ScrollView>
      {privacy.dialog}
    </SafeAreaView>
  );
}
