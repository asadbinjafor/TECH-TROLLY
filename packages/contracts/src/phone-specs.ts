import { z } from "zod";

export const storageOptions = [
  "64 GB",
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
  "2 TB",
] as const;
export const ramOptions = ["4 GB", "8 GB", "12 GB", "16 GB"] as const;
export type PhoneType = "android" | "iphone";
// No defaults: older persisted command hashes and unknown stock stay unchanged.
export const phoneSpecFields = {
  phoneType: z.enum(["android", "iphone"]).nullable().optional(),
  ram: z.enum(ramOptions).nullable().optional(),
};
export function normalizeCapacity(value: string) {
  const v = value.trim().toUpperCase().replace(/\s+/g, "");
  const normalized = /^\d+$/.test(v) ? v + " GB" : v.replace(/(GB|TB)$/, " $1");
  return [...storageOptions, ...ramOptions].includes(normalized as any)
    ? normalized
    : value;
}
export function validatePhoneSpecs(
  value: {
    phoneType?: string | null;
    ram?: string | null;
    storage?: string;
    category?: string;
  },
  context: {
    addIssue(issue: { code: "custom"; path: string[]; message: string }): void;
  },
) {
  const issue = (key: string) =>
    context.addIssue({
      code: "custom",
      path: [key],
      message: "PHONE_SPEC_INVALID",
    });
  if (!value.phoneType) {
    if (value.ram) issue("ram");
    return;
  }
  if (value.category === "accessory") issue("phoneType");
  if (!storageOptions.includes(value.storage as any)) issue("storage");
  if (value.phoneType === "android" && !ramOptions.includes(value.ram as any))
    issue("ram");
  if (value.phoneType === "iphone" && value.ram) issue("ram");
}
