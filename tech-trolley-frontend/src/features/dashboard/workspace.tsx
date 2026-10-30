"use client";
import { FormField } from "@/components/forms/form-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Package,
  ShoppingBag,
  ReceiptText,
  Wallet,
  Users,
  ChartNoAxesCombined,
  Settings,
  Search,
  Sun,
  Moon,
  Plus,
  ArrowUpRight,
  CheckCheck,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  Coins,
} from "lucide-react";
import {
  pages,
  minor,
  decimal,
  productDetails,
  canChangeStock,
  acquisitionCycleIds,
  type CommandKind,
  type Document,
  type Report,
} from "@tech-trolley/contracts";
import { t, currency, dateLabel } from "@tech-trolley/i18n";
import { useShop } from "@/contexts/shop-context";
import { api, apiBase } from "@/services/api";
import { Login } from "@/features/auth/login";
import { StartupScreen } from "@/features/auth/startup-screen";
import { CommandForm } from "@/features/transactions/command-form";
import { Administration } from "@/features/settings/administration";
import { Invoice } from "@/features/transactions/invoice";
import { PdfDownload } from "@/features/transactions/pdf-download";
import { PurchaseDeclaration } from "@/features/transactions/purchase-declaration";
import { ReportAnalysis } from "./report-analysis";
import { LoanDues } from "@/features/accounts/loan-dues";
import { QuickActions } from "./quick-actions";
import {
  useBalancePrivacy,
  BalanceToggle,
  RevealBalances,
} from "./balance-privacy";
const icons = [
  LayoutDashboard,
  CalendarDays,
  Package,
  Plus,
  ShoppingBag,
  ReceiptText,
  Wallet,
  Wallet,
  Users,
  ChartNoAxesCombined,
  Coins,
  Settings,
];
export function Workspace({ section }: { section: string }) {
  const router = useRouter();
  const [saleVersion, setSaleVersion] = useState(0);
  const [declarationId, setDeclarationId] = useState<string | null>(null);
  const [purchaseTab, setPurchaseTab] = useState("allPurchases");
  const {
      user,
      state,
      lang,
      setLang,
      dark,
      setDark,
      error,
      loading,
      connection,
      refresh,
      logout,
    } = useShop(),
    [command, setCommand] = useState<CommandKind | null>(null),
    [selectedUnit, setSelectedUnit] = useState<string | undefined>(),
    [selectedDocument, setSelectedDocument] = useState<string | undefined>(),
    [selectedParty, setSelectedParty] = useState<string | undefined>(),
    [historyUnit, setHistoryUnit] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [stockTab, setStockTab] = useState("inStock"),
    [menu, setMenu] = useState(false),
    [date, setDate] = useState(""),
    [period, setPeriod] = useState(section === "profit" ? "month" : "today"),
    [rangeFrom, setRangeFrom] = useState(""),
    [rangeTo, setRangeTo] = useState(""),
    [report, setReport] = useState<Report | null>(null),
    [reportError, setReportError] = useState(""),
    [receipt, setReceipt] = useState<any>(null),
    [detail, setDetail] = useState<Document | null>(null),
    [toast, setToast] = useState("");
  const privacy = useBalancePrivacy(`${user?.id || ""}:${section}`);
  const privacyContext = useRef({ key: "", visible: false });
  privacyContext.current = {
    key: `${user?.id || ""}:${section}`,
    visible: privacy.visible,
  };
  const [revealOpen, setRevealOpen] = useState(false);
  useEffect(() => {
    setCommand(null);
    setReceipt(null);
    setDetail(null);
    setDeclarationId(null);
  }, [section]);
  useEffect(() => {
    if (section === "overview" && !privacy.visible) {
      setReceipt(null);
      setDetail(null);
    }
  }, [privacy.visible, section]);
  useEffect(() => {
    const closeReveal = () => setRevealOpen(false);
    window.addEventListener("blur", closeReveal);
    document.addEventListener("visibilitychange", closeReveal);
    return () => {
      window.removeEventListener("blur", closeReveal);
      document.removeEventListener("visibilitychange", closeReveal);
    };
  }, []);
  const reportQuery = new URLSearchParams({
    lang,
    period: user?.role !== "OWNER" || section === "daybook" ? "today" : period,
    ...(user?.role === "OWNER" && section === "daybook" && date
      ? { date }
      : {}),
    ...(user?.role === "OWNER" && section !== "daybook" && period === "range"
      ? {
          from: rangeFrom || state?.today || "",
          to: rangeTo || state?.today || "",
        }
      : {}),
  }).toString();
  useEffect(() => {
    if (!state || !["reports", "daybook", "profit"].includes(section)) return;
    let active = true;
    setReportError("loading");
    void api
      .request<Report>("/reports?" + reportQuery)
      .then((r) => {
        if (active) {
          setReport(r);
          setReportError("");
        }
      })
      .catch((e) => {
        if (active) setReportError(e.code);
      });
    return () => {
      active = false;
    };
  }, [state, section, reportQuery]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  if (loading || (!state && connection !== "ready"))
    return (
      <StartupScreen
        phase={connection}
        lang={lang}
        onRetry={() => void refresh()}
      />
    );
  if (!user || user.must_change) return <Login />;
  if (!state)
    return (
      <StartupScreen
        phase={connection === "ready" ? "unavailable" : connection}
        lang={lang}
        onRetry={() => void refresh()}
      />
    );
  const r = section === "overview" ? state.report : report || state.report;
  const historyIds = historyUnit
    ? acquisitionCycleIds(historyUnit, state.units)
    : new Set<string>();
  const money = (v: string) =>
      section === "overview" && !privacy.visible
        ? "৳ ••••••"
        : currency(v, lang),
    tr = (k: string) => t(k, lang);
  const balanceToggle = () => (
    <BalanceToggle
      visible={privacy.visible}
      lang={lang}
      onClick={() => (privacy.visible ? privacy.hide() : setRevealOpen(true))}
    />
  );
  const action = (kind: CommandKind) => {
    setSelectedUnit(undefined);
    setSelectedDocument(undefined);
    setSelectedParty(undefined);
    setCommand(kind);
  };
  const fetchReceipt = async (
    id: string,
    requiresReveal = section === "overview",
  ) => {
    const context = privacyContext.current.key;
    try {
      const receipt = await api.request<object>(
        `/documents/${id}/receipt?lang=${lang}`,
      );
      if (
        privacyContext.current.key !== context ||
        (requiresReveal && !privacyContext.current.visible)
      )
        return;
      setReceipt({ ...receipt, id });
    } catch (e: any) {
      setToast(tr(e.code));
    }
  };
  const actions = (kinds: CommandKind[]) =>
    kinds.map((k) => (
      <button key={k} className="button" onClick={() => action(k)}>
        <Plus size={16} />
        {tr(k)}
      </button>
    ));
  const card = (label: string, value: string, style = "") => (
    <article className={"metric " + style} key={label}>
      <div className="metric-label">
        {tr(label)}
        <Coins size={17} />
      </div>
      <strong className="amount">{money(value)}</strong>
      {section === "overview" && balanceToggle()}
    </article>
  );
  const table = (documents: Document[], title = "recent") => (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{tr(title)}</h2>
          <p className="muted">
            {documents.length} {tr("number")}
          </p>
        </div>
      </div>
      {documents.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "number",
                  "kind",
                  "date",
                  "actor",
                  "total",
                  "due",
                  "details",
                ].map((k) => (
                  <th key={k}>{tr(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td data-label={tr("number")}>
                    <b>{d.number}</b>
                    {d.reversed_by && (
                      <span className="badge muted">{tr("reversed")}</span>
                    )}
                  </td>
                  <td data-label={tr("kind")}>
                    <span className="badge">
                      {tr(
                        d.kind === "purchase" &&
                          d.snapshot.purchaseSource === "individual"
                          ? "individualPurchase"
                          : d.kind,
                      )}
                    </span>
                    <small>
                      {String(
                        d.snapshot.model ||
                          d.snapshot.partyName ||
                          d.snapshot.staffName ||
                          "",
                      )}
                    </small>
                  </td>
                  <td data-label={tr("date")}>
                    {d.business_date}
                    <small>
                      {new Date(d.created_at).toLocaleTimeString(
                        lang === "bn" ? "bn-BD" : "en-GB",
                        {
                          timeZone: "Asia/Dhaka",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </small>
                  </td>
                  <td data-label={tr("actor")}>{d.actor_name}</td>
                  <td data-label={tr("total")} className="num">
                    {d.kind === "stockEdit" ? "—" : money(d.total)}
                  </td>
                  <td data-label={tr("due")} className="num">
                    {money(d.due)}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (section === "overview" && !privacy.visible) {
                          setRevealOpen(true);
                          return;
                        }
                        if (d.kind === "sale") void fetchReceipt(d.id);
                        else setDetail(d);
                      }}
                    >
                      {tr(d.kind === "sale" ? "receipt" : "details")}{" "}
                      <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </section>
  );
  let docs = state.documents.filter((d) =>
    (section === "overview" && !privacy.visible
      ? `${d.number} ${d.kind} ${d.actor_name} ${d.snapshot.model || ""} ${d.snapshot.partyName || ""}`
      : JSON.stringify(d)
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const dateShift = (n: number) => {
    const d = new Date((date || state.today) + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    setDate(d.toISOString().slice(0, 10));
  };
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {lang === "bn" ? "মূল অংশে যান" : "Skip to main content"}
      </a>
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <Link href="/" className="brand">
          <img
            src="/tech-trolley-logo.png"
            alt="Tech Trolley"
            width="42"
            height="42"
          />
          <div>
            <b>TECH TROLLEY</b>
            <small>SHOP MANAGER</small>
          </div>
        </Link>
        <p className="nav-label">{tr("workspace")}</p>
        <nav>
          {pages.map((p, i) => {
            const Icon = icons[i];
            return (
              <Link
                className={section === p ? "nav-item selected" : "nav-item"}
                key={p}
                href={p === "overview" ? "/" : "/" + p}
                onClick={() => setMenu(false)}
              >
                <Icon size={19} />
                <span>{tr(p)}</span>
                {p === "inventory" && (
                  <small className="nav-count">
                    {state.units.filter((u) => u.status === "IN_STOCK").length}
                  </small>
                )}
              </Link>
            );
          })}
          {section === "overview" && (
            <button className="nav-item" onClick={() => action("cashCount")}>
              <CheckCheck size={19} />
              {tr("cashCount")}
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <b>{user.name}</b>
            <small>{tr(user.role)}</small>
          </div>
          <button
            className="icon-button"
            aria-label={tr("logout")}
            onClick={() => void logout().catch((e) => setToast(tr(e.code)))}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label={tr("workspace")}
          >
            <Menu />
          </button>
          <div className="search">
            <Search size={20} />
            <input
              aria-label={tr("search")}
              placeholder={tr("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="top-controls">
            <select
              aria-label={tr("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as any)}
            >
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
            <button
              className="icon-button"
              aria-label={tr(dark ? "light" : "dark")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="account-label">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              {user.name}
              <small>{tr(user.role)}</small>
            </span>
          </div>
        </header>
        <main id="main">
          <div
            className={
              "page-heading" +
              (section === "purchases" ? " purchase-heading" : "")
            }
          >
            <div>
              <h1>{tr(section)}</h1>
              <p>{dateLabel(state.today, lang)}</p>
            </div>
            {section === "overview" && (
              <div className="heading-actions">
                <button
                  className="button reconcile-action"
                  onClick={() => action("cashCount")}
                >
                  <CheckCheck size={17} />
                  {tr("cashCount")}
                </button>
                <button
                  className="button primary"
                  onClick={() => action("sale")}
                >
                  <Plus size={19} />
                  {tr("sale")}
                </button>
              </div>
            )}
            {section === "purchases" && (
              <div className="heading-actions">
                <button
                  className="button primary"
                  onClick={() => action("purchase")}
                >
                  <Plus size={19} />
                  {tr("purchase")}
                </button>
                <button
                  className="button"
                  onClick={() => action("individualPurchase")}
                >
                  <Plus size={19} />
                  {tr("individualPurchase")}
                </button>
                <a
                  className="button"
                  href="/samples/tech-trolley-purchase-blank-a4.pdf"
                  download="Tech-Trolley-Blank-A4-Form.pdf"
                >
                  <ArrowDownToLine size={17} />
                  {tr("downloadPurchaseSample")}
                </a>
              </div>
            )}
          </div>
          {connection !== "ready" && (
            <div className="notice connection-notice" role="status">
              <span className="spinner" />
              {tr(
                connection === "offline"
                  ? "startupOfflineHelp"
                  : connection === "unavailable"
                    ? "startupUnavailableHelp"
                    : "startupWaitHelp",
              )}
              {(connection === "unavailable" || connection === "offline") && (
                <button className="text-button" onClick={() => void refresh()}>
                  {tr("retry")}
                </button>
              )}
            </div>
          )}
          {error && connection === "ready" && (
            <div role="alert" className="notice error">
              {tr("offline")}{" "}
              <button className="text-button" onClick={() => void refresh()}>
                {tr("retry")}
              </button>
            </div>
          )}
          {!state.shop.opened_at && (
            <div className="notice opening-notice">
              <span>{tr("openingNotice")}</span>
              {user.role === "OWNER" && (
                <button className="button" onClick={() => action("opening")}>
                  <Wallet size={18} />
                  {tr("opening")}
                </button>
              )}
            </div>
          )}
          {section === "overview" && (
            <>
              <Link href="/daybook" className="notice daybook-link">
                <span>
                  {lang === "bn"
                    ? "ক্যালেন্ডারে দিন বেছে কেনা, বিক্রি, খরচ ও অবশিষ্ট টাকা দেখুন।"
                    : "Choose a date to see purchases, sales, expenses and closing balances."}
                </span>
                <span className="button">
                  <CalendarDays size={18} />
                  {tr("daybook")}
                </span>
              </Link>
              <div className="balance-grid">
                <article className="balance-card cash-card">
                  <div>
                    <Wallet size={20} />
                    {tr("cash")}
                  </div>
                  <strong>{money(state.balances.cash)}</strong>
                  {balanceToggle()}
                  <div className="balance-foot">
                    <span>
                      {tr("openingCash")}
                      <b>{money(r.openingCash)}</b>
                    </span>
                    <span>
                      {tr("cashIn")}
                      <b className="positive">+ {money(r.cashIn)}</b>
                    </span>
                    <span>
                      {tr("cashOut")}
                      <b className="negative">− {money(r.cashOut)}</b>
                    </span>
                  </div>
                </article>
                <article className="balance-card">
                  <div>
                    <Wallet size={20} />
                    {tr("bank")}
                  </div>
                  <strong>{money(state.balances.bank)}</strong>
                  {balanceToggle()}
                  <p className="muted">
                    {lang === "bn"
                      ? "দোকানের ব্যাংক অ্যাকাউন্ট"
                      : "Shop bank account"}
                  </p>
                  <div className="balance-foot">
                    <span>
                      {tr("openingBank")}
                      <b>{money(r.openingBank)}</b>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => action("transfer")}
                    >
                      {tr("transfer")} →
                    </button>
                  </div>
                </article>
              </div>
              <div className="metrics-grid">
                {card("revenue", r.revenue)}
                {card("netProfit", r.netProfit, "profit")}
                {card("expenses", r.expense)}
                {card("stockCost", state.balances.inventory)}
              </div>
              <QuickActions lang={lang} onAction={action} />
              <div className="overview-lower">
                <div>{table(docs.slice(0, 6))}</div>
                {user.role === "OWNER" && (
                  <section className="panel sales-chart">
                    <h2>
                      {lang === "bn"
                        ? "বিক্রির গত ৭ দিন"
                        : "Sales over the last 7 days"}
                    </h2>
                    {!privacy.visible ? (
                      <div className="chart chart-locked">
                        {balanceToggle()}
                      </div>
                    ) : (
                      <div className="chart">
                        {Array.from({ length: 7 }, (_, i) => {
                          const d = new Date(state.today + "T12:00:00Z");
                          d.setUTCDate(d.getUTCDate() - 6 + i);
                          const ds = d.toISOString().slice(0, 10),
                            sum = state.documents
                              .filter(
                                (x) =>
                                  x.business_date === ds &&
                                  x.kind === "sale" &&
                                  !x.reversed_by,
                              )
                              .reduce((n, x) => n + minor(x.total), 0n);
                          const max = state.documents
                            .filter((x) => x.kind === "sale")
                            .reduce(
                              (n, x) =>
                                minor(x.total) > n ? minor(x.total) : n,
                              1n,
                            );
                          return (
                            <div
                              className="chart-day"
                              key={ds}
                              title={`${ds}: ${decimal(sum)}`}
                            >
                              <div
                                className="bar"
                                style={{
                                  height:
                                    sum > 0n
                                      ? `${Math.max(3, Number((sum * 100n) / max))}%`
                                      : "2px",
                                }}
                              />
                              <small>
                                {d.toLocaleDateString(
                                  lang === "bn" ? "bn-BD" : "en-GB",
                                  { weekday: "short", timeZone: "Asia/Dhaka" },
                                )}
                              </small>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
              </div>
              <div className="dues-grid">
                {card("receivable", state.balances.receivable)}
                {card("payable", state.balances.payable)}
              </div>
            </>
          )}
          {section === "sale" && (
            <CommandForm
              key={`sale-page-${saleVersion}`}
              kind="sale"
              embedded
              onClose={() => router.push("/")}
              onSaved={(id) => {
                setSaleVersion((value) => value + 1);
                setToast(tr("saved"));
                void fetchReceipt(id, false);
              }}
            />
          )}
          {section === "inventory" && (
            <>
              {stockTab === "inStock" &&
                !state.units.some((u) => u.status === "IN_STOCK") && (
                  <p className="notice">{tr("emptyStockSelection")}</p>
                )}
              {state.units.some((u) => u.variant && !u.storage && !u.color) && (
                <p className="notice">{tr("legacyVariant")}</p>
              )}
              <div className="section-tools">
                <div className="tabs">
                  {["inStock", "stockOut", "all"].map((k) => (
                    <button
                      className={stockTab === k ? "active" : ""}
                      key={k}
                      onClick={() => setStockTab(k)}
                    >
                      {tr(k)}
                    </button>
                  ))}
                </div>
                {actions(["purchase"])}
              </div>
              <section className="panel">
                {state.units.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {[
                            "model",
                            "storage",
                            "color",
                            "variant",
                            "imei",
                            "cost",
                            "status",
                            "price",
                            "details",
                          ].map((k) => (
                            <th key={k}>{tr(k)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {state.units
                          .filter(
                            (u) =>
                              (stockTab === "all" ||
                                (stockTab === "inStock"
                                  ? u.status === "IN_STOCK"
                                  : u.status !== "IN_STOCK")) &&
                              `${u.model} ${u.brand} ${productDetails(u)} ${u.imei} ${u.internal_id}`
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                          )
                          .map((u) => {
                            const sale = state.documents.find(
                              (d) => d.id === u.sale_id,
                            );
                            return (
                              <tr key={u.id}>
                                <td>
                                  <b>{u.model}</b>
                                  <small>
                                    {u.brand} · {u.internal_id}
                                  </small>
                                  {u.phoneType && (
                                    <small>
                                      {tr(u.phoneType)}
                                      {u.ram ? ` · RAM ${u.ram}` : ""}
                                    </small>
                                  )}
                                </td>
                                <td data-label={tr("storage")}>
                                  {u.storage || "—"}
                                </td>
                                <td data-label={tr("color")}>
                                  {u.color || "—"}
                                </td>
                                <td data-label={tr("variant")}>
                                  {u.variant || "—"}
                                </td>
                                <td className="mono">
                                  {u.imei || "—"}
                                  <small>
                                    {u.battery !== null ? `${u.battery}%` : "—"}{" "}
                                    · {tr(u.box)}
                                  </small>
                                </td>
                                <td className="num">{money(u.cost)}</td>
                                <td>
                                  <span className="badge">{tr(u.status)}</span>
                                </td>
                                <td className="num">
                                  {sale ? money(sale.total) : "—"}
                                  {sale && (
                                    <small>
                                      {sale.business_date} · {sale.actor_name}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  {sale ? (
                                    <button
                                      className="text-button"
                                      onClick={() => void fetchReceipt(sale.id)}
                                    >
                                      {tr("receipt")}
                                    </button>
                                  ) : u.status === "IN_STOCK" ? (
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        setSelectedUnit(u.id);
                                        setCommand("sale");
                                      }}
                                    >
                                      {tr("sale")}
                                    </button>
                                  ) : null}
                                  {canChangeStock(u, state) && (
                                    <>
                                      <button
                                        className="text-button"
                                        onClick={() => {
                                          setSelectedUnit(u.id);
                                          setCommand("stockEdit");
                                        }}
                                      >
                                        {tr("stockEdit")}
                                      </button>
                                      <button
                                        className="text-button"
                                        onClick={() => {
                                          setSelectedUnit(u.id);
                                          setCommand("purchaseReturn");
                                        }}
                                      >
                                        {tr("purchaseReturn")}
                                      </button>
                                    </>
                                  )}
                                  <button
                                    className="text-button"
                                    onClick={() => setHistoryUnit(u.id)}
                                  >
                                    {tr("stockHistory")}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty />
                )}
              </section>
            </>
          )}
          {section === "inventory" && historyUnit && (
            <>
              <button className="button" onClick={() => setHistoryUnit(null)}>
                {tr("close")}
              </button>
              {table(
                docs.filter((d) => d.unit_id && historyIds.has(d.unit_id)),
                "stockHistory",
              )}
            </>
          )}
          {section === "purchases" && (
            <>
              <div className="metrics-grid three">
                {card("stockCost", state.balances.inventory)}
                {card("payable", state.balances.payable)}
                {card(
                  "supplierReceivable",
                  state.balances.supplierReceivable || "0.00",
                )}
                {card("cash", state.balances.cash)}
              </div>
              <div
                className="heading-actions"
                role="group"
                aria-label={tr("purchaseSource")}
              >
                {[
                  "allPurchases",
                  "supplierPurchases",
                  "individualPurchases",
                ].map((tab) => (
                  <button
                    key={tab}
                    className={
                      "button " + (purchaseTab === tab ? "primary" : "")
                    }
                    aria-pressed={purchaseTab === tab}
                    onClick={() => setPurchaseTab(tab)}
                  >
                    {tr(tab)}
                  </button>
                ))}
              </div>
              {table(
                docs.filter(
                  (d) =>
                    d.kind === "purchase" &&
                    (purchaseTab === "allPurchases" ||
                      (purchaseTab === "individualPurchases") ===
                        (d.snapshot.purchaseSource === "individual")),
                ),
                "purchases",
              )}
            </>
          )}
          {section === "transactions" && (
            <>
              <div className="section-tools">
                {actions(["expense", "reversal"])}
              </div>
              {table(docs, "transactions")}
            </>
          )}
          {section === "money" && (
            <>
              <div className="metrics-grid">
                {card("cash", state.balances.cash)}
                {card("bank", state.balances.bank)}
                {card("receivable", state.balances.receivable)}
                {card("payable", state.balances.payable)}
                {card(
                  "supplierReceivable",
                  state.balances.supplierReceivable || "0.00",
                )}
              </div>
              <section className="quick-actions">
                <Link className="button primary" href="/dues">
                  {tr("dues")}
                </Link>
                <div>
                  {actions([
                    "collection",
                    "supplierPayment",
                    "supplierRefund",
                    "transfer",
                    "contribution",
                    "withdrawal",
                    "loan",
                    "loanRepayment",
                  ])}
                </div>
              </section>
              {table(
                docs.filter((d) => Number(d.due) > 0),
                "due",
              )}
              <Administration mode="parties" />
            </>
          )}
          {section === "dues" && (
            <LoanDues
              onDetails={setDetail}
              onCommand={(kind, partyId, documentId) => {
                setSelectedUnit(undefined);
                setSelectedDocument(documentId);
                setSelectedParty(partyId);
                setCommand(kind);
              }}
            />
          )}
          {section === "staff" && (
            <>
              <section className="quick-actions">
                <div>{actions(["advance", "advanceRepayment", "salary"])}</div>
              </section>
              <section className="panel">
                <h2>{tr("staff")}</h2>
                {state.staff.length ? (
                  state.staff.map((s) => (
                    <div className="list-row" key={s.id}>
                      <span className="avatar">{s.name.slice(0, 1)}</span>
                      <b>{s.name}</b>
                      <span className="badge">{tr(s.role)}</span>
                    </div>
                  ))
                ) : (
                  <Empty />
                )}
              </section>
              {table(
                docs.filter((d) =>
                  ["advance", "advanceRepayment", "salary"].includes(d.kind),
                ),
                "transactions",
              )}
            </>
          )}
          {["daybook", "reports", "profit"].includes(section) && (
            <>
              <div className="section-tools">
                {user.role !== "OWNER" ? (
                  <p className="notice">{tr("monthlyNotice")}</p>
                ) : section === "daybook" ? (
                  <div className="date-controls">
                    <button
                      className="icon-button"
                      aria-label="Previous day"
                      onClick={() => dateShift(-1)}
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <FormField label={tr("date")} className="filter-field">
                      <input
                        type="date"
                        aria-label={tr("date")}
                        max={state.today}
                        value={date || state.today}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </FormField>
                    <button
                      className="icon-button"
                      aria-label="Next day"
                      disabled={(date || state.today) >= state.today}
                      onClick={() => dateShift(1)}
                    >
                      <ChevronRight size={19} />
                    </button>
                    <button className="button" onClick={() => setDate("")}>
                      {tr("today")}
                    </button>
                  </div>
                ) : (
                  <div className="tabs">
                    {["today", "week", "month", "range"].map((p) => (
                      <button
                        className={period === p ? "active" : ""}
                        key={p}
                        onClick={() => setPeriod(p)}
                      >
                        {tr(p === "month" ? "monthReport" : p)}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="button"
                  disabled={!!reportError}
                  onClick={async () => {
                    try {
                      const url = apiBase + "/reports/export?" + reportQuery;
                      const res = await fetch(url, { credentials: "include" });
                      if (!res.ok) throw new Error("FORBIDDEN");
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(await res.blob());
                      link.download = `tech-trolley-${r.from}-${r.to}.csv`;
                      link.click();
                      URL.revokeObjectURL(link.href);
                    } catch (e: any) {
                      setToast(tr(e.message));
                    }
                  }}
                >
                  <ArrowDownToLine size={16} />
                  {tr("download")}
                </button>
              </div>
              {user.role === "OWNER" &&
                section !== "daybook" &&
                period === "range" && (
                  <div className="date-range-controls">
                    <FormField label={tr("startDate")} className="filter-field">
                      <input
                        type="date"
                        max={rangeTo || state.today}
                        value={rangeFrom || state.today}
                        onChange={(e) => setRangeFrom(e.target.value)}
                      />
                    </FormField>
                    <FormField label={tr("endDate")} className="filter-field">
                      <input
                        type="date"
                        min={rangeFrom || state.today}
                        max={state.today}
                        value={rangeTo || state.today}
                        onChange={(e) => setRangeTo(e.target.value)}
                      />
                    </FormField>
                  </div>
                )}
              {reportError ? (
                <p role="alert" className="error">
                  {tr(reportError)}
                </p>
              ) : !r.available ? (
                <div className="notice">{tr("unavailable")}</div>
              ) : (
                <>
                  <div className="report-range">
                    {dateLabel(r.from, lang)}
                    {r.from !== r.to && " — " + dateLabel(r.to, lang)}
                  </div>
                  <div className="metrics-grid three">
                    {card("revenue", r.revenue)}
                    {card("cogs", r.cogs)}
                    {card("grossProfit", r.grossProfit, "profit")}
                    {card("expenses", r.expense)}
                    {card("netProfit", r.netProfit, "profit")}
                    {card("purchasesTotal", r.purchases || "0.00")}
                    {card("purchaseReturns", r.purchaseReturns || "0.00")}
                    {card(
                      "closingSupplierRefund",
                      r.closingSupplierRefund || "0.00",
                    )}
                  </div>
                  {section !== "profit" && (
                    <section className="panel ledger-panels">
                      {[
                        "openingCash",
                        "cashIn",
                        "cashOut",
                        "closingCash",
                        "openingBank",
                        "bankIn",
                        "bankOut",
                        "closingBank",
                        "grossProfit",
                        "externalIn",
                        "externalOut",
                      ].map((k) => (
                        <div className="pnl-row" key={k}>
                          <span>{tr(k)}</span>
                          <b>{money((r as any)[k])}</b>
                        </div>
                      ))}
                    </section>
                  )}
                  {section !== "profit" && table(r.documents, "daybook")}
                  <ReportAnalysis
                    report={r}
                    lang={lang}
                    withMoney={section !== "profit"}
                  />
                </>
              )}
              {section === "daybook" && state.counts.length > 0 && (
                <section className="panel">
                  <h2>{tr("cashCount")}</h2>
                  {state.counts
                    .filter(
                      (c: any) =>
                        String(c.business_date).slice(0, 10) ===
                        (date || state.today),
                    )
                    .map((c: any) => (
                      <div className="list-row" key={c.document_id}>
                        <span>{c.actor_name}</span>
                        <span>
                          {tr("expected")}: {money(decimal(c.expected))}
                        </span>
                        <span>
                          {tr("counted")}: {money(decimal(c.counted))}
                        </span>
                        <span>
                          {tr("difference")}: {money(decimal(c.difference))}
                        </span>
                        {c.needs_review && (
                          <span className="negative">{tr("needsReview")}</span>
                        )}
                      </div>
                    ))}
                </section>
              )}
            </>
          )}
          {section === "settings" && <Administration mode="settings" />}
          <footer className="page-footer">
            <span className={error ? "status-dot offline" : "status-dot"} />
            {tr(error ? "cached" : "connected")}
            <span>·</span>Tech Trolley
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[
          "overview",
          "inventory",
          ...(section === "overview" ? ["sale"] : []),
          "daybook",
          "settings",
        ].map((p) => (
          <button
            key={p}
            className={p === "sale" ? "sell-nav" : ""}
            onClick={() =>
              p === "sale"
                ? action("sale")
                : location.assign(p === "overview" ? "/" : "/" + p)
            }
          >
            {p === "sale" ? (
              <Plus size={24} />
            ) : p === "overview" ? (
              <LayoutDashboard size={19} />
            ) : p === "inventory" ? (
              <Package size={19} />
            ) : p === "daybook" ? (
              <CalendarDays size={19} />
            ) : (
              <Menu size={19} />
            )}
            <small>{tr(p)}</small>
          </button>
        ))}
      </nav>
      {command && (
        <CommandForm
          key={command}
          kind={command}
          initialUnit={selectedUnit}
          initialDocument={selectedDocument}
          initialParty={selectedParty}
          onClose={() => setCommand(null)}
          onSaved={(id, kind) => {
            setCommand(null);
            setToast(tr("saved"));
            if (kind === "sale") void fetchReceipt(id, false);
            if (kind === "individualPurchase") setDeclarationId(id);
          }}
        />
      )}
      {revealOpen && (
        <RevealBalances
          key={user.id}
          lang={lang}
          onClose={() => setRevealOpen(false)}
          onVerified={() => {
            privacy.reveal();
            setRevealOpen(false);
          }}
        />
      )}
      {receipt && (
        <div className="modal-backdrop receipt-backdrop">
          <section className="modal receipt" role="dialog" aria-modal="true">
            <header>
              <h2>{tr("receipt")}</h2>
              <button
                className="icon-button"
                onClick={() => setReceipt(null)}
                aria-label={tr("close")}
              >
                ×
              </button>
            </header>
            <Invoice receipt={receipt} lang={lang} />
            <footer>
              <p className="receipt-print-hint">{tr("invoicePrintHint")}</p>
              <a
                className="button primary"
                href={`${apiBase}/documents/${encodeURIComponent(receipt.id)}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tr("openInvoicePdf")}
              </a>
              <PdfDownload
                id={receipt.id}
                number={receipt.number}
                lang={lang}
              />
            </footer>
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <header>
              <h2>{detail.number}</h2>
              <button
                className="icon-button"
                aria-label={tr("close")}
                onClick={() => setDetail(null)}
              >
                ×
              </button>
            </header>
            <p>
              {tr(detail.kind)} · {detail.business_date} · {detail.actor_name}
            </p>
            {detail.kind === "purchase" &&
              detail.snapshot.purchaseSource === "individual" && (
                <button
                  className="button primary"
                  onClick={() => {
                    setDeclarationId(detail.id);
                    setDetail(null);
                  }}
                >
                  {tr("purchaseDeclaration")}
                </button>
              )}
            {detail.kind === "stockEdit" && (
              <table>
                <thead>
                  <tr>
                    <th>{tr("details")}</th>
                    <th>{tr("beforeEdit")}</th>
                    <th>{tr("afterEdit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    detail.snapshot.after as Record<string, unknown>,
                  ).map(([k, v]) => (
                    <tr key={k}>
                      <td>{tr(k)}</td>
                      <td>
                        {String(
                          (detail.snapshot.before as Record<string, unknown>)[
                            k
                          ] ?? "—",
                        )}
                      </td>
                      <td>{String(v ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detail.kind === "purchaseReturn" &&
              minor(
                state.documents.find((d) => d.id === detail.id)?.due || "0",
              ) > 0n && (
                <button
                  className="button primary"
                  onClick={() => {
                    setSelectedDocument(detail.id);
                    setSelectedUnit(undefined);
                    setDetail(null);
                    setCommand("supplierRefund");
                  }}
                >
                  {tr("supplierRefund")}
                </button>
              )}
            {Object.entries(detail.snapshot)
              .filter(
                ([k, v]) =>
                  v !== null &&
                  typeof v !== "object" &&
                  !k.endsWith("Id") &&
                  k !== "revision" &&
                  (detail.kind !== "stockEdit" ||
                    ["note", "partyName", "originalNumber"].includes(k)),
              )
              .map(([k, v]) => (
                <div className="pnl-row" key={k}>
                  <span>
                    {tr(
                      detail.kind === "purchaseReturn" && k === "refundDue"
                        ? "originalRefundDue"
                        : k,
                    )}
                  </span>
                  <b>{String(v)}</b>
                </div>
              ))}
            {detail.kind !== "stockEdit" && (
              <>
                <p>
                  {tr("total")}: {money(detail.total)}
                </p>
                <p>
                  {tr("due")}: {money(detail.due)}
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {declarationId && (
        <PurchaseDeclaration
          id={declarationId}
          lang={lang}
          onClose={() => setDeclarationId(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
function Empty() {
  const { lang } = useShop();
  return (
    <div className="empty">
      <ReceiptText size={36} strokeWidth={1} />
      <h3>{t("empty", lang)}</h3>
      <p>{t("emptyHelp", lang)}</p>
    </div>
  );
}
