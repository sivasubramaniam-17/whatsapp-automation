// Feature #4 — heuristic lead scoring. Reads a conversation's inbound messages
// and infers hot/warm/cold + a short summary + suggested tags. No LLM, no cost.
// Structured so an LLM (Claude / Gemini) can replace scoreConversation() later.

interface Scored {
  leadScore: "hot" | "warm" | "cold";
  summary: string;
  tags: string[];
  suggestedStage: "new" | "contacted" | "qualified" | "won" | "lost";
}

// Buying-intent signals, weighted. Tuned for real-estate / agency sales chat.
const HOT = [
  "buy", "purchase", "book", "site visit", "visit", "schedule", "when can",
  "available", "price", "cost", "budget", "loan", "emi", "ready to", "interested in buying",
  "advance", "token", "deal", "finalize", "call me", "contact me",
];
const WARM = [
  "interested", "details", "more info", "brochure", "location", "size",
  "bhk", "sq ft", "photos", "options", "tell me", "how much", "features",
];
const COLD = [
  "not interested", "no thanks", "stop", "later", "just looking", "browsing",
  "too expensive", "not now", "maybe", "unsubscribe",
];

// Simple intent tags to auto-apply.
const TAG_RULES: { tag: string; words: string[] }[] = [
  { tag: "wants-visit", words: ["site visit", "visit", "schedule", "book"] },
  { tag: "price-sensitive", words: ["price", "cost", "budget", "emi", "loan", "expensive"] },
  { tag: "hot-lead", words: ["buy", "ready to", "finalize", "advance", "token"] },
  { tag: "needs-info", words: ["details", "brochure", "more info", "photos", "features"] },
];

function countHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

const SCORES = ["hot", "warm", "cold"] as const;
const STAGES = ["new", "contacted", "qualified", "won", "lost"] as const;

const SCORE_SYSTEM = `You are a sales assistant scoring a WhatsApp lead from their messages.
Output ONLY JSON: {"leadScore","suggestedStage","tags","summary"}.
- leadScore: "hot" (strong buying intent), "warm" (interested), or "cold" (low intent / not interested).
- suggestedStage: "new" | "contacted" | "qualified" | "won" | "lost".
- tags: 1-4 short lowercase intent tags (e.g. "wants-visit","price-sensitive","hot-lead").
- summary: one sentence for the sales rep.
JSON only, no prose.`;

// Smart scoring: try the LLM, validate, else fall back to heuristics.
export async function scoreConversationSmart(inboundTexts: string[]): Promise<Scored> {
  const { llmJson } = await import("./llm");
  const raw = await llmJson<any>(SCORE_SYSTEM, inboundTexts.join("\n"));
  if (raw && typeof raw === "object") {
    const leadScore = SCORES.includes(raw.leadScore) ? raw.leadScore : null;
    const suggestedStage = STAGES.includes(raw.suggestedStage) ? raw.suggestedStage : "contacted";
    if (leadScore) {
      const tags = Array.isArray(raw.tags)
        ? raw.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 4)
        : [];
      const summary = typeof raw.summary === "string" ? raw.summary.slice(0, 300) : "";
      return { leadScore, suggestedStage, tags, summary };
    }
  }
  return scoreConversation(inboundTexts);
}

export function scoreConversation(inboundTexts: string[]): Scored {
  const text = inboundTexts.join(" \n ").toLowerCase();

  const hot = countHits(text, HOT);
  const warm = countHits(text, WARM);
  const cold = countHits(text, COLD);

  let leadScore: Scored["leadScore"];
  let suggestedStage: Scored["suggestedStage"];
  if (cold > hot && cold >= warm) {
    leadScore = "cold";
    suggestedStage = "lost";
  } else if (hot >= 2 || (hot >= 1 && warm >= 1)) {
    leadScore = "hot";
    suggestedStage = "qualified";
  } else if (hot >= 1 || warm >= 1) {
    leadScore = "warm";
    suggestedStage = "contacted";
  } else {
    leadScore = "cold";
    suggestedStage = "new";
  }

  const tags = TAG_RULES.filter((r) => countHits(text, r.words) > 0).map((r) => r.tag);

  const last = inboundTexts[inboundTexts.length - 1]?.slice(0, 120) ?? "";
  const summary =
    `${leadScore.toUpperCase()} lead — ${inboundTexts.length} message(s). ` +
    (tags.length ? `Signals: ${tags.join(", ")}. ` : "") +
    (last ? `Last said: “${last}”` : "");

  return { leadScore, summary, tags, suggestedStage };
}
