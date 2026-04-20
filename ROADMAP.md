# Production roadmap

From the current demo (static site + presentation deck) to a tool that a real lab of 5–15 people can use for actual project work.

No marketing, no hand-waving. Concrete steps, honest effort estimates, what NOT to build.

---

## 0. Decisions to lock before any code  (~30 minutes with the PI)

| Decision | Options | Impact |
|---|---|---|
| **Scope** | Solo PI / small team (3–5) / large lab (8–15) | Determines multi-user layer. Large labs double the effort. |
| **Repo ownership** | One shared repo per lab / one per person | Shared is simpler + enables real cross-project views. Per-person preserves privacy but makes reporting messy. |
| **Privacy level** | Public repo / private repo / Cloudflare Access password / institutional SSO | Free path: public repo + Cloudflare Access allowlist. Institutional SSO adds weeks. |
| **Integrations** | Google Cal / Outlook / Slack / Email — which are required | Each OAuth flow is 2–3 days. Skip anything not essential in v1. |
| **Data substrate** | Markdown-in-git (recommended) / hosted DB (Supabase etc.) | Markdown + git is portable, auditable, free, and has no vendor lock-in. Hosted DB is faster to query but adds a dependency. Pick markdown + git. |

Write the decisions down before coding. Changes later cost much more.

---

## Phase 1 — Make the single-user flow real  (5–7 working days)

The current demo fakes Claude output with hardcoded strings. Phase 1 makes it real.

### Files to write

```
.claude/
  settings.json               # SessionStart hook + tool permissions
  commands/
    standup.md                # each: prompt + structured output spec
    week-plan.md
    digest.md
    retro.md
    newproject.md
    newcheckpoint.md
    logwin.md
    one-on-one.md
    report.md
    move.md
    replan.md
    onboard.md
    portfolio-review.md
    okr-review.md

CLAUDE.md                     # enhanced — slash command reference, tone spec

tools/
  planner/
    adjust.js                 # the real cascade adjuster (replaces demo logic)
  build-data.js               # parses all markdown into docs/data.json
  parse-issue.js              # turns an issue-form submission into a markdown commit

.github/
  workflows/
    build-site.yml            # on push: run build-data.js, deploy Pages
    parse-issue.yml           # on issue labeled pm: run parse-issue.js, commit
    nightly.yml               # calendar sync, staleness checks, digest
  ISSUE_TEMPLATE/
    log-win.yml
    log-passage.yml
    new-checkpoint.yml
    new-blocker.yml
    new-meeting.yml
    move-block.yml

projects/_template.md
progress/_template.md
meetings/_template.md
tasks/_template.md
```

### Effort breakdown

| Work | Days |
|---|---|
| Slash-command definitions (10 commands, incl. exact output specs) | 1.5 |
| Real cascade adjuster (`tools/planner/adjust.js`) with tests | 1 |
| `build-data.js` (markdown → JSON) | 0.5 |
| Issue forms + parser (`parse-issue.js`) | 0.5 |
| Wire the website to `data.json` (replace hardcoded state) | 0.5 |
| GitHub Actions (build + parse + nightly) | 0.5 |
| Local testing: run onboarding, 3 days of real use | 1.5 |
| **Total** | **~6 days** |

### Definition of done for Phase 1

- The researcher can run `/standup` in their Claude Code and it produces a real standup from their own markdown files.
- `/logwin "methods drafted" 2h` updates `progress/YYYY-MM.md` and the duration-learning table.
- Dragging a block in the website (via an issue form submission) actually changes `week-plans/YYYY-Www.md`.
- The dashboard the PI sees matches the data she sees in Claude chat.

---

## Phase 2 — Multi-user for a lab  (~2 weeks)

### What changes

- **Shared repo** with per-person metadata in every project/task/log entry (`owner:`, `watchers:`).
- **Roles** encoded in `.github/CODEOWNERS` and in `people.md` frontmatter:
  - `role: pi` — read all, write all
  - `role: postdoc` — write own projects, read shared
  - `role: student` — write own tasks, read their projects
  - `role: tech` — write passage/equipment logs, read schedules
