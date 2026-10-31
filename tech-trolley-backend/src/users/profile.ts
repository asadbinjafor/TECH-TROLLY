import type { EntityManager } from "typeorm";
import { fail } from "../common/errors";

type Details = {
  name?: string;
  login?: string;
  email?: string;
  currentPassword?: string;
};
export const profileDetails = (u: any) => ({
  name: u.name,
  login: u.login,
  email: u.email,
});

// Call only after the shared account lock and actor/target row locks are held.
export async function updateProfile(
  tx: EntityManager,
  previous: any,
  values: Details,
  actor: any,
  verifiedPasswordHash?: string,
) {
  const next = {
    name: values.name ?? previous.name,
    login: values.login ?? previous.login,
    email: values.email === undefined ? previous.email : values.email || null,
  };
  const identityChanged =
    next.login !== previous.login || next.email !== previous.email;
  const changed = identityChanged || next.name !== previous.name;
  if (identityChanged && !values.currentPassword)
    fail("CURRENT_PASSWORD_REQUIRED");
  if (values.currentPassword && actor.password_hash !== verifiedPasswordHash)
    fail("CURRENT_PASSWORD_INVALID");
  if (!changed) return { user: previous, identityChanged, changed };
  const [user] = await tx.query(
    "WITH saved AS (UPDATE app_user SET name=$2,login=$3,email=$4 WHERE id=$1 RETURNING *) SELECT * FROM saved",
    [previous.id, next.name, next.login, next.email],
  );
  if (identityChanged) {
    await tx.query("DELETE FROM identity WHERE user_id=$1", [previous.id]);
    for (const value of new Set([next.login, next.email].filter(Boolean))) {
      await tx.query("INSERT INTO identity(value,user_id) VALUES($1,$2)", [
        value,
        previous.id,
      ]);
    }
  }
  return { user, identityChanged, changed };
}
