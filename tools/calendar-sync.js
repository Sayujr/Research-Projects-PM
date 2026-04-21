#!/usr/bin/env node
/**
 * calendar-sync.js
 *
 * Pulls events from Google Calendar (and optionally Outlook/M365) for
 * the current ISO month and writes them to calendar/YYYY-MM.md as
 * markdown. Runs nightly via .github/workflows/nightly-sync.yml.
 *
 * OAuth model: refresh-token based. Users obtain a refresh token once
 * via the local bootstrap script (see docs/calendar-setup.html) and
 * store it as a repo secret. No device flow at runtime — the Action
 * just exchanges the refresh token for an access token and calls the
 * API.
 *
 * Required env (Google):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_IDS     — comma-separated calendar IDs (work, personal)
 *
 * Optional env (Outlook):
 *   OUTLOOK_CLIENT_ID
 *   OUTLOOK_CLIENT_SECRET
 *   OUTLOOK_REFRESH_TOKEN
 *
 * Optional env:
 *   CALENDAR_SYNC_DRY_RUN   — if '1', log events but don't write file
 *
 * Writes:
 *   calendar/YYYY-MM.md     — synced events for the current month
 *
 * Exits 0 on success; non-zero on failure.
 */

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const DRY = process.env.CALENDAR_SYNC_DRY_RUN === "1";

/* ---------- time helpers ---------- */

function monthBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

function monthLabel(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* ---------- Google Calendar ---------- */

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token exchange: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function fetchGoogleEvents(accessToken, calendarId, start, end) {
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Google fetch (${calendarId}): ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.items || []).map((e) => ({
    source: "google",
    calendar: calendarId,
    id: e.id,
    title: e.summary || "(untitled)",
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: !e.start?.dateTime,
    location: e.location || null,
    description: e.description || null,
  }));
}

async function syncGoogle() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return [];
  const { start, end } = monthBounds();
  const accessToken = await getGoogleAccessToken();
  const ids = (process.env.GOOGLE_CALENDAR_IDS || "primary").split(",").map((s) => s.trim());
  const events = [];
  for (const id of ids) {
    const batch = await fetchGoogleEvents(accessToken, id, start, end);
    events.push(...batch);
  }
  return events;
}

/* ---------- Outlook / Microsoft Graph ---------- */

async function syncOutlook() {
  if (!process.env.OUTLOOK_REFRESH_TOKEN) return [];
  // TODO — Phase 4.5: exchange refresh token, call /me/calendarView
  console.warn("Outlook sync is not yet implemented — skipping.");
  return [];
}

/* ---------- classify open blocks ---------- */

function classifyOpenBlocks(events, date = new Date()) {
  /* Walk working hours (09:00–18:00) for each weekday of the month,
     subtract meetings, tag the gaps by type. Simplistic version — the
     real classifier lives in the standup command. */
  const { start, end } = monthBounds(date);
  const blocks = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const dayStr = cursor.toISOString().slice(0, 10);
      const dayMeetings = events.filter((e) => (e.start || "").slice(0, 10) === dayStr);
      // We don't classify here — just list the meetings. The standup
      // command's classifier does the real work when planning a day.
      blocks.push({ date: dayStr, meetings: dayMeetings.length });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return blocks;
}

/* ---------- write markdown ---------- */

function renderMarkdown(events, label) {
  const byDay = {};
  for (const e of events) {
    const day = (e.start || "").slice(0, 10);
    if (!day) continue;
    (byDay[day] = byDay[day] || []).push(e);
  }
  const days = Object.keys(byDay).sort();
  const out = [
    `# Calendar — ${label}`,
    "",
    "_Synced nightly. Source: Google Calendar / Outlook. Read-only mirror;",
    "do not hand-edit — edits are overwritten by the next sync._",
    "",
  ];
  for (const day of days) {
    out.push(`## ${day}`, "");
    for (const e of byDay[day].sort((a, b) => (a.start || "").localeCompare(b.start || ""))) {
      const startT = e.start && e.start.length > 10 ? e.start.slice(11, 16) : "all-day";
      const endT = e.end && e.end.length > 10 ? e.end.slice(11, 16) : "";
      const timeStr = startT === "all-day" ? "all-day" : `${startT}–${endT}`;
      out.push(`- \`${timeStr}\` **${e.title}**${e.location ? ` · ${e.location}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n");
}

/* ---------- main ---------- */

(async () => {
  try {
    const events = [...(await syncGoogle()), ...(await syncOutlook())];
    const label = monthLabel();
    const md = renderMarkdown(events, label);

    if (DRY) {
      console.log("DRY RUN — would write to calendar/" + label + ".md:");
      console.log(md);
      return;
    }

    const file = path.join(REPO, "calendar", `${label}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, md);
    console.log(`Synced ${events.length} events to calendar/${label}.md`);

    // Block classifier hint for standup
    const blocks = classifyOpenBlocks(events);
    const totalDays = blocks.length;
    const busyDays = blocks.filter((b) => b.meetings > 0).length;
    console.log(`Working days: ${totalDays}; days with meetings: ${busyDays}.`);
  } catch (e) {
    console.error("calendar-sync:", e.message);
    process.exit(1);
  }
})();
