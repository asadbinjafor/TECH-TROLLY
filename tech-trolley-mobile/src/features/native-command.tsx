import * as Crypto from "expo-crypto";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useShop } from "../contexts/shop-context";
import { Button, Input, Txt, Panel, useColors } from "../components/ui";
import { api } from "../services/api";
import { NativePartyManager } from "./native-party-manager";
export function NativeCommand({ navigation, route }: any) {
  const kind = route.params.kind as CommandKind,
    { state, user, lang, refresh } = useShop(),
    c = useColors(),
    [values, setValues] = useState<Record<string, string>>({}),
    [pending, setPending] = useState<{ key: string; data: any } | null>(null),
    [ready, setReady] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [issues, setIssues] = useState<Record<string, string>>({}),
    [partyField, setPartyField] = useState<Field | null>(null);
  const storage = `tt-${user!.id}-draft-${kind}`,
    pendingKey = `tt-${user!.id}-pending-${kind}`,
    tr = (k: string) =>
      t(kind === "expense" && k === "note" ? "expenseDetails" : k, lang);
  useEffect(() => {
    void (async () => {
      const [[, draft], [, p]] = await AsyncStorage.multiGet([
        storage,
        pendingKey,
      ]);
      const initial = p
        ? Object.fromEntries(
            Object.entries(JSON.parse(p).data).map(([k, v]) => [
              k,
              v === null ? "" : String(v),
            ]),
          )
        : restoreFormDraft(
            kind,
            draft ? JSON.parse(draft) : null,
            state?.today || "",
          );
      if (!p && route.params.unitId && initial.unitId !== route.params.unitId) {
        initial.unitId = route.params.unitId;
        Object.assign(
          initial,
          unitFormValues(
            kind,
            state?.units.find((u) => u.id === route.params.unitId),
          ),
        );
      }
      if (
        !p &&
        route.params.documentId &&
        kind === "supplierRefund" &&
        initial.documentId !== route.params.documentId
      )
        Object.assign(initial, {
          documentId: route.params.documentId,
          amount: "",
        });
      setValues(initial);
      setPending(p ? JSON.parse(p) : null);
      setReady(true);
    })();
  }, [kind, storage, pendingKey]);
  useEffect(() => {
    if (ready) void AsyncStorage.setItem(storage, JSON.stringify(values));
  }, [values, ready, storage]);
  if (!state || !ready) return <Txt>{tr("loading")}</Txt>;
  const blockers = selectionBlockers(kind, values, state);
  const blocked = !pending && Object.keys(blockers).length > 0;
  const paymentHint = paymentHelp(kind, values);
  const persist = async (p: typeof pending) => {
    setPending(p);
    if (p) await AsyncStorage.setItem(pendingKey, JSON.stringify(p));
    else await AsyncStorage.removeItem(pendingKey);
  };
  const finish = async (id: string) => {
    await AsyncStorage.multiRemove([storage, pendingKey]);
    await refresh();
    if (kind === "sale") navigation.replace("Receipt", { id });
    else navigation.goBack();
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      let p = pending;
      if (!p) {
        p = {
          key: Crypto.randomUUID(),
          data: prepareForm(kind, values, state),
        };
        await persist(p);
      }
      const result = await api.command(kind, p.data, p.key);
      await finish(result.id);
    } catch (e: any) {
      if (e.issues) {
        setError("VALIDATION_ERROR");
        setIssues(
          Object.fromEntries(e.issues.map((i: any) => [i.path[0], i.message])),
        );
      } else {
        setError(e.code || "SERVER_ERROR");
        if (["STOCK_CHANGED", "STOCK_CONFLICT"].includes(e.code))
          await refresh();
        if (e.status >= 400 && e.status < 500) await persist(null);
        if (e.details)
          setIssues(
            Object.fromEntries(e.details.map((i: any) => [i.field, i.code])),
          );
      }
    } finally {
      setBusy(false);
    }
  };
  let preview: any = null;
  try {
    if (kind === "sale") {
      const total = minor(values.price || "0") - minor(values.discount || "0"),
        due = total - minor(values.cash || "0") - minor(values.bank || "0"),
        unit = state.units.find((u) => u.id === values.unitId);
      preview = {
        total: decimal(total),
        due: decimal(due),
        grossProfit: unit ? decimal(total - minor(unit.cost)) : null,
      };
    }
  } catch {}
  let returnSummary: Record<string, string> | null = null;
  try {
    if (kind === "purchaseReturn") returnSummary = returnPreview(state, values);
  } catch {}
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      edges={["left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Txt style={{ fontSize: 11, color: c.muted, marginBottom: 20 }}>
            {state.today} · Asia/Dhaka
          </Txt>
          {paymentHint && (
            <Txt style={{ marginBottom: 14 }}>{tr(paymentHint)}</Txt>
          )}
          {["stockEdit", "purchaseReturn", "supplierRefund"].includes(kind) && (
            <Panel>
              <Txt>{tr(kind + "Help")}</Txt>
            </Panel>
          )}
          {["stockEdit", "purchaseReturn"].includes(kind) &&
            values.unitId &&
            !review &&
            !pending && (
              <Button
                label={tr("reloadStock")}
                onPress={() =>
                  setValues((v) => ({
                    ...v,
                    ...unitFormValues(
                      kind,
                      state.units.find((u) => u.id === v.unitId),
                    ),
                  }))
                }
              />
            )}
          {formFields(kind, values).map((f) => (
            <View key={f.key}>
              {f.type === "select" ? (
                <View style={{ marginBottom: 14 }}>
                  <Txt style={{ fontSize: 12 }}>
                    {tr(f.label) +
                      (!fieldRequired(kind, f, values, state)
                        ? " · " + tr("optional")
                        : "")}
                  </Txt>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: c.line,
                      borderRadius: 8,
                      backgroundColor: c.surface,
                    }}
                  >
                    <Picker
                      accessibilityLabel={tr(f.label)}
                      selectedValue={values[f.key] || ""}
                      enabled={!review && !pending}
                      style={{ color: c.text }}
                      onValueChange={(v) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.key]: String(v),
                          ...(f.key === "unitId"
                            ? unitFormValues(
                                kind,
                                state.units.find((u) => u.id === String(v)),
                              )
                            : {}),
                          ...(f.key === "customerId"
                            ? customerInvoiceFields(
                                state.parties.find((p) => p.id === String(v)),
                              )
                            : {}),
                        }))
                      }
                    >
                      <Picker.Item
                        label={
                          f.key === "customerId" ? tr("walkIn") : tr("select")
                        }
                        value=""
                      />
                      {choices(f, state, lang).map((o) => (
                        <Picker.Item
                          key={o.value}
                          label={f.options ? tr(o.label) : o.label}
                          value={o.value}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              ) : review || pending ? (
                <Panel>
                  <Txt style={{ fontSize: 11, color: c.muted }}>
                    {tr(f.label)}
                  </Txt>
                  <Txt>{values[f.key] || "—"}</Txt>
                </Panel>
              ) : (
                <Input
                  label={
                    tr(f.label) +
                    (!fieldRequired(kind, f, values, state)
                      ? " · " + tr("optional")
                      : "")
                  }
                  value={values[f.key] || ""}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, [f.key]: v }))
                  }
                  money={f.type === "money"}
                  numeric={f.type === "number" || f.key === "imei"}
                  maxLength={fieldMaxLength(kind, f)}
                  secure={f.type === "password"}
                />
              )}
              {partyKindForSource(f.source) && !review && !pending && (
                <>
                  {!choices(f, state, lang).length && (
                    <Txt>
                      {tr(
                        f.key === "customerId" &&
                          !fieldRequired(kind, f, values, state)
                          ? "emptyOptionalCustomerSelection"
                          : "emptyPartySelection",
                      )}
                    </Txt>
                  )}
                  <Button
                    label={tr("manageParties")}
                    onPress={() => setPartyField(f)}
                  />
                </>
              )}
              {f.type === "select" &&
                !partyKindForSource(f.source) &&
                !choices(f, state, lang).length && (
                  <Txt>{tr(emptySelectionMessage(f))}</Txt>
                )}
              {!pending && blockers[f.key] === "SELECTION_UNAVAILABLE" && (
                <Txt style={{ color: "#b95050" }}>
                  {tr("SELECTION_UNAVAILABLE")}
                </Txt>
              )}
              {issues[f.key] && (
                <Txt style={{ color: "#b95050", fontSize: 11 }}>
                  {tr(
                    /^[A-Z_]+$/.test(issues[f.key])
                      ? issues[f.key]
                      : "VALIDATION_ERROR",
                  )}
                </Txt>
              )}
            </View>
          ))}
          {returnSummary && (
            <Panel>
              {Object.entries(returnSummary)
                .filter(([, v]) => v !== "")
                .map(([k, v]) => (
                  <Txt key={k}>
                    {tr(k)}: {currency(v, lang)}
                  </Txt>
                ))}
            </Panel>
          )}
          {preview && (
            <Panel>
              {Object.entries(preview).map(
                ([k, v]) =>
                  v !== null && (
                    <View
                      key={k}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 5,
                        gap: 10,
                      }}
                    >
                      <Txt>{tr(k)}</Txt>
                      <Txt
                        style={{ color: Number(v) < 0 ? "#b95050" : c.text }}
                      >
                        {currency(String(v), lang)}
                      </Txt>
                    </View>
                  ),
              )}
            </Panel>
          )}
          {review && (
            <Panel>
              <Txt>{tr("review")}</Txt>
            </Panel>
          )}
          {pending && !busy && (
            <Panel>
              <Txt>{tr("uncertain")}</Txt>
              <Txt style={{ fontSize: 10 }}>{pending.key}</Txt>
              <Button
                label={tr("checkStatus")}
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void api
                    .status(pending.key)
                    .then((r) =>
                      r.found ? finish(r.result!.id) : setError("notFound"),
                    )
                    .catch((e) => setError(e.code))
                    .finally(() => setBusy(false));
                }}
              />
            </Panel>
          )}
          {error && (
            <Txt
              accessibilityRole="alert"
              style={{ color: "#b95050", marginBottom: 14 }}
            >
              {tr(error)}
            </Txt>
          )}
          <Button
            label={tr(
              busy ? "saving" : review || pending ? "confirm" : "review",
            )}
            primary
            disabled={busy || blocked}
            onPress={() => {
              if (review || pending) void submit();
              else
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
            }}
          />
          <Button
            label={tr("cancel")}
            onPress={() =>
              review && !pending ? setReview(false) : navigation.goBack()
            }
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={!!partyField}
        animationType="slide"
        onRequestClose={() => setPartyField(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20 }}
            >
              <Button label={tr("close")} onPress={() => setPartyField(null)} />
              {partyField && (
                <NativePartyManager
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
                      v[partyField.key] === id
                        ? { ...v, [partyField.key]: "" }
                        : v,
                    )
                  }
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
