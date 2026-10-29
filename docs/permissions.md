# Permissions

| Capability | OWNER | STAFF |
| --- | --- | --- |
| Purchases, sales, stock/history, customer receipts | Yes | Yes |
| Expenses and category create/rename/archive/restore | Yes | Yes |
| Customer/supplier settlement, transfers, loans/repayments | Yes | Yes |
| Contributions/drawings, advances/repayments, salary settlement | Yes | Yes |
| Cash counts, daily daybook, daily/trailing-seven-day reports/exports | Yes | Yes |
| Reasoned linked corrections, subject to dependency/funds checks | Yes | Yes |
| Own password change/logout | Yes | Yes |
| Initial opening and shop/account/security administration | Yes | No |
| Create Owner/Staff, reset/deactivate/assign role | Yes | No |
| Current monthly profit capability and its export | Yes | No |

All operations require a live authenticated active account and completion of the initial password change. UI visibility is not the permission boundary. Server services authorize monthly capability before resolving canonical date bounds; query-supplied role/actor/profit fields are rejected. Daily and seven-day capabilities remain valid even when their dates coincide with month-to-date on the first or seventh day. Historical daily reading remains allowed; historical posting is not.

Staff can see daily profit, sale amounts and purchase costs, and can sum them to infer monthly profit. This system therefore enforces a monthly-report capability restriction, not complete profit confidentiality. A stricter policy would require the Owner to remove some existing daily/cost visibility; that policy has not been adopted.
