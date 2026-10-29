import type { Metadata } from "next";
import { ShopProvider } from "@/contexts/shop-context";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tech Trolley · Shop Manager",
  description: "Internal shop inventory, sales and daily accounts",
  icons: { icon: "/tech-trolley-logo.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body>
        <ShopProvider>{children}</ShopProvider>
      </body>
    </html>
  );
}
