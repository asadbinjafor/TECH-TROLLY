import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { PurchaseDeclaration } from "@tech-trolley/contracts";
import { t, currency } from "@tech-trolley/i18n";
import { api } from "../services/api";
import { useShop } from "../contexts/shop-context";
import { Button, Panel, Txt, useColors } from "../components/ui";
export function NativePurchaseDeclaration({ route }: any) {
  const { lang } = useShop(),
    c = useColors();
  const [data, setData] = useState<PurchaseDeclaration | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () => {
    setError("");
    void api
      .request<PurchaseDeclaration>(`/purchases/${route.params.id}/declaration`)
      .then(setData)
      .catch((e) => setError(e.code || "NETWORK_ERROR"));
  };
  useEffect(load, [route.params.id]);
  const print = async (share: boolean) => {
    setBusy(true);
    setError("");
    let file: File | undefined;
    try {
      const bytes = await api.receiptPdf(route.params.id, true);
      file = new File(Paths.cache, `${data!.number}-purchase.pdf`);
      file.create({ overwrite: true });
      file.write(bytes);
      if (share) {
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
          });
      } else await Print.printAsync({ uri: file.uri });
    } catch (e: any) {
      setError(e.code || "SERVER_ERROR");
    } finally {
      try {
        file?.delete();
      } catch {}
      setBusy(false);
    }
  };
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.bg }}
      edges={["left", "right", "bottom"]}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {error && (
          <>
            <Txt accessibilityRole="alert">{t(error, lang)}</Txt>
            <Button label={t("retry", lang)} onPress={load} />
          </>
        )}
        {data ? (
          <>
            <Panel>
              <Txt>
                {data.number} · {data.date}
              </Txt>
              <Txt>
                {data.buyer.name} · {t(data.buyer.role, lang)}
              </Txt>
              {data.reversed && <Txt>{t("reversed", lang)}</Txt>}
              {Object.entries(data.seller).map(([key, value]) => (
                <Txt key={key}>
                  {t(key, lang)}: {value}
                </Txt>
              ))}
              <Txt>
                {data.unit.brand} {data.unit.model}
              </Txt>
              <Txt>
                {data.unit.storage} · {data.unit.color} · {data.unit.variant}
              </Txt>
              <Txt>IMEI: {data.unit.imei}</Txt>
              <Txt>
                {t(data.unit.box, lang)} · {data.unit.accessories}
              </Txt>
              {["total", "cash", "bank", "originalDue"].map((key) => (
                <Txt key={key}>
                  {t(key === "originalDue" ? "due" : key, lang)}:{" "}
                  {currency(
                    data[key as "total" | "cash" | "bank" | "originalDue"],
                    lang,
                  )}
                </Txt>
              ))}
            </Panel>
            <Txt>{t("purchasePrintHint", lang)}</Txt>
            <Button
              label={t("print", lang)}
              primary
              disabled={busy}
              onPress={() => void print(false)}
            />
            <Button
              label={t("share", lang)}
              disabled={busy}
              onPress={() => void print(true)}
            />
          </>
        ) : (
          !error && <Txt>{t("loading", lang)}</Txt>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
