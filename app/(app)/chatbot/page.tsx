"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function ChatbotPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try { setFlows((await api("/chatbot/flows")).flows); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(f: any) {
    await api(`/chatbot/flows/${f.id}`, { method: "PATCH", body: { active: !f.active } });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    await api(`/chatbot/flows/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Chatbot auto-replies</h1>
        <div className="row">
          <button className="ghost" onClick={() => setShowGen(true)}>✨ Build from description</button>
          <button onClick={() => setShowCreate(true)}>New rule</button>
        </div>
      </div>
      <p className="muted">Rules run on every incoming message: a welcome on the first message, keyword matches by priority, then a default fallback.</p>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Trigger</th><th>Keywords</th><th>Reply</th><th>Handoff</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td><span className="pill">{f.trigger}</span></td>
                <td>{f.keywords.map((k: string) => <span key={k} className="tag">{k}</span>)}</td>
                <td className="muted" style={{ maxWidth: 240 }}>{f.responseText}</td>
                <td>{f.handoff ? <span className="pill warn">human</span> : "—"}</td>
                <td><input type="checkbox" checked={f.active} onChange={() => toggle(f)} style={{ width: "auto" }} /></td>
                <td><button className="ghost" onClick={() => remove(f.id)}>Delete</button></td>
              </tr>
            ))}
            {flows.length === 0 && <tr><td colSpan={7} className="muted">No rules yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
      {showGen && <GenModal onClose={() => setShowGen(false)} onDone={() => { setShowGen(false); load(); }} />}
    </div>
  );
}

function GenModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [instruction, setInstruction] = useState(
    "If someone asks about price, tell them our 2BHK starts at 45L.\nWhen they say hi, welcome them and ask what they're looking for.\nIf they want an agent, connect them to a human.",
  );
  const [drafts, setDrafts] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function generate() {
    setError(""); setDrafts(null);
    try {
      const r = await api("/chatbot/generate", { method: "POST", body: { instruction } });
      setDrafts(r.drafts);
    } catch (e) { setError((e as Error).message); }
  }
  async function saveAll() {
    if (!drafts) return;
    setSaving(true);
    try {
      for (const d of drafts) await api("/chatbot/flows", { method: "POST", body: d });
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  return (
    <div className="center" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 10 }} onClick={onClose}>
      <div className="card" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2>✨ Build chatbot from a description</h2>
        <p className="muted" style={{ marginTop: 0 }}>Describe your auto-replies in plain English — one rule per line.</p>
        <textarea rows={5} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        {drafts && (
          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Preview ({drafts.length} rules):</div>
            {drafts.map((d, i) => (
              <div key={i} className="card" style={{ padding: 10, marginBottom: 6 }}>
                <span className="pill">{d.trigger}</span>{" "}
                {d.keywords.map((k: string) => <span key={k} className="tag">{k}</span>)}
                {d.handoff && <span className="pill warn">human</span>}
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{d.responseText || "(sends booking slots)"}</div>
              </div>
            ))}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          {!drafts ? <button onClick={generate}>Generate</button>
            : <button onClick={saveAll} disabled={saving}>{saving ? "Saving…" : `Save ${drafts.length} rules`}</button>}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("keyword");
  const [keywords, setKeywords] = useState("");
  const [responseText, setResponse] = useState("");
  const [handoff, setHandoff] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      await api("/chatbot/flows", { method: "POST", body: {
        name, trigger,
        keywords: trigger === "keyword" ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        responseText, handoff,
      }});
      onDone();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="center" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 10 }} onClick={onClose}>
      <div className="card" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2>New auto-reply rule</h2>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Trigger</label>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="welcome">Welcome (first message)</option>
          <option value="keyword">Keyword match</option>
          <option value="booking">Booking (offer visit slots)</option>
          <option value="default">Default fallback</option>
        </select>
        {(trigger === "keyword" || trigger === "booking") && (
          <>
            <label>Keywords (comma separated)</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="price, cost, pricing" />
          </>
        )}
        <label>Reply message</label>
        <textarea rows={3} value={responseText} onChange={(e) => setResponse(e.target.value)} />
        <label className="row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={handoff} onChange={(e) => setHandoff(e.target.checked)} style={{ width: "auto" }} /> Hand off to a human (mark conversation pending)
        </label>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button onClick={save}>Save rule</button>
        </div>
      </div>
    </div>
  );
}
