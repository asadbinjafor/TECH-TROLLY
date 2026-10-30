import qrcode from "qrcode-generator";
import {
  decimal,
  minor,
  invoiceShop,
  productDetails,
  type Language,
  type Receipt,
} from "@tech-trolley/contracts";
import {
  memoLogoSvg,
  memoTechSvg,
  memoTrolleySvg,
  memoFooterWordmarkSvg,
  memoQrSvg,
  memoQrUrl,
} from "./artwork";
import { invoiceStyles } from "./styles";
export { invoiceStyles } from "./styles";

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export interface InvoiceAssets {
  /** Retained for older callers; vector brand artwork is embedded. */
  logo?: string;
  font?: string;
  sample?: boolean;
}
const tick =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2 8 4 4L14 2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const check = (active: boolean) =>
  `<span class="tt-memo__check">${active ? tick : ""}</span>`;
const bullet =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="m4 10 4 4 9-11" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const seal =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 0 2 2 3-1 1 3 3 1-1 3 3 2-2 2 2 3-3 1-1 3-3-1-2 3-2-2-3 1-1-3-3-1 1-3-3-2 2-2-1-3 3-1 1-3 3 1z"/><circle cx="12" cy="12" r="6" fill="#363734"/><path d="m8 12 3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const icon = (kind: "phone" | "pin" | "messenger") => {
  const paths = {
    phone:
      '<path d="m7 5 3 4-2 2c1 3 3 5 6 6l2-2 4 3c-1 5-6 4-11-1S3 7 7 5z"/>',
    pin: '<path fill-rule="evenodd" d="M12 3a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7m0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6"/>',
    messenger:
      '<path d="M4 5c5-5 16-3 17 5 1 7-7 12-13 8l-4 2v-5C1 12 1 8 4 5m1 9 6-6 4 3 4-3-6 7-4-3z" fill-rule="evenodd"/>',
  };
  return `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#c7a12a"/><g transform="translate(2 1)" fill="#30322d">${paths[kind]}</g></svg>`;
};
function money(value: string) {
  const [whole, fraction] = decimal(minor(value || "0")).split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === "00" ? "" : "." + fraction) +
    "/="
  );
}
const termsMarkup = (value: string) =>
  esc(value).replaceAll(
    "TECH TROLLEY",
    '<span class="tt-memo__inline-brand">TECH TROLLEY</span>',
  );

