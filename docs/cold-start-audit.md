# Cold-start latency follow-up — 2026-10-30

The Owner reported about 70 seconds after idle and asked to reduce the wait while preserving the approved animation and other behavior.

## Shop-hours external monitor — 2026-11-01

This dated section supersedes the original all-day GitHub operation below. Billing/service headers confirm four Free web services sharing 750 hours. After disclosure the Owner chooses every day 09:00-midnight Asia/Dhaka and creates/verifies/logs into their own cron-job.org account. Private billing/per-service evidence stays under .local/cron-readiness-audit-20261101.json.

Two enabled unauthenticated GET jobs use direct Render /health, 30-second timeout and Asia/Dhaka: `*/5 9-23 * * *` and pre-opening `50,55 8 * * *`. No credentials, keys, cookies or business commands are sent. Existing GitHub fallback is narrowed to UTC `2-59/5 3-17 * * *` to avoid scheduled overnight wake-ups. No competing deployment pipeline is added.

The first external cold test fails with "output too large" before actual JSON is available. Direct public health returns exact revision 147fd41 and JSON status ok after 42.527 seconds. An actual cron-job.org warm test then returns 200 OK, application/json, status ok and the same revision in 536 ms. Saved next-execution previews show the intended Dhaka times. This does not verify next morning's wake-up or guarantee punctuality. A first cold response may exceed output/timeout limits; a second pre-opening check follows five minutes later.

The window is about 450 hours in a 30-day month, approximately 460 including pre-warm/idle tails before other traffic, shared services and restarts. A GitHub execution-time guard also skips delayed scheduled checks outside UTC 03-17; explicit manual/push recovery checks remain available. No paid plan, other-service suspension/deletion, app source, DB/schema/password change. Editing/disabling instructions are in manual-deployment-bn.md; private screenshot: .local/cron-health-test-20261101.png.

## Original findings — 2026-10-30

- Render Free stops a service after 15 minutes without inbound traffic. Render documents roughly one minute to start it again. This platform allocation time cannot be removed by changing a browser spinner or a Nest timeout. We did not deliberately suspend the production service to reproduce the Owner's observation.
- An already-awake production sample returned the direct database-backed `/health` in 575 ms and the same-origin Vercel proxy in 2,038 ms. These are individual measurements, not a latency guarantee or a trace of the reported 70 seconds.
- The previous readiness retry delay grew to eight seconds. A ready service could therefore wait up to another eight seconds before the next probe. It now grows from one second to a maximum two-second gap. In-flight request time and browser/network scheduling remain additional factors.
- The Render workspace Billing page showed **1.25 / 750 free instance hours**, **2 MB / 5 GB bandwidth**, Hobby and no payment card on 2026-10-30. Other existing services were not changed. Free hours are shared across the workspace; one continuously running service alone takes at most 744 hours in a 31-day month.
- The GitHub repository is public and its default branch is `codex/tech-trolley-production`, so scheduled workflows on that branch are eligible. Standard public-repository GitHub-hosted runners are free. Vercel Hobby cron runs at most daily and cannot supply a five-minute health schedule.

## Implemented

`Production health` runs a short readiness check every five minutes, offset from the top of the hour. It contacts only the existing public Render `/health`, which also checks the database. Regular incoming checks reduce idle spin-down and move any normal wake-up wait ahead of a user's visit. It does not renew a user session, perform login, read business records or post financial commands.

The monitor uses no secrets, no npm install/build, a standard Ubuntu runner, read-only repository permissions, no persisted checkout credentials, a 110-second bounded readiness window and a three-minute job limit. It verifies actual JSON readiness rather than accepting Render loading HTML or HTTP 200 alone. It is restricted to this exact public repository and skips forks or a later private repository. Workflow changes trigger an immediate check as well as the schedule; manual **Run workflow** is available.

The existing static startup HTML, animation, elapsed time, offline behavior, two-minute browser startup deadline, explicit Retry and single-attempt financial writes remain in place. No Render plan, database schema, password or business record changed.

## Limits and operation

This is best-effort availability monitoring, not an always-on service guarantee. GitHub may delay or drop scheduled jobs; it disables public scheduled workflows after 60 days without repository activity. Render may restart Free services at any time, and its workspace hour/bandwidth limits still apply. A paused Supabase project or suspended service still needs the dashboard remedy. Do not describe a successful warm health sample as a guaranteed future opening time.

Check **GitHub → Actions → Production health** for recent scheduled success and latency. To stop it, choose that workflow's **… → Disable workflow**. Re-enable it there when needed. Recheck schedule/default-branch and hosting quotas if repository visibility, branch, plans or other services change. See the [Bengali manual guide](manual-deployment-bn.md).

Paid Render **service compute** removes idle spin-down; upgrading the workspace plan alone does not. Any paid upgrade remains an explicit Owner decision.

## Verification

Eleven hosting/readiness/monitor tests, the production web build and all workspace typechecks pass. A single isolated, no-database fixture held health unavailable for the same 40 seconds for both client versions: the old client detected recovery after **47,208 ms**, the new client after **41,508 ms** (5,700 ms sooner). This measures retry detection under that fixture, not Render allocation time. The public production monitor also returned verified JSON health in **313 ms** while the service was awake. No financial writes were made.

The deployed 4aeafcd release passed [full CI](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41011309788), including 16 isolated PostgreSQL tests and both native exports. The [first GitHub cloud check](https://github.com/asadbinjafor/TECH-TROLLY/actions/runs/41011309787) verified database readiness in **399 ms**. The existing Owner session reached the production dashboard in **1,872 ms** on a warm reload. Vercel deployment `8xnzizY3bW9QHZrmLZ4JCqXoYgcc` succeeded; the production health workflow is Active on the public default branch. Browser verification did not create or change business records.

Sources: [Render Free](https://render.com/docs/free#spinning-down-on-idle), [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
