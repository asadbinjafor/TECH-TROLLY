import {
  decimal,
  minor,
  type PurchaseDeclaration,
} from "@tech-trolley/contracts";
import { memoLogoSvg, memoFooterWordmarkSvg } from "./artwork";

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (v: string) =>
  decimal(minor(v))
    .replace(/\.00$/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "/=";
export const purchaseStyles = `
@page{size:A4 portrait;margin:6mm}
.tt-purchase,.tt-purchase *{box-sizing:border-box}
.tt-purchase{width:198mm;height:284mm;position:relative;background:#fff;color:#171b1e;font-family:PurchaseBengali,Shop,'Noto Sans Bengali',Arial,sans-serif;padding:12mm 13mm 15mm;overflow:hidden;text-align:left;font-size:11pt;line-height:1.7}
.tt-purchase__brand{height:36mm;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}
.tt-purchase__brand:after{content:'';position:absolute;left:0;right:0;bottom:7mm;border-bottom:.4mm solid #171b1e}
.tt-purchase__logo{height:23mm;width:32mm;background:#fff;z-index:1}
.tt-purchase__logo svg{width:100%;height:100%;filter:grayscale(1) brightness(0)}
.tt-purchase__wordmark{width:65mm;height:8mm;background:#fff;padding:0 2mm;z-index:1}
.tt-purchase__wordmark svg{width:100%;height:100%}
.tt-purchase__wordmark path{fill:#171b1e}
.tt-purchase__date{height:10mm;display:flex;align-items:center;justify-content:flex-end;gap:2mm;font-size:9pt}
.tt-purchase__digits{display:flex;height:7mm}
.tt-purchase__digits span{width:5.3mm;border:.2mm solid #555;border-right:0;text-align:center;line-height:7mm;font-size:11pt;font-weight:700}
.tt-purchase__digits span:last-child{border-right:.2mm solid #555}
.tt-purchase__intro{margin-top:4mm}
.tt-purchase__sentence{display:flex;gap:1.2mm;align-items:baseline;min-height:7mm}
.tt-purchase__fill{flex:1;min-width:0;border-bottom:.35mm dotted #555;font-weight:700;overflow-wrap:anywhere;line-height:1.65;font-size:10pt}
.tt-purchase__phone{font-size:10pt}
.tt-purchase__phone .tt-purchase__fill{font-size:var(--purchase-product-font,10pt);line-height:1.5}
.tt-purchase__terms{margin:0 0 2mm;line-height:1.7;font-size:11pt}
.tt-purchase__payments{font-size:9pt;margin:0 0 3mm}
.tt-purchase__identity{margin-top:2mm}
.tt-purchase__row{display:grid;grid-template-columns:40mm 3mm 1fr;align-items:center;min-height:9.5mm;gap:1mm}
.tt-purchase__value{min-width:0;border-bottom:.35mm dotted #555;padding:0 1mm;overflow-wrap:anywhere;font-size:10pt;font-weight:700;line-height:1.5;white-space:pre-wrap}
.tt-purchase__identity-pair{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:4mm}
.tt-purchase__identity-pair .tt-purchase__row{grid-template-columns:40mm 3mm minmax(0,1fr)}
.tt-purchase__identity-pair .tt-purchase__row:last-child{grid-template-columns:20mm 2mm minmax(0,1fr)}
.tt-purchase__row.address{min-height:13mm}
.tt-purchase__row.address .tt-purchase__value{font-size:9pt}
.tt-purchase__signatures{position:absolute;left:24mm;right:21mm;bottom:18mm;display:flex;justify-content:space-between;gap:30mm;text-align:center;font-size:10pt}
.tt-purchase__signature{width:56mm}
.tt-purchase__signature-space{height:15mm;border-bottom:.3mm solid #333}
.tt-purchase__signature em{display:block;font-size:11pt;font-family:Arial,sans-serif;line-height:1.3}
.tt-purchase__sample{position:absolute;top:7mm;left:0;right:0;text-align:center;font-size:7pt;color:#996b00}
.tt-purchase--compact .tt-purchase__terms{font-size:10pt}
.tt-purchase--compact .tt-purchase__row{min-height:9mm}
.tt-purchase--compact .tt-purchase__value{font-size:8.5pt;line-height:1.45}
.tt-purchase--compact .tt-purchase__row.address{min-height:12mm}
.tt-purchase--compact .tt-purchase__row.address .tt-purchase__value{font-size:8.5pt}
@media screen{.purchase-preview{overflow:auto;background:#e8e9e8;padding:10px}.tt-purchase{flex:none;margin:auto}}
`;

export function renderPurchaseBody(d: PurchaseDeclaration, sample = false) {
  const s = d.seller,
    u = d.unit;
  const model = u.model.toLowerCase().startsWith(u.brand.toLowerCase())
    ? u.model
    : `${u.brand} ${u.model}`;
  const description = [
    model,
    u.phoneType === "android" && u.ram ? "RAM " + u.ram : "",
    u.storage,
    u.color,
    u.variant,
    (
      { new: "নতুন", used: "ব্যবহৃত", refurbished: "রিফারবিশড" } as Record<
        string,
        string
      >
    )[u.condition],
    u.battery === null ? "" : `Battery ${u.battery}%`,
  ]
    .filter(Boolean)
    .join(" · ");
  const supplied = [u.box === "with" ? "বক্সসহ" : "বক্স ছাড়া", u.accessories]
    .filter(Boolean)
    .join(" · ");
  const rows: [string, string, string?][] = [
    ["নাম", s.sellerName],
    ["পিতার নাম", s.fatherName],
    ["মাতার নাম", s.motherName],
    ["মোবাইল নাম্বার", s.sellerPhone],
    ["বর্তমান ঠিকানা", s.presentAddress, "address"],
    ["স্থায়ী ঠিকানা", s.permanentAddress || "", "address"],
    ["নমিনি: নাম", s.nomineeName],
    ["মোবাইল নাম্বার", s.nomineePhone],
  ];
  const [year, month, day] = d.date.split("-");
  const birthDate = s.dateOfBirth
    ? s.dateOfBirth.split("-").reverse().join(" / ")
    : "";
  const identityPair = `<div class="tt-purchase__identity-pair"><div class="tt-purchase__row"><span>এনআইডি/ডিএল</span><span>:</span><span class="tt-purchase__value">${esc(s.identityNumber)}</span></div><div class="tt-purchase__row"><span>জন্মতারিখ</span><span>:</span><span class="tt-purchase__value">${esc(birthDate)}</span></div></div>`;
  const compact =
    description.length > 180 ||
    Object.values(s).some(
      (value) => typeof value === "string" && value.length > 130,
    ) ||
    [s.sellerName, s.fatherName, s.motherName, s.nomineeName].some(
      (value) => value.length > 60,
    );
  return `<article class="tt-purchase${compact ? " tt-purchase--compact" : ""}" aria-label="ফোন ক্রয়পত্র" style="--purchase-product-font:${description.length > 180 ? "8pt" : "10pt"}">
    ${sample ? '<div class="tt-purchase__sample">নমুনা তথ্য · প্রকৃত ক্রয় নয় / SAMPLE ONLY</div>' : ""}
    <header class="tt-purchase__brand"><div class="tt-purchase__logo">${memoLogoSvg}</div><div class="tt-purchase__wordmark">${memoFooterWordmarkSvg}</div></header>
    <div class="tt-purchase__date">তারিখ: <div class="tt-purchase__digits">${(
      day +
      month +
      year
    )
      .split("")
      .map((v) => `<span>${esc(v)}</span>`)
      .join("")}</div></div>
    <div class="tt-purchase__content"><section class="tt-purchase__intro">
      <div class="tt-purchase__sentence tt-purchase__phone">আমি আমার <span class="tt-purchase__fill">${esc(description)}</span></div>
      <div class="tt-purchase__sentence">এর সাথে আছে <span class="tt-purchase__fill">${esc(supplied)}</span></div>
      <div class="tt-purchase__sentence">IMEI <span class="tt-purchase__fill">${esc(u.imei)}</span></div>
      <div class="tt-purchase__sentence">যার মূল্য <span class="tt-purchase__fill">${esc(money(d.total))}</span> Tech Trolley এর</div>
      <p class="tt-purchase__terms">নিকট বিক্রয় করিলাম। ${esc(d.terms)}</p>
      <p class="tt-purchase__payments">নগদ: <strong>${esc(money(d.cash))}</strong> · ব্যাংক: <strong>${esc(money(d.bank))}</strong> · বাকি: <strong>${esc(money(d.originalDue))}</strong></p>
    </section>
    <section class="tt-purchase__identity">${rows.map(([label, value, cls], index) => `${index === 6 ? identityPair : ""}<div class="tt-purchase__row ${cls || ""}"><span>${esc(label)}</span><span>:</span><span class="tt-purchase__value">${esc(value)}</span></div>`).join("")}</section></div>
    <footer class="tt-purchase__signatures">
      <div class="tt-purchase__signature"><div class="tt-purchase__signature-space"></div><div>ক্রেতার স্বাক্ষর</div><em>Tech Trolley</em></div>
      <div class="tt-purchase__signature"><div class="tt-purchase__signature-space"></div><div>বিক্রেতার স্বাক্ষর</div></div>
    </footer>
  </article>`;
}
export function renderPurchaseHtml(
  d: PurchaseDeclaration,
  assets: { font?: string; sample?: boolean } = {},
) {
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(d.number)} - Phone purchase</title><style>html,body{margin:0;padding:0}${assets.font ? `@font-face{font-family:PurchaseBengali;src:url('${assets.font}') format('truetype');font-display:block}` : ""}${purchaseStyles}</style></head><body>${renderPurchaseBody(d, assets.sample)}</body></html>`;
}

// Shared by browser preview and the script-disabled canonical renderer via
// page.evaluate. Use actual font geometry; never clip filled identity fields or
// consume the two reserved handwritten-signature areas to force one page.
export async function fitPurchaseLayout() {
  await document.fonts.ready;
  const root = document.querySelector(".tt-purchase") as HTMLElement | null;
  const content = root?.querySelector(
    ".tt-purchase__content",
  ) as HTMLElement | null;
  const identity = root?.querySelector(".tt-purchase__identity");
  const signatures = root?.querySelector(".tt-purchase__signatures");
  if (!root || !content || !identity || !signatures) return false;
  for (let step = 0; step <= 10; step++) {
    content.style.zoom = String(1 - step * 0.02);
    if (
      identity.getBoundingClientRect().bottom + 6 <
        signatures.getBoundingClientRect().top &&
      root.scrollHeight <= root.clientHeight + 1 &&
      Array.from(
        root.querySelectorAll(".tt-purchase__value,.tt-purchase__fill"),
      ).every((element) => element.scrollWidth <= element.clientWidth + 1)
    )
      return true;
  }
  return false;
}
