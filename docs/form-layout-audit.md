# Web form layout audit — 2026-10-31

## Result and scope

All ordinary web controls now use `src/components/forms/form-field.tsx` and the shared form tokens in `src/app/globals.css`. The form wrapper contains a real linked label and an independent body containing the control, descriptions, validation and contextual actions. Optional text is inline and comes from the existing validation helpers. Existing translations that already said optional are normalized once at display time. Customer becomes required only under the existing credit-sale rule.

Previously a grid label contained separate text, optional marker, input, warning and button children. Parent row stretching distributed height through those children. The measured New sale controls ranged from 44px to 86.54px, and a paired Storage/stock selector had a 63.8px top mismatch. Reusable two-track subgrids now align label bottoms/control tops; each body keeps its own helper immediately below its control. This also prevents a taller neighbouring textarea from separating an input and its error.

Single-line controls are 48px with 16px text, 14px labels, 8px label spacing, 6px helper spacing, 20px row spacing, 24px column gaps and 8px radii. Two columns require a form container at least 620px wide. Narrow dialogs and browsers without subgrid retain one column. Toolbar search/language, checkboxes and icon buttons keep appropriate compact variants. At widths up to 380px, amount cards use one column to prevent large balances overflowing the page.

No contracts, calculation, financial posting, authentication, database, migration, shared invoice renderer or native source was changed. Field keys, values, handlers, validation, pending storage and posting keys remain in their existing feature code.

## Inspection checklist

| Surface | Inspected / changed | Result |
| --- | --- | --- |
| Login and password entry | Shared labels, autocomplete/required semantics, six widths; Bengali login; password settings | Pass |
| Opening balances | Actual shared `opening` component, empty money defaults | Pass |
| New sale | Android RAM/storage, iPhone without RAM, empty stock help, conditional Customer, blank Discount/Bank, name manager | Pass |
| Supplier and individual purchases | All fields; optional permanent address, date of birth; actual narrow modal at desktop/390px | Pass |
| Stock metadata / supplier return / refund | All three command forms; actual Inventory edit/return dialogs with saved unit context | Pass |
| Expenses | Category and custom expense name, optional details, invalid money errors | Pass |
| Transfer / contribution / withdrawal | Shared command fields and action rows | Pass |
| Customer collection / supplier payment | Shared required selections, contextual managers, payment controls | Pass |
| Personal DUE / repayment | Shared commands, visible search label and filter/action alignment | Pass |
| Staff / advance / repayment / salary | Every shared command; Staff page; Owner editing Staff and Staff's own profile | Pass |
| Cash reconciliation / correction | `cashCount` and `reversal` command fields | Pass |
| Settings | Own profile, conditional current password, shop settings, category add/rename, account create, role/password editors | Pass; editors inspected without changing credentials/roles |
| Contact managers | Add/edit, locked kind, optional phone/address, search, checkbox, nested Customer dialog | Pass |
| Daybook / Reports / Profit | Date label; custom From/To controls; narrow wrapping | Pass |
| Overview | Password reveal/error dialog, focus and keyboard sequence; existing masking retained | Pass |
| Inventory / Purchases / Transactions / Money | Page headings, action wrapping, tables contained within page at 320px | Pass |

All 20 contract kinds were exercised through the actual `CommandForm` in an ignored local audit page: `stockEdit`, `purchaseReturn`, `supplierRefund`, `opening`, `purchase`, `individualPurchase`, `sale`, `collection`, `supplierPayment`, `expense`, `transfer`, `contribution`, `withdrawal`, `loan`, `loanRepayment`, `advance`, `advanceRepayment`, `salary`, `cashCount`, `reversal`. This audit page is not part of the release.

## Browser verification

- 160 final command cases: every kind at 1440px and 390px in both languages and both themes.
- 24 final layout cases: 320/390/430/768/1024/1440px × English/Bengali × light/dark, including empty-stock help, wrapped labels and mixed textarea/input controls.
- All 12 actual workspace pages at 320px, plus desktop page inspection and actual narrow dialogs.
- Read-only DOM measurements verify visible single-line heights of 48px, paired control top/width equality within 1px, linked labels, valid description IDs, unique IDs and no root horizontal overflow. The 112px textarea keeps its own helper and the neighbouring input's error 6px below each control.
- Forced the unsupported-subgrid branch in the ignored QA copy: stable one-column layout at desktop width. This tests the fallback branch, not an old physical browser.
- Invalid money and password errors retain geometry and `aria-invalid`/`aria-describedby`. Keyboard Tab moved from the password control to Cancel; focus remained visible with the existing gold outline. Captured browser warning/error logs were empty.
- Final 320px Money/contact check caught and resolved balance-card overflow. The fieldset's grid count was measured from actual element positions instead of parsing its unresolved computed CSS string.

## Behaviour and PDF verification

Used a task-created UUID PostgreSQL database on loopback port 55432 and local API/web ports 3250/3251. The persistent local shop and production shop were not used for test postings.

A synthetic Android phone costing 1,000 was sold for 1,200, with Cash 1,200 and blank Bank/Discount. Review disabled controls without resizing them. A deliberately failed pre-post response retained the original pending key across reload. Retrying that same key saved exactly one new document. Exact final balances matched: Cash 999,930; Bank 1,001,000; inventory 110; customer due 100; supplier due 100; supplier refund due 50; personal loans 100; advances 100. This sale added gross profit 200 and no customer due. Pending reload retains the existing normalized transport zeros/UI-only-field behavior; this change does not alter that workflow.

The synthetic saved sale's canonical PDF remains two pages; the unchanged blank A4 asset remains one page. No invoice/print source was modified. Existing invoice/form/hosting checks and the full release CI cover purchase declarations and native compatibility.

Local frontend typecheck, production web build and all 30 form/hosting checks pass. Git/CI/live release evidence is recorded in `progress.md` after verification.

## Before / after evidence

Screenshots use only the owned synthetic shop. The before view has empty sources; the after view uses an unavailable stock filter to retain the long helper state.

| View | Before | After |
| --- | --- | --- |
| Desktop | [Before](assets/form-layout/before-desktop.png) | [After](assets/form-layout/after-desktop.png) |
| Mobile | [Before](assets/form-layout/before-mobile.png) | [After](assets/form-layout/after-mobile.png) |

Raw geometry, flow and live results stay in ignored `.local/form-layout-*.json`; no credentials or personal identity files are committed.

## Limits

No unresolved issue was found in the final measured web cases. Responsive desktop-browser testing does not replace physical iOS/Android keyboard, OS date-picker, assistive-technology or printer acceptance. Existing native client visual design is outside this web presentation change; the normal CI builds/typechecks/exports it. Real account changes, production financial commands and physical printing were not performed as audit steps.
