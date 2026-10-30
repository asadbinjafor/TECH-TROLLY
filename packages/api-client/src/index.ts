import type {
  CommandKind,
  CommandData,
  State,
  User,
} from "@tech-trolley/contracts";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(code);
  }
}
export function createClient(
  base: string,
  token?: () => Promise<string | null>,
) {
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    let r: Response;
    try {
      const bearer = await token?.();
      r = await fetch(`${base}${path}`, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(token ? { "X-Native-Client": "1" } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
          : AbortSignal.timeout(25000),
      });
    } catch {
      if (signal?.aborted) throw signal.reason;
      throw new ApiError(
        method === "GET" ? "NETWORK_ERROR" : "SUBMISSION_UNCERTAIN",
        0,
      );
    }
    let data: any;
    try {
      data = await r.json();
      if (!data || typeof data !== "object")
        throw new Error("Invalid API response");
    } catch {
      if (signal?.aborted) throw signal.reason;
      throw new ApiError(
        method === "GET" ? "UPSTREAM_UNAVAILABLE" : "SUBMISSION_UNCERTAIN",
        502,
      );
    }
    if (!r.ok)
      throw new ApiError(data.code || "SERVER_ERROR", r.status, data.details);
    return data;
  }
  return {
    request,
    receiptPdf: async (id: string, purchase = false) => {
      const bearer = await token?.();
      let response: Response;
      try {
        response = await fetch(
          `${base}/${purchase ? "purchases" : "documents"}/${encodeURIComponent(id)}/pdf?download=1`,
          {
            credentials: "include",
            headers: {
              Accept: "application/pdf",
              ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
              ...(token ? { "X-Native-Client": "1" } : {}),
            },
            signal: AbortSignal.timeout(60000),
          },
        );
      } catch {
        throw new ApiError("NETWORK_ERROR", 0);
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.code || "UPSTREAM_UNAVAILABLE",
          response.status,
        );
      }
      if (!response.headers.get("content-type")?.startsWith("application/pdf"))
        throw new ApiError("UPSTREAM_UNAVAILABLE", 502);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-")
        throw new ApiError("UPSTREAM_UNAVAILABLE", 502);
      return bytes;
    },
    login: (identity: string, password: string) =>
      request<{ user: User; token?: string }>("/auth/login", "POST", {
        identity,
        password,
      }),
    ready: (options?: ReadinessOptions) => waitForApi(base, options),
    me: (signal?: AbortSignal) =>
      request<User>("/auth/me", "GET", undefined, undefined, signal),
    logout: () => request("/auth/logout", "POST"),
    state: (signal?: AbortSignal) =>
      request<State>("/shop/state", "GET", undefined, undefined, signal),
    command: <K extends CommandKind>(
      kind: K,
      data: CommandData<K>,
      key: string,
    ) =>
      request<{ id: string; number: string }>(
        `/commands/${kind}`,
        "POST",
        data,
        key,
      ),
    status: (key: string) =>
      request<{ found: boolean; result?: { id: string; number: string } }>(
        `/commands/status/${key}`,
      ),
  };
}

export interface ReadinessOptions {
  signal?: AbortSignal;
  onProgress?: (progress: { attempt: number; elapsedMs: number }) => void;
  timeoutMs?: number;
  attemptTimeoutMs?: number;
  retryDelayMs?: number;
  isOnline?: () => boolean;
}
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const done = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Only the public, database-backed health GET is retried. Writes are never replayed.
export async function waitForApi(base: string, options: ReadinessOptions = {}) {
  const started = Date.now(),
    deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), options.timeoutMs ?? 120000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline.signal])
    : deadline.signal;
  let attempt = 0;
  try {
    while (!signal.aborted) {
      if (options.isOnline?.() === false) throw new ApiError("OFFLINE", 0);
      attempt += 1;
      options.onProgress?.({
        attempt,
        elapsedMs: Date.now() - started,
      });
      const probe = new AbortController();
      const probeTimer = setTimeout(
        () => probe.abort(),
        options.attemptTimeoutMs ?? 8000,
      );
      try {
        const response = await fetch(`${base}/health`, {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.any([signal, probe.signal]),
        });
        const data = await response.json();
        if (response.ok && data?.status === "ok") return;
        if (
          data?.code === "API_CONFIGURATION_REQUIRED" ||
          data?.code === "NOT_FOUND"
        )
          throw new ApiError(data.code, response.status);
      } catch (error) {
        if (error instanceof ApiError) throw error;
      } finally {
        clearTimeout(probeTimer);
      }
      try {
        await pause(
          options.retryDelayMs ??
            // Detect a recovered server promptly; a long backoff adds visible
            // delay after Render has already finished starting.
            Math.min(1000 * 2 ** Math.min(attempt - 1, 1), 2000),
          signal,
        );
      } catch {
        break;
      }
    }
    if (options.signal?.aborted) throw options.signal.reason;
    throw new ApiError("STARTUP_TIMEOUT", 0);
  } finally {
    clearTimeout(timer);
  }
}
