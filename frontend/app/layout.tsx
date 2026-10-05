import type React from "react";
import type { Metadata, Viewport } from "next";

import "./globals.css";
import { PortalShell } from "@/components/portal-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "MU LMS | Millat Umidi uchun ta’lim platformasi",
  description:
    "Millat Umidi universiteti uchun ishlab chiqilgan LMS konsepti: materiallar, topshiriqlar va natijalar.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          <AuthProvider>
            <PortalShell>{children}</PortalShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
