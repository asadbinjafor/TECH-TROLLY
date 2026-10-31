import type { Metadata, Viewport } from "next";
import { ShopProvider } from "@/contexts/shop-context";
import { NavigationProvider } from "@/components/navigation/navigation-provider";
import "./globals.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
export const metadata: Metadata = {
  title: "Tech Trolley · Shop Manager",
  description: "Internal shop inventory, sales and daily accounts",
  icons: { icon: "/tech-trolley-logo.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body>
        <NavigationProvider>
          <ShopProvider>{children}</ShopProvider>
        </NavigationProvider>
      </body>
    </html>
  );
}
