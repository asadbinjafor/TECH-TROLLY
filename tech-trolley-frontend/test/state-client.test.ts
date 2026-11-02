import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createClient } from "@tech-trolley/api-client";

for (const status of [200, 304])
  test(`an in-flight ${status} response cannot restore private state after logout`, async () => {
    const tag = 'W/"tt-state-' + "a".repeat(64) + '"';
    let acknowledge!: () => void, finish!: () => void;
    const waiting = new Promise<void>((r) => {
      acknowledge = r;
    });
    const server = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url !== "/shop/state") {
        res.end("{}");
        return;
      }
      res.setHeader("etag", tag);
      if (req.headers["if-none-match"]) {
        finish = () => {
          res.statusCode = status;
          res.end(
            status === 200 ? '{"user":{"id":"owner"},"units":[]}' : undefined,
          );
        };
        acknowledge();
        return;
      }
      res.end('{"user":{"id":"owner"},"units":[]}');
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const client = createClient(
      `http://127.0.0.1:${(server.address() as any).port}`,
    );
    try {
      await client.state();
      const pending = client.state();
      await waiting;
      await client.logout();
      finish();
      await assert.rejects(pending, (e: any) => e.code === "SESSION_EXPIRED");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

test("state validation reuses only private same-account memory and clears it on logout or authorization failure", async () => {
  let revision = "a",
    bearer = "owner",
    denied = false,
    bad304 = false;
  const seen: { url: string; tag?: string }[] = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url!, tag: req.headers["if-none-match"] });
    res.setHeader("content-type", "application/json");
    if (req.url !== "/shop/state") {
      res.end("{}");
      return;
    }
    if (denied) {
      res.statusCode = 401;
      res.end('{"code":"SESSION_EXPIRED"}');
      return;
    }
    const tag = 'W/"tt-state-' + revision.repeat(64) + '"';
    res.setHeader("etag", bad304 ? 'W/"tt-state-' + "f".repeat(64) + '"' : tag);
    if (bad304 || req.headers["if-none-match"] === tag) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.end(
      JSON.stringify({
        user: { id: bearer },
        units: [],
        documents: [],
        revision,
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = createClient(
    `http://127.0.0.1:${(server.address() as any).port}`,
    async () => bearer,
  );
  try {
    const first = await client.state(),
      same = await client.state();
    assert.equal(first, same);
    assert.ok(seen.at(-1)?.tag);
    revision = "b";
    assert.notEqual(await client.state(), first);
    bearer = "staff";
    await client.state();
    assert.equal(seen.at(-1)?.tag, undefined);
    await client.request("/reports");
    assert.equal(seen.at(-1)?.tag, undefined);
    denied = true;
    await assert.rejects(client.state(), (e: any) => e.status === 401);
    denied = false;
    await client.state();
    assert.equal(seen.at(-1)?.tag, undefined);
    await client.logout();
    await client.state();
    assert.equal(seen.at(-1)?.tag, undefined);
    bad304 = true;
    await assert.rejects(
      client.state(),
      (e: any) => e.code === "UPSTREAM_UNAVAILABLE",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
