# Back and Close navigation audit — 2026-10-31

## Behaviour

- Every secondary workspace page has a visible, labelled Back button with a minimum 44px target. It returns to the previous in-app page. A directly opened deep link falls back to Dashboard using client-side replacement. Dashboard shows Back when an earlier app page exists; initial Dashboard has no invented previous page.
- Mobile bottom navigation uses Next client links instead of `location.assign`, preserving the mounted shop context and avoiding full document reloads.
- Workspace has a visible close arrow, an outside-tap scrim, Escape and browser Back dismissal. Its navigation area scrolls independently while the close control stays reachable. The closed mobile drawer is hidden/inert; the background is inert while it opens.
- Browser Back first dismisses the most recent dialog or inline detail view. A nested contact manager closes before its purchase/sale form; Review returns to editing before leaving the form. Pending commands remain frozen with their original stored data/key.
- Manual Close consumes its temporary history entry. Page navigation waits for that dismissal and for Next's popstate restoration before routing. Replacing a saved form with a receipt is serialized. Reload cleans obsolete transient entries; Forward does not reopen a dismissed private dialog or leave a dead Back stop.
- Dialog Close targets are 44×44px with sticky headers, dynamic viewport height bounds and safe-area spacing. Scrolling a long form does not hide Close. Modal background scroll is locked and restored; keyboard focus remains within the top modal and returns to its opener. Existing HTML-print rules override the scroll lock.

The navigation coordinator lives under `src/components/navigation`. It merges its small page/layer marker into history state while retaining Next's own state. No financial payloads, passwords, identities or receipt contents enter history. Existing command drafts and persisted idempotency storage are untouched.

## Coverage

| Surface | Checks | Result |
| --- | --- | --- |
| Overview / initial home | Menu dismissal; first-entry home; return from another app page | Pass |
| Daybook, Inventory, New sale, Purchases, Transactions, Money, DUE, Staff, Reports, Profit, Settings | All 11 secondary pages at 1440px and 390px; labelled Back, previous-page return and same document | 22 route cases pass |
| Mobile bottom navigation | Inventory, Daybook, Settings and browser Back | Pass; no document reload |
| Workspace drawer | Close arrow, scrim, Escape, browser Back, route selection and focus return | Pass |
| Forms / nested contacts | Long purchase and individual purchase, sale, expense, nested supplier names; retained draft | Pass |
| Review / uncertain submission | Review Back restores editable amount; close/reopen after simulated pre-post 503 retains amount and original frozen key | Pass; no new financial posting |
| Profiles / receipt | Editor dismisses before Settings page; invoice preview dismisses before Transactions page | Pass |
| Personal DUE | Back closes borrower manager, then selected person's detail, then returns to previous page | Pass |
| Direct links / reload / Forward | Fresh New sale link falls back to Dashboard; reload with nested dialogs; dismissed-dialog Forward | Pass; no dead Back stop |
| Keyboard / short screen | Shift-Tab stays in drawer; Escape restores menu-button focus; 760×320 scroll test | Pass |

24 alignment cases cover 320/390/430/768/1024/1440px in English/Bengali and light/dark. Close stays within the viewport and measures 44×44px; mobile menu Close has the same minimum target. The individual purchase was scrolled over 2,100px while Close remained visible. No root horizontal overflow was measured. The final clean browser run captured no warnings/errors.

A document identity probe was present only in the ignored QA copy. The same DOM marker remained across page links, Back/Forward, menu and bottom navigation; it changed only on deliberately requested reloads. This probe is not included in the release.

Eight regression tests cover page fallback, nested history, manual-close/replacement sequencing, menu route sequencing, reload, React effect replay, immediate route-to-menu interaction and dismissed-dialog Forward. Together with the existing checks, all 38 hosting/form/navigation tests pass. Frontend typecheck and production web build are release gates; full CI also checks API, PostgreSQL/PDF and native compatibility.

The owned `navigation_flow_*_test` shop retained its 12 seeded documents and exact original balances after the UI checks. There were zero additional financial postings. Its canonical sale PDF remains two pages and the unchanged blank A4 form one page. No backend, contracts, database schema, invoice renderer or native source changed.

## Evidence

Only synthetic test data appears in these screenshots:

- [Mobile page Back](assets/navigation/mobile-page-back.png)
- [Workspace Close arrow](assets/navigation/mobile-menu-close.png)
- [Close after scrolling a long form](assets/navigation/mobile-sticky-close.png)

Detailed browser, financial and cloud results are retained in ignored `.local/navigation-*.json`. Normal Git/Vercel release applies; Render's verified API and Supabase schema remain unchanged.

## Limits

The supplied issue is in the mobile website. Existing native React Navigation stack Back and native modal `onRequestClose` handlers were inspected; native screens were not redesigned. No physical iPhone Safari, Android browser, OS gesture, keyboard or signed native-build acceptance was performed. Desktop responsive-browser and history checks do not replace those device checks. Browser Back from an initial Dashboard with no prior in-app page keeps normal browser behaviour; the app does not trap the user in an artificial history loop.
