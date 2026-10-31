import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import { db } from "../database/database";
import { fail } from "../common/errors";

export const passwordAttemptKey = (userId: string) =>
  createHash("sha256")
    .update("password-check:" + userId)
    .digest("hex");

// Check before acquiring a transaction connection. The mutation must compare
// this hash again under its account lock, preventing stale-password writes.
export async function verifyCurrentPassword(
  userId: string,
  password: string | undefined,
  code = "CURRENT_PASSWORD_INVALID",
  status = 400,
) {
  if (!password) return undefined;
  const [user] = await db.query(
    "SELECT id,password_hash FROM app_user WHERE id=$1 AND active",
    [userId],
  );
  if (!user) fail("SESSION_EXPIRED", 401);
  if (!(await verifyAccountPassword(user, password))) fail(code, status);
  return user.password_hash as string;
}

// Use the shared pool, not the caller's mutation transaction: failed attempts
// must survive a rollback. Aliases, IPs, sessions and endpoints share one limit.
export async function verifyAccountPassword(
  user: { id: string; password_hash: string },
  password: string,
) {
  const key = passwordAttemptKey(user.id);
  const [attempt] = await db.query(
    `INSERT INTO auth_attempt(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempt.reset_at<now() THEN 1 ELSE auth_attempt.count+1 END,reset_at=CASE WHEN auth_attempt.reset_at<now() THEN now()+interval '15 minutes' ELSE auth_attempt.reset_at END RETURNING count`,
    [key],
  );
  if (attempt.count > 5) fail("RATE_LIMIT", 429);
  const valid = await bcrypt.compare(password, user.password_hash);
  if (valid) await db.query("DELETE FROM auth_attempt WHERE key=$1", [key]);
  return valid;
}
