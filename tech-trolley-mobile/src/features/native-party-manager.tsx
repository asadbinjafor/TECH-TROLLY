import React, { useState } from "react";
import { View, Switch } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { partySchema, type Party } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { useShop } from "../contexts/shop-context";
import { Button, Input, Txt, Panel, useColors } from "../components/ui";
import { api } from "../services/api";

export function NativePartyManager({
  kind,
  onSelect,
  onArchive,
}: {
  kind?: string;
  onSelect?: (party: Party) => void;
  onArchive?: (id: string) => void;
}) {
  const { state, lang, refresh } = useShop(),
    c = useColors();
  const blank = () => ({
    name: "",
    phone: "",
    address: "",
    kind: kind || "supplier",
  });
  const [values, setValues] = useState(blank),
    [editing, setEditing] = useState<Party | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [confirm, setConfirm] = useState<string | null>(null);
  const tr = (key: string) => t(key, lang);
  if (!state) return null;
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const parsed = partySchema.parse(values),
        { kind: ignored, ...details } = parsed;
      const result = await api.request<Party>(
        editing ? "/parties/" + editing.id : "/parties",
        editing ? "PATCH" : "POST",
        editing ? details : parsed,
      );
      setEditing(null);
      setValues(blank());
      await refresh();
      if (result.active !== false) onSelect?.(result);
    } catch (e: any) {
      setError(e.code || (e.issues ? "VALIDATION_ERROR" : "NETWORK_ERROR"));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (p: Party) => {
    setBusy(true);
    setError("");
    try {
      await api.request(
        "/parties/" + p.id + (p.active === false ? "/active" : ""),
        p.active === false ? "PATCH" : "DELETE",
        p.active === false ? { active: true } : undefined,
      );
      if (p.active !== false) onArchive?.(p.id);
      if (editing?.id === p.id) {
        setEditing(null);
        setValues(blank());
      }
      setConfirm(null);
      await refresh();
    } catch (e: any) {
      setError(e.code || "NETWORK_ERROR");
    } finally {
      setBusy(false);
    }
  };
  const parties = state.parties.filter(
    (p) =>
      (!kind || p.kind === kind) &&
      (archived || p.active !== false) &&
      `${p.name} ${p.phone} ${p.address}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <View>
      <Txt>{tr("partyListHelp")}</Txt>
      <Panel>
        <Txt style={{ fontWeight: "600" }}>
          {tr(editing ? "editParty" : "createParty")}
          {kind ? " · " + tr(kind) : ""}
        </Txt>
        {!kind && (
          <Picker
            accessibilityLabel={tr("kind")}
            enabled={!editing && !busy}
            style={{ color: c.text }}
            selectedValue={values.kind}
            onValueChange={(v) => setValues((p) => ({ ...p, kind: String(v) }))}
          >
            {["supplier", "customer", "person"].map((k) => (
              <Picker.Item key={k} value={k} label={tr(k)} />
            ))}
          </Picker>
        )}
        {(["name", "phone", "address"] as const).map((k) => (
          <Input
            key={k}
            label={tr(k === "address" ? "partyAddress" : k)}
            optional={k !== "name"}
            value={values[k]}
            maxLength={k === "name" ? 180 : k === "phone" ? 30 : 300}
            onChange={(v) => !busy && setValues((p) => ({ ...p, [k]: v }))}
          />
        ))}
        <Button
          label={tr(busy ? "saving" : "save")}
          primary
          disabled={busy}
          onPress={() => void save()}
        />
        {editing && (
          <Button
            label={tr("cancel")}
            disabled={busy}
            onPress={() => {
              setEditing(null);
              setValues(blank());
            }}
          />
        )}
      </Panel>
      {error && (
        <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
          {tr(error)}
        </Txt>
      )}
      <Input label={tr("searchParties")} value={search} onChange={setSearch} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          accessibilityLabel={tr("showArchived")}
          value={archived}
          onValueChange={setArchived}
        />
        <Txt>{tr("showArchived")}</Txt>
      </View>
      {!parties.length && <Txt>{tr("noParties")}</Txt>}
      {parties.map((p) => (
        <Panel key={p.id}>
          <Txt style={{ fontWeight: "600" }}>{p.name}</Txt>
          <Txt>
            {tr(p.kind)} · {p.phone}
          </Txt>
          <Txt>{p.address}</Txt>
          {p.active === false && <Txt>{tr("archived")}</Txt>}
          {onSelect && p.active !== false && (
            <Button
              label={tr("useParty")}
              disabled={busy}
              onPress={() => onSelect(p)}
            />
          )}
          <Button
            label={tr("editParty")}
            disabled={busy}
            onPress={() => {
              setEditing(p);
              setValues({
                name: p.name,
                phone: p.phone,
                address: p.address,
                kind: p.kind,
              });
              setError("");
            }}
          />
          <Button
            label={tr(p.active === false ? "restore" : "removeFromList")}
            disabled={busy}
            onPress={() =>
              p.active === false ? void toggle(p) : setConfirm(p.id)
            }
          />
          {confirm === p.id && (
            <>
              <Txt>{tr("archivePartyConfirm")}</Txt>
              <Button
                label={tr("confirm")}
                disabled={busy}
                onPress={() => void toggle(p)}
              />
              <Button
                label={tr("cancel")}
                disabled={busy}
                onPress={() => setConfirm(null)}
              />
            </>
          )}
        </Panel>
      ))}
    </View>
  );
}
