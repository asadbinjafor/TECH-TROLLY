import { createClient } from "@tech-trolley/api-client";
export const api = createClient(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
);
