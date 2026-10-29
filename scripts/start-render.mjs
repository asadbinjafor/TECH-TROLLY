import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const release = spawn(
  process.execPath,
  [join(root, "scripts/release-api.mjs")],
  { cwd: root, stdio: "inherit", env: process.env },
);
release.once("error", () => {
  process.exitCode = 1;
});
release.once("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code || 1;
    return;
  }
  const api = spawn(
    process.execPath,
    [join(root, "tech-trolley-backend/dist/main.js")],
    { cwd: root, stdio: "inherit", env: process.env },
  );
  api.once("error", () => {
    process.exitCode = 1;
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => api.kill(signal));
  api.once("exit", (exitCode) => {
    process.exitCode = exitCode || 0;
  });
});
