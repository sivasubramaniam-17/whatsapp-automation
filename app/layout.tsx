import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "WhatsApp Automation SaaS",
  description: "Multi-tenant WhatsApp automation for businesses.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
