import qrcode from "qrcode-generator";
import {
  decimal,
  minor,
  invoiceShop,
  productDetails,
  type Language,
  type Receipt,
} from "@tech-trolley/contracts";
import { t } from "@tech-trolley/i18n";

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

const labels = {
  invoice: ["INVOICE", "ইনভয়েস"],
  number: ["INVOICE NO", "ইনভয়েস নং"],
  date: ["DATE", "তারিখ"],
  name: ["NAME", "নাম"],
  address: ["ADDRESS", "ঠিকানা"],
  contact: ["CONTACT", "ফোন"],
  item: ["ITEM NAME", "পণ্যের নাম"],
  quantity: ["QUANTITY", "পরিমাণ"],
  price: ["PRICE", "মূল্য"],
  subtotal: ["SUB TOTAL", "সাব টোটাল"],
  discount: ["DISCOUNT", "ছাড়"],
  total: ["TOTAL", "সর্বমোট"],
  paid: ["ADVANCE / PAID", "অগ্রিম / পরিশোধিত"],
  due: ["DUE AT SALE", "বিক্রির সময় বাকি"],
  outstanding: ["CURRENT DUE", "বর্তমান বাকি"],
  warranty: ["OUR WARRANTY POLICY", "আমাদের ওয়ারেন্টি নীতিমালা"],
  soldBy: ["SOLD BY", "বিক্রয় করেছেন"],
  signature: ["AUTHORISED SIGN", "অনুমোদিত স্বাক্ষর"],
  thankYou: [
    "Thank You For Shopping With Us",
    "আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ",
  ],
  walkIn: ["Walk-in customer", "সাধারণ ক্রেতা"],
  device: ["SMART PHONE", "স্মার্টফোন"],
  accessory: ["ACCESSORY", "অ্যাকসেসরি"],
  product: ["PRODUCT", "পণ্য"],
  brandNew: ["BRAND NEW", "নতুন"],
  preOwned: ["PRE-OWNED", "ব্যবহৃত"],
  refurbished: ["REFURBISHED", "রিফারবিশড"],
} as const;
type Label = keyof typeof labels;

export interface InvoiceAssets {
  logo?: string;
  font?: string;
  sample?: boolean;
}

