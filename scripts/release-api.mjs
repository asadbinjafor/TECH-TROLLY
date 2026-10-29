import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(root, "tech-trolley-backend/dist", file)],
      { cwd: root, stdio: "inherit", env: process.env },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Release step failed")),
    );
  });
}
try {
  await run("database/migrate.js");
  await run("auth/bootstrap.js");
} catch {
  console.error(
    "API release failed. Check migration/bootstrap configuration; business data was not reset.",
  );
  process.exitCode = 1;
}
