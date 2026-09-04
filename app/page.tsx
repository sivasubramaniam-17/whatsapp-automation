"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";

// Landing: bounce to the dashboard if logged in, else to login.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);
  return <div className="center muted">Loading…</div>;
}
