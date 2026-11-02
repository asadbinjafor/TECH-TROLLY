import { createHash } from "node:crypto";
import { db } from "../database/database";
import { fail } from "../common/errors";

let cleanupAfter = 0;
let passwordWork = 0;
// Use only Express's existing, untrusted-proxy-disabled network peer identity.
// Never trust a caller's forwarding headers. Proxy peers can share this budget;
// the independent account/alias password limit remains the primary PIN guard.
export const loginSourceKey = (peer: string) =>
  createHash("sha256")
    .update("login-source:" + peer)
    .digest("hex");

export async function checkLoginSource(peer: string) {
  if (Date.now() >= cleanupAfter) {
    cleanupAfter = Date.now() + 60_000;
    await db.query(
      "DELETE FROM auth_attempt WHERE key IN (SELECT key FROM auth_attempt WHERE reset_at<now() ORDER BY reset_at LIMIT 5000)",
    );
  }
  const [attempt] = await db.query(
    `INSERT INTO auth_attempt(key,count,reset_at) VALUES($1,1,now()+interval '1 minute')
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN auth_attempt.reset_at<now() THEN 1 ELSE auth_attempt.count+1 END,
       reset_at=CASE WHEN auth_attempt.reset_at<now() THEN now()+interval '1 minute' ELSE auth_attempt.reset_at END
     RETURNING count`,
    [loginSourceKey(peer)],
  );
  if (attempt.count > 60) fail("RATE_LIMIT", 429);
}

export async function withPasswordBudget<T>(
  work: () => Promise<T>,
): Promise<T> {
  // Bound queued bcrypt work as well as names/IPs. No unbounded request queue.
  if (passwordWork >= 8) fail("RATE_LIMIT", 429);
  passwordWork++;
  try {
    return await work();
  } finally {
    passwordWork--;
  }
}
