"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    api("/contacts/stats").then(setStats).catch(() => {});
    api("/campaigns").then((d) => setCampaigns(d.campaigns)).catch(() => {});
    api("/chatbot/flows").then((d) => setFlows(d.flows)).catch(() => {});
    api("/conversations").then((d) => setConversations(d.conversations)).catch(() => {});
  }, []);

  const openConvos = conversations.filter((c) => c.status !== "closed").length;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="card">
          <div className="muted">Contacts</div>
          <div className="stat">{stats?.total ?? "—"}</div>
        </div>
        <div className="card">
          <div className="muted">Opted-in</div>
          <div className="stat">{stats?.optedIn ?? "—"}</div>
        </div>
        <div className="card">
          <div className="muted">Open conversations</div>
          <div className="stat">{openConvos}</div>
        </div>
        <div className="card">
          <div className="muted">Active chatbot rules</div>
          <div className="stat">{flows.filter((f) => f.active).length}</div>
        </div>
      </div>

      <h3 style={{ marginTop: 28 }}>Recent campaigns</h3>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Template</th><th>Status</th><th>Recipients</th></tr>
          </thead>
          <tbody>
            {campaigns.slice(0, 5).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">{c.templateName}</td>
                <td><span className="pill">{c.status}</span></td>
                <td>{c.total}</td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan={4} className="muted">No campaigns yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
