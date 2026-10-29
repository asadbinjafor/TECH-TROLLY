# Reference structure audit — 2026-10-30

Inspected read-only: E:\razon\Tech-Trolley-Mobile-Shop-Inventory-and-Internal-Sales-Management-System.
Read AGENTS.md, tracker sections 14–16, PROJECT_REVIEW.md, manifests, source tree, app.module.ts, inventory entity, sales service, frontend shell/CSS, migration/test paths and Git status.
Reference branch main has untracked audit documents. No reference files, dependencies or Git state were changed.

| Observed source | Target | Decision |
| --- | --- | --- |
| tech-trolley-backend/src/main.ts, app.module.ts | Same paths | NestJS modular application |
| backend src/auth,users,shop,inventory,purchases,sales,accounts,expenses,reports | Same domain directories | Replace unsafe behavior with confirmed business rules |
| backend src/<domain>/{entities,dtos}, *.service/controller/module.ts | Same conventions | Shared transport schemas extend DTO validation |
| backend migrations/*.sql and test/ | Same paths | Versioned runner and isolated integration tests added |
| tech-trolley-frontend/src/app | Same path | Next.js App Router |
| frontend src/features,components,contexts,services,utils | Same paths | Feature screens and authenticated API client |
| frontend public/tech-trolley-logo.png | Same path | Existing approved brand asset |
| separate npm manifests/lockfiles | root npm workspace, one package-lock.json | Preserve npm; consolidate locking for three clients |
| README.md, tracker.md | Same root paths plus docs/ | Resumable progress and handover |
| No native app | tech-trolley-mobile/ | Smallest matching app-name extension; native screens |
| No shared packages or deployment runner | packages/{contracts,api-client,i18n,design-tokens}, scripts/, infra/ | Required shared contracts, native design/localization and portable deployment |

No apps/web or apps/api scaffold is substituted. No .git, .env, records, dependencies or generated output copied.
TypeORM is retained as the established ORM. Automatic synchronize is disabled; all schema changes are explicit versioned migrations.
