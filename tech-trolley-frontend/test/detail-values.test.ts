import { test } from "node:test";
import assert from "node:assert/strict";
import { detailValue, t } from "@tech-trolley/i18n";

test("transaction details localize owned fields without translating customer data", () => {
  assert.equal(
    t("actorRole", "bn"),
    "যে অ্যাকাউন্ট থেকে লেখা হয়েছে তার ভূমিকা",
  );
  assert.equal(t("partyPhone", "en"), "Contact phone");
  assert.equal(t("partyPhone", "bn"), "যোগাযোগের ফোন");
  for (const [key, value, en, bn] of [
    ["box", "with", "With box", "বক্সসহ"],
    ["box", "without", "Without box", "বক্স ছাড়া"],
    ["condition", "used", "Used", "ব্যবহৃত"],
    ["category", "phone", "Phone", "ফোন"],
    ["actorRole", "OWNER", "Owner", "মালিক"],
    ["actorRole", "STAFF", "Staff", "কর্মী"],
    ["account", "bank", "Bank", "ব্যাংক"],
    ["purchaseSource", "individual", "Individual seller", "ব্যক্তিগত বিক্রেতা"],
  ]) {
    assert.equal(detailValue(key, value, "en"), en);
    assert.equal(detailValue(key, value, "bn"), bn);
  }
  for (const key of ["note", "model", "partyName", "variant", "color"])
    for (const value of ["with", "phone", "OWNER", "শাওমি", "<Sample>"])
      assert.equal(detailValue(key, value, "bn"), value);
  assert.equal(detailValue("partyPhone", "01700000000", "bn"), "01700000000");
  assert.equal(detailValue("imei", "000000000000001", "en"), "000000000000001");
  assert.equal(detailValue("cash", "0.00", "bn"), "0.00");
  assert.equal(detailValue("battery", 0, "bn"), "0");
  assert.equal(detailValue("battery", null, "bn"), "—");
  assert.equal(detailValue("from", "2026-10-25", "bn"), "2026-10-25");
  assert.equal(
    detailValue("box", "future-legacy-value", "bn"),
    "future-legacy-value",
  );
  assert.equal(
    detailValue("dueType", "refund", "bn"),
    "সরবরাহকারীর ফেরত পাওনা",
  );
  assert.equal(detailValue("historical", true, "bn"), "হ্যাঁ");
});
