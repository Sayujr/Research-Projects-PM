/**
 * adjust.js
 *
 * The cascade adjuster. Single source of truth for what happens when a
 * block moves. Called from:
 *   - Claude slash command (/move)
 *   - GitHub Action parsing a move-block issue
 *   - Website Plan Board drag (imported as a module in the browser)
 *
 * Pure function. No I/O. Caller decides whether to commit.
 */

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const BLOCK_COMPAT = {
  /* which block types can absorb which task types */
  deep: new Set(["deep"]),
  light: new Set(["light", "admin"]),
  lab: new Set(["lab", "passage"]),
  meeting: new Set(["meeting"]),
};

/* ---------- time helpers ---------- */

function hhmmToMin(s) {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
}

function minToHhmm(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function blockDurationMin(block) {
  return hhmmToMin(block.end) - hhmmToMin(block.start);
}

function blocksOverlap(a, b) {
  if (a.day !== b.day) return false;
  const as = hhmmToMin(a.start);
  const ae = hhmmToMin(a.end);
  const bs = hhmmToMin(b.start);
  const be = hhmmToMin(b.end);
  return as < be && bs < ae;
}

function dayIndex(d) {
  return DAY_ORDER.indexOf(d);
}

/* ---------- main ---------- */

/**
 * adjust
 *
 * @param {object} args
 * @param {object[]} args.blocks            — current week's blocks
 * @param {object[]} args.tasks             — task pool with type + checkpoint
 * @param {object[]} args.checkpoints       — checkpoints with date + project
 * @param {object} args.move                — { task_id, day, start } target
 * @param {object} [args.options]           — { dayHoursStart, dayHoursEnd, stackLimit }
 *
 * @returns {{
 *   ok: boolean,
 *   newBlocks: object[],
 *   cascade: object[],
 *   warnings: string[],
 *   checkpointImpacts: object[],
 *   approvalRequired: boolean,
 *   reason?: string
 * }}
 */
function adjust(args) {
  const {
    blocks,
    tasks = [],
    checkpoints = [],
    move,
    options = {},
  } = args;

  const dayStart = options.dayHoursStart || 9 * 60;
  const dayEnd = options.dayHoursEnd || 18 * 60;
  const stackLimit = options.stackLimit || 3;

  if (!move || !move.task_id || !move.day || !move.start) {
    return fail("Invalid move: need task_id, day, start.");
  }

  const subjectIdx = blocks.findIndex((b) => b.task_id === move.task_id);
  if (subjectIdx < 0) return fail(`Task ${move.task_id} not on current plan.`);

  const subject = blocks[subjectIdx];
  if (subject.fixed) {
    return fail(`Task ${move.task_id} is a fixed block (meeting); cannot move.`);
  }

  const task = tasks.find((t) => t.id === move.task_id);
  const subjectType = (task && task.block_type) || subject.type;

  /* ---------- 1. Block-type match ---------- */
  const warnings = [];
  const compat = BLOCK_COMPAT[subject.type] || new Set([subject.type]);
  // For now we just warn if the task's natural block_type doesn't match subject's
  // declared type (subject.type is the containing slot). If the user is moving
  // a writing task to an afternoon "light" slot, we flag it but don't block.
  if (task && task.preferred_block && task.preferred_block !== subject.type) {
    warnings.push(
      `Task '${task.title || task.id}' is usually a ${task.preferred_block} task; placed in a ${subject.type} slot.`
    );
  }

  /* ---------- 2. Dependency check ---------- */
  if (task && Array.isArray(task.depends_on) && task.depends_on.length) {
    for (const depId of task.depends_on) {
      const dep = blocks.find((b) => b.task_id === depId);
      const depTask = tasks.find((t) => t.id === depId);
      if (!dep && !depTask) continue; // unknown dep, ignore
      if (dep) {
        const depEnd = dayIndex(dep.day) * 10000 + hhmmToMin(dep.end);
        const subEnd = dayIndex(move.day) * 10000 + hhmmToMin(move.start);
        if (depEnd > subEnd) {
          return fail(
            `Cannot schedule '${move.task_id}' before its dependency '${depId}' (currently ${dep.day} ${dep.end}).`
          );
        }
      }
    }
  }

  /* ---------- 3. Compute new subject position ---------- */
  const durationMin = blockDurationMin(subject);
  const newStart = hhmmToMin(move.start);
  const newEnd = newStart + durationMin;

  if (newEnd > dayEnd) {
    return fail(`Block would run past end of day (${minToHhmm(newEnd)}).`);
  }

  const newBlocks = blocks.map((b) => ({ ...b }));
  newBlocks[subjectIdx] = {
    ...subject,
    day: move.day,
    start: minToHhmm(newStart),
    end: minToHhmm(newEnd),
  };

  /* ---------- 4. Downstream cascade ---------- */
  const cascade = [];
  const moved = new Set([subject.task_id]);

  let changed = true;
  let iter = 0;
  while (changed && iter++ < 50) {
    changed = false;
    for (let i = 0; i < newBlocks.length; i++) {
      const b = newBlocks[i];
      if (b.fixed) continue;
      if (b.task_id === subject.task_id) continue;
      if (moved.has(b.task_id)) continue;

      const clash = newBlocks.find((o, j) => j !== i && !o.fixed === false ? false : o !== b && blocksOverlap(o, b));
      if (!clash) continue;

      // Bump this block to the next free compatible slot.
      const bumped = findNextFreeSlot(
        newBlocks,
        b,
        { dayStart, dayEnd, preferSameDay: true }
      );
      if (!bumped) {
        warnings.push(`Could not re-slot '${b.task_id}' within this week.`);
        continue;
      }
      cascade.push({
        task_id: b.task_id,
        from: { day: b.day, start: b.start, end: b.end },
        to:   { day: bumped.day, start: bumped.start, end: bumped.end },
      });
      newBlocks[i] = { ...b, ...bumped };
      moved.add(b.task_id);
      changed = true;
    }
  }

  /* ---------- 5. Checkpoint DoD impact ---------- */
  /* Only consider blocks actually touched by THIS move: subject + cascaded. */
  const checkpointImpacts = [];
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const touchedIds = new Set([subject.task_id, ...cascade.map((c) => c.task_id)]);
  for (const b of newBlocks) {
    if (!touchedIds.has(b.task_id)) continue;
    const t = tasksById[b.task_id];
    if (!t || !t.checkpoint) continue;
    const cp = checkpoints.find((c) => c.name === t.checkpoint);
    if (!cp || !cp.date) continue;

    const blockDate = datestampForDay(options.weekStart, b.day);
    if (!blockDate) continue;

    if (blockDate > cp.date) {
      checkpointImpacts.push({
        checkpoint: cp.name,
        cp_date: cp.date,
        block_date: blockDate,
        overshoot_days: diffDays(blockDate, cp.date),
        task: b.task_id,
      });
    }
  }

  /* ---------- 6. Energy / WIP stack ---------- */
  const deepCountsByDay = {};
  for (const b of newBlocks) {
    if (b.type === "deep") {
      deepCountsByDay[b.day] = (deepCountsByDay[b.day] || 0) + 1;
    }
  }
  for (const [d, n] of Object.entries(deepCountsByDay)) {
    if (n >= stackLimit) {
      warnings.push(`${n} Deep blocks stacked on ${d} — sustainability check.`);
    }
  }

  /* ---------- 7. Approval gate ---------- */
  const approvalRequired = checkpointImpacts.some((c) => c.overshoot_days >= 1);

  return {
    ok: true,
    newBlocks,
    cascade,
    warnings,
    checkpointImpacts,
    approvalRequired,
  };
}

/* ---------- cascade helpers ---------- */

function findNextFreeSlot(allBlocks, block, { dayStart, dayEnd, preferSameDay }) {
  const duration = blockDurationMin(block);
  const candidates = [];

  /* Same day, later */
  if (preferSameDay) {
    const later = findFreeSlotInDay(allBlocks, block.day, duration, hhmmToMin(block.end), dayEnd, block.task_id);
    if (later) candidates.push({ day: block.day, ...later });
  }
  /* Subsequent days */
  const dayIdx = DAY_ORDER.indexOf(block.day);
  for (let i = dayIdx + 1; i < 5; i++) {
    const slot = findFreeSlotInDay(allBlocks, DAY_ORDER[i], duration, dayStart, dayEnd, block.task_id);
    if (slot) { candidates.push({ day: DAY_ORDER[i], ...slot }); break; }
  }
  if (!candidates.length) return null;
  const c = candidates[0];
  return { day: c.day, start: minToHhmm(c.startMin), end: minToHhmm(c.startMin + duration) };
}

function findFreeSlotInDay(allBlocks, day, duration, fromMin, toMin, selfId) {
  const occupants = allBlocks
    .filter((b) => b.day === day && b.task_id !== selfId)
    .map((b) => ({ s: hhmmToMin(b.start), e: hhmmToMin(b.end) }))
    .sort((a, b) => a.s - b.s);
  let cursor = Math.max(fromMin, 0);
  for (const occ of occupants) {
    if (occ.e <= cursor) continue;
    if (occ.s - cursor >= duration) {
      return { startMin: cursor };
    }
    cursor = Math.max(cursor, occ.e);
  }
  if (toMin - cursor >= duration) return { startMin: cursor };
  return null;
}

/* ---------- date helpers ---------- */

function datestampForDay(weekStart, dayAbbr) {
  if (!weekStart) return null;
  const idx = DAY_ORDER.indexOf(dayAbbr);
  if (idx < 0) return null;
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
}

function diffDays(aStr, bStr) {
  return Math.round(
    (new Date(aStr + "T00:00:00Z") - new Date(bStr + "T00:00:00Z")) / 86400000
  );
}

function fail(reason) {
  return {
    ok: false,
    reason,
    newBlocks: [],
    cascade: [],
    warnings: [],
    checkpointImpacts: [],
    approvalRequired: false,
  };
}

/* ---------- exports (works in Node + ESM-ish browsers via <script type="module">) ---------- */

if (typeof module !== "undefined" && module.exports) {
  module.exports = { adjust, hhmmToMin, minToHhmm, blocksOverlap };
}
