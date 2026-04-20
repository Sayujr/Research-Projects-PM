---
description: Draft a 1:1 agenda from owes-me, I-owe, recent progress, and open blockers
argument-hint: "[person-id]"
---

Draft a 1:1 agenda for the named person. The agenda should be a working
document — not theatre. She uses it live during the meeting.

## Parse

- `/one-on-one sara` → person-id = `sara`
- `/one-on-one` → ask: "1:1 with whom? (active team: <list from people.md>)"

Match case-insensitively against `people.md` entries. If ambiguous (e.g. two
"Sara"s), ask to disambiguate by role.

## Read

- `people.md` — the person's `owes-me`, `I-owe`, `last_contact`, `cadence`
- `projects/*.md` — any project this person is listed as a collaborator or
  team member on; pull recent progress (last 14 days from `progress/YYYY-MM.md`)
  mentioning their projects
- Previous 1:1 notes — any file in `meetings/*-1on1-<person-id>.md`; reference
  only the most recent one for continuity

## Derive

- **She owes me** — every item on her `owes-me` list. Flag ones past due.
- **I owe her** — every item on `I-owe`. Flag ones past due.
- **Her recent progress** — up to 5 bullet points from the progress log mentioning
  the person or their projects. Be factual.
- **Open blockers** — any `## Blockers` section entry on a project she's on.
- **Non-urgent / career** — 1–2 items the user has flagged as wanting to
  discuss periodically (in `people.md` → `notes`).

## Output format

```
### 1:1 with <Name> · <YYYY-MM-DD>

Last met: <date> (<N days ago>). Cadence: <cadence>.

**She owes me (<N>)**
- <item> · due <date> <(overdue flag if applicable)>
- <item> · due <date>

**I owe her (<N>)**
- <item> · due <date>

**Her recent progress**
- <bullet>
- <bullet>

**Open blockers on her projects**
- <blocker>

**Non-urgent**
- <career item from notes>
```

Omit empty sections entirely. Don't print "She owes me (0) — none" — just
skip that section.

## Write

Save the agenda to `meetings/YYYY-MM-DD-1on1-<person-id>.md` with the
output as the body, plus blank `## Notes` and `## Action items` sections
the user fills in during the meeting.

## Acknowledge

> Drafted agenda for 1:1 with <Name> — `meetings/YYYY-MM-DD-1on1-<person-id>.md`.
> After the meeting, run `/logmeeting <file>` to move action items into
> owes-me / I-owe lists.

## Commit

`one-on-one: <person-id> (YYYY-MM-DD)`

Then push.

## If last contact was recent and there is nothing to discuss

Be honest. Output:

> Nothing on the agenda today — no open commitments, no blockers, no
> recent progress to review. Cancel the 1:1, or use the time for career /
> non-urgent topics?

Don't fabricate agenda items to fill space.
