"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { State, User, Language } from "@tech-trolley/contracts";
import { ApiError } from "@tech-trolley/api-client";
import { api } from "@/services/api";
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
    try {
      const u = await api.me();
      setUser(u);
      if (!u.must_change) setState(await api.state());
      setError("");
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        setUser(null);
        setState(null);
      } else setError(err.code || "NETWORK_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setLang(localStorage.getItem("tt-language") === "en" ? "en" : "bn");
    setDark(localStorage.getItem("tt-theme") === "dark");
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const resumed = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resumed);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resumed);
    };
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
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
        setUser,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
