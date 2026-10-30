import type { Role } from "./index";

/** Preserve real saved names; legacy role defaults use that seller's saved profile display name. */
export function invoiceSellerName(
  saved?: string | null,
  profile?: string | null,
) {
  const actual = (name?: string | null) => {
    const value = name?.trim() || "";
    return /^(?:owner|staff|shop owner|shop staff|মালিক|স্টাফ|কর্মী|—|-)?$/iu.test(
      value,
    )
      ? ""
      : value;
  };
  return (
    actual(saved) ||
    actual(profile) ||
    (profile?.trim() && !/^[—-]$/.test(profile.trim()) ? profile.trim() : "") ||
    (saved?.trim() && !/^[—-]$/.test(saved.trim()) ? saved.trim() : "")
  );
}

// Printed shop details and policy supplied and confirmed by the Owner.
export const memoProfile = {
  phone: "01607-683097",
  address: "Basement: 02, Shop: 114, Bashundhara City Shopping Complex.",
  facebook: "facebook.com/techtrolley.dhaka",
  qrUrl: "https://www.facebook.com/share/1CWzbVs5hb/?mibextid=wwXIfr",
  warrantyPolicy: [
    "7 Days Replacement Guarantee (Without Display, Fingerprint/Face ID & Camera)",
    "2 Years Service Warranty (Without Parts)",
    "Goods Once Sold Can't Be Returned Any Exchange, Will Relust To Minimum 25% Deducation From Sell Amount",
    "We don't accept any dead phone",
  ],
  // Verbatim printed copy supplied by the Owner; this is not a returns engine.
  afterSalesTerms: [
    "বিক্রিত পণ্য অফেরতযোগ্য।",
    "ব্যবহৃত ডিভাইস ক্রয়ের সময় ডিভাইসটির সম্পূর্ণ ফিজিকাল বডি কন্ডিশন, ডিসপ্লে ও নেটওয়ার্ক কানেক্টিভিটিসহ সকল খুটিনাটি অংশ নিজ দায়িত্বে চেক করে নিশ্চিত হয়ে নেয়ার অনুরোধ থাকলো।",
    "ডিভাইস ডিসপ্লেজনিত সকল সমস্যা যেমন: GREEN LINE, WHITE LINE, PINK LINE, GREEN TINT, WHITE TINT, BLACK SCREEN, FLICKERING, BLINKING ইত্যাদি যেকোন প্রকার সমস্যার জন্য রিপ্লেসমেন্ট / পার্টস ওয়ারেন্টি প্রযোজ্য নয়।",
    "ক্রয়কৃত ডিভাইস ক্রয় পরবর্তীকালে দেশীয় নেটওয়ার্ক এর আওতাধীন যেকোনো প্রশাসনিক জটিলতার ক্ষেত্রে TECH TROLLEY সর্বোচ্চ সহায়তার চেষ্টায় নিয়োজিত থাকিবে এবং সমস্যা সমাধানের লক্ষ্যে অটুট থাকিবে। তবে ডিভাইস ইন্টারন্যাশনাল যেকোনো সিম ব্যবহার অথবা দেশের বাহিরে বহিরাগত ভ্রমনের ক্ষেত্রে সৃষ্ট কোনো প্রকার সমস্যা বা প্রশাসনিক জটিলতার জন্য বিক্রেতা দায়ি নয়।",
    "তরল পদার্থের স্পর্শ, হাত থেকে পরা, ইলেকট্রিক শর্টসার্কিট, কোন প্রকার আঘাত জনিত চিহ্ন থাকলে সার্ভিসিং এর অন্তর্ভুক্ত নয়।",
    "সফটওয়্যার রুট করা কোন ফোন সার্ভিসিং এর অন্তর্ভুক্ত নয়।",
    "ইন্টারন্যাশনাল ওয়ারেন্টি (যদি থাকে) অন্তর্ভুক্ত যেকোনো ডিভাইসের ইন্টারন্যাশনাল সাপোর্ট বা ওয়ারেন্টি দাবির ক্ষেত্রে TECH TROLLEY অবগত থাকিবে না। TECH TROLLEY সকল প্রকার আফটার সেলস সার্ভিস নীতিবিধি শুধুমাত্র বাংলাদেশের অধীনে প্রযোজ্য।",
    "একই ডিভাইস একই মডেল বিভিন্ন REGION বা বিভিন্ন ব্যাচ উৎপাদন জনিত কারণে ভিন্নতা ও তারতম্য থাকতে পারে। যেমন: সেন্সর, ডিসপ্লে কালার, সাউন্ড আউটপুট, ক্যামেরা কোয়ালিটি, ব্যাটারি ব্যাকাপ, প্যাকেজিং ইত্যাদি।",
    "আন-অফিসিয়াল ডিভাইসের BTRC রেজিস্ট্রেশন সংক্রান্ত কোনো রকম দায়-দায়িত্ব TECH TROLLEY মোবাইল এর উপর বর্তাবে না। পরবর্তীতে সরকারি নতুন নীতিমালা অনুযায়ী ডিভাইস রেজিস্ট্রেশন সহ অন্যান্য আনুষঙ্গিকতা নিজ দায়িত্বে পালন করার জন্য অনুরোধ করা গেলো।",
    "Warranty করতে চাইলে আপনাকে অবশ্যই স্ব-শরীরে প্রোডাক্টের বক্স ও ইনভয়েস/বিল সহ আউটলেটে হাজির হতে হবে অথবা কুরিয়ার এর মাধ্যমে পাঠিয়ে দিতে হবে। ওয়ারেন্টি এর সময় অতিক্রম হওয়ার পর কোন প্রকার Warranty Claim গ্রহণযোগ্য হবে না।",
    "প্রোডাক্ট এর Warranty Claim ক্ষেত্রে অবশ্যই গ্রাহকগন কে সময় প্রদান করবেন। এবং সেই সময়সীমার মধ্যেই গ্রাহক তার প্রোডাক্ট এর Warranty Claim করতে পারবেন। তাৎক্ষনিক কোন প্রোডাক্ট এর রিপ্লেসমেন্ট অথবা রিপেয়ার করে দেওয়া হবে না।",
    "আফটার সেলস সার্ভিসের যেকোনো শর্তে ইনভয়েসে উল্লেখিত ক্রেতা স্ব-শরীরে যোগাযোগ বা উপস্থিত থাকতে হবে এবং ওয়ারেন্টি বিষয়ক সকল বোঝাপড়া, লেনদেন অথবা যেকোনো জটিলতায় উল্লেখিত ক্রেতা ব্যতীত অন্য কোনো থার্ড পার্টির পক্ষ থেকে কোনো প্রকার অভিযোগ গ্রহণযোগ্য নয়।",
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
  id?: string;
  shop: ReturnType<typeof invoiceShop>;
  number: string;
  createdAt: string;
  date: string;
  reversed: boolean;
  customer: string | null;
  phone: string | null;
  address: string | null;
  seller: {
    id: string;
    name: string;
    role: Role | null;
    nameMissing?: boolean;
  };
  unit: {
    phoneType?: "android" | "iphone" | null;
    ram?: string | null;
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
  /** Print-only line collection when supplied; current sale posting tracks one unit. */
  items?: { unit: Receipt["unit"]; quantity: number; price: string }[];
  discount: string;
  total: string;
  paid: string;
  cash: string;
  bank: string;
  originalDue: string;
  outstandingDue: string;
}
