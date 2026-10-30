import { z } from "zod";

// Separate from ordinary contacts/state: these fields include private identity data.
const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\r\n\t]+$/);
const phone = z
  .string()
  .trim()
  .min(5)
  .max(30)
  .regex(/^[^\r\n\t]+$/);
const address = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .regex(/^[^\r\n\t]+$/);
export const individualSellerSchema = z.strictObject({
  sellerName: name,
  sellerPhone: phone,
  fatherName: name,
  motherName: name,
  presentAddress: address,
  permanentAddress: z
    .string()
    .trim()
    .max(240)
    .regex(/^[^\r\n\t]*$/)
    .optional(),
  identityNumber: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[^\r\n\t]+$/),
  // Optional on the wire so existing saved declarations and retries still parse.
  dateOfBirth: z.iso
    .date()
    .refine(
      (value) =>
        value <=
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
          new Date(),
        ),
      "BIRTH_DATE_INVALID",
    )
    .optional(),
  nomineeName: name,
  nomineePhone: phone,
});
export type IndividualSeller = z.infer<typeof individualSellerSchema>;
export const individualSellerKeys = Object.keys(
  individualSellerSchema.shape,
) as (keyof IndividualSeller)[];
export function sellerFormValues(
  party?: { name: string; phone: string; address: string },
  profile?: IndividualSeller | null,
): Record<string, string> {
  return {
    ...Object.fromEntries(individualSellerKeys.map((key) => [key, ""])),
    sellerName: party?.name || "",
    sellerPhone: party?.phone || "",
    presentAddress: party?.address || "",
    ...profile,
  };
}
export const purchaseDeclarationTerms =
  "যদি এই পণ্যটি নিয়ে কোন আইনগত বা মালিকানা বিষয়ক কোনরূপ ঝামেলা হয়, সে ক্ষেত্রে পণ্য ও সমস্ত দায়ভার আমি (বিক্রেতা) আমার উপর বর্তাবে। আমি স্বেচ্ছায়, স্বজ্ঞানে ও সুস্থ মস্তিষ্কে ৭ দিনের মধ্যে ফোনে কোন সমস্যা হলে সমাধানের শর্ত মেনে নিয়ে নিম্নে স্বাক্ষর করিলাম।";
export interface PurchaseDeclaration {
  id: string;
  number: string;
  date: string;
  reversed: boolean;
  buyer: { name: string; role: "OWNER" | "STAFF" };
  seller: IndividualSeller;
  unit: {
    phoneType?: "android" | "iphone" | null;
    ram?: string | null;
    brand: string;
    model: string;
    storage: string;
    color: string;
    variant: string;
    imei: string;
    condition: string;
    battery: number | null;
    box: "with" | "without";
    accessories: string;
  };
  total: string;
  cash: string;
  bank: string;
  originalDue: string;
  terms: string;
}
