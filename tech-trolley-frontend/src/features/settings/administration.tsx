"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Pencil,
  KeyRound,
  Plus,
  Store,
  ShieldCheck,
  UserRoundPen,
  UserRoundX,
} from "lucide-react";
import { t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { api } from "@/services/api";
import { PartyManager } from "./party-manager";
import { FormField, FormGrid } from "@/components/forms/form-field";
import { useBackLayer } from "@/components/navigation/navigation-provider";
import {
  profileSchema,
  profileIdentityChanged,
  type User,
} from "@tech-trolley/contracts";
type Editor = {
  title: string;
  path: string;
  method: string;
  fields: {
    key: string;
    label?: string;
    options?: string[];
    type?: string;
    required?: boolean;
  }[];
  initial?: Record<string, string>;
  fixed?: Record<string, unknown>;
  profile?: boolean;
};
export function Administration({
  mode,
  onCategoryCreated,
}: {
  mode: "parties" | "settings" | "categories";
  onCategoryCreated?: (id: string) => void;
}) {
  const { state, user, lang, refresh } = useShop(),
    [users, setUsers] = useState<any[]>([]),
    [editor, setEditor] = useState<Editor | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [managedAccount, setManagedAccount] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const manageTrigger = useRef<HTMLButtonElement | null>(null);
  useBackLayer(
    !!managedAccount,
    () => {
      setManagedAccount(null);
      manageTrigger.current?.focus({ preventScroll: true });
    },
    false,
  );
  useBackLayer(!!editor, () => setEditor(null));
  useEffect(() => {
    if (!managedAccount) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-account-actions]"))
        setManagedAccount(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [managedAccount]);
  const tr = (k: string) => t(k, lang);
  const loadUsers = async () => {
    if (user?.role === "OWNER" && mode === "settings")
      setUsers(await api.request<any[]>("/users"));
  };
  useEffect(() => {
    void loadUsers().catch((e: any) => setError(e.code));
  }, [user, mode]);
  if (!state) return null;
  const open = (v: Editor) => {
    if (managedAccount) manageTrigger.current?.focus({ preventScroll: true });
    setManagedAccount(null);
    setEditor(v);
    setValues(v.initial || {});
    setError("");
  };
  const editProfile = (account: User, own: boolean) =>
    open({
      title: "editProfile",
      path: own ? "/auth/profile" : "/users/" + account.id,
      method: "PATCH",
      profile: true,
      initial: {
        name: account.name,
        login: account.login,
        email: account.email || "",
      },
      fields: [
        { key: "name", required: true },
        { key: "login", label: "loginId", required: true },
        { key: "email" },
        { key: "currentPassword", type: "password" },
      ],
    });
  const mutate = async (path: string, body: any) => {
    setManagedAccount(null);
    try {
      await api.request(path, "PATCH", body);
      await refresh();
      await loadUsers();
    } catch (e: any) {
      setError(e.code);
    }
  };
  return (
    <>
      {error && !editor && (
        <p className="error" role="alert">
          {tr(error)}
        </p>
      )}
      {mode === "parties" && (
        <section className="panel">
          <h2>{tr("parties")}</h2>
          <PartyManager />
        </section>
      )}
      {mode === "settings" && (
        <div className="settings-overview">
          <div className="settings-card-grid">
            <section
              className="panel settings-card"
              aria-labelledby="profile-heading"
            >
              <div className="settings-card-heading">
                <h2 id="profile-heading">{tr("myProfile")}</h2>
                <p>{tr("profileSummary")}</p>
              </div>
              <div className="settings-profile-identity">
                <span className="avatar" aria-hidden="true">
                  {user?.name.slice(0, 1)}
                </span>
                <strong>{user?.name}</strong>
                <span className="badge">{tr(user!.role)}</span>
              </div>
              <dl className="settings-details">
                <div>
                  <dt>{tr("loginId")}</dt>
                  <dd>{user?.login}</dd>
                </div>
                {user?.email && (
                  <div>
                    <dt>{tr("emailLabel")}</dt>
                    <dd>{user.email}</dd>
                  </div>
                )}
              </dl>
              <div className="settings-card-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => editProfile(user!, true)}
                >
                  <Pencil size={17} aria-hidden="true" />
                  {tr("editProfile")}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    open({
                      title: "changePassword",
                      path: "/auth/password",
                      method: "POST",
                      fields: [
                        {
                          key: "currentPassword",
                          type: "password",
                          required: true,
                        },
                        {
                          key: "password",
                          label: "newPassword",
                          type: "password",
                          required: true,
                        },
                      ],
                    })
                  }
                >
                  <KeyRound size={17} aria-hidden="true" />
                  {tr("changePassword")}
                </button>
              </div>
            </section>
            <section
              className="panel settings-card"
              aria-labelledby="shop-heading"
            >
              <div className="settings-card-heading">
                <h2 id="shop-heading">{tr("shopDetails")}</h2>
              </div>
              <div className="settings-shop-identity">
                <Store size={27} aria-hidden="true" />
                <strong>{state.shop.name}</strong>
              </div>
              <p className="settings-shop-summary">
                {tr("shopDetailsSummary")}
              </p>
              {state.shop.address || state.shop.phone ? (
                <dl className="settings-details settings-shop-details">
                  {state.shop.address && (
                    <div>
                      <dt>{tr("addressLabel")}</dt>
                      <dd>{state.shop.address}</dd>
                    </div>
                  )}
                  {state.shop.phone && (
                    <div>
                      <dt>{tr("phoneLabel")}</dt>
                      <dd>{state.shop.phone}</dd>
                    </div>
                  )}
                </dl>
              ) : null}
              {user?.role === "OWNER" && (
                <div className="settings-card-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      open({
                        title: "editShopDetails",
                        path: "/shop",
                        method: "PATCH",
                        initial: {
                          name: state.shop.name,
                          address: state.shop.address,
                          phone: state.shop.phone,
                        },
                        fields: [
                          { key: "name", label: "shopName", required: true },
                          { key: "address" },
                          { key: "phone", label: "shopPhone" },
                        ],
                      })
                    }
                  >
                    <Pencil size={17} aria-hidden="true" />
                    {tr("editShopDetails")}
                  </button>
                </div>
              )}
            </section>
          </div>
          {user?.role === "OWNER" && (
            <section
              className="panel settings-team"
              aria-labelledby="users-heading"
            >
              <div className="settings-team-heading">
                <div className="settings-card-heading">
                  <h2 id="users-heading">{tr("users")}</h2>
                  <p>{tr("usersSummary")}</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() =>
                    open({
                      title: "createUser",
                      path: "/users",
                      method: "POST",
                      fields: [
                        { key: "name", required: true },
                        { key: "login", label: "loginId", required: true },
                        { key: "email" },
                        {
                          key: "role",
                          options: ["OWNER", "STAFF"],
                          required: true,
                        },
                        { key: "password", type: "password", required: true },
                      ],
                    })
                  }
                >
                  <Plus size={18} aria-hidden="true" />
                  {tr("createUser")}
                </button>
              </div>
              <div className="settings-account-head" aria-hidden="true">
                <span>{tr("accountLabel")}</span>
                <span>{tr("role")}</span>
                <span>{tr("status")}</span>
                <span>{tr("actions")}</span>
              </div>
              <ul className="settings-account-list">
                {users.map((u) => (
                  <li className="settings-account" key={u.id}>
                    <div className="settings-account-identity">
                      <span className="avatar" aria-hidden="true">
                        {u.name.slice(0, 1)}
                      </span>
                      <div>
                        <strong>{u.name}</strong>
                        <span>
                          {tr("loginId")}: {u.login}
                        </span>
                        {u.email && <span>{u.email}</span>}
                      </div>
                    </div>
                    <div className="settings-account-state">
                      <span className="badge">{tr(u.role)}</span>
                      <span
                        className={
                          "settings-account-status" +
                          (u.active ? " is-active" : "")
                        }
                      >
                        <i aria-hidden="true" />
                        {tr(u.active ? "active" : "inactive")}
                      </span>
                    </div>
                    <div
                      className="settings-account-actions"
                      data-account-actions
                    >
                      <button
                        type="button"
                        className="button"
                        aria-expanded={managedAccount === u.id}
                        aria-controls={"account-actions-" + u.id}
                        aria-label={tr("manageAccount") + ": " + u.name}
                        onClick={(event) => {
                          manageTrigger.current = event.currentTarget;
                          setManagedAccount(
                            managedAccount === u.id ? null : u.id,
                          );
                        }}
                      >
                        {tr("manageAccount")}
                        <ChevronDown size={17} aria-hidden="true" />
                      </button>
                      {managedAccount === u.id && (
                        <div
                          className="settings-account-popover"
                          id={"account-actions-" + u.id}
                          role="group"
                          aria-label={tr("actions") + ": " + u.name}
                        >
                          <button
                            type="button"
                            onClick={() => editProfile(u, u.id === user.id)}
                          >
                            <Pencil size={17} aria-hidden="true" />
                            {tr("editProfile")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              open({
                                title: "role",
                                path: "/users/" + u.id,
                                method: "PATCH",
                                fields: [
                                  {
                                    key: "role",
                                    options: ["OWNER", "STAFF"],
                                    required: true,
                                  },
                                ],
                                initial: { role: u.role },
                              })
                            }
                          >
                            <ShieldCheck size={17} aria-hidden="true" />
                            {tr("changeRole")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              open({
                                title: "resetPassword",
                                path: "/users/" + u.id,
                                method: "PATCH",
                                fields: [
                                  {
                                    key: "password",
                                    type: "password",
                                    required: true,
                                  },
                                ],
                              })
                            }
                          >
                            <KeyRound size={17} aria-hidden="true" />
                            {tr("resetPassword")}
                          </button>
                          <button
                            type="button"
                            className={u.active ? "settings-deactivate" : ""}
                            onClick={() =>
                              void mutate("/users/" + u.id, {
                                active: !u.active,
                              })
                            }
                          >
                            {u.active ? (
                              <UserRoundX size={17} aria-hidden="true" />
                            ) : (
                              <UserRoundPen size={17} aria-hidden="true" />
                            )}
                            {tr(u.active ? "deactivate" : "activate")}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="settings-team-help">{tr("usersOwnerHelp")}</p>
            </section>
          )}
        </div>
      )}
      {mode === "categories" && (
        <section className="panel expense-category-list">
          <div className="panel-heading">
            <h2>{tr("categories")}</h2>
            <button
              className="button"
              onClick={() =>
                open({
                  title: "addCategory",
                  path: "/expense-categories",
                  method: "POST",
                  fields: [
                    { key: "bn", required: true },
                    { key: "en", required: true },
                  ],
                  fixed: { active: true },
                })
              }
            >
              {tr("addCategory")}
            </button>
          </div>
          {state.categories.map((c) => (
            <div className="list-row expense-category-row" key={c.id}>
              <div className="expense-category-names">
                <b className={!c.active ? "muted" : ""}>{c[lang]}</b>
                <span className="muted">{c[lang === "bn" ? "en" : "bn"]}</span>
              </div>
              <div className="row-actions">
                <button
                  className="text-button"
                  onClick={() =>
                    open({
                      title: "rename",
                      path: "/expense-categories/" + c.id,
                      method: "PATCH",
                      fields: [
                        { key: "bn", required: true },
                        { key: "en", required: true },
                      ],
                      initial: { bn: c.bn, en: c.en },
                      fixed: { active: c.active },
                    })
                  }
                >
                  {tr("rename")}
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void mutate("/expense-categories/" + c.id, {
                      bn: c.bn,
                      en: c.en,
                      active: !c.active,
                    })
                  }
                >
                  {tr(c.active ? "archive" : "restore")}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {editor && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <header>
              <h2 id="editor-title">{tr(editor.title)}</h2>
              <button
                className="icon-button"
                onClick={() => setEditor(null)}
                aria-label={tr("close")}
              >
                ×
              </button>
            </header>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const data = {
                    ...values,
                    ...editor.fixed,
                  };
                  if (editor.profile) {
                    profileSchema.parse(data);
                    if (
                      profileIdentityChanged(editor.initial || {}, values) &&
                      !values.currentPassword
                    ) {
                      setError("CURRENT_PASSWORD_REQUIRED");
                      return;
                    }
                  }
                  const result = await api.request<{
                    requiresLogin?: boolean;
                    id?: string;
                  }>(editor.path, editor.method, data);
                  setEditor(null);
                  setValues({});
                  if (
                    editor.path === "/auth/password" ||
                    result.requiresLogin
                  ) {
                    location.assign("/");
                    return;
                  }
                  await refresh();
                  if (editor.path === "/expense-categories" && result.id)
                    onCategoryCreated?.(result.id);
                  await loadUsers();
                } catch (e: any) {
                  setError(
                    e.code || (e.issues ? "VALIDATION_ERROR" : "NETWORK_ERROR"),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FormGrid>
                {editor.profile && (
                  <p className="notice wide">
                    {tr(
                      editor.path === "/auth/profile"
                        ? "profileHelp"
                        : "accountProfileHelp",
                    )}{" "}
                    {tr("userIdHelp")}
                  </p>
                )}
                {editor.fields.map((f) => {
                  const required =
                    f.key === "currentPassword" && editor.profile
                      ? profileIdentityChanged(editor.initial || {}, values)
                      : !!f.required;
                  return (
                    <FormField
                      key={f.key}
                      label={tr(f.label || f.key)}
                      optional={!required}
                      optionalText={tr("optional")}
                      wide={f.key === "address"}
                      hint={
                        f.key === "password" ? tr("PASSWORD_FORMAT") : undefined
                      }
                    >
                      {f.options ? (
                        <select
                          value={values[f.key] || ""}
                          required={required}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [f.key]: e.target.value,
                            }))
                          }
                        >
                          <option value="">{tr("select")}</option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {tr(o)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            f.type || (f.key === "email" ? "email" : "text")
                          }
                          value={values[f.key] || ""}
                          required={required}
                          minLength={
                            f.type === "password"
                              ? f.key === "currentPassword"
                                ? 1
                                : 4
                              : undefined
                          }
                          maxLength={
                            f.type === "password"
                              ? f.key === "currentPassword"
                                ? 72
                                : 4
                              : f.key === "address"
                                ? 300
                                : f.key === "phone"
                                  ? 30
                                  : f.key === "login"
                                    ? 60
                                    : f.key === "email"
                                      ? 254
                                      : 180
                          }
                          autoComplete={
                            f.type === "password"
                              ? f.key === "currentPassword"
                                ? "current-password"
                                : "new-password"
                              : "off"
                          }
                          inputMode={
                            f.type === "password" ? "numeric" : undefined
                          }
                          pattern={
                            f.key === "password" ? "[0-9]{4}" : undefined
                          }
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [f.key]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </FormField>
                  );
                })}
              </FormGrid>
              {error && (
                <p className="error" role="alert">
                  {tr(error)}
                </p>
              )}
              <footer>
                <button
                  type="button"
                  className="button"
                  onClick={() => setEditor(null)}
                >
                  {tr("cancel")}
                </button>
                <button className="button primary" disabled={busy}>
                  {tr(busy ? "saving" : "save")}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
