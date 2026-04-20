---
description: Add a checkpoint to a project with a Definition of Done
argument-hint: "[project-id] [name] [date]"
---

Add a checkpoint. No DoD, no checkpoint.

## Parse

Forms accepted:

- `/newcheckpoint tnf-paper "Methods drafted" 2026-05-01`
- `/newcheckpoint organoid "Cell type B stable"` (no date — ask)
- `/newcheckpoint` (empty — ask all)

Ask missing fields one at a time.

## Capture the DoD (required)

Ask: "What is the Definition of Done? One line — how will you know it is finished?"

Good DoDs: "2000 words, all citations in" · "6 of 6 figure panels at v3" · "replicate matches primary within 5%".

Vague ones ("finished", "reviewed") — push back once, then accept and flag in the commit message.

## Write

Append to the project's Checkpoints section, ordered by date:

```
- [ ] **<name>** — YYYY-MM-DD. DoD: <one-line>.
```

If a checkpoint with the same name exists, ask whether to update or add new.

## Acknowledge

One-line confirmation: project, date, DoD echo.

First checkpoint on the project? Offer: "Want to sketch 1–2 more now?"

## Downstream

- New date before a dependent checkpoint — flag the ordering.
- DoD names a person — suggest adding a commitment to `people.md`.

## Commit

`checkpoint: <project-id> — <name> (DoD <date>)`

Then push.
