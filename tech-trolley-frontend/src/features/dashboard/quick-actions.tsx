"use client";
import {
  ShoppingCart,
  FileMinus,
  ArrowLeftRight,
  HandCoins,
  ChevronRight,
} from "lucide-react";
import { type CommandKind, type Language } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";

export function QuickActions({
  lang,
  onAction,
}: {
  lang: Language;
  onAction: (kind: CommandKind) => void;
}) {
  return (
    <section className="quick-actions colorful-actions">
      <h2>{t("quick", lang)}</h2>
      <div>
        {(
          [
            ["purchase", ShoppingCart],
            ["expense", FileMinus],
            ["transfer", ArrowLeftRight],
            ["loan", HandCoins],
          ] as const
        ).map(([kind, Icon]) => (
          <button
            key={kind}
            className={`quick-tile quick-${kind}`}
            onClick={() => onAction(kind)}
          >
            <Icon size={30} strokeWidth={1.8} aria-hidden="true" />
            <span>{t(kind, lang)}</span>
            <ChevronRight
              size={21}
              className="quick-tile-arrow"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
