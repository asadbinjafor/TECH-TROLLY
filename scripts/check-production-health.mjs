import { setTimeout as pause } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// Public, read-only readiness. No credentials, sessions, or business commands.
export const healthUrl =
  "https://tech-trolley-internal-api.onrender.com/health";

export async function checkProductionHealth({
  fetchImpl = fetch,
  timeoutMs = 110000,
  probeTimeoutMs = 12000,
  retryDelayMs = 2000,
} = {}) {
  const started = performance.now();
  const deadline = AbortSignal.timeout(timeoutMs);
  let attempts = 0;
  while (!deadline.aborted) {
    attempts++;
    try {
      const response = await fetchImpl(healthUrl, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.any([
          deadline,
          AbortSignal.timeout(probeTimeoutMs),
        ]),
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.includes("application/json") &&
        (await response.json())?.status === "ok"
      )
        return {
          status: "ok",
          attempts,
          elapsedMs: Math.round(performance.now() - started),
        };
      await response.body?.cancel();
    } catch {
      // Provider loading HTML and connection timeouts are not readiness.
    }
    try {
      await pause(retryDelayMs, undefined, { signal: deadline });
    } catch {
      break;
    }
  }
  throw new Error(
    "Production database readiness did not recover within the check window.",
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    console.log(JSON.stringify(await checkProductionHealth()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
