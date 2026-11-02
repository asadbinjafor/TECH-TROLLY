# Final audit remediation — 2 November 2026

The Owner authorized implementation and the normal Git/CI-managed release after the read-only audit of `0e3ba38`. This record separates measured results from remaining operational limits. No real business transaction, identity, password or reset is used for acceptance testing.

## Changes and evidence

| Finding | Implemented response | Verification |
| --- | --- | --- |
| F-01: accepted long product text breaks PDF | Shared bounded typography fitting for oversized product/customer/seller text inside the existing fixed A4 layout; no truncation or changed stored values. Web preview and canonical API renderer use the same fit. | Maximum brand/model 180, color 60 and variant 120 are accepted by real isolated purchase/sale commands; PDF returns 200 and two A4 pages. Cash 1,100, profit 100 and SOLD status reconcile. The PDF service also tests maximum customer/address/seller lengths. Poppler-rendered front inspected. |
| F-02: rotating nonexistent login identities bypasses resource protection | Persisted network-peer budget of 60/minute, maximum eight active password comparisons, indexed/bounded expired authentication-counter cleanup. Existing five-attempt account/PIN protection remains. Caller forwarding headers are not trusted. | Runtime tests rotate names and spoof forwarding headers, verify 429 at the shared budget, persistence across app lifetimes, counter retention and work-slot release after errors. No financial records are created by rejected login tests. |
| F-03: two moderate dependency advisory roots | Exact patched transitive `glob` 14.0.2 and `minimatch` 11.0.1 overrides; TypeORM and Expo application versions retained. | Fresh `npm ci --include=dev`, complete build/typecheck, Android/iOS Hermes exports and Expo Doctor 20/20 pass. Full-workspace and Web/API production dependency audits report zero advisories at verification time. |
| F-04: repeated full-state history transfer | Private authenticated state validators and memory-only same-account client reuse; unchanged requests skip full state/report queries and return a bodyless 304. Changed/initial large snapshots use gzip. Full authorized history/search/stock choices remain available. | In 2,001 documents/1,000 units, a full 3,701,596-byte snapshot transfers as 308,659 gzip bytes (91.7% smaller). Five unchanged reads return 304 with zero body bytes; quiet-loopback median is 16.78 ms. Lower-ID late commits, financial posts, idempotent retries, profile/account/day/release scope and logout races are covered. Optimized same-origin Web proxy reproduces 200 → 304 and anonymous 401 with host-only HttpOnly cookies. |
| F-05: transaction amounts labelled as balances | Contextual paid/received/opening labels in bilingual transaction snapshots; current Dashboard balance labels retain their meaning. | Shared label tests and English/Bengali browser checks of an actual synthetic individual purchase show Bank paid 15,000 / Cash paid 0. At 390px there is no root/dialog horizontal overflow. |
| D-01: conflicting deployment handover | Active Vercel/Render/Supabase setup is stated at the beginning of deployment guidance; original local-only handover is explicitly archived. Bengali normal-deployment instructions updated. | Source documentation review; historical process/data counts are not presented as current readiness. |

The state change fixes repeated unchanged polling rather than introducing a new archive/pagination architecture. Initial and changed responses still contain the full authorized snapshot. The above timings are synthetic loopback measurements, not Free-hosting or physical-phone benchmarks. Large future archives can still justify separately designed incremental/page endpoints without removing existing search/history behavior.

## Checks executed

Tests use the explicitly owned cluster on loopback 55571 and UUID `_test` databases, never a database inferred disposable from configuration. Private artifacts are under ignored `.local/audit-fixes-20261102-154508-7cbc29/`.

- Fresh isolated install: 728 packages; exit 0. Existing npm script-approval notices were not bypassed.
- `npm run build`: shared packages, Nest API and optimized Next Web build pass; 16 routes generated.
- `npm run typecheck`: every workspace passes.
- `npm test`: 89 backend/PostgreSQL/PDF tests pass, zero skipped/cancelled in the final run. An earlier concurrent run competed with both Metro exports and timed out two PDF tests; after those builds completed, the unmodified PDF tests and entire backend suite passed in 28.8 seconds. No timeout or assertion was relaxed.
- `npm run test:hosting`: 45 tests pass, including proxy privacy, cache/account boundaries and in-flight 200/304 logout races.
- Separate Android and iOS Expo exports: pass with the final API-client source; Expo Doctor 20/20. These are bundle checks, not installed native-device acceptance.
- Full `npm audit --json` and Web/API production audit: exit 0, zero advisories at verification time.
- Browser: optimized Web login, masked Dashboard, purchase labels in both languages, mobile invoice fit and actual Download control pass. Downloaded file is a valid two-page A4 PDF. Synthetic balances remain Cash 81,050 / Bank 58,000 / stock 12,000 / customer due 2,000 / supplier payable 7,000 / loan 24,500; net profit 11,550; 20 documents.
- `git diff --check` and the invoice release fingerprint are required before push. No standalone lint script exists in the workspace.

## Operational observation O-01 and limits

Render Free cold starts are an external hosting behavior. The existing approved cron-job.org shop-hours jobs (09:00–24:00 Asia/Dhaka, with pre-opening attempts) and GitHub fallback remain configured as previously recorded. During this task the authenticated cron dashboard is unavailable; current cron execution history/Free-hour quota cannot be certified. Public GitHub metadata shows delayed schedules, so that fallback is not treated as an exact five-minute timer. No paid upgrade, unrelated service suspension or promise of continuous Free uptime is made.

Physical Android/iPhone browsers, installed signed native apps, physical cameras/printers and actual poor mobile networks are not available in this test environment. Browser viewport checks and native bundles do not replace those checks. Initial/changed history size, Free-plan sleep/quota and future dependency advisories remain operational limits, not verified production failures.

## Release safety

Normal pushes target `codex/tech-trolley-production`; Vercel Git and Render After CI Checks Pass handle rollout. Shared invoice changes are paired with the generated backend fingerprint. Migration 013 adds only an authentication expiry index through the existing API startup runner. Before rollout, a verified-TLS read-only production baseline and readable 353,196-byte custom backup capture the existing account/business records. Production financial/password/image writes are excluded from verification. Post-rollout checks must confirm exact API revision, same-origin health, migration 013, RLS/no Data API grants and preservation of captured business/account records.

Release `f1015ed73a9f06bafe39338d36c24e73d9a13951` is live. [Complete Linux CI](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41430498539) succeeds; Vercel reports successful deployment `CjwaY9XsZvB44Cp9MzrQd5PqqZsU`. Both direct API and same-origin Web health report that exact revision. Live Web assets include the new state validator and payment labels. Anonymous state/forged-validator, PDF and image reads return 401. Post-release verified-TLS read-only comparison confirms all 15 captured account/business tables unchanged, 13 applied migrations, 21 RLS tables and zero direct Data API grants. Authenticated production business transactions and physical devices remain untested deliberately; their behavior is verified using the synthetic fixtures described above.
