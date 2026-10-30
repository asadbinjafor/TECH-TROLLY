// `u` below is one millimetre on the 198 mm printable A4 canvas. Convert it
// to container units so a narrow preview preserves the printed geometry.
const layout = `
.tt-memo,.tt-memo *{box-sizing:border-box}
.tt-memo{width:100%;max-width:198mm;margin:0 auto;color:#292c2a;font-family:Arial,InvoiceBangla,Shop,sans-serif;color-scheme:light}
.tt-memo__page{--mm:.505050505cqw;container-type:inline-size;position:relative;width:100%;aspect-ratio:198/285;background:#fff;margin:0 0 6mm;isolation:isolate;font-size:3.5u;line-height:1.25;box-shadow:0 0 0 1px #ddd;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.tt-memo p,.tt-memo h2,.tt-memo ol,.tt-memo ul{margin:0}
.tt-memo svg{display:block;width:100%;height:100%}
.tt-memo__header{position:absolute;inset:0 0 auto;height:40u}
.tt-memo__logo{position:absolute;left:7u;top:1.5u;width:51u;height:37u}
.tt-memo__brand{position:absolute;left:66u;top:2u;width:86u}
.tt-memo__tech{width:52u;height:11.5u;margin-bottom:1.6u}
.tt-memo__trolley{width:78u;height:14u}
.tt-memo__brand p{font-size:3.65u;font-weight:500;white-space:nowrap;margin-top:1.2u;letter-spacing:-.05u}
.tt-memo__qr-block{position:absolute;right:9.5u;top:1u;width:43u}
.tt-memo__badge{background:#292c29;color:#fff;text-align:center;border-radius:2.4u;height:9u;line-height:9u;font-size:6.1u;font-weight:700;letter-spacing:1.2u}
.tt-memo__qr{width:25u;height:25u;margin:1.2u auto 0;border:.4u solid #ae8b25;padding:.4u;background:white}
.tt-memo__meta{position:absolute;left:7u;right:8.5u;top:42u;display:flex;justify-content:space-between;align-items:center;font-size:3.6u;height:10u}
.tt-memo__meta>div{display:flex;align-items:center;gap:1.5u;white-space:nowrap}
.tt-memo__meta strong{border:.25u dashed #777;min-width:39u;height:9.5u;display:flex;align-items:center;justify-content:center;padding:0 1.7u;font-size:4.5u;font-weight:700}
.tt-memo__meta>div:last-child{font-size:3u;letter-spacing:.3u}
.tt-memo__meta>div:last-child strong{font-size:3.8u;min-width:35u;letter-spacing:0}
.tt-memo__customer{position:absolute;left:7u;right:8.5u;top:55u}
.tt-memo__field{display:grid;grid-template-columns:24u 1fr;align-items:center;height:10u;margin-bottom:1.6u}
.tt-memo__field>span{font-weight:700;letter-spacing:.45u;font-size:3.7u}
.tt-memo__field>strong{border:.23u solid #858982;display:flex;align-items:center;height:100%;padding:.5u 2u;font-family:Arial,InvoiceBangla,Shop,sans-serif;font-weight:400;font-size:3.8u;line-height:1.2;overflow-wrap:anywhere;white-space:pre-line}
.tt-memo__field>strong.tt-memo__value--long{font-size:3u}
.tt-memo__field>strong.tt-memo__value--very-long{font-size:2.2u}
.tt-memo__items{position:absolute;left:6.5u;top:89.5u;width:182u;height:95u;table-layout:fixed;border-collapse:separate;border-spacing:.8u 1.8u;color:#292c2a!important;font:inherit}
.tt-memo__items th{height:10u;background:#30322f!important;color:white!important;text-align:center;font-size:4u;font-weight:700;letter-spacing:0;padding:0;border:0}
.tt-memo__items th:first-child{background:linear-gradient(120deg,#c1a426,#c7a32b 44%,#ac8120)!important;color:#31352d!important}
.tt-memo__items td{height:18.5u;padding:2u 2.5u;background:#e4e5e1!important;border:0;text-align:center;vertical-align:top;font-size:4.2u;overflow-wrap:anywhere;line-height:1.2}
.tt-memo__items td:last-child{font-variant-numeric:tabular-nums;font-size:3.9u;white-space:nowrap}
.tt-memo__items td.tt-memo__price--long{font-size:2.8u}
.tt-memo__items td.tt-memo__description{text-align:left;background:repeating-linear-gradient(to bottom,#e4e5e1 0,#e4e5e1 18.5u,#fff 18.5u,#fff 20.3u)!important;font-size:3.8u}
.tt-memo__model{display:block;font-size:4u;font-weight:500;line-height:1.25}
.tt-memo__details{margin-top:1u;line-height:1.2;font-size:3.55u}
.tt-memo__device-notes{margin-top:1.3u;font-size:2.7u;line-height:1.35}
.tt-memo__description--long .tt-memo__model{font-size:3.25u}
.tt-memo__description--long .tt-memo__details{font-size:3u}
.tt-memo__device{position:absolute;left:7u;top:187u;width:90.5u}
.tt-memo__serial-label{display:flex;gap:6u;font-size:3.25u;font-weight:700;letter-spacing:.2u;height:6u}
.tt-memo__serial-label>span,.tt-memo__condition>span{display:inline-flex;align-items:center;gap:1u}
.tt-memo__check{display:inline-flex;flex-shrink:0;width:3u;height:3u;border:.22u solid #63685f;vertical-align:middle;color:#242823}
.tt-memo__serial{display:flex;height:8u;font-family:Arial,InvoiceBangla,Shop,sans-serif;font-size:4.1u;font-weight:400}
.tt-memo__serial>span{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;border:.22u solid #7e847a;border-right:0}
.tt-memo__serial>span:last-child{border-right:.22u solid #7e847a}
.tt-memo__condition{display:flex;align-items:center;gap:4u;min-height:7u;background:#e4e5e1;margin-top:2.5u;font-size:2.9u;font-weight:700;white-space:nowrap;padding:0 1u}
.tt-memo__condition>b{font-size:3u;border:.2u solid #70766b;line-height:1.1;padding:0 .6u}
.tt-memo__condition .tt-memo__check{width:2.8u;height:2.8u}
.tt-memo__condition--refurbished{font-size:2.15u;gap:1.1u}
.tt-memo__warranty{position:absolute;left:6.5u;top:214u;width:90.5u;height:32u;background:#e0e1dc}
.tt-memo__warranty h2{display:flex;align-items:center;gap:1u;height:6.5u;background:#343732;color:white;font-size:3.9u;letter-spacing:.05u;font-weight:700;padding:0 1.5u;white-space:nowrap}
.tt-memo__warranty h2 svg{width:4.2u;height:4.2u;flex:none}
.tt-memo__warranty ul{list-style:none;padding:1u 1.3u 1u .9u;font-size:2.4u;line-height:1.37;letter-spacing:-.055u}
.tt-memo__warranty li{display:flex;align-items:flex-start;gap:.6u;margin-bottom:.35u}
.tt-memo__warranty li svg{width:2.6u;height:2.6u;flex:none;color:#7b806d;margin-top:.2u}
.tt-memo__accounting{position:absolute;left:114u;right:9.5u;top:187u}
.tt-memo__extra,.tt-memo__total-row{display:grid;grid-template-columns:1fr 1fr;gap:.9u;height:8.2u;margin-bottom:1.4u;font-size:3.2u}
.tt-memo__extra>*{display:flex;align-items:center;justify-content:center;background:#e4e5e1;padding:0 1u;font-weight:400}
.tt-memo__extra{height:7u;font-size:2.9u}
.tt-memo__total-row>*{display:flex;align-items:center;justify-content:center;background:#e4e5e1;padding:0 1u}
.tt-memo__total-row strong{font-size:4.1u;font-weight:400;white-space:nowrap;font-variant-numeric:tabular-nums}
.tt-memo__total-row strong.tt-memo__money--long{font-size:2.8u}
.tt-memo__total-row--gold>span{background:#343732;color:#fff;font-weight:700}
.tt-memo__total-row--gold>strong{background:linear-gradient(120deg,#c5a52b,#b88d1e);color:#292c2a}
.tt-memo__payment{text-align:right;font-size:2.35u;line-height:1.35;margin-top:.6u;font-variant-numeric:tabular-nums}
.tt-memo__authorised{position:absolute;left:154u;right:9.5u;bottom:38u}
.tt-memo__seller{font-family:Arial,InvoiceBangla,Shop,sans-serif;text-align:right;line-height:1.2;font-size:2.4u;overflow-wrap:anywhere;width:74.5u;margin-left:-40u}
.tt-memo__seller>span{display:block;font-size:2.2u;text-transform:uppercase;letter-spacing:.1u}
.tt-memo__seller strong{display:block;font-weight:500;font-size:3u;margin-top:.7u}
.tt-memo__seller--long strong{font-size:2u;line-height:1.1}
.tt-memo__address--long{font-size:2.2u}
.tt-memo__signature{border-top:.22u solid #676e60;margin-top:2u;padding-top:1.2u;font-size:3.6u;text-align:center;white-space:nowrap}
.tt-memo__footer{position:absolute;left:0;right:0;bottom:16u;height:21u;background:#32362f;color:#f1f2ed}
.tt-memo__footer svg{flex-shrink:0;width:8u;height:8u}
.tt-memo__phone{position:absolute;left:6u;top:.9u;display:flex;gap:1.8u;align-items:center}
.tt-memo__phone strong{font-size:6.1u;line-height:1;letter-spacing:.05u}
.tt-memo__address{position:absolute;left:6u;bottom:1.1u;display:flex;align-items:center;gap:1.8u;font-size:3.2u;line-height:1.1;max-width:101u}
.tt-memo__address svg{height:9u;width:8u}
.tt-memo__social{position:absolute;right:5u;bottom:3u;display:flex;align-items:center;gap:2u;font-size:3.8u;white-space:nowrap}
.tt-memo__thanks{position:absolute;bottom:0;left:0;right:0;height:16u;background:linear-gradient(to bottom,#c5a22a 0,#c5a22a 77%,#a9881e 79%,#a9881e 86%,#c5a22a 89%,#c5a22a 96%,#a98212 98%);text-align:center;font-size:5.4u;font-weight:600;padding-top:2.6u;letter-spacing:.1u}
.tt-memo__thanks>span{display:flex;align-items:center;gap:2u;padding:0 2.5u;white-space:nowrap}
.tt-memo__thanks>span:before,.tt-memo__thanks>span:after{content:'';height:.2u;background:#50532e;flex:1}
.tt-memo__terms-title{position:absolute;left:24u;right:24u;top:11u;height:12u;border:.3u dashed #32352f;text-align:center;display:flex;align-items:center;justify-content:center;font-size:5.7u;line-height:1;font-family:Arial,sans-serif;font-weight:700;white-space:nowrap}
.tt-memo__terms{position:absolute;left:5u;right:5u;top:36u;padding:0;list-style:none;font-family:InvoiceBangla,Shop,Arial,sans-serif;font-size:3.55u;line-height:1.52}
.tt-memo__terms li{position:relative;display:flex;align-items:flex-start;gap:1.8u;padding:.7u 1u .7u 0;margin:0 0 1.1u;background:#f1f1ee}
.tt-memo__terms li:nth-child(odd){background:#f8f8f5}
.tt-memo__terms li>svg{flex:none;width:4u;height:4u;margin-top:.7u;color:#40463d}
.tt-memo__terms li>span{flex:1;min-width:0}
.tt-memo__inline-brand{font-family:Arial,sans-serif;font-weight:700;letter-spacing:.5u;font-size:.89em}
.tt-memo__delivery{position:absolute;left:12u;bottom:23.5u;font-size:3.6u}
.tt-memo__delivery>b{display:block;letter-spacing:.65u;font-size:4.4u;font-weight:500;margin-bottom:1.5u}
.tt-memo__delivery>div{display:flex;gap:5u}
.tt-memo__delivery span{display:inline-flex;align-items:center;gap:1u}
.tt-memo__customer-signature{position:absolute;right:10u;bottom:27u;width:52u;border-top:.25u solid #50574c;text-align:center;padding-top:1.4u;font-size:3.8u;white-space:nowrap}
.tt-memo__back-footer{position:absolute;bottom:0;left:0;right:0;height:18u;background:#32362f;display:flex;align-items:center;justify-content:center}
.tt-memo__back-footer svg{width:119u;height:9u}
.tt-memo__sample{position:absolute;left:0;right:0;top:38u;text-align:center;font:700 1.8u Arial,sans-serif;letter-spacing:.3u;color:#8b6518;z-index:2}
.tt-memo__back .tt-memo__sample{top:3u}
.tt-memo__reversed{position:absolute;top:38u;right:6u;z-index:3;color:#a52222;font-weight:700;font-size:2.5u}
@page{size:A4 portrait;margin:6mm}
@media print{
 .tt-memo{width:198mm;max-width:none;margin:0}
 .tt-memo__page{width:198mm;height:285mm;aspect-ratio:auto;margin:0;border:0;box-shadow:none;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
 .tt-memo__page:last-child{break-after:auto;page-break-after:auto}
}
`;
export const invoiceStyles = layout.replace(
  /(-?\d*\.?\d+)u\b/g,
  (_, n: string) => `calc(var(--mm)*${n})`,
);
