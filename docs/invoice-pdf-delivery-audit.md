# iPhone PDF delivery audit — 2026-10-30

## Failure and revised acceptance

The second supplied TT-000008 document has four A4 pages. Its metadata identifies iOS 27.2 Quartz PDFContext / Chrome, and it contains the refined typography/watermark from the prior release. The failure therefore remains in the real phone HTML-print path. Prior tests rendered desktop Chromium HTML and could not establish acceptance on this device. This correction changes the delivered format/path rather than claiming another margin-only adjustment fixes iOS pagination.

## Export authority

Authenticated GET /documents/:id/pdf calls the same Owner/Staff/date-scoped receipt read first, then produces a PDF from the shared template and inline licensed Noto Sans Bengali font. It checks print-layout bounds and rejects an invalid result unless it has exactly two A4 portrait pages. Web links use the same-origin /api proxy; its explicit PDF GET/HEAD route preserves bytes, filename and existing cookie rules, bounds size and rejects non-PDF content. Open uses an inline PDF viewer; Download uses attachment. Native writes those bytes to a cache file and passes its URI to Print/Share. The renderer does not use client HTML, user agent or a caller-supplied URL.

One short-lived renderer is active at a time, duplicate reads coalesce, four content-hashed files are cached for ten minutes, and every request is authorized before the cache. Changed due/name/condition/receipt data yields a different key. JavaScript is disabled; all assets are inline and network/file requests are blocked. Workers close after completion. Financial reads remain outside PostingService transactions; no command, journal, data reset, public registration, RLS or cookie-scope change. The browser is loaded only when an authorized PDF is requested. Paid hosting is unchanged.

Pinned API dependencies use [Sparticuz Chromium](https://github.com/Sparticuz/chromium) for Linux and [Puppeteer PDF options](https://pptr.dev/api/puppeteer.pdfoptions), including CSS page size and font readiness. Windows development uses the installed Edge executable in a separate temporary headless context. A Linux CI test exercises the packaged renderer before Render's After CI Checks Pass deployment. PDF parsing validates page count/size; final files retain selectable text/vector artwork. The font is bundled with its OFL license.

## Seller name clarification

The Owner's latest reply asks for whatever name is stored for the selling Owner/Staff, e.g. Taki. Preserve actual saved historical names; only legacy role-default names resolve to the associated seller profile. If that profile is still named Owner or Staff, use that stored display value, centered, rather than blank. Never append role badges or substitute the currently logged-in viewer. Never hardcode the example name or change production profiles to invent it. Entirely unavailable names retain the existing missing-data warning.

## Deployment dependency

The native dashboard automation repeatedly stopped on minimized/user-input guards, and the Owner cannot manually change the filter now. Keep the live and render.yaml included paths unchanged/aligned. Shared template source is fingerprinted into backend src/documents/invoice-version.ts; npm run prepare:invoice-release updates it. CI fails if the committed dependency fingerprint differs, so every valid template edit is paired with a backend-path change already covered by Render's filter. AGENTS.md and the Bengali guide record this. No deploy hook or competing manual-deploy pipeline was added.

## Evidence and limits

The disposable pdf_flow shop tested the actual application Receipt → Download PDF button, not a recreated HTML wrapper. That browser download is two pages, preserves the full front footer, and has the synthetic Owner Taki centered with 0.0 pt error relative to AUTHORISED SIGN. The shared binary client fetched a Staff invoice with its distinct name centered within 0.007 pt. Staff historical PDF reads are rejected before generation/cache, anonymous reads return 401, the authenticated HTTP route returns an attachment with no-store, and byte-preserving proxy tests cover cookies/errors/corrupt responses. Repeat generation and changed seller data exercise coalescing/cache invalidation. Source/read-only production and final live evidence are recorded in progress.md.

The real phone is not remotely controlled, so a physical iPhone tap/print/printer test is not claimed. Acceptance is the exact authenticated downloaded PDF file: two complete A4 pages, checked before delivery, and identical bytes for device user-agent variants. Using the browser's general webpage-print command is outside the new prepared-PDF button path. Existing one-unit sales and finite memo capacity remain unchanged. No production fake purchase/sale/contact/profile test writes.
