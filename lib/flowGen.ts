// Feature #2 — turn a plain-English description into chatbot flow drafts.
// Rule-based, no LLM. Handles inputs like:
//   "If someone asks about price, tell them our 2BHK starts at 45L."
//   "When they say hi, welcome them and ask what they're looking for."
//   "If they want an agent, connect them to a human."
// One sentence (or line) → one draft flow. Users review before saving.
// Swap parseInstruction() for an LLM call later to handle free-form phrasing.

export interface FlowDraft {
  name: string;
  trigger: "welcome" | "keyword" | "default";
  keywords: string[];
  matchType: "contains" | "exact";
  responseText: string;
  handoff: boolean;
}

const STOPWORDS = new Set([
  "the", "a", "an", "about", "for", "to", "of", "and", "or", "our", "your",
  "they", "them", "someone", "customer", "user", "asks", "ask", "asking",
  "says", "say", "saying", "wants", "want", "mentions", "mention", "is", "are",
  "if", "when", "whenever", "regarding", "on", "in", "me", "we",
]);

// Split the condition/response on the first response cue. Only strong,
// unambiguous cues — bare verbs like "say"/"send" are omitted because they
// appear inside conditions ("when they say hi").
const RESPONSE_CUES = [
  "->", "then reply with", "then reply", "then tell them", "then respond with",
  "then respond", "reply with", "tell them", "respond with", "answer with",
  "message them", "reply", "respond",
];

function splitCondResponse(sentence: string): { cond: string; resp: string } | null {
  const lower = sentence.toLowerCase();
  let best = -1;
  let cueLen = 0;
  for (const cue of RESPONSE_CUES) {
    const idx = lower.indexOf(cue);
    if (idx >= 0 && (best === -1 || idx < best)) {
      best = idx;
      cueLen = cue.length;
    }
  }
  // Fall back to a comma split if no explicit cue.
  if (best === -1) {
    const comma = sentence.indexOf(",");
    if (comma === -1) return null;
    return { cond: sentence.slice(0, comma), resp: sentence.slice(comma + 1).trim() };
  }
  return { cond: sentence.slice(0, best), resp: sentence.slice(best + cueLen).trim() };
}

function extractKeywords(cond: string): string[] {
  // Prefer quoted phrases.
  const quoted = [...cond.matchAll(/[“"']([^”"']+)[”"']/g)].map((m) => m[1].trim());
  if (quoted.length) return quoted.map((q) => q.toLowerCase());

  // Otherwise take meaningful words after common lead-ins.
  const cleaned = cond
    .toLowerCase()
    .replace(/^\s*(if|when|whenever)\b/, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // De-dupe, cap at 5.
  return [...new Set(words)].slice(0, 5);
}

function parseInstruction(sentence: string): FlowDraft | null {
  const trimmed = sentence.trim();
  if (!trimmed) return null;

  const split = splitCondResponse(trimmed);
  const cond = split ? split.cond : trimmed;
  const resp = split ? split.resp : trimmed;

  // Detect welcome/handoff from the FULL sentence (not just the condition),
  // so cues buried mid-sentence don't hide them.
  const full = trimmed.toLowerCase();
  const isWelcome = /\b(welcome|greet|first message|says? hi|says? hello|starts? (chat|conversation))\b/.test(full);
  const isHandoff = /\b(agent|human|representative|team|staff|talk to (someone|a person)|call)\b/.test(
    (resp + " " + cond).toLowerCase(),
  );

  const keywords = isWelcome ? [] : extractKeywords(cond);
  const trigger: FlowDraft["trigger"] = isWelcome
    ? "welcome"
    : keywords.length
      ? "keyword"
      : "default";

  const responseText = split ? resp : trimmed;
  if (!responseText) return null;

  const name = isWelcome
    ? "Welcome"
    : keywords.length
      ? `Reply: ${keywords[0]}`
      : "Fallback";

  return {
    name,
    trigger,
    keywords,
    matchType: "contains",
    responseText: responseText.replace(/\s+/g, " ").trim(),
    handoff: isHandoff,
  };
}

// ---- LLM-backed variant (OpenRouter) with heuristic fallback ----

const TRIGGERS = ["welcome", "keyword", "default", "booking"] as const;

function normalizeDraft(raw: any): FlowDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const trigger = TRIGGERS.includes(raw.trigger) ? raw.trigger : "keyword";
  const responseText = typeof raw.responseText === "string" ? raw.responseText.trim() : "";
  if (trigger !== "booking" && !responseText) return null;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.map((k: any) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 6)
    : [];
  if ((trigger === "keyword" || trigger === "booking") && keywords.length === 0) return null;
  return {
    name: typeof raw.name === "string" && raw.name ? raw.name.slice(0, 60) : "Rule",
    trigger,
    keywords,
    matchType: raw.matchType === "exact" ? "exact" : "contains",
    responseText,
    handoff: !!raw.handoff,
  };
}

const FLOW_SYSTEM = `You convert a business owner's plain-English description of WhatsApp auto-replies into chatbot rules.
Output ONLY a JSON array. Each element: {"name","trigger","keywords","matchType","responseText","handoff"}.
- trigger: "welcome" (first message of a chat), "keyword" (matches keywords), "booking" (offers appointment slots), or "default" (fallback).
- keywords: lowercase trigger words (required for "keyword" and "booking"; empty for welcome/default).
- matchType: "contains" unless an exact match is clearly intended.
- responseText: the reply to send (leave "" for "booking", which auto-sends slots).
- handoff: true if the rule should hand off to a human agent.
Produce one rule per distinct instruction. No prose, JSON only.`;

// Smart generation: try the LLM, validate, else fall back to heuristics.
export async function generateFlowsSmart(instruction: string): Promise<FlowDraft[]> {
  const { llmJson } = await import("./llm");
  const raw = await llmJson<any[]>(FLOW_SYSTEM, instruction);
  if (Array.isArray(raw)) {
    const drafts = raw.map(normalizeDraft).filter((d): d is FlowDraft => !!d);
    if (drafts.length) return drafts;
  }
  return generateFlows(instruction);
}

// Split a multi-line / multi-sentence instruction into individual drafts.
export function generateFlows(instruction: string): FlowDraft[] {
  const parts = instruction
    .split(/\n+|(?<=[.?!])\s+(?=(?:if|when|whenever)\b)/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const source = parts.length ? parts : [instruction];
  const drafts: FlowDraft[] = [];
  for (const part of source) {
    const draft = parseInstruction(part);
    if (draft) drafts.push(draft);
  }
  return drafts;
}
