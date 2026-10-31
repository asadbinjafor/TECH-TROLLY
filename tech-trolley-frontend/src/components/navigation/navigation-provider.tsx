"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavigationHistory } from "./navigation-history";

const NavigationContext = createContext<{
  navigation: NavigationHistory;
  version: number;
} | null>(null);
export const useNavigation = () => useContext(NavigationContext)!.navigation;

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter(),
    pathname = usePathname();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [version, render] = useState(0);
  const [navigation] = useState(
    () =>
      new NavigationHistory(
        {
          path: () => window.location.pathname,
          read: () => window.history.state || {},
          write: (entry, push) =>
            window.history[push ? "pushState" : "replaceState"](
              { ...window.history.state, ttNavigation: entry },
              "",
              window.location.href,
            ),
          go: (delta) => window.history.go(delta),
          route: (path, replace) =>
            // Finish Next's popstate restoration before issuing the next route.
            window.setTimeout(() => {
              if (replace) routerRef.current.replace(path);
              else routerRef.current.push(path);
            }, 0),
        },
        () => render((v) => v + 1),
      ),
  );
  useEffect(() => {
    let session: string = crypto.randomUUID();
    try {
      session = sessionStorage.getItem("tt-navigation-session") || session;
      sessionStorage.setItem("tt-navigation-session", session);
    } catch {}
    navigation.initialize(session, window.location.pathname);
    const pop = () => navigation.pop();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && navigation.hasLayers) {
        e.preventDefault();
        navigation.back();
      }
      if (e.key !== "Tab" || !navigation.modalOpen) return;
      const dialog = visibleDialogs().at(-1);
      const items =
        dialog &&
        [
          ...dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']",
          ),
        ].filter((e) => e.getClientRects().length && !e.closest("[inert]"));
      if (!items?.length) return;
      const first = items[0],
        last = items.at(-1)!;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !dialog!.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !dialog!.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("popstate", pop);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("popstate", pop);
      document.removeEventListener("keydown", key);
    };
  }, [navigation]);
  useEffect(() => navigation.adoptPage(pathname), [navigation, pathname]);
  const locked = navigation.modalOpen;
  useEffect(() => {
    if (!locked) return;
    const y = window.scrollY,
      body = document.body;
    const original = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    Object.assign(body.style, {
      position: "fixed",
      top: `-${y}px`,
      width: "100%",
      overflow: "hidden",
    });
    return () => {
      Object.assign(body.style, original);
      window.scrollTo(0, y);
    };
  }, [locked]);
  return (
    <NavigationContext.Provider value={{ navigation, version }}>
      {children}
    </NavigationContext.Provider>
  );
}
function visibleDialogs() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "[role='dialog'][aria-modal='true']",
    ),
  ].filter((e) => e.getClientRects().length && !e.closest("[inert]"));
}
export function useBackLayer(open: boolean, onClose: () => void, modal = true) {
  const navigation = useNavigation(),
    id = useId(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // Each effect lifetime owns its own entry, including React's dev replay.
    const unregister = navigation.register(
      `${id}-${crypto.randomUUID()}`,
      () => close.current(),
      modal,
    );
    const frame = modal
      ? requestAnimationFrame(() => {
          const dialog = visibleDialogs().at(-1);
          dialog
            ?.querySelector<HTMLElement>("header button,button")
            ?.focus({ preventScroll: true });
        })
      : null;
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      unregister();
      if (
        modal &&
        opener?.isConnected &&
        !opener.closest("[inert]") &&
        opener.getClientRects().length
      )
        opener.focus({ preventScroll: true });
    };
  }, [open, navigation, id, modal]);
}
