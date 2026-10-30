import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkProductionHealth,
  healthUrl,
} from "./check-production-health.mjs";

test("production health monitor waits for real readiness using only credential-free health GETs", async () => {
  const calls = [];
  const result = await checkProductionHealth({
    retryDelayMs: 1,
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      if (calls.length === 1)
        return new Response("<html>Starting</html>", {
          headers: { "content-type": "text/html" },
        });
      return Response.json({ status: calls.length === 2 ? "starting" : "ok" });
    },
  });
  assert.equal(result.status, "ok");
  assert.equal(result.attempts, 3);
  for (const call of calls) {
    assert.equal(call.url, healthUrl);
    assert.equal(call.method, "GET");
    assert.equal(call.credentials, "omit");
    assert.equal(call.redirect, "error");
    assert.deepEqual(call.headers, { Accept: "application/json" });
    assert.equal(call.body, undefined);
  }
});

test("production health monitor times out, stops probing, and fails instead of claiming readiness", async () => {
  let calls = 0;
  await assert.rejects(
    checkProductionHealth({
      timeoutMs: 40,
      retryDelayMs: 5,
      fetchImpl: async () => {
        calls++;
        return Response.json({ status: "unavailable" }, { status: 503 });
      },
    }),
    /did not recover/,
  );
  assert.ok(calls > 0);
  const stopped = calls;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(calls, stopped);
});
