const routes = new Set([
  "auth",
  "users",
  "shop",
  "parties",
  "expense-categories",
  "commands",
  "reports",
  "documents",
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
  try {
    const response = await fetch(target, {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      body: ["GET", "HEAD"].includes(method)
        ? undefined
        : await request.arrayBuffer(),
      signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    });
    if (response.status >= 300 && response.status < 400)
      return error("UPSTREAM_UNAVAILABLE", 502);
    if (
      response.status >= 400 &&
      !response.headers.get("content-type")?.includes("application/json")
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
