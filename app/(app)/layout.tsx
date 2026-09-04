"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, clearToken } from "@/lib/apiClient";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/contacts", label: "Contacts" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/chatbot", label: "Chatbot" },
  { href: "/sequences", label: "Sequences" },
  { href: "/appointments", label: "Appointments" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<{ tenant?: any; user?: any } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/auth/me")
      .then((d) => setMe(d))
      .catch(() => router.replace("/login"))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return <div className="center muted">Loading…</div>;

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">WhatsApp Automation</div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item ${pathname === n.href ? "active" : ""}`}
          >
            {n.label}
          </Link>
        ))}
        <div className="sidebar-foot">
          <div style={{ padding: "0 12px 8px" }}>
            <div>{me?.tenant?.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{me?.user?.email}</div>
          </div>
          <div className="nav-item" onClick={logout} style={{ cursor: "pointer" }}>
            Sign out
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
