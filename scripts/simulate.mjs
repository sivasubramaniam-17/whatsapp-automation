// Simulate an incoming WhatsApp message hitting your LOCAL webhook — so you can
// test the chatbot, booking, and lead-scoring flows without a phone or a live
// Meta connection.
//
// Usage (server must be running on :4000):
//   node scripts/simulate.mjs <phone> "<message text>"
//
// Examples (run in order to test booking):
//   node scripts/simulate.mjs 919000000009 "hi"
//   node scripts/simulate.mjs 919000000009 "I want to book a visit"
//   node scripts/simulate.mjs 919000000009 "1"
//
// Then open http://localhost:4000 → Inbox / Appointments to see the result.

import fs from "node:fs";
import crypto from "node:crypto";

const [, , phone, ...rest] = process.argv;
const text = rest.join(" ");
if (!phone || !text) {
  console.error('Usage: node scripts/simulate.mjs <phone> "<message>"');
  process.exit(1);
}

// Read the values the webhook needs from .env.
const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`${k}\\s*=\\s*"?([^"\\n]+)"?`)) || [])[1];
const APP_SECRET = get("WHATSAPP_APP_SECRET");
const PHONE_NUMBER_ID = get("WHATSAPP_PHONE_NUMBER_ID") || "1274206122443422";
const BASE = process.env.BASE_URL || "http://localhost:4000";

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1367406292234420",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15551969058", phone_number_id: PHONE_NUMBER_ID },
            contacts: [{ profile: { name: "Test Customer" }, wa_id: phone }],
            messages: [
              {
                from: phone,
                id: "sim." + Date.now(),
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
};

const raw = JSON.stringify(payload);
const headers = { "Content-Type": "application/json" };
// Sign the payload if an app secret is configured (webhook verifies it).
if (APP_SECRET) {
  headers["x-hub-signature-256"] =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
}

const res = await fetch(`${BASE}/api/whatsapp/webhook`, { method: "POST", headers, body: raw });
console.log(`→ sent "${text}" from ${phone}  ·  webhook responded ${res.status} ${await res.text()}`);
console.log("Open http://localhost:4000 → Inbox to see the conversation.");
