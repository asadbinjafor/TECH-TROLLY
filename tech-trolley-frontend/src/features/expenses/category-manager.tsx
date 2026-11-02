"use client";
import { useId } from "react";
import { t } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { useBackLayer } from "@/components/navigation/navigation-provider";
import { Administration } from "@/features/settings/administration";

export function CategoryManager({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { lang } = useShop();
  const title = useId();
  useBackLayer(true, onClose);
  return (
    <div className="modal-backdrop party-modal">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
      >
        <header>
          <h2 id={title}>{t("manageCategories", lang)}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t("close", lang)}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <Administration mode="categories" onCategoryCreated={onCreated} />
      </section>
    </div>
  );
}
