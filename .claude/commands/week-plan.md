---
description: Propose Monday's top-5 and block placement for the week
argument-hint: ""
---

Propose a week plan. Should only fire Mondays in normal use, but OK to run
any day if the user asks.

## Read

- `projects/*.md` — upcoming checkpoints + DoD dates
- `people.md` — outstanding commitments (things she owes others due this week)
- `calendar/YYYY-MM.md` — fixed meetings, blocked hours, PTO
- `meta/week-shape.md` — her typical week pattern
- `meta/task-history.json` — duration estimates
- `meta/preferences.json` — for morning/afternoon deep preference
- Previous week-plan `week-plans/YYYY-Www.md` for the previous week — to see
  what slipped (anything not marked done in the previous progress log)

## Propose

Pick **top-5 items** with these constraints:
- Max 1–2 per project (force portfolio breadth)
- Each item must map to a specific checkpoint or commitment
- Sum of estimated durations ≤ 60% of available working hours this week
  (leaves slack; research weeks get hijacked)
- If any item is writing-tagged and no other writing has been logged in
  5+ days, prioritise it

For each item in the proposal, show:
- Rough time estimate (from history)
- The checkpoint / commitment it rolls up to
- Which block type it needs (Deep / Lab / Light)

Then propose **block placement** for the week:
- Monday morning 9:00–10:30 Deep block protected
- Lab blocks in her declared lab hours
- Meetings stay fixed (already on calendar)
- Use a text table for the proposal (real visual rendering happens on the Plan Board)

## Output format

```
Morning. It's <Weekday> <Month DD> — week <YYYY-Www>.

Pulling your upcoming checkpoints and outstanding commitments…

### Proposed top-5 this week
1. **<task>** — <hours>h · <project> › <checkpoint> (DoD <date>)
2. **<task>** — <hours>h · <project> › <checkpoint>
3. **<task>** — <hours>h · <project> › <checkpoint>
4. **<task>** — <hours>h · <person/commitment>
5. **<task>** — <hours>h · <project> › <checkpoint>

Total estimated: <N>h of ~<available>h working time this week.

### Block placement
|       | Mon | Tue | Wed | Thu | Fri |
|-------|-----|-----|-----|-----|-----|
| AM    | Deep: <task> | Deep: <task> | Lab: <task> | Deep: <task> | Deep: <task> |
| PM    | Light       | Lab: <task>  | (lab mtg)   | Light        | /digest      |

Writing is protected in 5 of 5 mornings. Want to swap anything, or
commit to `week-plans/<YYYY-Www>.md`?
```

## Wait for reply, then

- If approved: write the plan to `week-plans/YYYY-Www.md` with frontmatter
  (see schema in CLAUDE.md). Commit + push.
- If she wants swaps: make the swap (do not re-propose the whole plan
  unless asked). Re-check the DoD and block-type constraints on the change.
- If she wants to drop an item: suggest which checkpoint becomes at-risk
  without it, so the decision is informed.

## Carry-over handling

If the previous week's plan has incomplete items, flag them at the top
before the proposal:

> Last week: 3 of 5 items done. Not done: *Figure 4 v1* (pushed twice),
> *1:1 Jim*. Re-include both this week, or cut?

Never silently drop incomplete items. Make the user decide each time.

## Writing-streak protection

If any active writing project has no progress entries in 5+ days, include
"writing on that paper" in the proposed top-5 even if no checkpoint demands
it yet. Flag it visibly:

> *(writing streak protection — Organoid paper log silent 5 days)*

## Commit

After writing the approved plan, commit:

```
week-plan: <YYYY-Www> — <one-line summary of week theme>
```
