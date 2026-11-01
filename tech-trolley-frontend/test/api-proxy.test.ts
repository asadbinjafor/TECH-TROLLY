import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { proxyApi } from "../src/lib/api-proxy";

test("private JPEG evidence is bounded, authenticated through the same-origin proxy and never accepted on an unrelated route", async () => {
  let cookie = "",
    body = Buffer.alloc(0);
  const server = createServer(async (req, res) => {
    cookie = String(req.headers.cookie || "");
    for await (const chunk of req)
      body = Buffer.concat([body, Buffer.from(chunk)]);
    if (req.method === "POST") {
      res.setHeader("content-type", "application/json");
      res.end('{"id":"synthetic"}');
      return;
    }
    res.setHeader("content-type", "image/jpeg");
    res.setHeader("content-disposition", 'attachment; filename="memo.jpg"');
    res.end(
      req.url?.includes("invalid")
        ? Buffer.from("not jpeg")
        : Buffer.from([255, 216, 255, 0]),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const options = {
    upstream: `http://127.0.0.1:${(server.address() as any).port}`,
    production: false,
  };
  try {
    const headers = {
      Cookie: "tt_session=synthetic; unrelated=secret",
      "Content-Type": "image/jpeg",
      Origin: "https://shop.example",
    };
    const upload = await proxyApi(
      new Request("https://shop.example/api/purchases/files/test", {
        method: "POST",
        headers,
        body: new Uint8Array([255, 216, 255, 0]),
      }),
      ["purchases", "files", "test"],
      options,
    );
    assert.equal(upload.status, 200);
    assert.equal(cookie, "tt_session=synthetic");
    assert.deepEqual([...body], [255, 216, 255, 0]);
    const response = await proxyApi(
      new Request("https://shop.example/api/purchases/files/test", { headers }),
      ["purchases", "files", "test"],
      options,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-disposition")!, /attachment/);
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer())],
      [255, 216, 255, 0],
    );
    const invalid = await proxyApi(
      new Request("https://shop.example/api/purchases/files/invalid", {
        headers,
      }),
      ["purchases", "files", "invalid"],
      options,
    );
    assert.equal(invalid.status, 502);
    const wrong = await proxyApi(
      new Request("https://shop.example/api/commands/test", { headers }),
      ["commands", "test"],
      options,
    );
    assert.equal(wrong.status, 502);
  } finally {
    server.close();
    await once(server, "close");
  }
});

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
    const removed = await proxyApi(
      new Request("https://shop.example/api/parties/synthetic-id", {
        method: "DELETE",
        headers: {
          Cookie: "tt_session=opaque-session",
          Origin: "https://shop.example",
        },
      }),
      ["parties", "synthetic-id"],
      options,
    );
    assert.equal(removed.status, 200);
    assert.equal(seen[3].url, "/parties/synthetic-id");
    assert.equal(seen[3].headers.cookie, "tt_session=opaque-session");
    assert.equal(seen[3].headers.origin, "https://shop.example");
    assert.equal(seen[3].body, "");
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

test("same-origin receipt PDFs retain binary bytes and cookies, reject fake PDFs and keep authorization errors", async () => {
  const pdf = Buffer.concat([
    Buffer.from("%PDF-1.7\n"),
    Buffer.from([0, 255, 254, 128, 13, 10]),
  ]);
  const seen: Record<string, any>[] = [];
  const server = createServer((req, res) => {
    seen.push(req.headers);
    if (req.url?.includes("denied")) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end('{"code":"UNAUTHORIZED"}');
      return;
    }
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="TT-000008.pdf"',
    });
    res.end(req.url?.includes("bad") ? Buffer.from("not a pdf") : pdf);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const upstream = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (path: string[], query = "", method = "GET") =>
    proxyApi(
      new Request("https://shop.example/api/" + path.join("/") + query, {
        method,
        headers: {
          Cookie: "other=ignore; tt_session=private-session",
          Authorization: "Bearer do-not-forward",
          "X-Native-Client": "1",
        },
      }),
      path,
      { upstream, production: false },
    );
  try {
    const response = await call(["documents", "saved-invoice", "pdf"]);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
    assert.match(response.headers.get("content-disposition")!, /TT-000008.pdf/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(seen[0].cookie, "tt_session=private-session");
    assert.equal(seen[0].authorization, undefined);
    assert.equal(seen[0]["x-native-client"], undefined);
    const purchase = await call(["purchases", "saved-purchase", "pdf"]);
    assert.equal(purchase.status, 200);
    assert.deepEqual(Buffer.from(await purchase.arrayBuffer()), pdf);
    assert.equal(
      (await call(["purchases", "saved-purchase", "pdf"], "?bad=1")).status,
      502,
    );
    assert.equal(
      (await call(["documents", "saved-invoice", "pdf"], "?bad=1")).status,
      502,
    );
    assert.equal((await call(["auth", "pdf"])).status, 502);
    const denied = await call(
      ["documents", "saved-invoice", "pdf"],
      "?denied=1",
    );
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).code, "UNAUTHORIZED");
    assert.equal(
      (await call(["documents", "saved-invoice", "pdf"], "", "HEAD")).status,
      200,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
