"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { State, User, Language } from "@tech-trolley/contracts";
import { ApiError } from "@tech-trolley/api-client";
import { api } from "@/services/api";
import type { ConnectionPhase } from "@/features/auth/startup-screen";
type ShopContext = {
  user: User | null;
  state: State | null;
  lang: Language;
  setLang: (l: Language) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  refresh: () => Promise<void>;
  error: string;
  loading: boolean;
  connection: ConnectionPhase;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};
const Context = createContext<ShopContext>(null!);
export const useShop = () => useContext(Context);
export function ShopProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [state, setState] = useState<State | null>(null),
    [lang, setLangState] = useState<Language>("bn"),
    [dark, setDarkState] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ConnectionPhase>("connecting");
  const lifecycle = useRef<AbortController | null>(null),
    lastContact = useRef(0),
    pendingRefresh = useRef<{
      promise: Promise<void>;
      signal: AbortSignal;
    } | null>(null);
  const hasState = useRef(false);
  const setLang = (l: Language) => {
      setLangState(l);
      localStorage.setItem("tt-language", l);
      document.documentElement.lang = l;
    },
    setDark = (d: boolean) => {
      setDarkState(d);
      localStorage.setItem("tt-theme", d ? "dark" : "light");
      document.documentElement.dataset.theme = d ? "dark" : "light";
    };
  const refresh = useCallback(async () => {
    const signal = lifecycle.current?.signal;
    if (!signal || signal.aborted) return;
    if (pendingRefresh.current?.signal === signal)
      return pendingRefresh.current.promise;
    const run = (async () => {
      try {
        if (Date.now() - lastContact.current > 60000) {
          setConnection("connecting");
          setError("");
          await api.ready({ signal, isOnline: () => navigator.onLine });
          if (signal.aborted) return;
          setConnection("account");
        }
        if (!hasState.current) setConnection("account");
        const u = await api.me(signal);
        if (signal.aborted) return;
        setUser(u);
        if (!u.must_change) {
          const next = await api.state(signal);
          if (signal.aborted) return;
          setState(next);
          hasState.current = true;
        } else {
          setState(null);
          hasState.current = false;
        }
        lastContact.current = Date.now();
        setConnection("ready");
        setError("");
      } catch (e) {
        if (signal.aborted) return;
        const err = e as ApiError;
        if (err.status === 401) {
          setUser(null);
          setState(null);
          hasState.current = false;
          lastContact.current = Date.now();
          setError("");
          setConnection("ready");
        } else {
          lastContact.current = 0;
          setError(err.code || "NETWORK_ERROR");
          setConnection(navigator.onLine ? "unavailable" : "offline");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
    pendingRefresh.current = { promise: run, signal };
    try {
      await run;
    } finally {
      if (pendingRefresh.current?.promise === run)
        pendingRefresh.current = null;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    setLang(localStorage.getItem("tt-language") === "en" ? "en" : "bn");
    setDark(localStorage.getItem("tt-theme") === "dark");
    void refresh();
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        hasState.current &&
        lastContact.current > 0
      )
        void refresh();
    }, 30000);
    const resumed = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resumed);
    window.addEventListener("online", resumed);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resumed);
      window.removeEventListener("online", resumed);
    };
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void api.request("/auth/refresh", "POST").catch(() => {});
    }, 15 * 60000);
    return () => clearInterval(timer);
  }, [user]);
  const logout = async () => {
    await api.logout();
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(`tt-${user?.id}-`)) sessionStorage.removeItem(key);
    setUser(null);
    setState(null);
    hasState.current = false;
  };
  return (
    <Context.Provider
      value={{
        user,
        state,
        lang,
        setLang,
        dark,
        setDark,
        refresh,
        error,
        loading,
        connection,
        setUser,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
