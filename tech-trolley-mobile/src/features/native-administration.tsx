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
import { t } from "@tech-trolley/i18n";
import { useShop } from "../contexts/shop-context";
import { Button, Input, Txt, Panel, useColors } from "../components/ui";
import { api, tokenKey } from "../services/api";
import * as SecureStore from "expo-secure-store";
import { NativeHistoricalSetup } from "./native-historical-setup";
import { NativePartyManager } from "./native-party-manager";
import {
  profileSchema,
  profileIdentityChanged,
  newPassword,
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
    secure?: boolean;
  }[];
  initial?: Record<string, string>;
  fixed?: Record<string, unknown>;
  profile?: boolean;
};
export function NativeAdministration({ route, navigation }: any) {
  const { mode } = route.params,
    { state, user, lang, refresh } = useShop(),
    c = useColors(),
    [users, setUsers] = useState<any[]>([]),
    [editor, setEditor] = useState<Editor | null>(null),
    [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    tr = (k: string) => t(k, lang);
  const reload = async () => {
    if (user?.role === "OWNER" && mode === "users")
      setUsers(await api.request<any[]>("/users"));
  };
  const open = (e: Editor) => {
    setEditor(e);
    setValues(e.initial || {});
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
        { key: "name" },
        { key: "login", label: "loginId" },
        { key: "email" },
        { key: "currentPassword", secure: true },
      ],
    });
  useEffect(() => {
    void reload().catch((e: any) => setError(e.code));
    if (mode === "password")
      open({
        title: "changePassword",
        path: "/auth/password",
        method: "POST",
        fields: [
          { key: "currentPassword", secure: true },
          { key: "password", label: "newPassword", secure: true },
        ],
      });
  }, [mode]);
  if (!state) return null;
  const mutate = async (path: string, data: any) => {
    try {
      await api.request(path, "PATCH", data);
      await refresh();
      await reload();
    } catch (e: any) {
      setError(e.code);
    }
  };
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {error && !editor && (
          <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
            {tr(error)}
          </Txt>
        )}
        {mode === "settings" && (
          <NativeHistoricalSetup navigation={navigation} />
        )}
        {mode === "settings" && (
          <Panel>
            <Txt style={{ fontSize: 20, fontWeight: "600" }}>
              {tr("myProfile")}
            </Txt>
            <Txt>{user?.name}</Txt>
            <Txt>
              {user?.login} · {user?.email}
            </Txt>
            <Txt>{tr("profileHelp")}</Txt>
            <Button
              label={tr("editProfile")}
              onPress={() => editProfile(user!, true)}
            />
            <Button
              label={tr("changePassword")}
              onPress={() =>
                open({
                  title: "changePassword",
                  path: "/auth/password",
                  method: "POST",
                  fields: [
                    { key: "currentPassword", secure: true },
                    { key: "password", label: "newPassword", secure: true },
                  ],
                })
              }
            />
          </Panel>
        )}
        {mode === "settings" && (
          <Panel>
            <Txt style={{ fontSize: 20, fontWeight: "600" }}>
              {state.shop.name}
            </Txt>
            <Txt>{state.shop.address}</Txt>
            <Txt>{state.shop.phone}</Txt>
            {user?.role === "OWNER" && (
              <Button
                label={tr("settings")}
                onPress={() =>
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
                      { key: "name", label: "shopName" },
                      { key: "address" },
                      { key: "phone", label: "shopPhone" },
                    ],
                  })
                }
              />
            )}
          </Panel>
        )}
        {mode === "parties" && <NativePartyManager />}
        {mode === "categories" && (
          <>
            <Button
              label={tr("addCategory")}
              primary
              onPress={() =>
                open({
                  title: "addCategory",
                  path: "/expense-categories",
                  method: "POST",
                  fields: [{ key: "bn" }, { key: "en" }],
                  fixed: { active: true },
                })
              }
            />
            {state.categories.map((cat) => (
              <Panel key={cat.id}>
                <Txt>{cat[lang]}</Txt>
                <Txt style={{ color: c.muted, fontSize: 12 }}>
                  {cat[lang === "bn" ? "en" : "bn"]}
                </Txt>
                <Button
                  label={tr("rename")}
                  onPress={() =>
                    open({
                      title: "rename",
                      path: "/expense-categories/" + cat.id,
                      method: "PATCH",
                      fields: [{ key: "bn" }, { key: "en" }],
                      initial: { bn: cat.bn, en: cat.en },
                      fixed: { active: cat.active },
                    })
                  }
                />
                <Button
                  label={tr(cat.active ? "archive" : "restore")}
                  onPress={() =>
                    void mutate("/expense-categories/" + cat.id, {
                      bn: cat.bn,
                      en: cat.en,
                      active: !cat.active,
                    })
                  }
                />
              </Panel>
            ))}
          </>
        )}
        {mode === "users" && user?.role === "OWNER" && (
          <>
            <Button
              label={tr("createUser")}
              primary
              onPress={() =>
                open({
                  title: "createUser",
                  path: "/users",
                  method: "POST",
                  fields: [
                    { key: "name" },
                    { key: "login", label: "loginId" },
                    { key: "email" },
                    { key: "role", options: ["OWNER", "STAFF"] },
                    { key: "password", secure: true },
                  ],
                })
              }
            />
            {users.map((u) => (
              <Panel key={u.id}>
                <Txt style={{ fontWeight: "600" }}>{u.name}</Txt>
                <Txt style={{ fontSize: 12 }}>
                  {u.login} · {u.email} · {tr(u.role)}
                </Txt>
                <Button
                  label={tr("editProfile")}
                  onPress={() => editProfile(u, u.id === user.id)}
                />
                <Button
                  label={tr("role")}
                  onPress={() =>
                    open({
                      title: "role",
                      path: "/users/" + u.id,
                      method: "PATCH",
                      fields: [{ key: "role", options: ["OWNER", "STAFF"] }],
                      initial: { role: u.role },
                    })
                  }
                />
                <Button
                  label={tr(u.active ? "deactivate" : "activate")}
                  onPress={() =>
                    void mutate("/users/" + u.id, { active: !u.active })
                  }
                />
                <Button
                  label={tr("resetPassword")}
                  onPress={() =>
                    open({
                      title: "resetPassword",
                      path: "/users/" + u.id,
                      method: "PATCH",
                      fields: [{ key: "password", secure: true }],
                    })
                  }
                />
              </Panel>
            ))}
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!editor}
        animationType="slide"
        onRequestClose={() => {
          setEditor(null);
          if (mode === "password") navigation.goBack();
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {editor && (
                <>
                  <Txt
                    style={{
                      fontSize: 22,
                      fontWeight: "600",
                      lineHeight: 35,
                      marginBottom: 20,
                    }}
                  >
                    {tr(editor.title)}
                  </Txt>
                  {editor.profile && (
                    <Txt>
                      {tr(
                        editor.path === "/auth/profile"
                          ? "profileHelp"
                          : "accountProfileHelp",
                      )}{" "}
                      {tr("userIdHelp")}
                    </Txt>
                  )}
                  {editor.fields.map((f) =>
                    f.options ? (
                      <View key={f.key} style={{ marginBottom: 15 }}>
                        <Txt>{tr(f.label || f.key)}</Txt>
                        <Picker
                          accessibilityLabel={tr(f.label || f.key)}
                          selectedValue={values[f.key] || ""}
                          style={{ color: c.text }}
                          onValueChange={(value) =>
                            setValues((v) => ({ ...v, [f.key]: String(value) }))
                          }
                        >
                          <Picker.Item label={tr("select")} value="" />
                          {f.options.map((o) => (
                            <Picker.Item label={tr(o)} value={o} key={o} />
                          ))}
                        </Picker>
                      </View>
                    ) : (
                      <Input
                        key={f.key}
                        label={
                          tr(f.label || f.key) +
                          (f.key === "password"
                            ? " · " + tr("PASSWORD_FORMAT")
                            : "")
                        }
                        value={values[f.key] || ""}
                        onChange={(value) =>
                          setValues((v) => ({ ...v, [f.key]: value }))
                        }
                        secure={f.secure}
                        numeric={f.key === "password"}
                        maxLength={
                          f.secure
                            ? f.key === "password"
                              ? 4
                              : 72
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
                      />
                    ),
                  )}
                  {error && (
                    <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
                      {tr(error)}
                    </Txt>
                  )}
                  <Button
                    label={tr(busy ? "saving" : "save")}
                    primary
                    disabled={busy}
                    onPress={() => {
                      setBusy(true);
                      setError("");
                      void (async () => {
                        try {
                          const data = {
                            ...Object.fromEntries(
                              editor.fields.map((f) => [
                                f.key,
                                values[f.key] || "",
                              ]),
                            ),
                            ...editor.fixed,
                          };
                          if (
                            editor.fields.some((f) => f.key === "password") &&
                            !newPassword.safeParse(values.password).success
                          ) {
                            setError("PASSWORD_FORMAT");
                            return;
                          }
                          if (editor.profile) {
                            profileSchema.parse(data);
                            if (
                              profileIdentityChanged(
                                editor.initial || {},
                                values,
                              ) &&
                              !values.currentPassword
                            ) {
                              setError("CURRENT_PASSWORD_REQUIRED");
                              return;
                            }
                          }
                          const result = await api.request<{
                            requiresLogin?: boolean;
                          }>(editor.path, editor.method, data);
                          const isPassword = editor.path === "/auth/password";
                          setEditor(null);
                          setValues({});
                          if (isPassword || result.requiresLogin)
                            await SecureStore.deleteItemAsync(tokenKey);
                          await refresh();
                          if (isPassword || result.requiresLogin) return;
                          await reload();
                        } catch (e: any) {
                          setError(
                            e.code ||
                              (e.issues ? "VALIDATION_ERROR" : "NETWORK_ERROR"),
                          );
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  />
                  <Button
                    label={tr("cancel")}
                    onPress={() => {
                      setEditor(null);
                      setValues({});
                      if (mode === "password") navigation.goBack();
                    }}
                  />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
