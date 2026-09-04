"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function SequencesPage() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try { setSequences((await api("/sequences")).sequences); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);

  async function enroll(id: string) {
    const tag = prompt("Enroll contacts with which tag? (blank = all opted-in)") ?? "";
    try {
      const r = await api(`/sequences/${id}/enroll`, {
        method: "POST",
        body: tag ? { segmentTags: [tag] } : {},
      });
      setMsg(`Enrolled ${r.enrolled} contacts.`);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function runNow() {
    try {
      const r = await api("/sequences/run", { method: "POST" });
      setMsg(`Ran: ${r.sent} sent, ${r.failed} failed, ${r.completed} completed.`);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Follow-up sequences</h1>
        <div className="row">
          <button className="ghost" onClick={runNow}>Run due steps now</button>
          <button onClick={() => setShowCreate(true)}>New sequence</button>
        </div>
      </div>
      <p className="muted">Automated drip messages that follow up with leads over time (e.g. Day 0, Day 3, Day 7).</p>
      {msg && <div className="pill green" style={{ display: "inline-block" }}>{msg}</div>}
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0, marginTop: 10 }}>
        <table>
          <thead><tr><th>Name</th><th>Steps</th><th>Enrolled</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {sequences.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{(s.steps as any[]).length} steps</td>
                <td>{s._count?.enrollments ?? 0}</td>
                <td>{s.active ? <span className="pill green">yes</span> : <span className="pill">no</span>}</td>
                <td><button className="ghost" onClick={() => enroll(s.id)}>Enroll</button></td>
              </tr>
            ))}
            {sequences.length === 0 && <tr><td colSpan={5} className="muted">No sequences yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState([
    { delayHours: 0, type: "template", templateName: "hello_world", languageCode: "en_US", text: "" },
  ]);
  const [error, setError] = useState("");

  function addStep() {
    setSteps([...steps, { delayHours: 72, type: "template", templateName: "hello_world", languageCode: "en_US", text: "" }]);
  }
  function update(i: number, patch: any) {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    setError("");
    try {
      await api("/sequences", {
        method: "POST",
        body: {
          name,
          steps: steps.map((s) => ({
            delayHours: Number(s.delayHours),
            type: s.type,
            templateName: s.type === "template" ? s.templateName : undefined,
            languageCode: s.languageCode,
            text: s.type === "text" ? s.text : undefined,
          })),
        },
      });
      onDone();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="center" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 10 }} onClick={onClose}>
      <div className="card" style={{ width: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2>New follow-up sequence</h2>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New lead nurture" />
        <div className="muted" style={{ fontSize: 12, margin: "14px 0 6px" }}>STEPS (delay is hours after the previous step)</div>
        {steps.map((s, i) => (
          <div key={i} className="card" style={{ padding: 10, marginBottom: 8 }}>
            <div className="row">
              <div style={{ flex: "0 0 90px" }}>
                <label style={{ margin: 0 }}>Delay (h)</label>
                <input type="number" value={s.delayHours} onChange={(e) => update(i, { delayHours: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ margin: 0 }}>Type</label>
                <select value={s.type} onChange={(e) => update(i, { type: e.target.value })}>
                  <option value="template">Template</option>
                  <option value="text">Text (only in 24h window)</option>
                </select>
              </div>
            </div>
            {s.type === "template"
              ? <><label>Template name</label><input value={s.templateName} onChange={(e) => update(i, { templateName: e.target.value })} /></>
              : <><label>Message</label><textarea rows={2} value={s.text} onChange={(e) => update(i, { text: e.target.value })} /></>}
          </div>
        ))}
        <button className="ghost" onClick={addStep}>+ Add step</button>
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button onClick={save}>Create</button>
        </div>
      </div>
    </div>
  );
}
