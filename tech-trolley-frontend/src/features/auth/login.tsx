"use client";
import { useState } from "react";
import { t } from "@tech-trolley/i18n";
import { api } from "@/services/api";
import { useShop } from "@/contexts/shop-context";
import { FormField, FormGrid } from "@/components/forms/form-field";
export function Login() {
  const {
      user,
      lang,
      setLang,
      refresh,
      setUser,
      error: networkError,
    } = useShop(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-screen">
      <div className="login-brand">
        <img
          src="/tech-trolley-logo.png"
          alt="Tech Trolley"
          width="100"
          height="100"
        />
        <span className="eyebrow">TECH TROLLEY</span>
        <h1>{t("welcome", lang)}</h1>
        <p>{t("subtitle", lang)}</p>
        <small>Technology · Trust · Tomorrow</small>
      </div>
      <div className="login-panel">
        <div className="language-row">
          <button onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
        </div>
        <span className="eyebrow">SHOP MANAGER</span>
        <h2>{t(user?.must_change ? "changePassword" : "login", lang)}</h2>
        <p className="muted">
          {user?.must_change ? t("mustChange", lang) : t("subtitle", lang)}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api.ready({ isOnline: () => navigator.onLine });
              if (user?.must_change) {
                await api.request("/auth/password", "POST", {
                  currentPassword: f.get("currentPassword"),
                  password: f.get("password"),
                });
                setUser(null);
              } else
                await api.login(
                  String(f.get("identity")),
                  String(f.get("password")),
                );
              await refresh();
            } catch (e: any) {
              setError(e.code || "NETWORK_ERROR");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormGrid single>
            {user?.must_change ? (
              <FormField label={t("currentPassword", lang)}>
                <input
                  name="currentPassword"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  required
                  maxLength={72}
                />
              </FormField>
            ) : (
              <FormField label={t("identity", lang)}>
                <input
                  name="identity"
                  autoComplete="username"
                  required
                  maxLength={180}
                />
              </FormField>
            )}
            <FormField
              label={t(user?.must_change ? "newPassword" : "password", lang)}
              hint={user?.must_change ? t("PASSWORD_FORMAT", lang) : undefined}
            >
              <input
                name="password"
                type="password"
                autoComplete={
                  user?.must_change ? "new-password" : "current-password"
                }
                minLength={user?.must_change ? 4 : 1}
                maxLength={user?.must_change ? 4 : 72}
                inputMode="numeric"
                pattern={user?.must_change ? "[0-9]{4}" : undefined}
                required
              />
            </FormField>
          </FormGrid>
          {(error || networkError) && (
            <p role="alert" className="error">
              {t(error || networkError, lang)}
            </p>
          )}
          {busy && (
            <p className="notice connection-notice" role="status">
              <span className="spinner" />
              {t("startupWaitHelp", lang)}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {t(
              busy ? "saving" : user?.must_change ? "changePassword" : "login",
              lang,
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
