import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { t, currency, dateLabel } from "@tech-trolley/i18n";
import { useShop } from "../contexts/shop-context";
import { Button, Txt, Panel, useColors } from "../components/ui";
import { api } from "../services/api";
import { renderInvoiceHtml } from "@tech-trolley/invoice";
import type { Receipt } from "@tech-trolley/contracts";
import { productDetails } from "@tech-trolley/contracts";
export function NativeReceipt({ route }: any) {
  const { lang } = useShop(),
    c = useColors(),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const tr = (k: string) => t(k, lang),
    money = (v: string) => currency(v, lang);
  const load = () => {
    void api
      .request<Receipt>("/documents/" + route.params.id + "/receipt")
      .then(setReceipt)
      .catch((e) => setError(e.code));
  };
  useEffect(load, [route.params.id]);
  const html = async () => {
    const asset = Asset.fromModule(require("../../assets/NotoSansBengali.ttf"));
    await asset.downloadAsync();
    const font = await new File(asset.localUri || asset.uri).base64();
    return renderInvoiceHtml(receipt!, lang, {
      font: "data:font/ttf;base64," + font,
    });
  };
  const print = async (share: boolean) => {
    setBusy(true);
    try {
      const content = await html();
      if (share) {
        const file = await Print.printToFileAsync({
          html: content,
          width: 595,
          height: 842,
          base64: false,
        });
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
          });
      } else await Print.printAsync({ html: content });
    } catch (e: any) {
      setError(e.code || "SERVER_ERROR");
    } finally {
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
            <Txt accessibilityRole="alert" style={{ color: "#b95050" }}>
              {tr(error)}
            </Txt>
            <Button label={tr("retry")} onPress={load} />
          </>
        )}
        {receipt ? (
          <>
            <Panel>
              <Txt
                style={{
                  textAlign: "center",
                  fontSize: 24,
                  fontWeight: "700",
                  lineHeight: 38,
                }}
              >
                {receipt.shop.name}
              </Txt>
              <Txt style={{ textAlign: "center", fontSize: 12 }}>
                {receipt.shop.address}
              </Txt>
              <Txt style={{ textAlign: "center", fontSize: 12 }}>
                {receipt.shop.phone}
              </Txt>
              <Txt
                style={{
                  textAlign: "center",
                  marginVertical: 20,
                  fontWeight: "600",
                }}
              >
                {receipt.number}
              </Txt>
              <Txt style={{ textAlign: "center", fontSize: 11 }}>
                {dateLabel(receipt.createdAt, lang)}
              </Txt>
              <Txt style={{ textAlign: "center", marginVertical: 12 }}>
                {receipt.customer || tr("walkIn")}
              </Txt>
              <Txt style={{ textAlign: "center" }}>{receipt.phone}</Txt>
              <Txt style={{ textAlign: "center" }}>{receipt.address}</Txt>
              <Txt style={{ textAlign: "center", marginVertical: 12 }}>
                {tr("soldBy")}: {receipt.seller?.name || "—"}
                {receipt.seller?.role ? " · " + tr(receipt.seller.role) : ""}
              </Txt>
              {receipt.reversed && <Txt>{tr("reversed")}</Txt>}
              <Txt style={{ fontWeight: "600" }}>
                {receipt.unit.brand} {receipt.unit.model}
              </Txt>
              <Txt>{productDetails(receipt.unit)}</Txt>
              <Txt>{receipt.unit.imei || receipt.unit.internalId}</Txt>
              <Txt>
                {tr(receipt.unit.box)} ·{" "}
                {receipt.unit.battery === null
                  ? "—"
                  : receipt.unit.battery + "%"}
              </Txt>
              {[
                "price",
                "discount",
                "total",
                "cash",
                "bank",
                "originalDue",
                "outstandingDue",
              ].map((k) => (
                <View
                  key={k}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderBottomWidth: 1,
                    borderBottomColor: c.line,
                    paddingVertical: 12,
                    gap: 10,
                  }}
                >
                  <Txt style={{ fontSize: 12 }}>
                    {tr(
                      k === "originalDue" || k === "outstandingDue" ? "due" : k,
                    )}
                    {k === "originalDue" ? " · " + receipt.date : ""}
                  </Txt>
                  <Txt style={{ fontSize: 12, fontWeight: "600" }}>
                    {money(
                      receipt[
                        k as
                          | "price"
                          | "discount"
                          | "total"
                          | "cash"
                          | "bank"
                          | "originalDue"
                          | "outstandingDue"
                      ],
                    )}
                  </Txt>
                </View>
              ))}
            </Panel>
            <Button
              label={tr("print")}
              primary
              disabled={busy}
              onPress={() => void print(false)}
            />
            <Button
              label={tr("share")}
              disabled={busy}
              onPress={() => void print(true)}
            />
          </>
        ) : (
          <Txt>{tr("loading")}</Txt>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
