"use client";
import { useState } from "react";
import { partySchema, type Party } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { api } from "@/services/api";
import { FormField, FormGrid } from "@/components/forms/form-field";

export function PartyManager({
  kind,
  onSelect,
  onArchive,
}: {
  kind?: string;
  onSelect?: (party: Party) => void;
  onArchive?: (id: string) => void;
}) {
  const { state, lang, refresh } = useShop();
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
    [archived, setArchived] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const tr = (key: string) => t(key, lang);
  if (!state) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parsed = partySchema.parse(values);
      const { kind: ignored, ...details } = parsed;
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
      setConfirm(null);
      if (editing?.id === p.id) {
        setEditing(null);
        setValues(blank());
      }
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
    <section className="party-manager">
      <p className="muted">{tr("partyListHelp")}</p>
      <form onSubmit={save}>
        <h3>
          {tr(editing ? "editParty" : "createParty")}
          {kind ? " · " + tr(kind) : ""}
        </h3>
        <FormGrid as="fieldset" disabled={busy} className="party-fields">
          <FormField label={tr("name")}>
            <input
              name="party-name"
              value={values.name}
              required
              maxLength={180}
              onChange={(e) =>
                setValues((v) => ({ ...v, name: e.target.value }))
              }
            />
          </FormField>
          {!kind && (
            <FormField label={tr("kind")}>
              <select
                value={values.kind}
                disabled={!!editing}
                onChange={(e) =>
                  setValues((v) => ({ ...v, kind: e.target.value }))
                }
              >
                {["supplier", "customer", "person"].map((k) => (
                  <option key={k} value={k}>
                    {tr(k)}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label={tr("phone")} optional optionalText={tr("optional")}>
            <input
              name="party-phone"
              value={values.phone}
              inputMode="tel"
              maxLength={30}
              onChange={(e) =>
                setValues((v) => ({ ...v, phone: e.target.value }))
              }
            />
          </FormField>
          <FormField
            label={tr("partyAddress")}
            wide
            optional
            optionalText={tr("optional")}
          >
            <input
              name="party-address"
              value={values.address}
              maxLength={300}
              onChange={(e) =>
                setValues((v) => ({ ...v, address: e.target.value }))
              }
            />
          </FormField>
        </FormGrid>
        <div className="row-actions">
          <button className="button primary" disabled={busy}>
            {tr(busy ? "saving" : "save")}
          </button>
          {editing && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setValues(blank());
              }}
            >
              {tr("cancel")}
            </button>
          )}
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {tr(error)}
        </p>
      )}
      <FormField label={tr("searchParties")}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </FormField>
      <label className="party-checkbox">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        {tr("showArchived")}
      </label>
      {!parties.length && <p className="notice">{tr("noParties")}</p>}
      {parties.map((p) => (
        <div className="list-row" key={p.id}>
          <div>
            <b>{p.name}</b> <span className="badge">{tr(p.kind)}</span>
            {p.active === false && (
              <span className="muted"> · {tr("archived")}</span>
            )}
            <p>
              {p.phone}
              {p.address ? " · " + p.address : ""}
            </p>
          </div>
          <div className="row-actions">
            {onSelect && p.active !== false && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => onSelect(p)}
              >
                {tr("useParty")}
              </button>
            )}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditing(p);
                setValues({
                  name: p.name,
                  phone: p.phone,
                  address: p.address,
                  kind: p.kind,
                });
                setError("");
              }}
            >
              {tr("editParty")}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() =>
                p.active === false ? void toggle(p) : setConfirm(p.id)
              }
            >
              {tr(p.active === false ? "restore" : "removeFromList")}
            </button>
          </div>
          {confirm === p.id && (
            <div className="notice">
              <p>{tr("archivePartyConfirm")}</p>
              <div className="row-actions">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void toggle(p)}
                >
                  {tr("confirm")}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  {tr("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
