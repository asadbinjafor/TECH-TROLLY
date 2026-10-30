import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { invoiceSourceHash } from "./invoice-dependency.mjs";
test("shared invoice changes require an API release dependency covered by Render's existing filters", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const version = readFileSync(
    new URL(
      "../tech-trolley-backend/src/documents/invoice-version.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    version.includes(invoiceSourceHash(root)),
    "Run npm run prepare:invoice-release and commit the API invoice-version.ts with template changes.",
  );
  const manifest = readFileSync(
    new URL("../render.yaml", import.meta.url),
    "utf8",
  );
  assert.ok(manifest.includes("tech-trolley-backend/**"));
});
