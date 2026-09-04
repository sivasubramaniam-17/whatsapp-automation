"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

const STAGES = ["new", "contacted", "qualified", "won", "lost"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const d = await api(`/contacts?search=${encodeURIComponent(search)}&pageSize=100`);
      setContacts(d.contacts);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function updateStage(id: string, stage: string) {
    await api(`/contacts/${id}`, { method: "PATCH", body: { stage } });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Contacts</h1>
        <div className="row">
          <button className="ghost" onClick={() => setShowImport(true)}>Import CSV</button>
          <button onClick={() => setShowAdd(true)}>Add contact</button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <input
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ maxWidth: 320 }}
        />
        <button className="ghost" onClick={load}>Search</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Tags</th><th>Stage</th><th>Opt-in</th></tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>{c.name || <span className="muted">—</span>}</td>
                <td>{c.waPhone}</td>
                <td>{c.tags.map((t: string) => <span key={t} className="tag">{t}</span>)}</td>
                <td>
                  <select value={c.stage} onChange={(e) => updateStage(c.id, e.target.value)} style={{ width: 130 }}>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>{c.optIn ? <span className="pill green">yes</span> : <span className="pill">no</span>}</td>
              </tr>
            ))}
            {contacts.length === 0 && <tr><td colSpan={5} className="muted">No contacts.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="center" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 10 }} onClick={onClose}>
      <div className="card" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function AddModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [waPhone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    try {
      await api("/contacts", { method: "POST", body: {
        waPhone: waPhone.replace(/\D/g, ""),
        name: name || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        optIn,
      }});
      onDone();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <Modal onClose={onClose}>
      <h2>Add contact</h2>
      <label>Phone (with country code)</label>
      <input value={waPhone} onChange={(e) => setPhone(e.target.value)} placeholder="15551234567" />
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <label>Tags (comma separated)</label>
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="buyer, vip" />
      <label className="row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} style={{ width: "auto" }} /> Opted in to messages
      </label>
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("phone,name,tags,stage\n");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function importCsv() {
    setError("");
    try {
      const r = await api("/contacts/import", { method: "POST", body: { csv, defaultOptIn: true } });
      setResult(r);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <Modal onClose={onClose}>
      <h2>Import contacts (CSV)</h2>
      <p className="muted" style={{ marginTop: 0 }}>Header row: <code>phone,name,tags,stage</code>. Tags separated by <code>;</code></p>
      <textarea rows={7} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ fontFamily: "monospace" }} />
      {result && <div className="pill green" style={{ display: "inline-block", marginTop: 10 }}>
        Imported {result.imported} (created {result.created}, updated {result.updated})
      </div>}
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="ghost" onClick={result ? onDone : onClose}>{result ? "Done" : "Cancel"}</button>
        <button onClick={importCsv}>Import</button>
      </div>
    </Modal>
  );
}
