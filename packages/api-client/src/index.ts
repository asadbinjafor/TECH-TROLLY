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
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new ApiError(
        method === "GET" ? "NETWORK_ERROR" : "SUBMISSION_UNCERTAIN",
        0,
      );
    }
    const data = await r.json();
    if (!r.ok)
      throw new ApiError(data.code || "SERVER_ERROR", r.status, data.details);
    return data;
  }
  return {
    request,
    login: (identity: string, password: string) =>
      request<{ user: User; token?: string }>("/auth/login", "POST", {
        identity,
        password,
      }),
    me: () => request<User>("/auth/me"),
    logout: () => request("/auth/logout", "POST"),
    state: () => request<State>("/shop/state"),
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
