#!/usr/bin/env node
/**
 * send-digest.js
 *
 * Builds + sends the weekly Friday digest email. Runs on schedule via
 * .github/workflows/friday-digest.yml. Also runnable locally for testing.
 *
 * Required env:
 *   RESEND_API_KEY        — Resend API key (from resend.com, free tier 3k/month)
 *   DIGEST_FROM           — sender, e.g. "research-pm <noreply@yourdomain>"
 *   DIGEST_TO             — comma-separated recipient list
 *
 * Optional env:
 *   DIGEST_CC             — comma-separated CCs (e.g. lab PI, collaborators)
 *   DIGEST_DRY_RUN        — if '1', print payload but don't send
 *
 * Reads:
 *   progress/YYYY-MM.md   — entries from Mon–Fri of the current ISO week
 *   projects/*.md         — checkpoints closed this week
 *   meta/task-history.json — for duration breakdown
 *
 * Output: one email. Exits 0 on success, non-zero on failure.
 */

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM;
const TO = (process.env.DIGEST_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
const CC = (process.env.DIGEST_CC || "").split(",").map((s) => s.trim()).filter(Boolean);
const DRY = process.env.DIGEST_DRY_RUN === "1";

if (!DRY && (!KEY || !FROM || !TO.length)) {
  console.error("Missing RESEND_API_KEY / DIGEST_FROM / DIGEST_TO. Refusing to run.");
  process.exit(1);
}

/* ---------- date helpers ---------- */

function startOfIsoWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toISODate(d) { return d.toISOString().slice(0, 10); }

const now = new Date();
const weekStart = startOfIsoWeek(now);
const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 4); // Friday
const month = toISODate(weekStart).slice(0, 7);

/* ---------- read progress entries ---------- */

function readProgress() {
  const file = path.join(REPO, `progress/${month}.md`);
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  for (const line of src.split("\n")) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\S+)\s+—\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/);
    if (!m) continue;
    const d = m[1];
    if (d < toISODate(weekStart) || d > toISODate(weekEnd)) continue;
    out.push({ date: d, project: m[2], text: m[3].trim(), duration: m[4] || null });
  }
  return out;
}

function readClosedCheckpoints() {
  const dir = path.join(REPO, "projects");
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f.startsWith("_")) continue;
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const re = /^-\s*\[x\]\s*\*\*(.+?)\*\*\s*—\s*(\d{4}-\d{2}-\d{2})\./gm;
    let m;
    while ((m = re.exec(src))) {
      if (m[2] >= toISODate(weekStart) && m[2] <= toISODate(weekEnd)) {
        out.push({ project: f.replace(".md", ""), name: m[1], date: m[2] });
      }
    }
  }
  return out;
}

/* ---------- build digest ---------- */

const progress = readProgress();
const checkpoints = readClosedCheckpoints();

const byProject = {};
for (const e of progress) (byProject[e.project] = byProject[e.project] || []).push(e);

// Writing streak = distinct dates with any entry this month, consecutive from latest
const writingDates = new Set(progress.map((e) => e.date));
let streak = 0;
const cursor = new Date(now);
while (writingDates.has(toISODate(cursor))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }

const weekStr = toISODate(weekStart) + " to " + toISODate(weekEnd);

const subject = `research-pm digest — week of ${toISODate(weekStart)} (${progress.length} shipped)`;

const text = [
  `Weekly digest — ${weekStr}`,
  "",
  "SHIPPED THIS WEEK",
  "",
  ...Object.entries(byProject).flatMap(([proj, items]) => [
    `${proj}`,
    ...items.map((e) => `  • ${e.text}${e.duration ? ` (${e.duration})` : ""}`),
    "",
  ]),
  checkpoints.length ? "CHECKPOINTS CLOSED" : "",
  "",
  ...checkpoints.map((c) => `  • ${c.name} — ${c.project}`),
  "",
  "STREAK",
  `  ${streak}-day progress streak.`,
  "",
  "—",
  `Built from ${progress.length} progress entries across ${Object.keys(byProject).length} projects.`,
  "Markdown source: github.com/Sayujr/Research-Projects-PM",
].filter(Boolean).join("\n");

const html = `
<div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2b3340;">
  <h1 style="color:#1a2332;font-size:20px;margin-bottom:4px;">Weekly digest — ${weekStr}</h1>
  <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">
    ${progress.length} entries · ${checkpoints.length} checkpoint${checkpoints.length === 1 ? "" : "s"} closed · ${streak}-day streak
  </p>
  ${Object.entries(byProject).map(([proj, items]) => `
    <h3 style="color:#2d7a7a;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-top:20px;margin-bottom:8px;">${proj}</h3>
    <ul style="margin-left:18px;padding-left:0;">${items.map((e) =>
      `<li style="margin-bottom:6px;"><strong>${escapeHtml(e.text)}</strong>${e.duration ? ` <span style='color:#6b7280;font-size:12px;'>(${e.duration})</span>` : ""}</li>`
    ).join("")}</ul>
  `).join("")}
  ${checkpoints.length ? `
    <h3 style="color:#2d7a7a;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-top:20px;margin-bottom:8px;">Checkpoints closed</h3>
    <ul style="margin-left:18px;padding-left:0;">
      ${checkpoints.map((c) => `<li><strong>${escapeHtml(c.name)}</strong> — ${c.project}</li>`).join("")}
    </ul>` : ""}
  <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;">
    Source: <a href="https://github.com/Sayujr/Research-Projects-PM" style="color:#2d7a7a;">Research-Projects-PM</a> · generated automatically Friday.
  </p>
</div>`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- send ---------- */

async function send() {
  if (DRY) {
    console.log("DRY RUN");
    console.log("Subject:", subject);
    console.log("---");
    console.log(text);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      cc: CC.length ? CC : undefined,
      subject,
      text,
      html,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Resend ${res.status}: ${body}`);
    process.exit(1);
  }
  console.log(`Sent: ${body}`);
}

if (progress.length === 0 && checkpoints.length === 0) {
  console.log("No entries this week — skipping digest.");
  process.exit(0);
}

send().catch((e) => { console.error(e); process.exit(1); });
