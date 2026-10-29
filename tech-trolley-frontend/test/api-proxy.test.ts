import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { proxyApi } from "../src/lib/api-proxy";

test("same-origin proxy preserves cookies, command keys, CSV and uncertain results", async () => {
  const seen: { url: string; headers: Record<string, any>; body: string }[] =
    [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    seen.push({ url: req.url!, headers: req.headers, body });
    if (req.url?.includes("slow=1"))
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (req.url?.includes("redirect=1")) {
      res.writeHead(302, { Location: "https://example.invalid/" });
      res.end();
      return;
    }
    if (req.url?.includes("html=1")) {
      res.writeHead(req.url.includes("ok=1") ? 200 : 503, {
        "Content-Type": "text/html",
      });
      res.end("<html>Starting</html>");
      return;
    }
    if (req.url?.startsWith("/reports/export")) {
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="report.csv"',
      });
      res.end("নাম,টাকা\nপরীক্ষা,10.00");
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (req.url?.startsWith("/auth/login"))
      res.setHeader("Set-Cookie", [
        "tt_session=opaque-session; Path=/; HttpOnly; Secure; SameSite=Strict",
        "test_flag=1; Path=/; HttpOnly; Secure",
      ]);
    res.end(JSON.stringify({ ok: true }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const upstream = `http://127.0.0.1:${(server.address() as any).port}`;
  const options = { upstream, production: false };
  try {
    const login = await proxyApi(
      new Request("https://shop.example/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://shop.example",
          "X-Native-Client": "1",
          Authorization: "Bearer untrusted-client-header",
        },
        body: JSON.stringify({ identity: "test", password: "synthetic-only" }),
      }),
      ["auth", "login"],
      options,
    );
    assert.equal(login.status, 200);
    assert.equal(login.headers.getSetCookie().length, 2);
    assert.match(
      login.headers.getSetCookie()[0],
      /HttpOnly; Secure; SameSite=Strict/,
    );
    assert.ok(!login.headers.getSetCookie()[0].includes("Domain="));
    assert.equal(seen[0].headers.origin, "https://shop.example");
    assert.equal(seen[0].headers["x-native-client"], undefined);
    assert.equal(seen[0].headers.authorization, undefined);
    const key = "b3d545f6-6a1a-4d9b-b897-3821a50fffb7",
      body = '{"amount":"123.45"}';
    const result = await proxyApi(
      new Request("https://shop.example/api/commands/expense", {
        method: "POST",
        headers: {
          Cookie:
            "tt_session=opaque-session; __vercel_jwt=unrelated-private-cookie; other=value",
          Origin: "https://shop.example",
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body,
      }),
      ["commands", "expense"],
      options,
    );
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(seen[1].headers.cookie, "tt_session=opaque-session");
    assert.equal(seen[1].headers["idempotency-key"], key);
    assert.equal(seen[1].body, body);
    const csv = await proxyApi(
      new Request(
        "https://shop.example/api/reports/export?period=week&lang=bn",
        { headers: { Cookie: "tt_session=opaque-session" } },
      ),
      ["reports", "export"],
      options,
    );
    assert.equal(await csv.text(), "নাম,টাকা\nপরীক্ষা,10.00");
    assert.match(csv.headers.get("content-disposition")!, /report.csv/);
    assert.equal(seen[2].url, "/reports/export?period=week&lang=bn");
    const missing = await proxyApi(
      new Request("https://shop.example/api/auth/me"),
      ["auth", "me"],
      { production: true, upstream: "" },
    );
    assert.equal(missing.status, 503);
    const insecure = await proxyApi(
      new Request("https://shop.example/api/auth/me"),
      ["auth", "me"],
      { upstream, production: true },
    );
    assert.equal(insecure.status, 503);
    const traversal = await proxyApi(
      new Request("https://shop.example/api/auth/me"),
      ["auth", "..", "shop"],
      options,
    );
    assert.equal(traversal.status, 404);
    const redirect = await proxyApi(
      new Request("https://shop.example/api/auth/login?redirect=1"),
      ["auth", "login"],
      options,
    );
    assert.equal(redirect.status, 502);
    const unavailable = await proxyApi(
      new Request("https://shop.example/api/auth/login?html=1", {
        method: "POST",
        body: "{}",
      }),
      ["auth", "login"],
      options,
    );
    assert.equal((await unavailable.json()).code, "SUBMISSION_UNCERTAIN");
    const providerPage = await proxyApi(
      new Request("https://shop.example/api/health?html=1&ok=1"),
      ["health"],
      options,
    );
    assert.equal(providerPage.status, 502);
    assert.equal((await providerPage.json()).code, "UPSTREAM_UNAVAILABLE");
    const uncertain = await proxyApi(
      new Request("https://shop.example/api/commands/expense?slow=1", {
        method: "POST",
        body: "{}",
      }),
      ["commands", "expense"],
      { ...options, timeoutMs: 10 },
    );
    assert.equal((await uncertain.json()).code, "SUBMISSION_UNCERTAIN");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
