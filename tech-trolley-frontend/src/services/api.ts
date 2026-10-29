import { createClient } from "@tech-trolley/api-client";
export const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
export const api = createClient(apiBase);
