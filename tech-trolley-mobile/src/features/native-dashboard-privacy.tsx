import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { verifyPasswordSchema } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { useShop } from "../contexts/shop-context";
import { Button, Input, Txt, useColors } from "../components/ui";
import { api } from "../services/api";

export function useNativeDashboardPrivacy(key: string, navigation: any) {
  const { lang } = useShop(),
    c = useColors();
  const [grant, setGrant] = useState<{ key: string; until: number } | null>(
    null,
  );
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const hide = () => {
    generation.current++;
    setGrant(null);
    setOpen(false);
    setPassword("");
    setBusy(false);
    setError("");
  };
  useEffect(() => {
    hide();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") hide();
    });
    const remove = navigation.addListener("blur", hide);
    return () => {
      generation.current++;
      sub.remove();
      remove();
    };
  }, [key, navigation]);
  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(hide, Math.max(0, grant.until - Date.now()));
    return () => clearTimeout(timer);
  }, [grant]);
  const visible = !!grant && grant.key === key && grant.until > Date.now();
  const toggle = () => {
    if (visible) hide();
    else {
      setError("");
      setPassword("");
      setOpen(true);
    }
  };
  const control = (
    <Button
      label={t(visible ? "hideBalance" : "tapBalance", lang)}
      onPress={toggle}
    />
  );
  const dialog = (
    <Modal visible={open} animationType="slide" onRequestClose={hide}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView
          contentContainerStyle={{ padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Txt style={{ fontSize: 23, lineHeight: 34, marginBottom: 16 }}>
            {t("revealDashboard", lang)}
          </Txt>
          <Txt>{t("revealPasswordHelp", lang)}</Txt>
          <View style={{ marginTop: 24 }}>
            <Input
              secure
              label={t("currentPassword", lang)}
              value={password}
              onChange={setPassword}
              maxLength={72}
            />
          </View>
          {!!error && (
            <Txt accessibilityRole="alert" style={{ color: "#c40033" }}>
              {t(error, lang)}
            </Txt>
          )}
          <Button
            primary
            disabled={busy || !password}
            label={t(busy ? "saving" : "revealSubmit", lang)}
            onPress={() => {
              void (async () => {
                const attempt = generation.current,
                  secret = password;
                setPassword("");
                setBusy(true);
                setError("");
                try {
                  const body = verifyPasswordSchema.parse({ password: secret });
                  const response = await api.request<{ ok: boolean }>(
                    "/auth/verify-password",
                    "POST",
                    body,
                  );
                  if (
                    response.ok &&
                    attempt === generation.current &&
                    AppState.currentState === "active"
                  ) {
                    setGrant({ key, until: Date.now() + 60000 });
                    setOpen(false);
                  }
                } catch (e: any) {
                  if (attempt === generation.current)
                    setError(e.code || "VALIDATION_ERROR");
                } finally {
                  if (attempt === generation.current) setBusy(false);
                }
              })();
            }}
          />
          <Button label={t("cancel", lang)} onPress={hide} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
  return { visible, toggle, control, dialog };
}
