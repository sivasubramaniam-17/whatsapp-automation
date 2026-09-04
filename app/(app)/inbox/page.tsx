"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [lead, setLead] = useState<any>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  async function loadList() {
    try { setConversations((await api("/conversations")).conversations); }
    catch (e) { setError((e as Error).message); }
  }
  async function loadThread(id: string) {
    setActiveId(id);
    setLead(null);
    const d = await api(`/conversations/${id}`);
    setThread(d);
    setTimeout(() => msgsRef.current?.scrollTo(0, msgsRef.current.scrollHeight), 50);
  }

  async function scoreLead() {
    if (!thread) return;
    setError("");
    try {
      const r = await api(`/conversations/${thread.conversation.id}/analyze`, { method: "POST" });
      setLead(r);
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { loadList(); }, []);

  async function send() {
    if (!reply.trim() || !thread) return;
    setError("");
    try {
      await api("/whatsapp/send", { method: "POST", body: {
        to: thread.conversation.contact.waPhone, type: "text", text: reply,
      }});
      setReply("");
      await loadThread(thread.conversation.id);
      loadList();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div>
      <div className="page-head"><h1>Inbox</h1></div>
      {error && <div className="error">{error}</div>}
      <div className="inbox">
        <div className="convo-list">
          {conversations.map((c) => (
            <div key={c.id} className={`convo ${activeId === c.id ? "active" : ""}`} onClick={() => loadThread(c.id)}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{c.contact.name || c.contact.waPhone}</strong>
                {c.status === "pending" && <span className="pill warn">needs human</span>}
              </div>
              <div className="muted" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.lastMessage ? (c.lastMessage.direction === "outbound" ? "You: " : "") + c.lastMessage.content : "—"}
              </div>
            </div>
          ))}
          {conversations.length === 0 && <div className="convo muted">No conversations yet.</div>}
        </div>

        <div className="thread">
          {!thread ? (
            <div className="center muted" style={{ flex: 1 }}>Select a conversation</div>
          ) : (
            <>
              <div className="row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", justifyContent: "space-between" }}>
                <div>
                  <strong>{thread.conversation.contact.name || thread.conversation.contact.waPhone}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{thread.conversation.contact.waPhone}</div>
                </div>
                <div className="row">
                  <button className="ghost" onClick={scoreLead}>Score lead</button>
                  {thread.windowOpen
                    ? <span className="pill green">24h window open</span>
                    : <span className="pill warn">window closed · template only</span>}
                </div>
              </div>
              {lead && (
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                  <span className={`pill ${lead.leadScore === "hot" ? "warn" : lead.leadScore === "warm" ? "green" : ""}`}>
                    {lead.leadScore?.toUpperCase()} · {lead.stage}
                  </span>{" "}
                  {(lead.tags ?? []).map((t: string) => <span key={t} className="tag">{t}</span>)}
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{lead.summary}</div>
                </div>
              )}
              <div className="msgs" ref={msgsRef}>
                {thread.conversation.messages.map((m: any) => (
                  <div key={m.id} className={`bubble ${m.direction}`}>
                    {m.content}
                    <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{m.status}</div>
                  </div>
                ))}
              </div>
              <div className="composer">
                <input
                  placeholder={thread.windowOpen ? "Type a reply…" : "Window closed — only templates can be sent"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={!thread.windowOpen}
                />
                <button onClick={send} disabled={!thread.windowOpen}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
