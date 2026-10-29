"use client";
import { useEffect, useState } from "react";
import type { Language } from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";
export type ConnectionPhase =
  "connecting" | "account" | "ready" | "offline" | "unavailable";
export function StartupScreen({
  phase,
  lang = "bn",
  onRetry,
}: {
  phase: ConnectionPhase;
  lang?: Language;
  onRetry?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const failed = phase === "offline" || phase === "unavailable";
  useEffect(() => {
    if (failed) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [failed]);
  return (
    <main className="startup-screen" aria-busy={!failed}>
      <section className="startup-card">
        <div className={"startup-orbit" + (failed ? " paused" : "")}>
          <img
            src="/tech-trolley-logo.png"
            width="92"
            height="92"
            alt="Tech Trolley"
          />
          <span />
          <span />
        </div>
        <p className="eyebrow">TECH TROLLEY</p>
        <div role="status" aria-live="polite">
          <h1>
            {t(
              failed
                ? phase === "offline"
                  ? "startupOffline"
                  : "startupUnavailable"
                : phase === "account"
                  ? "startupAccount"
                  : elapsed >= 10
                    ? "startupWaking"
                    : "startupTitle",
              lang,
            )}
          </h1>
          <p>
            {t(
              failed
                ? phase === "offline"
                  ? "startupOfflineHelp"
                  : "startupUnavailableHelp"
                : elapsed >= 10
                  ? "startupWaitHelp"
                  : "startupHelp",
              lang,
            )}
          </p>
        </div>
        {!failed && (
          <>
            <div
              className="startup-track"
              role="progressbar"
              aria-label={t("startupProgress", lang)}
            >
              <span />
            </div>
            <p className="startup-elapsed" aria-hidden="true">
              {t("startupElapsed", lang)}: {elapsed} {t("startupSeconds", lang)}
            </p>
          </>
        )}
        <ol className="startup-steps">
          <li className="done">
            <span>✓</span>
            {t("startupSite", lang)}
          </li>
          <li className={phase === "account" ? "done" : ""}>
            <span>{phase === "account" ? "✓" : "2"}</span>
            {t("startupServer", lang)}
          </li>
          <li>
            <span>3</span>
            {t("startupSession", lang)}
          </li>
        </ol>
        {failed && (
          <button className="button primary full" onClick={onRetry}>
            {t("retry", lang)}
          </button>
        )}
        <small>{t("startupSafe", lang)}</small>
      </section>
    </main>
  );
}
