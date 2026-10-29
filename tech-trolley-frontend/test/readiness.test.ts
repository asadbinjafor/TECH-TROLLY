import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";
import { createClient, waitForApi, ApiError } from "@tech-trolley/api-client";
async function serverFor(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    base: `http://127.0.0.1:${(server.address() as any).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
test("readiness tolerates provider HTML, unavailable responses and malformed JSON until real database health is ready", async () => {
  const requests: { method: string; path: string }[] = [],
    attempts: number[] = [];
  const server = await serverFor((req, res) => {
    requests.push({ method: req.method!, path: req.url! });
    const n = requests.length;
    res.setHeader("content-type", n === 2 ? "text/html" : "application/json");
    if (n === 1) {
      res.statusCode = 503;
      res.end('{"status":"unavailable"}');
    } else if (n === 2) res.end("<html>Starting your service</html>");
    else if (n === 3) res.end("{broken");
    else if (n === 4) res.end('{"status":"starting"}');
    else res.end('{"status":"ok"}');
  });
  try {
    await waitForApi(server.base, {
      timeoutMs: 1500,
      retryDelayMs: 5,
      attemptTimeoutMs: 200,
      onProgress: (p) => attempts.push(p.attempt),
    });
    assert.deepEqual(attempts, [1, 2, 3, 4, 5]);
    assert.ok(
      requests.every((r) => r.method === "GET" && r.path === "/health"),
    );
  } finally {
    await server.close();
  }
});
test("unavailable startup stops at its deadline, cancellation stops probes, and offline/configuration failures do not loop", async () => {
  let hits = 0,
    mode = "unavailable";
  const server = await serverFor((_req, res) => {
    hits++;
    res.setHeader("content-type", "application/json");
    res.statusCode = 503;
    res.end(
      JSON.stringify(
        mode === "config"
          ? { code: "API_CONFIGURATION_REQUIRED" }
          : { status: "unavailable" },
      ),
    );
  });
  try {
    await assert.rejects(
      waitForApi(server.base, { timeoutMs: 70, retryDelayMs: 10 }),
      (e) => e instanceof ApiError && e.code === "STARTUP_TIMEOUT",
    );
    const afterTimeout = hits;
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(hits, afterTimeout);
    const controller = new AbortController(),
      cancelled = waitForApi(server.base, {
        signal: controller.signal,
        timeoutMs: 1000,
        retryDelayMs: 50,
      });
    setTimeout(() => controller.abort(), 15);
    await assert.rejects(cancelled, (e) => (e as Error).name === "AbortError");
    const afterCancel = hits;
    await new Promise((r) => setTimeout(r, 70));
    assert.equal(hits, afterCancel);
    await assert.rejects(
      waitForApi(server.base, { isOnline: () => false }),
      (e) => e instanceof ApiError && e.code === "OFFLINE",
    );
    assert.equal(hits, afterCancel);
    mode = "config";
    await assert.rejects(
      waitForApi(server.base),
      (e) => e instanceof ApiError && e.code === "API_CONFIGURATION_REQUIRED",
    );
    assert.equal(hits, afterCancel + 1);
  } finally {
    await server.close();
  }
});
test("readiness never replays a financial POST and unexpected provider bodies keep the original submission uncertain", async () => {
  const calls: { method: string; key: string; body: string }[] = [];
  const server = await serverFor((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      calls.push({
        method: req.method!,
        key: String(req.headers["idempotency-key"] || ""),
        body,
      });
      res.setHeader("content-type", "text/html");
      res.end("<html>Starting</html>");
    });
  });
  try {
    const client = createClient(server.base),
      key = "9f7de60b-bf9a-4986-ae0d-45667de480b8";
    await assert.rejects(
      client.command(
        "expense",
        {
          categoryId: "custom",
          expenseName: "Sample",
          amount: "5",
          account: "cash",
          note: "Synthetic only",
        },
        key,
      ),
      (e) => e instanceof ApiError && e.code === "SUBMISSION_UNCERTAIN",
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].key, key);
    assert.equal(JSON.parse(calls[0].body).amount, "5");
  } finally {
    await server.close();
  }
});
test("an unauthenticated read remains a login response rather than a retrying network error", async () => {
  let hits = 0;
  const server = await serverFor((_req, res) => {
    hits++;
    res.statusCode = 401;
    res.setHeader("content-type", "application/json");
    res.end('{"code":"SESSION_EXPIRED"}');
  });
  try {
    await assert.rejects(
      createClient(server.base).me(),
      (e) => e instanceof ApiError && e.status === 401,
    );
    assert.equal(hits, 1);
  } finally {
    await server.close();
  }
});
test("default backoff increases even when no progress listener is attached", async () => {
  const times: number[] = [];
  const server = await serverFor((_req, res) => {
    times.push(Date.now());
    res.setHeader("content-type", "application/json");
    res.statusCode = times.length < 3 ? 503 : 200;
    res.end(
      JSON.stringify({ status: times.length < 3 ? "unavailable" : "ok" }),
    );
  });
  try {
    await waitForApi(server.base, { timeoutMs: 8000 });
    assert.equal(times.length, 3);
    assert.ok(times[1] - times[0] >= 900);
    assert.ok(times[2] - times[1] >= 1800);
  } finally {
    await server.close();
  }
});