- **Private 1:1 notes** — separate private repo, symlinked or federated. Or encrypted with [sops](https://github.com/getsops/sops) using GPG keys per person.
- **Per-user dashboard view** — URL `?user=sara` filters scope. Default view shows "what's mine + what I need from others."
- **Cloudflare Access** on the Pages site — email allowlist (free tier, up to 50 users). One-time ~15 min setup.
- **Write access from the web** — GitHub OAuth device flow in the PWA so postdocs can move blocks / log wins without cloning the repo.

### Effort breakdown

| Work | Days |
|---|---|
| Add per-person metadata to all artifacts | 1 |
| Role-based filtering in `build-data.js` | 1 |
| Cloudflare Access setup + docs | 0.5 |
| GitHub OAuth device flow in PWA | 2 |
| Private notes — sops integration | 2 |
| Cross-project rollup views | 2 |
| Migration script (move existing solo repo to multi-user) | 1 |
| Testing with 3 mock users across roles | 2 |
| **Total** | **~2 weeks** |

### Explicit non-goals

- **No per-user login** on the site itself — Cloudflare Access handles the gate. The site just reads the email header.
- **No fine-grained permissions engine** — GitHub + CODEOWNERS is enough.
- **No real-time presence** — eventual consistency via git commits is the contract.

---

## Phase 3 — Integrations  (~2 weeks)

| Integration | Flow | Effort |
|---|---|---|
| **Google Calendar** | OAuth device flow; nightly Action reads free/busy; creates protected blocks on approval | 3 days |
| **Outlook / M365** | Microsoft Graph API, same pattern | 3 days |
| **Slack** | Incoming webhook (URL in secret); post weekly digests + blocker alerts to team channel | 0.5 day |
| **Email** | Resend API (secret); scheduled Action for Friday digests, on-demand collaborator reports | 1 day |

Secrets managed in GitHub Actions environment. OAuth tokens stored encrypted in the repo (sops) per user, refreshed by a nightly Action.

### Definition of done for Phase 3

- On Monday, running `/week-plan` in Claude creates real calendar events on her Outlook work calendar titled `"Writing — TNF methods"` etc., visible to her department.
- On Friday, the weekly digest email is sent automatically to her collaborators at 5pm.
- When a postdoc adds a blocker via the website, it posts to `#lab-blockers` on Slack within 2 minutes.

---

## Phase 4 — Polish + onboarding  (~1 week)

- **Onboarding wizard** in Claude Code (`.claude/commands/onboard.md`) — conversational 8-stage interview, spread across sessions.
- **Migration scripts** — one-off converters from Notion / Asana / Todoist CSV exports into `projects/*.md`. Written when a lab actually needs to migrate.
- **Admin page** for the PI — add/remove lab members, rotate tokens, reset duration history.
- **5-minute video walkthrough** for new lab members.
- **Failure mode docs** — what to do when calendar sync breaks, OAuth token expires, an Action fails.

---

## Total honest effort

**6–10 working weeks** for one developer, depending on integration scope and polish level. Phases can run in parallel with a team.

| Scope | Effort |
|---|---|
| Single-user MVP (Phase 1) | ~1.5 weeks |
| Small team (Phase 1 + 2) | ~3.5 weeks |
| Production lab deployment (Phase 1–3) | ~5.5 weeks |
| With polish + onboarding (Phase 1–4) | ~6.5 weeks |

Add 30% buffer for unknowns (OAuth quirks, MCP server setup, calendar edge cases).

---

## What NOT to build

Things that will look necessary but aren't, and will cost time if you add them:

- **A custom backend / REST API.** Git is the backend. Markdown is the database.
- **A real-time sync layer.** Eventual consistency via git commits is the correct contract. Socket-based live-sync across 15 users is 6 weeks of pain.
- **A native mobile app.** A PWA with offline support covers 98% of the use cases.
- **Your own auth system.** GitHub OAuth + Cloudflare Access covers the full stack.
- **A rich drag-and-drop builder for the Gantt.** The markdown is the edit surface. Drag-drop on the web is a convenience, not the primary interface.
- **A task scheduler daemon.** GitHub Actions scheduled workflows replace it.
- **A dashboard framework (Grafana, Retool, etc.).** Chart.js + hand-written HTML is sufficient and leaves you in control.

---

## Lab-specific considerations

### Adoption risk

Any PM tool fails if people don't use it. Mitigations:

- Start with **one motivated person** (the PI or a PM-inclined postdoc). Prove value for 2 weeks before expanding.
- **The website is the primary interface** for anyone who hates git. They never see `git` or CLAUDE.md; they see a dashboard and quick-log forms.
- **The PI must use it**. If the PI doesn't read the reports, the rest of the lab won't generate them.

### Data sensitivity

- **No patient data** in this system — it's operational PM, not research data.
- **Collaborator names, unpublished results, grant content** — these do appear. Store in a **private repo**, not public.
- If your institution has IT policies against cloud storage of unpublished research, check before deploying. Alternatives: self-host on a lab server with [Forgejo](https://forgejo.org/) or similar.

### Scale limits

| Component | Free-tier limit | Lab scale headroom |
|---|---|---|
| GitHub Actions | 2000 min/month free (public repos unlimited) | Plenty for nightly + on-push |
| Cloudflare Access | 50 users free | Fits any lab |
| GitHub OAuth | 5000 req/hour per user | Plenty |
| Resend email | 3000/month free | 100 emails/week = plenty |
| Pages bandwidth | 100 GB/month | Plenty |

### Ongoing costs

For a lab of 10 on a private repo with all integrations:

| Item | Cost |
|---|---|
| GitHub Team (for private repo with 10 collabs) | $4/user/month × 10 = $40 |
| Claude Pro per user | $20 × 10 = $200 (but lab members have this anyway) |
| Cloudflare Access | $0 |
| Resend | $0 |
| Domain (optional) | $1/month |
| **All-in marginal cost** | **~$41/month per lab** |

Compare to Monday.com, Asana Business, etc. at $10–30/user/month = $100–300/month for the same lab.

---

## The simplest v1 you could actually ship

If you want to pilot this with one researcher **this week**, skip everything except:

1. CLAUDE.md (done) + 5 slash commands: `/standup`, `/week-plan`, `/logwin`, `/newcheckpoint`, `/digest` (1.5 days)
2. The website pages the deck shows, wired to a real `data.json` built from her markdown (1 day)
3. One Issue Form: `log-win.yml` + the parser Action (0.5 day)
4. A bootstrap prompt she pastes once (done — `docs/setup.html`)

**Total: ~3 days.** It will feel slightly rougher than the full build, but she'll use it and tell you what actually matters. Most PM tool builds fail because they ship full-featured to zero users. Ship narrow, expand on signal.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Researcher hates git | Website is her interface; she never touches git. |
| CLAUDE.md drifts and Claude's behavior degrades | Quarterly review of CLAUDE.md. Version-locked in git. |
| OAuth token expires during a critical week | Nightly Action validates tokens; Slack alert on failure. |
| Slash command output format changes and breaks the website parser | Website reads `data.json`, not raw chat output. Parser is decoupled. |
| Institutional IT policy blocks GitHub | Self-host via Forgejo on a lab server. Same code, different remote. |
| Migration from existing tool is painful | Build one-way migration scripts when a lab actually wants to switch. Don't build generic "import from anywhere" in v1. |
| The PI stops engaging | Nothing technical can fix this. The tool exists to serve her; if she stops using it, retire it gracefully. |

---

## Open questions (to answer with the PI before starting)

1. Which calendar platform is authoritative for the lab (Google / Outlook)?
2. Is there a lab Slack workspace and are you allowed to wire a webhook?
3. Public vs private repo? Does any collaborator name or unpublished data appear in progress logs?
4. Who owns the domain / Cloudflare account?
5. Which 2-3 lab members pilot first?
6. What's the "failure mode" — if the tool disappears tomorrow, what's the fallback?

Answer these, then start Phase 1.
