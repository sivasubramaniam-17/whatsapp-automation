"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState("");

  async function load() {
    try { setCampaigns((await api("/campaigns")).campaigns); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function open(id: string) {
    const d = await api(`/campaigns/${id}`);
    setSelected(d);
  }

  async function send(id: string) {
    if (!confirm("Send this broadcast now?")) return;
    await api(`/campaigns/${id}/send`, { method: "POST" });
    await open(id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Campaigns</h1>
        <button onClick={() => setShowCreate(true)}>New broadcast</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Template</th><th>Segment</th><th>Status</th><th>Recipients</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">{c.templateName}</td>
                <td>{[...c.segmentTags, ...c.segmentStages].map((t: string) => <span key={t} className="tag">{t}</span>) || "all"}</td>
                <td><span className={`pill ${c.status === "completed" ? "green" : ""}`}>{c.status}</span></td>
                <td>{c.total}</td>
                <td className="row">
                  <button className="ghost" onClick={() => open(c.id)}>Report</button>
                  {c.status === "draft" && <button onClick={() => send(c.id)}>Send</button>}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={6} className="muted">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      {selected && <ReportModal data={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="center" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 10 }} onClick={onClose}>
      <div className="card" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [templateName, setTemplate] = useState("hello_world");
  const [segmentTags, setTags] = useState("");
  const [error, setError] = useState("");
  const [audience, setAudience] = useState<number | null>(null);

  async function create() {
    setError("");
    try {
      const r = await api("/campaigns", { method: "POST", body: {
        name, templateName,
        segmentTags: segmentTags ? segmentTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        optInOnly: true,
      }});
      setAudience(r.audience);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <Modal onClose={onClose}>
      <h2>New broadcast</h2>
      <label>Campaign name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <label>Approved template name</label>
      <input value={templateName} onChange={(e) => setTemplate(e.target.value)} />
      <label>Segment tags (comma separated, blank = all opted-in)</label>
      <input value={segmentTags} onChange={(e) => setTags(e.target.value)} placeholder="buyer, vip" />
      {audience !== null && <div className="pill green" style={{ display: "inline-block", marginTop: 10 }}>Created · audience: {audience} contacts</div>}
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="ghost" onClick={audience !== null ? onDone : onClose}>{audience !== null ? "Done" : "Cancel"}</button>
        {audience === null && <button onClick={create}>Create draft</button>}
      </div>
    </Modal>
  );
}

function ReportModal({ data, onClose }: { data: any; onClose: () => void }) {
  const { campaign, stats } = data;
  const items = [
    ["Sent", stats.sent], ["Delivered", stats.delivered],
    ["Read", stats.read], ["Failed", stats.failed], ["Pending", stats.pending],
  ];
  return (
    <Modal onClose={onClose}>
      <h2>{campaign.name}</h2>
      <p className="muted" style={{ marginTop: 0 }}>Template: {campaign.templateName} · {campaign.status}</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", textAlign: "center" }}>
        {items.map(([label, n]) => (
          <div key={label as string} className="card">
            <div className="stat" style={{ fontSize: 22 }}>{n as number}</div>
            <div className="muted" style={{ fontSize: 12 }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
