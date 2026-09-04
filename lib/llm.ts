// OpenRouter LLM client (OpenAI-compatible). Optional — used to upgrade the
// chatbot builder (#2) and lead scoring (#4). When OPENROUTER_API_KEY is unset,
// callers fall back to the free heuristic implementations.
//
// Free models work here — set OPENROUTER_MODEL to e.g.
//   google/gemini-2.0-flash-exp:free   (default)
//   meta-llama/llama-3.3-70b-instruct:free

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "inclusionai/ling-3.0-flash-fin:free";

export function llmEnabled(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// Extract the first JSON object/array from a model response (models sometimes
// wrap JSON in prose or ```json fences).
function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  // Walk to the matching closing bracket.
  const open = candidate[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === open) depth++;
    else if (candidate[i] === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Ask the model for JSON and parse it. Returns null on any failure so callers
// can fall back to heuristics.
export async function llmJson<T = unknown>(
  system: string,
  user: string,
): Promise<T | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "WhatsApp Automation SaaS",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
      // Don't let a slow model hang the request forever (falls back on timeout).
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error("[llm] OpenRouter error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    return extractJson(content) as T | null;
  } catch (err) {
    console.error("[llm] request failed:", (err as Error).message);
    return null;
  }
}
