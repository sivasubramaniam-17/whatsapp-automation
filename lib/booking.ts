// Feature #5 — appointment / site-visit booking slots. Pure logic, no cost.

export interface Slot {
  index: number; // 1-based, what the customer replies with
  start: string; // ISO string
  label: string; // human-friendly, e.g. "Fri, Sep 5 · 11:00 AM"
}

const HOURS = [11, 14, 16]; // 11am, 2pm, 4pm slots each day
const DAYS_AHEAD = 3; // offer the next 3 business days

function fmt(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Generate the next available slots (skips weekends).
export function generateSlots(from: Date = new Date()): Slot[] {
  const slots: Slot[] = [];
  const cursor = new Date(from);
  let days = 0;
  let index = 1;
  while (days < DAYS_AHEAD) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue; // skip Sun/Sat
    days++;
    for (const h of HOURS) {
      const slot = new Date(cursor);
      slot.setHours(h, 0, 0, 0);
      slots.push({ index: index++, start: slot.toISOString(), label: fmt(slot) });
    }
  }
  return slots;
}

// Render a slot list as a WhatsApp message body.
export function slotsMessage(slots: Slot[]): string {
  const lines = slots.map((s) => `${s.index}. ${s.label}`);
  return (
    "Sure! Here are available slots for a visit — reply with the number:\n\n" +
    lines.join("\n") +
    "\n\nReply 0 to cancel."
  );
}

// Parse a customer's reply into a chosen slot (or null / cancel).
export function parseSlotChoice(
  reply: string,
  slots: Slot[],
): { slot?: Slot; cancel?: boolean } | null {
  const m = reply.trim().match(/^\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (n === 0) return { cancel: true };
  const slot = slots.find((s) => s.index === n);
  return slot ? { slot } : null;
}
