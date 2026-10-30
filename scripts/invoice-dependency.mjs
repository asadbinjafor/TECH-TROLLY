import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function invoiceSourceHash(root) {
  const hash = createHash("sha256");
  for (const file of ["artwork.ts", "index.ts", "styles.ts"])
    hash.update(
      file +
        "\n" +
        readFileSync(
          resolve(root, "packages/invoice/src", file),
          "utf8",
        ).replaceAll("\r\n", "\n") +
        "\n",
    );
  return hash.digest("hex");
}
