import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

// Chunk by code units so Bengali text stays below each keychain value limit.
// The manifest is committed last: a killed app cannot read a partial payload.
export async function readPrivateDraft(key: string): Promise<string | null> {
  const meta = await SecureStore.getItemAsync(key);
  if (!meta) return null;
  const { version, count } = JSON.parse(meta);
  if (
    typeof version !== "string" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 80
  )
    throw new Error("PRIVATE_DRAFT_INVALID");
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.getItemAsync(`${key}_${version}_${i}`),
    ),
  );
  if (parts.some((p) => p === null)) throw new Error("PRIVATE_DRAFT_INVALID");
  return parts.join("");
}
export async function writePrivateDraft(key: string, value: string | null) {
  const previous = await SecureStore.getItemAsync(key);
  if (value === null) await SecureStore.deleteItemAsync(key);
  else {
    const characters = Array.from(value);
    const version = Crypto.randomUUID(),
      count = Math.ceil(characters.length / 400);
    if (count > 80) throw new Error("PRIVATE_DRAFT_TOO_LARGE");
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${key}_${version}_${i}`,
        characters.slice(i * 400, (i + 1) * 400).join(""),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    await SecureStore.setItemAsync(key, JSON.stringify({ version, count }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (previous) {
    const { version, count } = JSON.parse(previous);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_${version}_${i}`),
      ),
    );
  }
}
