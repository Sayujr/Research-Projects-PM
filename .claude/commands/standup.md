---
description: Morning standup — today's 3, overdue, calendar shape, heads-up, streak
argument-hint: ""
---

Produce a **morning standup** for the user. This is a real ritual, not a demo.

## Steps (do these silently, then produce the output)

1. Determine today's date in ISO format (YYYY-MM-DD) and the ISO week (YYYY-Www).
2. Read the following files to build the standup. Skip gracefully if any is missing (first-run case).
   - `week-plans/YYYY-Www.md` — top-5 for this week, block schedule for today
   - `projects/*.md` — status, active checkpoints, DoD dates
   - `progress/YYYY-MM.md` — last 14 days of entries (for streak + silent-day checks)
   - `calendar/YYYY-MM.md` — today's fixed events
   - `goals.md` — for the goal chain
   - `people.md` — for stale-contact flags
   - `meta/task-history.json` — for duration estimates on today's tasks
3. Derive:
   - **Today's 3**: pull from `top_5` in the week-plan, picking the 3 that fit today's calendar shape. Each shows start-end time + task + goal chain.
   - **Overdue**: any checkpoint whose DoD date is before today AND status != done.
   - **Calendar shape**: count of Deep / Lab / Light / Meeting hours today.
   - **Heads-up**: anti-burnout signals (3+ silent days on any active writing-tagged project; late-night entries in last 7 days; blockers repeating across 3+ standups; meetings without action items).
   - **Streak**: consecutive days with at least one progress entry. Writing streak separately if any writing-tagged project.

## Output format (produce this literally — markdown)

```
Good morning. Here's your standup for **<Weekday>, <Month> <DD>**.

### Today's 3
· `<HH:MM–HH:MM>` **<task>**
  <project> › <checkpoint> › <Q# objective> › <year goal>
· `<HH:MM–HH:MM>` **<task>**
  <project> › <checkpoint> › <Q# objective>
· `<HH:MM–HH:MM>` **<task>**
  <project> › <checkpoint> › <Q# objective>

### Overdue · <N>
- **<item>** (due <date>). <Claude's suggested action>.

### Calendar shape
<Nh Deep> · <Nh Lab> · <N meeting(s)>. <One-line note on protection>.

### Heads-up
<One kind flag only, if any signal triggered. Otherwise omit this section entirely.>

### Streak
<N>-day writing streak. <Short contextual note if this is a notable run.>

---
Anything change overnight, or ready to start?
```

## Rules

- **One question at the end** — never multi-choice walls. "Ready to start?" or "Re-slot figure 4, or push?" — not both.
- **If a section has no content, omit it.** Do not print "Overdue · 0" or "No heads-up." Blank is blank.
- **Goal chain is tight.** Max 4 hops. Use `›` separators. Year goal only on the top item if all three share it.
- **Specificity in heads-up.** Not "you've been quiet" — "Organoid writing log silent 4 days. Today's protected writing slot is 09:00–10:30."
- **No greetings like "Happy Tuesday!" or emojis in the output.** Warm but not saccharine.

## After the output

Wait for the user's reply. Common replies and how to handle them:

| Reply pattern | Your response |
|---|---|
| "Ready" / "go" / "yes" | Acknowledge in one line. If it's before a protected Deep block, remind of end time. Exit — let her work. |
| "Move X" / "slip X" / "push X" | Invoke `/move` logic — run the cascade, show impact, ask for commit strategy (Compress / Accept / Cut scope). |
| "Add blocker…" | Append to project's `## Blockers` section. Flag the commit. |
| "I missed X yesterday" | Quietly update the plan; don't lecture. |
| Vague/negative ("rough night", "not feeling it") | Offer a reduced day: cut to 1 item, or postpone the Deep block to tomorrow. No moralizing. |

## Commit the change to record state

After producing the standup, record it for the streak counter:

```bash
date +%Y-%m-%d > .claude/last-standup
```

Do not commit `.claude/last-standup` itself (add to `.gitignore` if not already). It's local session state.

## First-run / empty-state handling

If this is the first time `/standup` has run (no `goals.md`, no `projects/*.md`, etc.), do **NOT** produce the standup template. Instead, say:

> It looks like this is a fresh repo — onboarding hasn't been done yet. Run `/onboard` to start the 8-stage interview. It takes about 10 minutes for stage 1 (role + year goals), and we can do the rest over subsequent sessions.

Do not attempt to standup against empty data.
