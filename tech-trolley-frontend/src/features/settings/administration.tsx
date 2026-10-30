"use client";
import { useEffect, useState } from "react";
import { t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { api } from "@/services/api";
import { PartyManager } from "./party-manager";
import { FormField, FormGrid } from "@/components/forms/form-field";
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
export function Administration({ mode }: { mode: "parties" | "settings" }) {
  const { state, user, lang, refresh } = useShop(),
    [users, setUsers] = useState<any[]>([]),
    [editor, setEditor] = useState<Editor | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>{tr("myProfile")}</h2>
              <button
                className="button"
                onClick={() => editProfile(user!, true)}
              >
                {tr("editProfile")}
              </button>
            </div>
            <b>{user?.name}</b>
            <p>
              {user?.login}
              {user?.email ? " · " + user.email : ""} · {tr(user!.role)}
            </p>
            <p className="muted">{tr("profileHelp")}</p>
            <button
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
              {tr("changePassword")}
            </button>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{state.shop.name}</h2>
              {user?.role === "OWNER" && (
                <button
                  className="button"
                  onClick={() =>
                    open({
                      title: "settings",
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
                  {tr("settings")}
                </button>
              )}
            </div>
            <p>{state.shop.address}</p>
            <p>{state.shop.phone}</p>
          </section>
          <section className="panel">
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
              <div className="list-row" key={c.id}>
                <b className={!c.active ? "muted" : ""}>{c[lang]}</b>
                <span className="muted">{c[lang === "bn" ? "en" : "bn"]}</span>
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
          {user?.role === "OWNER" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>{tr("users")}</h2>
                <button
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
                  {tr("createUser")}
                </button>
              </div>
              {users.map((u) => (
                <div className="list-row" key={u.id}>
                  <span className="avatar">{u.name.slice(0, 1)}</span>
                  <div>
                    <b>{u.name}</b>
                    <small>
                      {u.login} · {u.email}
                    </small>
                  </div>
                  <span className="badge">{tr(u.role)}</span>
                  <div className="row-actions">
                    <button
                      className="text-button"
                      onClick={() => editProfile(u, u.id === user.id)}
                    >
                      {tr("editProfile")}
                    </button>
                    <button
                      className="text-button"
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
                      {tr("role")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        void mutate("/users/" + u.id, { active: !u.active })
                      }
                    >
                      {tr(u.active ? "deactivate" : "activate")}
                    </button>
                    <button
                      className="text-button"
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
                      {tr("resetPassword")}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
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
                  const result = await api.request<{ requiresLogin?: boolean }>(
                    editor.path,
                    editor.method,
                    data,
                  );
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
                                : 8
                              : undefined
                          }
                          maxLength={
                            f.type === "password"
                              ? 72
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