export const invoiceStyles = `
.tt-invoice,.tt-invoice *{box-sizing:border-box}
.tt-invoice{--memo-gold:#d6a21c;--memo-dark:#292b2d;--memo-line:#d9d9d6;width:100%;max-width:780px;margin:0 auto;background:#fff;color:#242526;font-family:Arial,Shop,InvoiceBangla,sans-serif;font-size:13px;line-height:1.45;padding:27px 26px 0;border:1px solid #deded8;isolation:isolate;color-scheme:light}
.tt-invoice p{margin:0}
.tt-invoice h1,.tt-invoice h2{margin:0;color:inherit}
.tt-invoice__header{display:grid;grid-template-columns:112px minmax(0,1fr) 105px;gap:23px;align-items:center;padding-bottom:22px;border-bottom:3px solid var(--memo-gold)}
.tt-invoice__logo{width:108px;height:108px;object-fit:contain;border-radius:50%}
.tt-invoice__brand{font-size:33px;line-height:1.13;font-weight:800;letter-spacing:5px;overflow-wrap:anywhere;text-transform:uppercase}
.tt-invoice__tagline{font-size:9px;letter-spacing:1.2px;margin-top:9px!important;white-space:nowrap}
.tt-invoice__badge{background:var(--memo-dark);color:#fff;border-radius:6px;font-size:17px;font-weight:700;letter-spacing:2px;text-align:center;padding:5px 7px;margin-bottom:7px}
.tt-invoice__qr{width:86px;height:86px;margin:auto;padding:3px;border:1px solid var(--memo-gold);border-radius:4px}
.tt-invoice__qr svg{width:100%;height:100%;display:block}
.tt-invoice__meta{display:flex;justify-content:space-between;gap:15px;padding:18px 0 14px;font-size:11px}
.tt-invoice__meta strong{font-size:15px;letter-spacing:.5px;border-bottom:1px dotted #92918a;min-width:135px;display:inline-block;padding:0 8px}
.tt-invoice__customer{display:grid;gap:7px;margin-bottom:17px}
.tt-invoice__field{display:grid;grid-template-columns:81px minmax(0,1fr);align-items:baseline;gap:10px}
.tt-invoice__label{font-size:10px;font-weight:700;letter-spacing:1.1px}
.tt-invoice__value{border:1px solid var(--memo-line);padding:6px 10px;min-height:31px;overflow-wrap:anywhere;white-space:pre-line}
.tt-invoice__items{width:100%;border-collapse:collapse;table-layout:fixed;color:#242526!important;font:inherit}
.tt-invoice__items th,.tt-invoice__items td{border:1px solid #fff;padding:10px 12px;text-align:left;overflow-wrap:anywhere}
.tt-invoice__items th{background:var(--memo-dark)!important;color:#fff!important;font-size:12px;font-weight:700;letter-spacing:.6px}
.tt-invoice__items th:first-child{background:var(--memo-gold)!important;color:#202124!important;width:60%}
.tt-invoice__items th:nth-child(2){width:15%;text-align:center}
.tt-invoice__items th:last-child{width:25%;text-align:right}
.tt-invoice__items td{background:#f0f0ed!important;border-color:#fff!important;vertical-align:top;height:36px}
.tt-invoice__items td:nth-child(2){text-align:center}
.tt-invoice__items td:last-child{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tt-invoice__product{font-size:16px;font-weight:700;display:block;margin-bottom:5px}
.tt-invoice__variant{display:block;color:#575952;font-size:11px;margin-top:4px}
.tt-invoice__blank td{height:29px;background:#f5f5f2!important}
.tt-invoice__bottom{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:24px;margin-top:19px;align-items:start}
.tt-invoice__serial-label{font-size:10px;font-weight:700;letter-spacing:.7px;margin-bottom:7px!important}
.tt-invoice__serial{display:flex;flex-wrap:wrap;margin-bottom:11px;font-size:16px;font-family:monospace;font-weight:700}
.tt-invoice__serial span{display:block;flex:1;min-width:0;max-width:24px;height:27px;line-height:26px;text-align:center;border:1px solid #a6a59d;border-right:0}
.tt-invoice__serial span:last-child{border-right:1px solid #a6a59d}
.tt-invoice__condition{display:flex;flex-wrap:wrap;gap:6px 12px;padding:7px 9px;background:#e7e7df!important;font-size:9px;font-weight:700;margin-bottom:15px}
.tt-invoice__check{display:inline-block;border:1px solid #777;width:9px;height:9px;vertical-align:baseline;margin-right:3px;text-align:center;line-height:8px}
.tt-invoice__warranty h2{font-size:12px;color:#fff;background:var(--memo-dark)!important;padding:7px 10px;letter-spacing:.4px}
.tt-invoice__warranty ul{list-style:none;margin:0;padding:9px 10px 9px 16px;background:#efefea!important;font-size:9px;line-height:1.5}
.tt-invoice__warranty li{position:relative;margin-bottom:5px;padding-left:10px}
.tt-invoice__warranty li:before{content:'✓';position:absolute;left:-3px;color:#8b6815;font-weight:700}
.tt-invoice__totals{display:grid;gap:4px;font-size:11px}
.tt-invoice__total-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(83px,1fr);gap:4px;font-variant-numeric:tabular-nums}
.tt-invoice__total-row span,.tt-invoice__total-row strong{padding:8px 10px;background:#ededeb!important}
.tt-invoice__total-row strong{text-align:right;white-space:nowrap;font-size:13px}
.tt-invoice__total-row--gold span{background:var(--memo-dark)!important;color:#fff!important}
.tt-invoice__total-row--gold strong{background:var(--memo-gold)!important;color:#202124!important}
.tt-invoice__payment{font-size:9px;color:#64645c;text-align:right;margin:8px 0 0!important}
.tt-invoice__seller{margin-top:23px;padding-top:11px;border-top:1px solid var(--memo-line);font-size:10px}
.tt-invoice__seller strong{font-size:15px;display:block;margin-top:3px;overflow-wrap:anywhere}
.tt-invoice__role{display:block;margin-top:2px;color:#616258}
.tt-invoice__signature{margin-top:25px;padding-top:8px;border-top:1px solid #72736a;text-align:center;letter-spacing:.7px;font-size:10px}
.tt-invoice__footer{margin:22px -26px 0;padding:14px 22px;background:var(--memo-dark)!important;color:#fff!important;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:9px;font-size:10px;align-items:center}
.tt-invoice__phone{font-size:23px!important;font-weight:700;letter-spacing:.4px;color:#fff!important}
.tt-invoice__footer-address{font-size:10px!important;color:#dedfd9!important;margin-top:3px!important;overflow-wrap:anywhere}
.tt-invoice__social{color:#fff;text-align:right;font-size:11px!important;overflow-wrap:anywhere}
.tt-invoice__thanks{background:var(--memo-gold)!important;color:#222!important;text-align:center;margin:0 -26px;padding:9px;font-weight:700;letter-spacing:.8px;font-size:13px}
.tt-invoice__notice{padding:6px 9px;border:1px solid #9f3131;color:#9f3131;font-weight:700;text-align:center;margin-bottom:12px}
.tt-invoice__sample{background:#fff2c4;color:#694e00;text-align:center;padding:5px;font-size:10px;letter-spacing:1px;font-weight:700;margin-bottom:12px}
@media(max-width:600px){
  .tt-invoice{padding:18px 14px 0;font-size:10px}
  .tt-invoice__header{grid-template-columns:66px minmax(0,1fr) 70px;gap:10px}
  .tt-invoice__logo{width:64px;height:64px}.tt-invoice__brand{font-size:21px;letter-spacing:2px}
  .tt-invoice__tagline{font-size:6px;letter-spacing:.1px}.tt-invoice__badge{font-size:11px;letter-spacing:1px}
  .tt-invoice__qr{width:65px;height:65px}.tt-invoice__meta{font-size:8px;gap:7px}
  .tt-invoice__meta strong{font-size:11px;min-width:84px;padding:0 3px}
  .tt-invoice__field{grid-template-columns:62px minmax(0,1fr);gap:5px}
  .tt-invoice__label{font-size:8px;letter-spacing:.4px}.tt-invoice__value{padding:5px 6px;min-height:27px}
  .tt-invoice__items th,.tt-invoice__items td{padding:7px 5px;font-size:10px}
  .tt-invoice__items th:nth-child(2){font-size:8px;letter-spacing:0;white-space:nowrap}
  .tt-invoice__product{font-size:12px}.tt-invoice__variant{font-size:9px}.tt-invoice__bottom{gap:11px}
  .tt-invoice__serial span{min-width:0;height:22px;line-height:21px;font-size:11px}
  .tt-invoice__condition{font-size:7px;padding:6px;gap:4px}
  .tt-invoice__warranty h2{font-size:9px;padding:6px}.tt-invoice__warranty ul{font-size:7px;padding:7px}
  .tt-invoice__total-row{grid-template-columns:minmax(0,1fr) minmax(56px,1fr);font-size:8px}
  .tt-invoice__total-row span,.tt-invoice__total-row strong{padding:7px 5px}.tt-invoice__total-row strong{font-size:10px}
  .tt-invoice__payment{font-size:7px}.tt-invoice__seller strong{font-size:11px}
  .tt-invoice__footer{margin:18px -14px 0;padding:12px;font-size:8px;gap:10px}
  .tt-invoice__phone{font-size:17px!important}.tt-invoice__footer-address{font-size:8px!important}
  .tt-invoice__social{font-size:8px!important}.tt-invoice__thanks{margin:0 -14px;font-size:10px}
}
@media print{
  .tt-invoice{-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:none;min-height:267mm;display:flex;flex-direction:column;border:0;font-size:11px;padding:10px 20px 0;break-inside:avoid}
  .tt-invoice__header{grid-template-columns:90px minmax(0,1fr) 90px;gap:18px;padding-bottom:14px}
  .tt-invoice__brand{font-size:30px}.tt-invoice__logo{width:86px;height:86px}
  .tt-invoice__qr{width:74px;height:74px}.tt-invoice__badge{font-size:15px;margin-bottom:4px}
  .tt-invoice__sample{font-size:8px;padding:3px;margin-bottom:6px}
  .tt-invoice__meta{padding:12px 0 10px;font-size:10px}.tt-invoice__meta strong{font-size:14px}
  .tt-invoice__customer{gap:6px;margin-bottom:12px}.tt-invoice__value{min-height:28px;padding:5px 8px}
  .tt-invoice__items th,.tt-invoice__items td{padding:8px 10px}.tt-invoice__product{font-size:14px}
  .tt-invoice__blank td{height:26px;padding:0}.tt-invoice__bottom{margin-top:14px;gap:18px}
  .tt-invoice__warranty h2{font-size:11px}.tt-invoice__warranty ul{font-size:10.5px;line-height:1.45}
  .tt-invoice__total-row span,.tt-invoice__total-row strong{padding:6px 8px}.tt-invoice__total-row strong{font-size:12px}
  .tt-invoice__seller{margin-top:15px;padding-top:9px}.tt-invoice__signature{margin-top:20px}
  .tt-invoice__footer{margin:16px -20px 0;padding:12px 20px;margin-top:auto}
  .tt-invoice__thanks{margin-left:-20px;margin-right:-20px;font-size:12px}
  .tt-invoice__items thead{display:table-header-group}.tt-invoice__items tr{break-inside:avoid}
}
`;