export function renderInvoiceBody(
  receipt: Receipt,
  _lang: Language = "en",
  assets: InvoiceAssets = {},
) {
  // Earlier API receipts remain printable during rolling deployment.
  const r = {
    ...receipt,
    shop: { ...invoiceShop(receipt.shop), ...receipt.shop },
    seller: receipt.seller || { id: "", name: "—", role: null },
    paid: receipt.paid ?? decimal(minor(receipt.cash) + minor(receipt.bank)),
  };
  let qrSvg = memoQrSvg;
  if (r.shop.qrUrl !== memoQrUrl) {
    // Historical/custom snapshotted destinations remain intact. New sales use
    // the supplied QR matrix exactly, rather than choosing a different mask.
    const qr = qrcode(0, "M");
    qr.addData(r.shop.qrUrl);
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 3, margin: 12, scalable: true });
  }
  const serial = r.unit.imei || r.unit.internalId || "";
  const serialCells = Array.from(
    { length: Math.max(15, serial.length) },
    (_, i) => `<span>${esc(serial[i] || "")}</span>`,
  ).join("");
  const field = (label: string, value: string | null) =>
    `<div class="tt-memo__field"><span>${label}:</span><strong class="${(value?.length || 0) > 200 ? "tt-memo__value--very-long" : (value?.length || 0) > 100 ? "tt-memo__value--long" : ""}">${esc(value || "")}</strong></div>`;
  const role =
    r.seller.role === "OWNER"
      ? "Owner"
      : r.seller.role === "STAFF"
        ? "Staff"
        : "";
  const details = productDetails(r.unit);
  const longProduct =
    [r.unit.brand, r.unit.model, details].join(" ").length > 110;
  const sample = assets.sample
    ? '<div class="tt-memo__sample">PREVIEW / SAMPLE DATA - NOT A REAL SALE</div>'
    : "";
  const row = (label: string, value: string, gold = false) =>
    `<div class="tt-memo__total-row${gold ? " tt-memo__total-row--gold" : ""}"><span>${label}</span><strong class="${money(value).length > 13 ? "tt-memo__money--long" : ""}">${esc(money(value))}</strong></div>`;
  const address = esc(r.shop.address).replace(
    /,?\s*(Bashundhara City)/i,
    "<br>$1",
  );
  const policy = r.shop.warrantyPolicy
    .map(
      (p) =>
        `<li>${bullet}<span>${esc(p).replace(" To Minimum", "<br>To Minimum")}</span></li>`,
    )
    .join("");
  const afterSales = r.shop.afterSalesTerms
    .map((p) => `<li>${bullet}<span>${termsMarkup(p)}</span></li>`)
    .join("");
  return `<div class="tt-memo" aria-label="Tech Trolley two-sided invoice">
<article class="tt-memo__page tt-memo__front" aria-label="Invoice front">
${sample}${r.reversed ? '<div class="tt-memo__reversed">REVERSED / বাতিল</div>' : ""}
<header class="tt-memo__header"><div class="tt-memo__logo">${memoLogoSvg}</div><div class="tt-memo__brand" aria-label="${esc(r.shop.name)}"><div class="tt-memo__tech">${memoTechSvg}</div><div class="tt-memo__trolley">${memoTrolleySvg}</div><p>TECHNOLOGY | TRUST | TOMORROW</p></div><div class="tt-memo__qr-block"><div class="tt-memo__badge">INVOICE</div><div class="tt-memo__qr" aria-label="Shop Facebook QR code">${qrSvg}</div></div></header>
<div class="tt-memo__meta"><div>INVOICE NO: <strong>${esc(r.number)}</strong></div><div><b>DATE:</b> <strong>${esc(r.date.split("-").reverse().join(" / "))}</strong></div></div>
<div class="tt-memo__customer">${field("NAME", r.customer)}${field("ADDRESS", r.address)}${field("CONTACT", r.phone)}</div>
<table class="tt-memo__items"><colgroup><col style="width:58%"><col style="width:21%"><col style="width:21%"></colgroup><thead><tr><th>ITEM NAME</th><th>QUANTITY</th><th>PRICE</th></tr></thead><tbody><tr><td rowspan="4" class="tt-memo__description${longProduct ? " tt-memo__description--long" : ""}"><strong class="tt-memo__model">${esc([r.unit.brand, r.unit.model].filter(Boolean).join(" "))}</strong><div class="tt-memo__details">${esc(details)}</div><div class="tt-memo__device-notes">${r.unit.battery === null ? "" : "Battery: " + esc(r.unit.battery) + "% · "}${esc(r.unit.box === "with" ? "With box" : r.unit.box === "without" ? "Without box" : r.unit.box)}${minor(r.discount) > 0n ? " · Discount: " + esc(money(r.discount)) : ""}</div></td><td>1</td><td class="${money(r.price).length > 13 ? "tt-memo__price--long" : ""}">${esc(money(r.price))}</td></tr>${Array.from({ length: 3 }, () => '<tr aria-hidden="true"><td></td><td></td></tr>').join("")}</tbody></table>
<section class="tt-memo__device"><div class="tt-memo__serial-label"><span>${check(!!r.unit.imei)}IMEI</span><span>${check(!r.unit.imei)}SERIAL NO</span></div><div class="tt-memo__serial" aria-label="${r.unit.imei ? "IMEI" : "Serial number"}: ${esc(serial)}">${serialCells}</div><div class="tt-memo__condition${r.unit.condition === "refurbished" ? " tt-memo__condition--refurbished" : ""}"><b>${r.unit.category === "phone" ? "SMART PHONE" : r.unit.category === "accessory" ? "ACCESSORY" : "PRODUCT"}</b><span>${check(r.unit.condition === "new")}BRAND NEW</span><span>${check(r.unit.condition === "used")}PRE-OWNED</span>${r.unit.condition === "refurbished" ? "<span>REFURBISHED</span>" : ""}</div></section>
<section class="tt-memo__warranty"><h2>${seal}<span>OUR WARRANTY POLICY:</span></h2><ul>${policy}</ul></section>
<section class="tt-memo__accounting"><div class="tt-memo__extra"><span>EXTRA CHARGE</span><strong>${esc(money("0"))}</strong></div>${row("SUB TOTAL", r.total, true)}${row("ADVANCE", r.paid)}${row("DUE", r.originalDue)}<div class="tt-memo__payment">Cash: ${esc(money(r.cash))} · Bank: ${esc(money(r.bank))}${r.outstandingDue !== r.originalDue ? "<br>CURRENT DUE: " + esc(money(r.outstandingDue)) : ""}</div></section>
<section class="tt-memo__authorised"><div class="tt-memo__seller${r.seller.name.length > 60 ? " tt-memo__seller--long" : ""}" data-seller-role="${esc(r.seller.role || "")}"><span>SOLD BY${role ? " · " + role : ""}</span><strong>${esc(r.seller.name)}</strong></div><div class="tt-memo__signature">AUTHORISED SIGN</div></section>
<footer class="tt-memo__footer"><div class="tt-memo__phone">${icon("phone")}<strong>${esc(r.shop.phone)}</strong></div><div class="tt-memo__address${r.shop.address.length > 100 ? " tt-memo__address--long" : ""}">${icon("pin")}<span>${address}</span></div><div class="tt-memo__social">${icon("messenger")}<span>${esc(r.shop.facebook)}</span></div></footer><div class="tt-memo__thanks"><span>Thank You For Shopping With Us</span></div>
</article>
<article class="tt-memo__page tt-memo__back" aria-label="After-sales terms reverse side" lang="bn">${sample}<h2 class="tt-memo__terms-title">TERMS &amp; CONDITIONS FOR AFTER SALES SERVICE</h2><ol class="tt-memo__terms">${afterSales}</ol><div class="tt-memo__delivery"><b>DELIVERY TYPE</b><div><span>${check(false)}ONLINE</span><span>${check(false)}OFFLINE</span></div></div><div class="tt-memo__customer-signature">CUSTOMER SIGNATURE</div><footer class="tt-memo__back-footer" aria-label="TECH TROLLEY">${memoFooterWordmarkSvg}</footer></article></div>`;
}
export function renderInvoiceHtml(
  receipt: Receipt,
  lang: Language = "en",
  assets: InvoiceAssets = {},
) {
  const font = assets.font
    ? `@font-face{font-family:InvoiceBangla;src:url("${esc(assets.font)}") format("truetype");font-weight:100 900;}`
    : "";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(receipt.number)} - ${esc(receipt.shop.name)}</title><style>${font}html,body{margin:0;padding:0;background:white}${invoiceStyles}</style></head><body>${renderInvoiceBody(receipt, lang, assets)}</body></html>`;
}
