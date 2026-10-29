import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Image,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { t } from "@tech-trolley/i18n";
import { ShopProvider, useShop } from "./src/contexts/shop-context";
import { api, tokenKey } from "./src/services/api";
import * as SecureStore from "expo-secure-store";
import { Button, Input, Txt, useColors } from "./src/components/ui";
import { NativePage } from "./src/features/native-page";
import { NativeCommand } from "./src/features/native-command";
import { NativeAdministration } from "./src/features/native-administration";
import { NativeReceipt } from "./src/features/native-receipt";
const Tabs = createBottomTabNavigator(),
  Stack = createNativeStackNavigator();
function Login() {
  const {
      user,
      lang,
      setLang,
      login,
      refresh,
      error: networkError,
    } = useShop(),
    c = useColors(),
    [identity, setIdentity] = useState(""),
    [password, setPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 30,
            flexGrow: 1,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: 35 }}>
            <Image
              source={require("./assets/icon.png")}
              style={{
                width: 85,
                height: 85,
                borderRadius: 43,
                marginBottom: 22,
              }}
              accessibilityLabel="Tech Trolley"
            />
            <Txt style={{ fontSize: 25, fontWeight: "700", lineHeight: 38 }}>
              Tech Trolley
            </Txt>
            <Txt style={{ fontSize: 12, color: c.muted }}>
              Technology · Trust · Tomorrow
            </Txt>
          </View>
          <Txt style={{ fontSize: 22, fontWeight: "600", marginBottom: 18 }}>
            {t(user?.must_change ? "changePassword" : "login", lang)}
          </Txt>
          {user?.must_change ? (
            <Txt>{t("mustChange", lang)}</Txt>
          ) : (
            <Input
              label={t("identity", lang)}
              value={identity}
              onChange={setIdentity}
            />
          )}
          <Input
            label={t(user?.must_change ? "currentPassword" : "password", lang)}
            value={password}
            onChange={setPassword}
            secure
          />
          {user?.must_change && (
            <Input
              label={t("newPassword", lang)}
              value={newPassword}
              onChange={setNewPassword}
              secure
            />
          )}
          {(error || networkError) && (
            <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
              {t(error || networkError, lang)}
            </Txt>
          )}
          <Button
            label={t(
              busy ? "saving" : user?.must_change ? "changePassword" : "login",
              lang,
            )}
            primary
            disabled={busy}
            onPress={() => {
              setBusy(true);
              setError("");
              void (async () => {
                try {
                  if (user?.must_change) {
                    await api.request("/auth/password", "POST", {
                      currentPassword: password,
                      password: newPassword,
                    });
                    await SecureStore.deleteItemAsync(tokenKey);
                    setPassword("");
                    setNewPassword("");
                    await refresh();
                  } else {
                    await login(identity, password);
                    setPassword("");
                  }
                } catch (e: any) {
                  setError(e.code || "NETWORK_ERROR");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
          <Button
            label={lang === "bn" ? "English" : "বাংলা"}
            onPress={() => setLang(lang === "bn" ? "en" : "bn")}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function TabScreens() {
  const { lang } = useShop(),
    c = useColors();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#a58230",
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: "Shop", fontSize: 10 },
        tabBarIcon: () => null,
      }}
    >
      {[
        ["Home", "overview"],
        ["Stock", "inventory"],
        ["Sell", "sell"],
        ["Daybook", "daybook"],
        ["More", "more"],
      ].map(([name, section]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(
              section === "sell"
                ? "sale"
                : section === "more"
                  ? "more"
                  : section,
              lang,
            ),
            ...(name === "Sell"
              ? {
                  tabBarIcon: () => (
                    <View
                      style={{
                        backgroundColor: "#e9ba4b",
                        borderRadius: 12,
                        width: 42,
                        height: 30,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Txt
                        style={{
                          color: "#332a12",
                          fontSize: 25,
                          lineHeight: 29,
                        }}
                      >
                        +
                      </Txt>
                    </View>
                  ),
                  tabBarLabelStyle: {
                    fontFamily: "Shop",
                    fontWeight: "700",
                    color: "#9d7b2d",
                  },
                }
              : {}),
          }}
        >
          {(props) => <NativePage {...props} section={section} />}
        </Tabs.Screen>
      ))}
    </Tabs.Navigator>
  );
}
function Root() {
  const { user, loading, error, refresh, dark, lang } = useShop(),
    c = useColors();
  if (loading)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: c.bg,
        }}
      >
        <ActivityIndicator color="#e9ba4b" />
      </SafeAreaView>
    );
  if (!user) return <Login />;
  if (user.must_change) return <Login />;
  return (
    <NavigationContainer theme={dark ? DarkTheme : DefaultTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: "Shop" },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen
          name="Tabs"
          component={TabScreens}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Page"
          component={NativePage}
          options={({ route }: any) => ({
            title: t(route.params.section, lang),
          })}
        />
        <Stack.Screen
          name="Command"
          component={NativeCommand}
          options={({ route }: any) => ({
            presentation: "modal",
            title: t(route.params.kind, lang),
          })}
        />
        <Stack.Screen
          name="Administration"
          component={NativeAdministration}
          options={({ route }: any) => ({ title: t(route.params.mode, lang) })}
        />
        <Stack.Screen
          name="Receipt"
          component={NativeReceipt}
          options={{ title: t("receipt", lang) }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  const [loaded, error] = useFonts({
    Shop: require("./assets/NotoSansBengali.ttf"),
  });
  if (!loaded && !error)
    return <ActivityIndicator color="#e9ba4b" style={{ flex: 1 }} />;
  return (
    <SafeAreaProvider>
      <ShopProvider>
        <Root />
      </ShopProvider>
    </SafeAreaProvider>
  );
}
