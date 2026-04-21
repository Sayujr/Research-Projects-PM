#!/usr/bin/env node
/**
 * notify-slack.js
 *
 * Posts a message to a Slack incoming webhook. Called from workflows
 * after significant events (blocker filed, weekly digest, etc.).
 *
 * Required env:
 *   SLACK_WEBHOOK_URL   — from Slack: Apps → Incoming Webhooks → Add
 *
 * CLI:
 *   node tools/notify-slack.js "<text message, Markdown-ish>"
 *
 * Exits 0 if not configured (so it never breaks a workflow if the
 * webhook isn't set up).
 */

const URL = process.env.SLACK_WEBHOOK_URL;
const text = process.argv.slice(2).join(" ").trim();

if (!URL) {
  console.log("SLACK_WEBHOOK_URL not set — skipping Slack notification.");
  process.exit(0);
}
if (!text) {
  console.error("notify-slack: no message provided.");
  process.exit(1);
}

(async () => {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Slack ${res.status}: ${body}`);
    process.exit(1);
  }
  console.log("Slack notification sent.");
})().catch((e) => { console.error(e); process.exit(1); });
