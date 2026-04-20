---
description: 8-stage onboarding interview — one stage per session, conversational
argument-hint: "[optional: specific stage number 1-8]"
---

Run the onboarding interview. One stage per session. Never dump all stages
at once.

## Check state before starting

Read `meta/onboarding.json`. If missing, create:

```json
{ "completed_stages": [], "next_stage": 1, "last_run": null }
```

If the user passed an explicit stage number as an argument (e.g. `/onboard 3`),
run that stage. Otherwise run `next_stage`.

If all 8 stages are complete, reply:

> Onboarding is done. If you want to update something specific, run
> `/onboard <stage>` (1=role, 2=projects, 3=team, 4=week shape,
> 5=durations, 6=calendar, 7=goals, 8=preferences).

## The 8 stages

Run **only one** per invocation. Conversational — one question, wait for answer,
follow up, move on.

### Stage 1 — Role + year goals (~10 min)

Ask:
1. "What's your role, and what lab?"
2. "What would make this year a great year? 3 to 5 outcomes — specific."
3. For each outcome, force specificity: "By when? And how will you know it's done?"

Write:
- Append to `goals.md` under `## YEAR <year> — year goals` with each outcome
  as a numbered item + measurable DoD.
- Scaffold one `projects/<id>.md` per outcome that is a project (use kebab-case id,
  ask user to confirm the id if ambiguous).
- Update `meta/onboarding.json`: add 1 to `completed_stages`, set `next_stage: 2`.

End with: "Next session we'll cover your active projects in more detail.
Run `/onboard` again when you have 10 minutes, or `/onboard 3` to skip
to team."

### Stage 2 — Active projects (~10 min)

For each project file from stage 1 (and any others she mentions), ask:
- "One-line goal, for `<project>`?"
- "Deadline — real external, or self-imposed?"
- "Main collaborators?"
- "Is this an **OKR** (measurable key results — best for papers, grants)
  or **narrative** (status + paragraph — best for exploratory work)?"

Write each project's frontmatter with those fields. Fill in a placeholder Goal
section with the one-liner. Leave Checkpoints, Lab, Writing sections empty for
now — `/newcheckpoint` fills them in as they come up.

### Stage 3 — Team (~8 min)

"Who do you work with regularly? Postdocs, students, techs, PI, external
collaborators. Name, role, projects they're on, 1:1 cadence."

Build `people.md` entries. Initialise `owes-me` / `I-owe` as empty lists —
they grow organically from conversations.

### Stage 4 — Week shape (~5 min)

"Describe a typical week: which days are mostly lab, which mostly writing /
analysis, which mostly meetings? Any fixed commitments (lab meeting, journal
club, teaching)? Morning or afternoon for deep work?"

Write to `meta/week-shape.md` — narrative, used by `/week-plan` to propose
sensible block placement.

### Stage 5 — Task durations (~8 min)

Seed the duration estimator. Ask:
- "Roughly how long does a cell passage (routine maintenance) take you?"
- "A single figure draft (v1, rough)?"
- "A methods section for a paper, start to finish?"
- "A typical dose-response or similar assay, from plating to analysis?"
- "A grant section (one specific aim, draft)?"

Populate `meta/task-history.json` with these as initial estimates. Mark each
as `n: 0` so they update as real data comes in:

```json
{ "passage_routine": {"median_min": 45, "p90_min": 60, "n": 0, "samples": []}, ... }
```

### Stage 6 — Calendars (~5 min)

"Which calendars do you use? Google, Outlook, Apple? Which is work vs
personal? Should I be allowed to **create events** on your work calendar
when you approve a plan (recommended — makes your protected blocks visible
to colleagues), or just **read** free/busy?"

Write settings to `meta/calendar-config.json`:

```json
{
  "work": { "provider": "google|outlook", "write": true, "calendar_id": "..." },
  "personal": { "provider": "google", "write": false, "calendar_id": "..." }
}
```

Do NOT attempt OAuth yet — flag that as a setup step for Phase 3. For now
the user will manually share any upcoming meetings until calendar sync is
enabled.

### Stage 7 — Goals broken into quarters (~15 min)

For each year goal from stage 1, break into a Q-by-Q plan for the current
year:
- For OKR projects: 2–3 measurable key results per quarter
- For narrative projects: one-paragraph objective + intended status (green)

Write to `goals.md` under a `## Q<N> <YEAR>` section per quarter.

This is the longest stage. Spread across two sessions if needed — do Q1+Q2
first, then Q3+Q4 a day later.

### Stage 8 — Preferences (~5 min)

Ask:
- "Best time for me to fire the morning standup? (e.g. 9am, or when you
  open Claude — default is on session start)"
- "Motivation tone: factual / warm / minimal?"
- "When is it OK for me to notify you on Slack or by email vs waiting for
  next standup?"
- "What's the nudge cutoff time? (e.g. no prompts after 8pm)"

Write to `meta/preferences.json`.

## Tone

- **One question, wait.** Never bullet out 4 questions at once.
- **Push for specificity gently.** "Cell Reports" is fine. "A good paper"
  isn't. "Which journal, by when?"
- **Offer examples if the user stalls.** "Most researchers pick 3–4 year
  goals: a paper, a grant, a method, a trainee milestone. Ring a bell?"
- **Summarise at the end of each stage.** Two lines: what got captured,
  what comes next.

## Commit

At the end of each stage, commit with message `onboarding: stage <N> complete`
and push. The user can then see the diff and edit markdown directly if anything
was captured wrong.
