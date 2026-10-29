# Tech Trolley implementation tracker

Canonical checkout: E:\Taki. Read [docs/progress.md](docs/progress.md) for current implementation/release status, [docs/verification.md](docs/verification.md) for evidence and limitations, and [docs/decisions.md](docs/decisions.md) for unapproved policies. The older E:\razon reference remains read-only; do not apply target updates to it.

Business rules and operating workflows are in [docs/operator-guide.md](docs/operator-guide.md). Money/stock correctness is enforced by PostingService, BigInt minor units, the shop transaction lock, immutable journal/documents, allocations and persisted idempotency. All financial handlers use that transaction boundary. Schema changes use new versioned SQL migrations with checksum tracking, never synchronize/reset.

Before changes inspect Git state, shared contracts, relevant controller/service, both clients and acceptance tests. Preserve draft/pending payload semantics and server ownership of actor/time/pricing/COGS. Keep actual credentials, dumps and business records out of Git.
