# Permissions

| Capability | OWNER | STAFF |
| --- | --- | --- |
| Purchases, sales, all stock and purchase costs | Yes | Yes |
| Transaction history, receipts, declarations and source settlements/corrections | All dates | Today's business-date sources only |
| Expenses and category create/rename/archive/restore | Yes | Yes |
| Customer/supplier settlement, transfers, loans/repayments | Yes | Yes |
| Contributions/drawings, advances/repayments, salary settlement | Yes | Yes |
| Cash counts and today's daybook/report/export | Yes | Yes |
| Earlier daily, trailing-seven-day, monthly and custom-range reports/exports | Yes | No |
| Reasoned linked corrections, subject to dependency/funds checks | Yes | Yes |
| Own password change/logout | Yes | Yes |
| Initial opening and shop/account/security administration | Yes | No |
| One-time historical-accounting onboarding before ordinary opening | Yes | No |
| Create Owner/Staff, reset/deactivate/assign role | Yes | No |
| Current monthly profit capability and its export | Yes | No |

All operations require a live authenticated active account. Mandatory initial password change is disabled by the approved migration 004 policy; voluntary password change remains available. UI visibility is not the permission boundary. The server restricts STAFF reports to the `today` capability and today's Asia/Dhaka business date, including when a week/month/range happens to have identical bounds. Query-supplied role/actor/profit fields are rejected. OWNER can read all valid report dates. Ordinary posting uses today; the Owner-only, chronological historical-onboarding exception is described in [historical-accounts-bn.md](historical-accounts-bn.md). Staff financial posting pauses while that setup is active.

Staff can see today's profit/sale amounts, all stock costs and current operational balances. This is date-based access, not complete profit confidentiality. Earlier committed command status/exact retries retain their existing idempotent results; this does not authorize a new historical posting. A stricter confidentiality policy has not been adopted.
