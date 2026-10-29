import type { Role } from "./index";

// Printed shop details and policy supplied and confirmed by the Owner.
export const memoProfile = {
  phone: "01607-683097",
  address: "Basement: 02, Shop: 114, Bashundhara City Shopping Complex.",
  facebook: "facebook.com/techtrolley.dhaka",
  qrUrl: "https://www.facebook.com/share/1623PtVAdJ9/?mibextid=wwXIfr",
  warrantyPolicy: [
    "7 Days Replacement Guarantee (Without Display, Fingerprint/Face ID & Camera)",
    "2 Years Service Warranty (Without Parts)",
    "Goods Once Sold Can't Be Returned. Any Exchange Will Result In Minimum 25% Deduction From Sell Amount.",
    "We don't accept any dead phone.",
  ],
};

export function invoiceShop(shop: {
  name: string;
  address: string;
  phone: string;
}) {
  return {
    ...memoProfile,
    name: shop.name,
    address: shop.address.trim() || memoProfile.address,
    phone: shop.phone.trim() || memoProfile.phone,
  };
}

export interface Receipt {
  shop: ReturnType<typeof invoiceShop>;
  number: string;
  createdAt: string;
  date: string;
  reversed: boolean;
  customer: string | null;
  phone: string | null;
  address: string | null;
  seller: { id: string; name: string; role: Role | null };
  unit: {
    model: string;
    brand: string;
    variant: string;
    storage?: string;
    color?: string;
    imei: string | null;
    internalId: string;
    battery: number | null;
    box: string;
    condition: string | null;
    category: string | null;
  };
  price: string;
  discount: string;
  total: string;
  paid: string;
  cash: string;
  bank: string;
  originalDue: string;
  outstandingDue: string;
}
