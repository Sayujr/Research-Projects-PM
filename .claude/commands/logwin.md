---
description: Append a win to progress log + update duration learning
argument-hint: "[note] [duration like 2h or 90m]"
---

Log a win (a progress entry) to the current month's log, and update
duration-learning history if a duration is given.

## Parse the input

The user's argument string (`$ARGUMENTS` in Claude Code) may look like:
- `methods drafted 2h`
- `figure 4 v1 — TNF — 90m`
- `finished cell type B contamination trace`
- *(empty — prompt them interactively)*

Extract:
- **project id** — match against known ids in `projects/*.md`. If ambiguous or
  missing, ask: "Which project? <list of active project ids>"
- **note** — the core description (e.g. "Methods drafted — intro section done")
- **duration** — patterns: `\d+h`, `\d+m`, `\d+h\s*\d+m`. Optional but encouraged.
- **date** — always today unless user wrote "yesterday" or a specific date

## Write the entry

Append one line to `progress/YYYY-MM.md` (create the file with a minimal
header if it doesn't exist):

```
YYYY-MM-DD <project-id> — <note> (Nm)
```

Duration always normalised to minutes in the trailing parens. If no duration
was given, omit the parens.

## Update duration learning

If a duration was given, infer a `task_type` for the entry:
- contains "figure" → `figure_draft`
- contains "methods" → `methods_section`
- contains "results" → `results_section`
- contains "intro" → `intro_section`
- contains "passage" or "maintenance" → `passage_routine`
- contains "dose-response" or "assay" → `assay_run`
- otherwise: don't update history (one-off task)

Update `meta/task-history.json`:

```json
{
  "<task_type>": {
    "median_min": <recomputed from all samples>,
    "p90_min": <recomputed from all samples>,
    "n": <sample count + 1>,
    "samples": [<up to last 20 durations in minutes>]
  }
}
```

Recompute `median_min` and `p90_min` from `samples`. Keep only the last 20 to
avoid the file growing unbounded.

## Commit

Stage both files, commit with message:

```
progress: <project-id> — <note>
```

Then push (per repo convention).

## Acknowledge

One-line reply. Examples:

- Given `methods drafted 2h` with project `tnf-paper`:
  > Logged to `progress/2026-04.md`: *Methods drafted — 2h*.
  > Figure-draft history now has 5 samples; median holding at 2h 20m.

- Given `figure 4 v1 90m`:
  > Logged. Figure-draft median updated to 2h 15m (9 samples).

- No duration given:
  > Logged to `progress/2026-04.md`. (No duration — want to add one? It
  > helps the estimator.)

## Flag if the entry doesn't roll up to any checkpoint

After logging, check: does this win advance any checkpoint toward its DoD?
If yes, say so in one line:
> Advances checkpoint *Methods drafted (DoD May 1)* — now ~80% of the way
> there based on word count.

If the entry seems orphan (doesn't match a checkpoint in the named project),
flag once:
> Note: this doesn't map to any active checkpoint in `<project>`. Want to
> add a checkpoint, or leave it as free-standing progress?

## Empty input

If the user ran `/logwin` with no arguments, ask in one line:
> What shipped? (project + short description + optional duration)
