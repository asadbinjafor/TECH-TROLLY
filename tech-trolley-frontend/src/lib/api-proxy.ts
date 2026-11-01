const routes = new Set([
  "auth",
  "users",
  "shop",
  "parties",
  "expense-categories",
  "commands",
  "reports",
  "documents",
  "purchases",
  "health",
]);
type ProxyOptions = {
  upstream?: string;
  production?: boolean;
  timeoutMs?: number;
};

// Transport only. Nest owns sessions, authorization, validation and accounting.
export async function proxyApi(
  request: Request,
  path: string[],
  options: ProxyOptions = {},
) {
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const configured =
    options.upstream ??
    process.env.API_UPSTREAM_URL ??
    (production ? "" : "http://localhost:3000");
  const error = (code: string, status: number) =>
    Response.json(
      { code },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (
    !path.length ||
    !routes.has(path[0]) ||
    path.some((p) => !p || p === "." || p === ".." || /[\\/]/.test(p))
  )
    return error("NOT_FOUND", 404);
  let upstream: URL;
  try {
    upstream = new URL(configured);
    if (
      !["http:", "https:"].includes(upstream.protocol) ||
      (production && upstream.protocol !== "https:") ||
      upstream.username ||
      upstream.password ||
      upstream.pathname !== "/" ||
      upstream.search ||
      upstream.hash
    )
      throw new Error();
  } catch {
    return error("API_CONFIGURATION_REQUIRED", 503);
  }
  const target = new URL(
    "/" + path.map(encodeURIComponent).join("/"),
    upstream,
  );
  target.search = new URL(request.url).search;
  const headers = new Headers();
  // Do not forward Host, X-Native-Client, Authorization, forwarding headers or arbitrary client headers.
  for (const name of ["content-type", "accept", "origin", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const sessionCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("tt_session="));
  if (sessionCookie) headers.set("Cookie", sessionCookie);
  const method = request.method;
  const pdfRoute =
    ["GET", "HEAD"].includes(method) &&
    path.length === 3 &&
    ["documents", "purchases"].includes(path[0]) &&
    path[2] === "pdf";
  try {
    const response = await fetch(target, {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      body: ["GET", "HEAD"].includes(method)
        ? undefined
        : await request.arrayBuffer(),
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(
          options.timeoutMs ??
            (pdfRoute ? 55000 : path[0] === "health" ? 6000 : 20000),
        ),
      ]),
    });
    if (response.status >= 300 && response.status < 400)
      return error("UPSTREAM_UNAVAILABLE", 502);
    const contentType = response.headers.get("content-type") || "";
    const csvExport =
      response.ok &&
      path.length === 2 &&
      path[0] === "reports" &&
      path[1] === "export" &&
      contentType.includes("text/csv");
    const pdfExport =
      response.ok &&
      pdfRoute &&
      contentType.split(";")[0].trim() === "application/pdf";
    const imageExport =
      response.ok &&
      ["GET", "HEAD"].includes(method) &&
      path.length === 3 &&
      path[0] === "purchases" &&
      path[1] === "files" &&
      contentType.split(";")[0].trim() === "image/jpeg";
    if (
      !contentType.includes("application/json") &&
      !csvExport &&
      !pdfExport &&
      !imageExport
    )
      return error(
        ["GET", "HEAD"].includes(method)
          ? "UPSTREAM_UNAVAILABLE"
          : "SUBMISSION_UNCERTAIN",
        502,
      );
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-disposition", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie())
      outgoing.append("Set-Cookie", cookie);
    if (imageExport && method === "GET") {
      const bytes = await response.arrayBuffer();
      const signature = new Uint8Array(bytes.slice(0, 3));
      if (
        bytes.byteLength > 524288 ||
        signature[0] !== 255 ||
        signature[1] !== 216 ||
        signature[2] !== 255
      )
        return error("UPSTREAM_UNAVAILABLE", 502);
      outgoing.set("X-Content-Type-Options", "nosniff");
      return new Response(bytes, {
        status: response.status,
        headers: outgoing,
      });
    }
    if (pdfExport && method === "GET") {
      const bytes = await response.arrayBuffer();
      if (
        bytes.byteLength > 10 * 1024 * 1024 ||
        new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
      )
        return error("UPSTREAM_UNAVAILABLE", 502);
      return new Response(bytes, {
        status: response.status,
        headers: outgoing,
      });
    }
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return error(
      ["GET", "HEAD"].includes(method)
        ? "UPSTREAM_UNAVAILABLE"
        : "SUBMISSION_UNCERTAIN",
      502,
    );
  }
}
