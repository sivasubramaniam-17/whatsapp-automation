"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function SettingsPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [phoneNumberId, setPhone] = useState("");
  const [wabaId, setWaba] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const t = await api("/tenant");
    setTenant(t);
    setPhone(t.whatsapp?.phoneNumberId ?? "");
    setWaba(t.whatsapp?.wabaId ?? "");
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setError(""); setSaved(false);
    try {
      await api("/tenant", { method: "PATCH", body: {
        phoneNumberId: phoneNumberId || undefined,
        wabaId: wabaId || undefined,
      }});
      setSaved(true);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  if (!tenant) return <div className="muted">Loading…</div>;

  return (
    <div>
      <div className="page-head"><h1>Settings</h1></div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Company</h3>
        <div className="muted">{tenant.name} · plan: {tenant.plan}</div>

        <h3 style={{ marginTop: 22 }}>WhatsApp connection</h3>
        <div style={{ marginBottom: 8 }}>
          {tenant.whatsapp?.connected
            ? <span className="pill green">Connected</span>
            : <span className="pill warn">Not connected</span>}
        </div>
        <label>Phone number ID</label>
        <input value={phoneNumberId} onChange={(e) => setPhone(e.target.value)} placeholder="from Meta API Setup" />
        <label>WhatsApp Business Account ID</label>
        <input value={wabaId} onChange={(e) => setWaba(e.target.value)} />
        <p className="muted" style={{ fontSize: 12 }}>
          The access token is set server-side via environment variables for security.
        </p>
        {saved && <div className="pill green" style={{ display: "inline-block" }}>Saved</div>}
        {error && <div className="error">{error}</div>}
        <div style={{ marginTop: 14 }}><button onClick={save}>Save</button></div>
      </div>
    </div>
  );
}
