# Cold-start latency follow-up — 2026-10-30

The Owner reported about 70 seconds after idle and asked to reduce the wait while preserving the approved animation and other behavior.

## Findings

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

Sources: [Render Free](https://render.com/docs/free#spinning-down-on-idle), [GitHub scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
