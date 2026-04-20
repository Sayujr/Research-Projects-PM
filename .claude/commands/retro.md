---
description: Friday retrospective — what slipped, one adjustment for next week
argument-hint: ""
---

Run the Friday retro. **One adjustment** — not a list of five improvements.

## Read

- `progress/YYYY-MM.md` — the week's entries
- `week-plans/YYYY-Www.md` — what was planned
- `projects/*.md` — blockers, failed experiments, revision counts
- Previous retro for continuity — did we follow up on last week's adjustment?

## Derive

- **Planned-but-not-done**: top-5 items not completed + reasons (from progress
  log entries mentioning blockers, deferrals)
- **Pushed**: anything moved more than twice (flagged as sticky)
- **Silent stretches**: writing-tagged projects with no entry for 5+ days
- **Blockers repeating**: same blocker across 3+ standups
- **Meetings without outcomes**: meetings this week without action items logged

## Output format

```
### What slipped
· <item> — <one-line reason>. (<flag if this is a pattern>)
· <item> — <one-line reason>.

### Pattern I'm noticing
<If there's a real pattern worth naming. Examples:
- "Figure 4 v1 moved 3 times. The antibody delay is the actual blocker —
  is there a workaround, or does this checkpoint need to slip?"
- "Organoid writing silent 5 days in a row. Protected block was
  skipped Mon/Wed/Fri. Something competing with the morning?"
Omit this section if nothing clear.>

### Follow-up on last week's adjustment
<If last retro committed to an adjustment, report on whether it held.
Honest. E.g. "Last week we said earlier lab blocks. You did 2 of 3.
Half credit." or "Held — no skipped writing blocks.">

### One adjustment for next week
<Propose ONE change only. Concrete. Example:
- "Drop the 1:1 prep slot — you've been skipping it anyway. Move it into
  the 1:1 itself."
- "Cut scope on Figure 4 — 3 panels instead of 6. Accept the slip on
  Figures v3 DoD by 1 week."
- "Block writing at 10am instead of 9am — you've been starting late.">

Agree, or pick a different adjustment?
```

## Wait for reply, then

- Write the retro to `retros/YYYY-Www.md` with the agreed adjustment recorded.
- If the adjustment changes future week-plans (different block times, WIP
  cap, etc.), update `meta/week-shape.md` or `meta/preferences.json`
  accordingly so Monday's `/week-plan` picks it up.
- Commit + push with message `retro: YYYY-Www — <adjustment>`.

## Tone

- **Honest, not harsh.** Name what slipped; don't moralise.
- **One adjustment.** The whole point of this ritual is focused iteration.
  Five "improvements" becomes zero.
- **If nothing meaningful slipped:** say so. "Pretty clean week. One
  follow-up — the Jim 1:1 got pushed to next week. Carry it forward?"
- **Never use "we" as in "we failed."** The tool and the user are not a team
  — the tool is the PM. "You slipped X" is accurate. "Let's adjust" is fine.
