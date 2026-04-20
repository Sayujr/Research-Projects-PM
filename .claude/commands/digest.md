---
description: Friday digest — what shipped this week. Celebration only, no reflection.
argument-hint: ""
---

Produce the Friday digest. **Celebration only** — no improvement suggestions,
no criticism. Save reflection for `/retro`.

## Read

- `progress/YYYY-MM.md` — all entries from Mon–Fri this week
- `projects/*.md` — checkpoints that moved to `status: done` this week
- `meta/task-history.json` — so durations can be named specifically
- Previous digest (last Friday's) — for streak context

## Derive

- **Shipped items**: every distinct progress entry this week, grouped by
  project. Include durations if logged.
- **Checkpoints closed**: any checkpoint moved to done this week (from
  project frontmatter or section state).
- **Streaks**: consecutive-days-with-a-progress-entry count; writing streak
  separately if applicable.
- **Milestone notes**: if something notable crossed a threshold (first
  submission, first grant response, end of quarter goal, etc.), call it out.

## Output format

```
It's <Weekday> <Month DD>. Week <YYYY-Www> wrap-up.

### Shipped this week
· **<project>** — <item> <duration if logged>
· **<project>** — <item>
· ...

### Checkpoints closed · <N>
· <checkpoint name> (<project>) — DoD met <date>

### Streak
<N>-day progress streak. <N>-day writing streak.<br>
<One-line contextual note — e.g. "Longest this quarter." or "Beats last week's 9.">

### Notable
<Omit this section unless something really did cross a threshold.
Examples that qualify: first draft submitted, reviewer response received,
grant awarded/rejected, a quarterly KR completed.>

---
Good week. Want to close out with `/retro`, or just done for the day?
```

## Rules

- **Name specific items.** Don't say "you shipped 5 things." Name them.
- **No criticism.** Don't say "could have done better on X." That's retro.
- **No suggestions for next week.** That's week-plan, Monday.
- **Durations only if logged.** Don't fabricate — if no duration on the log
  entry, omit it.
- **If the week was thin (fewer than 3 progress entries):** don't inflate
  it. Still produce the digest, but keep it tight. No pep talk.
- **No emojis, no "🎉", no "!!!".**

## Commit

After producing, write the digest text into `digests/YYYY-Www.md` for the
record. Commit + push.

## If `/retro` then follows

Keep the digest output visible — retro should reference what shipped.