export function renderInvoiceBody(
  receipt: Receipt,
  lang: Language = "en",
  assets: InvoiceAssets = {},
) {
  // Tolerate receipts from an earlier API while web and API deployments roll out.
  const r = {
    ...receipt,
    shop: { ...invoiceShop(receipt.shop), ...receipt.shop },
    seller: receipt.seller || { id: "", name: "—", role: null },
    paid: receipt.paid ?? decimal(minor(receipt.cash) + minor(receipt.bank)),
  };
  const label = (key: Label) => labels[key][lang === "bn" ? 1 : 0];
  const cash = (value: string) => {
    const canonical = decimal(minor(value || "0"));
    const [whole, fraction] = canonical.split(".");
    const formatted =
      whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      (fraction === "00" ? "" : "." + fraction);
    return "৳ " + formatted;
  };
  const qr = qrcode(0, "M");
  qr.addData(r.shop.qrUrl);
  qr.make();
  const qrSvg = qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true });
  const row = (title: string, value: string, gold = false) =>
    `<div class="tt-invoice__total-row${gold ? " tt-invoice__total-row--gold" : ""}"><span>${esc(title)}</span><strong>${esc(cash(value))}</strong></div>`;
  const field = (title: string, value: string | null) =>
    `<div class="tt-invoice__field"><span class="tt-invoice__label">${esc(title)}:</span><span class="tt-invoice__value">${esc(value || "—")}</span></div>`;
  const date = r.date.split("-").reverse().join(" / ");
  const serial = r.unit.imei || r.unit.internalId;
  const condition = (value: string, text: string) =>
    `<span><span class="tt-invoice__check">${r.unit.condition === value ? "✓" : ""}</span>${esc(text)}</span>`;
  const role = r.seller.role ? t(r.seller.role, lang) : "";
  return `<article class="tt-invoice" aria-label="${esc(label("invoice"))}">
${assets.sample ? '<div class="tt-invoice__sample">PREVIEW / SAMPLE DATA - NOT A REAL SALE</div>' : ""}
${r.reversed ? `<div class="tt-invoice__notice">${esc(t("reversed", lang))}</div>` : ""}
<div class="tt-invoice__header"><img class="tt-invoice__logo" src="${esc(assets.logo || "/tech-trolley-logo.png")}" alt="Tech Trolley logo"><div><h1 class="tt-invoice__brand">${esc(r.shop.name).replace(/ /g, "<br>")}</h1><p class="tt-invoice__tagline">TECHNOLOGY | TRUST | TOMORROW</p></div><div><div class="tt-invoice__badge">${esc(label("invoice"))}</div><div class="tt-invoice__qr" aria-label="Shop Facebook QR code">${qrSvg}</div></div></div>
<div class="tt-invoice__meta"><div>${esc(label("number"))}: <strong>${esc(r.number)}</strong></div><div>${esc(label("date"))}: <strong>${esc(date)}</strong></div></div>
<div class="tt-invoice__customer">${field(label("name"), r.customer || label("walkIn"))}${field(label("address"), r.address)}${field(label("contact"), r.phone)}</div>
<table class="tt-invoice__items"><thead><tr><th>${esc(label("item"))}</th><th>${esc(label("quantity"))}</th><th>${esc(label("price"))}</th></tr></thead><tbody><tr><td><span class="tt-invoice__product">${esc([r.unit.brand, r.unit.model].filter(Boolean).join(" "))}</span><span>${esc(productDetails(r.unit))}</span><span class="tt-invoice__variant">${esc(t(r.unit.box, lang))}${r.unit.battery === null ? "" : " · " + esc(t("battery", lang)) + ": " + esc(r.unit.battery) + "%"}</span></td><td>1</td><td>${esc(cash(r.price))}</td></tr>${Array.from({ length: 3 }, () => '<tr class="tt-invoice__blank" aria-hidden="true"><td>&nbsp;</td><td></td><td></td></tr>').join("")}</tbody></table>
<div class="tt-invoice__bottom"><div><p class="tt-invoice__serial-label">${r.unit.imei ? "IMEI" : "SERIAL / INTERNAL NO"}</p><div class="tt-invoice__serial">${Array.from(
    serial,
  )
    .map((char) => `<span>${esc(char)}</span>`)
    .join(
      "",
    )}</div><div class="tt-invoice__condition"><span>${esc(label(r.unit.category === "accessory" ? "accessory" : r.unit.category === "phone" ? "device" : "product"))}</span>${condition("new", label("brandNew"))}${condition("used", label("preOwned"))}${r.unit.condition === "refurbished" ? condition("refurbished", label("refurbished")) : ""}</div><div class="tt-invoice__warranty"><h2>${esc(label("warranty"))}</h2><ul>${r.shop.warrantyPolicy.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div></div>
<div><div class="tt-invoice__totals">${row(label("subtotal"), r.price, true)}${minor(r.discount) > 0n ? row(label("discount"), r.discount) + row(label("total"), r.total, true) : ""}${row(label("paid"), r.paid)}${row(label("due"), r.originalDue)}${r.outstandingDue !== r.originalDue ? row(label("outstanding"), r.outstandingDue) : ""}</div><p class="tt-invoice__payment">${esc(t("cashAccount", lang))}: ${esc(cash(r.cash))} · ${esc(t("bankAccount", lang))}: ${esc(cash(r.bank))}</p><div class="tt-invoice__seller"><span class="tt-invoice__label">${esc(label("soldBy"))}</span><strong>${esc(r.seller.name)}</strong>${role ? `<span class="tt-invoice__role">${esc(role)}</span>` : ""}</div><div class="tt-invoice__signature">${esc(label("signature"))}</div></div></div>
<div class="tt-invoice__footer"><div><p class="tt-invoice__phone">${esc(r.shop.phone)}</p><p class="tt-invoice__footer-address">${esc(r.shop.address)}</p></div><p class="tt-invoice__social">${esc(r.shop.facebook)}</p></div><div class="tt-invoice__thanks">${esc(label("thankYou"))}</div></article>`;
}

export function renderInvoiceHtml(
  receipt: Receipt,
  lang: Language = "en",
  assets: InvoiceAssets = {},
) {
  const font = assets.font
    ? `@font-face{font-family:InvoiceBangla;src:url("${esc(assets.font)}") format("truetype");font-weight:100 900;}`
    : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(receipt.number)} - ${esc(receipt.shop.name)}</title><style>${font}html,body{margin:0;padding:0;background:white}${invoiceStyles}@page{size:A4 portrait;margin:10mm}@media print{body{margin:0}.tt-invoice{width:100%}}</style></head><body>${renderInvoiceBody(receipt, lang, assets)}</body></html>`;
}
