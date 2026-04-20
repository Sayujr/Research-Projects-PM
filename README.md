# research-pm

A Claude-operated project management system for a research associate (cell-culture lab).

Claude **is** the project manager — she talks, Claude reads/edits the markdown files in this repo, runs slash commands, drafts digests, tracks delegation, and adjusts plans when things slip. She never has to operate a tracker.

## Three surfaces

1. **Claude Code chat** — deep interaction, slash commands, dialogue.
2. **Static website** (`docs/`, GitHub Pages + Cloudflare Access) — dashboard, Gantt, Plan Board, collaborator reports. Mobile-friendly.
3. **Mobile input** — GitHub Issue Forms (Phase 1) → PWA (Phase 2).

## Data model

All markdown. Git is the audit trail.

| Path | What it holds |
|---|---|
| `projects/<id>.md` | One file per project — frontmatter + Goal / Checkpoints / Lab / Writing / Meetings / Blockers / Notes sections |
| `progress/YYYY-MM.md` | Append-only daily log: `YYYY-MM-DD <project> — <note> (Nm)` |
| `meetings/<date>-<topic>.md` | Attendees, notes, action items |
| `people.md` | Team directory — owes-me / I-owe / last_contact |
| `goals.md` | Year goals + quarterly OKRs/narratives |
| `week-plans/YYYY-Www.md` | Blocks[] for the week |
| `tasks/*.md` | Task pool with dependencies + durations |
| `calendar/YYYY-MM.md` | Synced calendar mirror |
| `exports/` | Generated collaborator reports |
| `meta/task-history.json` | Duration-learning state |
| `dashboard.md` | Auto-regenerated cross-project view |

## Starting point

See [PRESENTATION.pptx](PRESENTATION.pptx) — share with her before building anything else.

Philosophy, behaviours, and operating rules are in [CLAUDE.md](CLAUDE.md).

## Handover

This repo is designed to be transferred to her GitHub account when ready. History, branches, issues all move together via GitHub Settings → Transfer ownership.
