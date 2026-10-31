import { connect, db } from "../database/database";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { newPassword } from "@tech-trolley/contracts";
export async function bootstrap() {
  await connect();
  await db.transaction(async (em) => {
    const [shop] = await em.query("SELECT * FROM shop WHERE id=1 FOR UPDATE");
    if (shop.bootstrapped) return;
    const [{ count }] = await em.query("SELECT count(*) FROM app_user");
    if (Number(count) > 0) throw new Error("EXISTING_ACCOUNTS_REQUIRE_REVIEW");
    const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase(),
      password = process.env.BOOTSTRAP_OWNER_PASSWORD;
    if (!email || !password || !newPassword.safeParse(password).success)
      throw new Error("BOOTSTRAP_CONFIGURATION_REQUIRED");
    const id = randomUUID();
    await em.query(
      `INSERT INTO app_user(id,name,login,email,password_hash,role) VALUES($1,'Owner','owner',$2,$3,'OWNER')`,
      [id, email, await bcrypt.hash(password, 12)],
    );
    for (const value of new Set(["owner", email]))
      await em.query("INSERT INTO identity(value,user_id) VALUES($1,$2)", [
        value,
        id,
      ]);
    const defaults = [
      ["লাঞ্চ", "Lunch"],
      ["অ্যাকসেসরিজ গিফট", "Accessories gift"],
      ["নাস্তা", "Nasta"],
      ["Vat", "Vat"],
      ["মাহির", "Mahir"],
      ["তানজিম", "Tanjim"],
      ["অন্যান্য খরচ", "Other cost"],
    ];
    for (const [bn, en] of defaults)
      await em.query(
        "INSERT INTO expense_category(id,bn,en) VALUES($1,$2,$3)",
        [randomUUID(), bn, en],
      );
    await em.query("UPDATE shop SET bootstrapped=true WHERE id=1");
    await em.query(
      "INSERT INTO audit_event(actor_id,action,subject_id) VALUES($1,'initial_owner_bootstrap',$2)",
      [id, id],
    );
  });
}
if (require.main === module)
  bootstrap()
    .then(() => {
      console.log("Bootstrap checked; existing accounts preserved.");
      process.exit(0);
    })
    .catch(() => {
      console.error(
        "Bootstrap failed; check server-only configuration or existing account setup.",
      );
      process.exit(1);
    });
