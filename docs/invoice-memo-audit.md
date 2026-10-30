# Two-sided shop memo audit — 2026-10-30

The Owner supplied a blank front photograph, a reverse-side photograph and a separate QR image, and confirmed A4. The shared web/native print renderer now reproduces the two-sided form: two A4 PDF pages, each with a 198 × 285 mm canvas inside 6 mm page margins. The preview scales as one fixed form on a narrow screen; it does not rearrange the print layout.

## Reference and data mapping

| Reference element | Implementation / source |
| --- | --- |
| White-background trolley logo and two-line TECH / TROLLEY | Vector contours traced from the existing approved brand asset; removed the earlier circular badge presentation |
| Invoice badge and QR | Supplied QR's exact 37 × 37 module grid, with a scan-safe four-module quiet zone |
| Invoice number and date | Existing immutable document number and Bangladesh business date |
| NAME / ADDRESS / CONTACT | Customer values frozen at sale posting; saved-party selection already fills the sale form |
| ITEM NAME | Frozen brand/model, separate storage/color/variant, box/battery details |
| QUANTITY / PRICE | Existing one-unit sale; original price, with a real discount shown in its details when applicable |
| IMEI / SERIAL NO | Actual IMEI or internal stock ID, individually boxed; the corresponding checkbox is selected |
| BRAND NEW / PRE-OWNED | Frozen stock condition; refurbished is explicitly identified |
| EXTRA CHARGE | Zero: the current sale command has no extra-charge amount. No invented charge or financial posting |
| SUB TOTAL / ADVANCE / DUE | Net sale total after discount, cash plus bank paid, original due; later outstanding due and payment split remain visible |
| Seller and AUTHORISED SIGN | Original authenticated Owner/Staff name and role; manual signature line. No copied handwritten signature |
| Warranty box | Owner-supplied English wording, including printed spelling; a new sale snapshots the policy |
| Reverse | All 12 supplied Bengali clauses, dashed title, DELIVERY TYPE, CUSTOMER SIGNATURE and dark wordmark footer |
| ONLINE / OFFLINE | Blank, as on the supplied form: the current transaction has no delivery-type field, so no value is inferred |

The new supplied QR decodes to `https://www.facebook.com/share/1CWzbVs5hb/?mibextid=wwXIfr`, different from the earlier photographed memo. Its module-grid SHA-256 is `3dfa5a614eb2d6ab2727e567a02e02e919322bbe370b0ec15800d42652a43454`. A regression check verifies every module. Historical/custom QR destinations and historical warranty snapshots remain intact; posted documents are not rewritten. The new reverse-side copy is included in new shop snapshots, and older API receipts have an additive print fallback.

The clauses are printed copy only. This release does not create or alter refund, exchange, warranty, BTRC, registration or financial workflows. Existing PostingService transactions, money calculations, idempotency and Staff date restrictions remain unchanged. Product purchase costs do not enter the customer receipt.

## Verification and fidelity

The print layout was rendered and reviewed repeatedly rather than judged only from HTML. The first review caught large-money text exceeding its cell and policy text that needed correction against enlarged reference crops. The final audit covers normal and maximum-length customer/product/seller values at desktop and 390 px widths, verifies no field/section collisions, and prints standalone, actual web print-wrapper and Bengali/long-value variants to two A4 pages. The PDF's QR must decode to the supplied destination.

The supplied references are camera photographs with perspective, lighting, translucent reverse-side bleed and paper curvature. The deliverable is clean printable artwork. A pixel-identical color/font reproduction of a photographed physical sheet cannot be certified from these photos; the original print-design file and a physical printer proof would be required for that claim. The audit does not claim a physical duplex printer or iOS/Android device acceptance test. Web printing shows an A4/two-page/long-edge duplex hint; native shares the same two-page HTML artwork.

The sample PDF is marked PREVIEW / SAMPLE DATA and uses synthetic names, stock IDs and amounts. No synthetic sale, customer or staff record should be created in production to test printing.
