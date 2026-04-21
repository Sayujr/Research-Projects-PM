/**
 * Unit tests for adjust.js.
 *
 * Run: node tools/planner/adjust.test.js
 * Exits non-zero on failure. No framework required.
 */

const assert = require("node:assert/strict");
const { adjust, hhmmToMin, blocksOverlap } = require("./adjust");

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function section(name) { console.log(`\n${name}`); }

/* ---------- fixtures ---------- */

const baseBlocks = [
  { day: "mon", start: "09:00", end: "11:00", type: "deep", task_id: "t-methods" },
  { day: "mon", start: "14:00", end: "15:00", type: "light", task_id: "t-admin" },
  { day: "tue", start: "09:00", end: "11:00", type: "deep", task_id: "t-figure-4" },
  { day: "tue", start: "14:00", end: "16:00", type: "lab",  task_id: "t-media" },
  { day: "tue", start: "16:15", end: "17:00", type: "meeting", task_id: "t-sara-1on1", fixed: true },
  { day: "wed", start: "09:00", end: "11:30", type: "deep", task_id: "t-results" },
  { day: "thu", start: "09:00", end: "11:00", type: "deep", task_id: "t-aim3" },
  { day: "fri", start: "09:00", end: "11:00", type: "deep", task_id: "t-polish" },
];

const baseTasks = [
  { id: "t-methods",   title: "Methods", block_type: "deep", preferred_block: "deep", checkpoint: "Methods drafted" },
  { id: "t-figure-4",  title: "Figure 4", block_type: "deep", preferred_block: "deep", checkpoint: "Figures v3" },
  { id: "t-results",   title: "Results", block_type: "deep", preferred_block: "deep", checkpoint: "Results drafted", depends_on: ["t-methods"] },
  { id: "t-admin",     title: "Admin", block_type: "light", preferred_block: "light" },
  { id: "t-media",     title: "Media", block_type: "lab", preferred_block: "lab", checkpoint: "Media v2 protocol" },
  { id: "t-aim3",      title: "Aim 3 outline", block_type: "deep", preferred_block: "deep", checkpoint: "Aim 3 outline" },
  { id: "t-polish",    title: "Intro polish", block_type: "deep", preferred_block: "deep" },
];

const baseCheckpoints = [
  { name: "Methods drafted", date: "2026-04-30", project: "tnf-paper" },
  { name: "Results drafted", date: "2026-05-15", project: "tnf-paper" },
  { name: "Figures v3",      date: "2026-05-31", project: "tnf-paper" },
  { name: "Media v2 protocol", date: "2026-04-18", project: "organoid" },
  { name: "Aim 3 outline",   date: "2026-04-17", project: "r01-renewal" },
];

/* ---------- tests ---------- */

section("hhmmToMin");
test("parses 09:00", () => assert.equal(hhmmToMin("09:00"), 540));
test("parses 17:30", () => assert.equal(hhmmToMin("17:30"), 17*60+30));

section("blocksOverlap");
test("same-day overlap detected", () => {
  assert.equal(blocksOverlap(
    { day: "mon", start: "09:00", end: "11:00" },
    { day: "mon", start: "10:00", end: "12:00" }
  ), true);
});
test("different days never overlap", () => {
  assert.equal(blocksOverlap(
    { day: "mon", start: "09:00", end: "11:00" },
    { day: "tue", start: "09:00", end: "11:00" }
  ), false);
});
test("adjacent blocks do not overlap", () => {
  assert.equal(blocksOverlap(
    { day: "mon", start: "09:00", end: "11:00" },
    { day: "mon", start: "11:00", end: "12:00" }
  ), false);
});

section("adjust — invalid inputs");
test("rejects missing move", () => {
  const r = adjust({ blocks: baseBlocks });
  assert.equal(r.ok, false);
});
test("rejects unknown task_id", () => {
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-nope", day: "tue", start: "10:00" } });
  assert.equal(r.ok, false);
});
test("rejects moving a fixed block", () => {
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-sara-1on1", day: "wed", start: "10:00" } });
  assert.equal(r.ok, false);
});

section("adjust — simple moves");
test("moves Methods to a free slot with no cascade", () => {
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-methods", day: "mon", start: "11:30" } });
  assert.equal(r.ok, true);
  assert.equal(r.cascade.length, 0);
  const moved = r.newBlocks.find((b) => b.task_id === "t-methods");
  assert.equal(moved.start, "11:30");
  assert.equal(moved.end, "13:30");
});

test("cascades when moving Methods clobbers Admin slot", () => {
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-methods", day: "mon", start: "13:30" } });
  assert.equal(r.ok, true);
  // Methods should land at 13:30-15:30. Admin at 14:00-15:00 overlaps → bumped.
  assert.ok(r.cascade.find((c) => c.task_id === "t-admin"),
    "Admin should have cascaded");
});

section("adjust — dependency enforcement");
test("blocks Results from before Methods finishes", () => {
  // Move Results to Mon 09:00 — before Methods is scheduled on Mon ending 11am? Actually
  // Methods also starts at 09:00 on Mon, so moving Results to Mon 09:00 should be blocked
  // because depends_on Methods and Methods's END (11:00) is after Results' START (09:00).
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-results", day: "mon", start: "09:00" } });
  assert.equal(r.ok, false);
});
test("allows Results after Methods finishes", () => {
  const r = adjust({ blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-results", day: "mon", start: "11:30" } });
  assert.equal(r.ok, true);
});

section("adjust — checkpoint impact");
test("flags checkpoint overshoot when block date > DoD", () => {
  // Move Aim 3 (checkpoint date 2026-04-17) to Friday of week starting 2026-04-13.
  // Friday = 2026-04-17. Should be on-boundary, no overshoot.
  const r = adjust({
    blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-aim3", day: "fri", start: "09:00" },
    options: { weekStart: "2026-04-13" },
  });
  assert.equal(r.ok, true);
  // No overshoot on boundary date
  const overshoots = r.checkpointImpacts.filter((c) => c.overshoot_days >= 1);
  assert.equal(overshoots.length, 0);
});

test("flags overshoot when moved beyond DoD", () => {
  // Media v2 DoD is 2026-04-18 (Sat). Moving to Fri of week starting 2026-04-20 = 2026-04-24 > DoD.
  const r = adjust({
    blocks: baseBlocks, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-media", day: "fri", start: "14:00" },
    options: { weekStart: "2026-04-20" },
  });
  assert.equal(r.ok, true);
  assert.ok(r.checkpointImpacts.some((c) => c.overshoot_days >= 1),
    "should flag Media checkpoint overshoot");
  assert.equal(r.approvalRequired, true);
});

section("adjust — Deep-block stack warning");
test("warns if 3+ Deep blocks stack in one day", () => {
  // Move Figure-4 and Polish to Wednesday alongside Results → 3 Deep on Wed
  const modified = baseBlocks.map((b) => {
    if (b.task_id === "t-figure-4") return { ...b, day: "wed", start: "12:00", end: "14:00" };
    if (b.task_id === "t-polish")  return { ...b, day: "wed", start: "14:00", end: "16:00" };
    return b;
  });
  const r = adjust({
    blocks: modified, tasks: baseTasks, checkpoints: baseCheckpoints,
    move: { task_id: "t-methods", day: "wed", start: "16:00" },
    options: { stackLimit: 3 },
  });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes("Deep blocks stacked")),
    "should warn on stacked deep blocks");
});

section("summary");
console.log(`\n${passed} passed · ${failed} failed\n`);
process.exit(failed ? 1 : 0);
