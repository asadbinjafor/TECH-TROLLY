# Decisions

Adopted: one shop; OWNER/STAFF only; BDT; Asia/Dhaka; integer minor units (bigint) in PostgreSQL and BigInt arithmetic, decimal strings over HTTP. Single unit per purchase/sale, including individually tracked accessories without fake IMEIs. TypeORM retained; explicit SQL migrations. A singleton shop row serializes financial commands, a conservative correctness choice appropriate for one shop. Immutable journal/documents and linked corrections. Financial posting requires connectivity. Cash/bank only. Explicit Owner contribution extends the prototype and credits equity, never profit.

Unconfirmed and excluded pending policy: stronger profit confidentiality; returns/refunds/exchanges/trade-in/warranty; backdating/period locks; historical stock/dues import; bulk accessory costing/multi-item checkout; dual IMEI/scanning/printers; multiple wallets/branches; offline financial synchronization; taxes/payroll compliance; internal versus public mobile distribution. Recommended initial distribution is an internal Android preview and iOS TestFlight, subject to account/device availability; neither means public publication.

Daily and trailing-seven-day reports remain available to STAFF. They can infer monthly profit from daily results and purchase costs. Monthly capability restriction is not complete financial confidentiality.
