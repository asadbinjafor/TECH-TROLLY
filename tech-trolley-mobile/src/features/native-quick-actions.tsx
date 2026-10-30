import React from "react";
import { Pressable, View } from "react-native";
import { type CommandKind, type Language } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
import { Txt } from "../components/ui";
export function NativeQuickActions({
  lang,
  onAction,
}: {
  lang: Language;
  onAction: (kind: CommandKind) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
      }}
    >
      {(
        [
          ["purchase", "＋", "#e3edff", "#0758d6"],
          ["expense", "−", "#ffe6eb", "#c40033"],
          ["transfer", "⇄", "#dcfaec", "#007b50"],
          ["loan", "৳", "#eee5ff", "#6020c7"],
        ] as const
      ).map(([kind, symbol, bg, color]) => (
        <Pressable
          key={kind}
          accessibilityRole="button"
          accessibilityLabel={t(kind, lang)}
          onPress={() => onAction(kind)}
          style={({ pressed }) => ({
            width: "48%",
            minHeight: 110,
            backgroundColor: bg,
            padding: 16,
            borderRadius: 14,
            marginBottom: 12,
            opacity: pressed ? 0.7 : 1,
            justifyContent: "center",
          })}
        >
          <Txt style={{ color, fontSize: 27, lineHeight: 36 }}>{symbol}</Txt>
          <Txt style={{ color, fontWeight: "700" }}>{t(kind, lang)} ›</Txt>
        </Pressable>
      ))}
    </View>
  );
}
