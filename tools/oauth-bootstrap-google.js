#!/usr/bin/env node
/**
 * oauth-bootstrap-google.js
 *
 * One-time local script to mint a Google OAuth refresh token for
 * research-pm's calendar sync.
 *
 * Prerequisites:
 *   - A Google Cloud OAuth 2.0 client (Desktop app type) — see
 *     docs/integrations.html for the console steps.
 *   - A redirect URI of http://localhost:8787/oauth2callback on the
 *     client.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=...    \
 *   GOOGLE_CLIENT_SECRET=... \
 *   node tools/oauth-bootstrap-google.js
 *
 * The script:
 *   1. Prints a URL — paste into your browser, grant consent
 *   2. Google redirects to localhost:8787 with a code
 *   3. Script exchanges code for access + refresh tokens
 *   4. Prints the refresh token
 *
 * You then store the refresh token as a repo secret
 * (GOOGLE_REFRESH_TOKEN). Subsequent API calls in the GitHub Action
 * use the refresh token to mint short-lived access tokens.
 */

const http = require("http");
const crypto = require("crypto");
const { URL, URLSearchParams } = require("url");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.");
  console.error("See docs/integrations.html → Google Calendar sync.");
  process.exit(1);
}

const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
const STATE = crypto.randomBytes(16).toString("hex");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", STATE);

console.log("Open this URL in your browser and grant consent:\n");
console.log(authUrl.toString(), "\n");
console.log(`Listening on http://localhost:${PORT} for the redirect…\n`);

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  if (parsed.pathname !== "/oauth2callback") {
    res.writeHead(404); return res.end();
  }
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  if (state !== STATE) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("State mismatch — possible CSRF. Aborting.");
    server.close();
    return;
  }
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Missing code parameter.");
    server.close();
    return;
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await r.json();

    if (!r.ok || !data.refresh_token) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Token exchange failed: " + JSON.stringify(data));
      console.error("\nToken exchange failed:", data);
      server.close();
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><html><body style="font-family:system-ui;padding:40px;">
      <h2 style="color:#1a2332;">Done.</h2>
      <p>Refresh token printed in the terminal. You can close this tab.</p>
    </body></html>`);

    console.log("\nRefresh token (store as GOOGLE_REFRESH_TOKEN):\n");
    console.log(data.refresh_token);
    console.log("\nAccess token (one-time, expires in 1h):");
    console.log(data.access_token);
    console.log("\nAdd to repo → Settings → Secrets → Actions as GOOGLE_REFRESH_TOKEN.");
    server.close();
  } catch (e) {
    res.writeHead(500);
    res.end("Error: " + e.message);
    console.error(e);
    server.close();
  }
});

server.listen(PORT);
