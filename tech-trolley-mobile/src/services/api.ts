import * as SecureStore from "expo-secure-store";
import { createClient } from "@tech-trolley/api-client";
export const tokenKey = "tech-trolley-session";
export const api = createClient(
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
  () => SecureStore.getItemAsync(tokenKey),
);
