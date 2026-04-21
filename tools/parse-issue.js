#!/usr/bin/env node
/**
 * parse-issue.js
 *
 * Runs inside the parse-issue GitHub Action. Reads the issue JSON from
 * the `ISSUE_JSON` env var (piped in by the workflow), determines which
 * form was used by the label, dispatches to the appropriate handler
 * which makes a markdown edit. Workflow then stages, commits, pushes.
 *
 * Output: prints a summary comment to stdout that the workflow posts
 * back to the issue. Also prints machine-readable JSON on the last line.
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { adjust } = require("./planner/adjust");

const REPO = path.resolve(__dirname, "..");

/* ---------- input ---------- */

const issueRaw = process.env.ISSUE_JSON || "{}";
let issue;
try {
  issue = JSON.parse(issueRaw);
} catch (e) {
  console.error("parse-issue: invalid ISSUE_JSON");
  process.exit(1);
}

const body = issue.body || "";
const labels = (issue.labels || []).map((l) =>
  typeof l === "string" ? l : l.name
);
const number = issue.number;
const title = issue.title || "";

/* Extract form fields: `### Label\n\nValue\n\n###...` */
function parseForm(text) {
  const out = {};
  const parts = text.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const firstNL = part.indexOf("\n");
    const label = part.slice(0, firstNL).trim();
    const value = part
      .slice(firstNL + 1)
      .replace(/^_No response_\s*$/m, "")
      .trim();
    out[slug(label)] = value;
  }
  return out;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const fields = parseForm(body);

/* ---------- helpers ---------- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function durationToMinutes(s) {
  if (!s) return null;
  let m = 0;
  const h = s.match(/(\d+)\s*h/);
  const mm = s.match(/(\d+)\s*m/);
  if (h) m += parseInt(h[1], 10) * 60;
  if (mm) m += parseInt(mm[1], 10);
  return m || null;
}

function appendToFile(relPath, line) {
  const abs = path.join(REPO, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
  const sep = existing.endsWith("\n") || existing === "" ? "" : "\n";
  fs.writeFileSync(abs, existing + sep + line + "\n");
}

function insertInSection(relPath, heading, insertLine) {
  /* Insert `insertLine` at the end of a `## heading` section in a markdown file. */
  const abs = path.join(REPO, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${relPath}`);
  }
  const src = fs.readFileSync(abs, "utf8").split("\n");
  let inTarget = false;
  const out = [];
  let inserted = false;
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (/^##\s+/.test(line)) {
      if (inTarget && !inserted) {
        out.push(insertLine);
        inserted = true;
      }
      inTarget = line.trim().toLowerCase() === `## ${heading}`.toLowerCase();
    }
    out.push(line);
  }
  if (inTarget && !inserted) out.push(insertLine);
  if (!inserted && !inTarget) {
    // Heading didn't exist — append at EOF
    out.push(`\n## ${heading}\n\n${insertLine}`);
  }
  fs.writeFileSync(abs, out.join("\n"));
}

function projectFileExists(id) {
  return fs.existsSync(path.join(REPO, "projects", `${id}.md`));
}

function result(ok, message, filesChanged = [], commitMsg = null) {
  return { ok, message, filesChanged, commitMsg };
}

/* ---------- handlers ---------- */

function handleLogWin() {
  const project = (fields.project || "").trim();
  const note = (fields.what_shipped || "").trim();
  const duration = (fields.duration || "").trim();
  const date = (fields.date || "").trim() || today();

  if (!project) return result(false, "Missing project id.");
  if (!note) return result(false, "Missing note.");
  if (!projectFileExists(project)) {
    return result(false, `Unknown project id: \`${project}\`.`);
  }

  const month = date.slice(0, 7);
  const file = `progress/${month}.md`;

  const durSuffix = duration ? ` (${duration})` : "";
  const line = `${date} ${project} — ${note}${durSuffix}`;

  // Ensure file exists with a header
  const abs = path.join(REPO, file);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(
      abs,
      `# Progress — ${date.slice(0, 7)}\n\nAppend-only log. One line per entry:\n` +
        "`YYYY-MM-DD <project-id> — <note> (Nm)`\n\n---\n\n"
    );
  }

  appendToFile(file, line);

  // Update task-history.json if a known task_type + duration
  const minutes = durationToMinutes(duration);
  if (minutes) {
    updateTaskHistory(note, minutes);
  }

  return result(
    true,
    `Logged to \`${file}\`:\n\n> ${line}`,
    [file, "meta/task-history.json"],
    `progress: ${project} — ${note}`
  );
}

function handleLogPassage() {
  const project = (fields.project || "").trim();
  const cell = (fields.cell_line || "").trim();
  const pn = (fields.passage_number || "").trim();
  const duration = (fields.duration || "").trim();
  const notes = (fields.notes_optional || "").trim();

  if (!project) return result(false, "Missing project id.");
  if (!cell) return result(false, "Missing cell line.");
  if (!projectFileExists(project)) {
    return result(false, `Unknown project id: \`${project}\`.`);
  }

  const note = `Passage ${cell}${pn ? ` ${pn}` : ""}${notes ? ` — ${notes}` : ""}`;
  // Re-use logwin path
  fields.project = project;
  fields.what_shipped = note;
  fields.duration = duration;
  fields.date = today();
  return handleLogWin();
}

function handleNewCheckpoint() {
  const project = (fields.project || "").trim();
  const name = (fields.checkpoint_name || "").trim();
  const date = (fields.target_date_yyyy_mm_dd || "").trim();
  const dod = (fields.definition_of_done || "").trim();

  if (!project || !name || !date || !dod) {
    return result(false, "Missing one of: project, name, date, DoD.");
  }
  if (!projectFileExists(project)) {
    return result(false, `Unknown project id: \`${project}\`.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return result(false, `Date must be YYYY-MM-DD (got \`${date}\`).`);
  }

  const line = `- [ ] **${name}** — ${date}. DoD: ${dod}.`;
  const file = `projects/${project}.md`;
  insertInSection(file, "Checkpoints", line);

  return result(
    true,
    `Added checkpoint *${name}* (due ${date}) to \`${file}\`.`,
    [file],
    `checkpoint: ${project} — ${name} (DoD ${date})`
  );
}

function handleNewBlocker() {
  const project = (fields.project || "").trim();
  const desc = (fields.what_s_blocked_and_what_s_needed || "").trim();
  const owner = (fields.who_can_unblock_optional || "").trim();
  const etaRaw = (fields.target_resolve_date_optional_yyyy_mm_dd || "").trim();
  const eta = /^\d{4}-\d{2}-\d{2}$/.test(etaRaw) ? etaRaw : null;

  if (!project || !desc) return result(false, "Missing project or description.");
  if (!projectFileExists(project)) {
    return result(false, `Unknown project id: \`${project}\`.`);
  }

  const parts = [desc];
  if (owner) parts.push(`Owner: ${owner}.`);
  if (eta) parts.push(`ETA: ${eta}.`);
  const line = `- ${parts.join(" ")}`;

  const file = `projects/${project}.md`;
  insertInSection(file, "Blockers", line);

  return result(
    true,
    `Added blocker to \`${file}\`.`,
    [file],
    `blocker: ${project} — ${desc.slice(0, 60)}`
  );
}

function handleMoveBlock() {
  const taskId = (fields.task_id_from_week_plans || "").trim();
  const day = (fields.target_day || "").trim();
  const start = (fields.target_start_time_hh_mm_24h || "").trim();

  if (!taskId || !day || !start) {
    return result(false, "Missing task_id, target_day, or target_start.");
  }

  // Find the current week plan
  const week = currentWeek();
  const weekFile = `week-plans/${week}.md`;
  const absWeek = path.join(REPO, weekFile);
  if (!fs.existsSync(absWeek)) {
    return result(false, `No week-plan file for ${week}. Run /week-plan in Claude first.`);
  }

  const { data: plan } = matter(fs.readFileSync(absWeek, "utf8"));
  if (!plan.blocks) {
    return result(false, `${weekFile} has no blocks[] in frontmatter.`);
  }

  // Build tasks[] from top_5 + project files
  const tasks = (plan.top_5 || []).map((t) => ({
    id: t.id,
    title: t.title,
    checkpoint: t.checkpoint,
    block_type: inferBlockType(t, plan),
    preferred_block: inferBlockType(t, plan),
  }));

  // Build checkpoints[] from all projects
  const checkpoints = collectCheckpoints();

  const weekStart = weekStartDate(week);
  const r = adjust({
    blocks: plan.blocks,
    tasks,
    checkpoints,
    move: { task_id: taskId, day, start },
    options: { weekStart },
  });

  if (!r.ok) {
    return result(false, `Move rejected: ${r.reason}`);
  }

  // If no overshoot, auto-apply. Otherwise, return a preview.
  if (r.approvalRequired) {
    const preview = formatCascadePreview(r);
    return result(
      true,
      "Cascade preview (needs your approval before commit):\n\n" + preview +
        "\n\n**Approve?** Reply to this issue with `accept`, `compress`, or `cut` — or dismiss by closing.\n\n" +
        "(Auto-commit is paused because this move pushes at least one checkpoint past its DoD.)",
      [],
      null
    );
  }

  // Safe move — commit. Use gray-matter's stringifier (bundles js-yaml).
  const existing = fs.readFileSync(absWeek, "utf8");
  const { content } = matter(existing);
  const updated = matter.stringify(content, { ...plan, blocks: r.newBlocks });
  fs.writeFileSync(absWeek, updated);

  return result(
    true,
    `Moved \`${taskId}\` to ${day} ${start}.\n\n` +
      (r.cascade.length
        ? "Cascaded blocks:\n" +
          r.cascade.map((c) => `- \`${c.task_id}\` · ${c.from.day} ${c.from.start} → ${c.to.day} ${c.to.start}`).join("\n")
        : "No cascade needed."),
    [weekFile],
    `move: ${taskId} → ${day} ${start}`
  );
}

function currentWeek() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekStartDate(weekId) {
  const m = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO week: Monday is day 1. Find Jan 4 of year (always in week 1).
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  return target.toISOString().slice(0, 10);
}

function inferBlockType(task, _plan) {
  const n = (task.title || "").toLowerCase();
  if (/draft|revise|polish|outline|section|figure/.test(n)) return "deep";
  if (/passage|media|dose|assay|culture|lab/.test(n)) return "lab";
  if (/admin|email|order/.test(n)) return "light";
  if (/1:1|meeting|retro|digest/.test(n)) return "meeting";
  return "deep";
}

function collectCheckpoints() {
  const out = [];
  const projectsDir = path.join(REPO, "projects");
  if (!fs.existsSync(projectsDir)) return out;
  for (const file of fs.readdirSync(projectsDir)) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const src = fs.readFileSync(path.join(projectsDir, file), "utf8");
    const { content } = matter(src);
    const sectionMatch = content.match(/##\s+Checkpoints\s*\n([\s\S]*?)(?:\n##|\s*$)/);
    if (!sectionMatch) continue;
    for (const line of sectionMatch[1].split("\n")) {
      const m = line.trim().match(/^-\s*\[[ x]\]\s*\*\*(.+?)\*\*\s*—\s*(\d{4}-\d{2}-\d{2})/);
      if (m) out.push({ name: m[1].trim(), date: m[2], project: file.replace(".md", "") });
    }
  }
  return out;
}

function formatCascadePreview(r) {
  const lines = [];
  lines.push("**Cascade:**");
  for (const c of r.cascade) {
    lines.push(`- \`${c.task_id}\`: ${c.from.day} ${c.from.start} → ${c.to.day} ${c.to.start}`);
  }
  if (r.checkpointImpacts.length) {
    lines.push("\n**Checkpoint impact:**");
    for (const ci of r.checkpointImpacts) {
      lines.push(
        `- *${ci.checkpoint}* (DoD ${ci.cp_date}) — task ${ci.task} now on ${ci.block_date} (${ci.overshoot_days}d overshoot)`
      );
    }
  }
  if (r.warnings.length) {
    lines.push("\n**Warnings:**");
    for (const w of r.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}


function updateTaskHistory(note, minutes) {
  const file = "meta/task-history.json";
  const abs = path.join(REPO, file);
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {}

  const n = note.toLowerCase();
  let taskType = null;
  if (/figure/.test(n)) taskType = "figure_draft";
  else if (/method/.test(n)) taskType = "methods_section";
  else if (/result/.test(n)) taskType = "results_section";
  else if (/intro/.test(n)) taskType = "intro_section";
  else if (/passage|maintenance/.test(n)) taskType = "passage_routine";
  else if (/dose|assay/.test(n)) taskType = "dose_response";
  else if (/grant|aim/.test(n)) taskType = "grant_section";

  if (!taskType) return;

  const cur = data[taskType] || { median_min: null, p90_min: null, n: 0, samples: [] };
  const samples = [...(cur.samples || []), minutes].slice(-20);
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const p90 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))];
  data[taskType] = { median_min: med, p90_min: p90, n: samples.length, samples };

  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + "\n");
}

/* ---------- dispatch ---------- */

let res;
try {
  if (labels.includes("logwin") && !labels.includes("lab")) res = handleLogWin();
  else if (labels.includes("logwin") && labels.includes("lab")) res = handleLogPassage();
  else if (labels.includes("newcheckpoint")) res = handleNewCheckpoint();
  else if (labels.includes("blocker")) res = handleNewBlocker();
  else if (labels.includes("move-block")) res = handleMoveBlock();
  else res = result(false, `No matching form label on issue (#${number}).`);
} catch (e) {
  res = result(false, `Parser error: ${e.message}`);
}

// Human-readable comment
console.log(res.message);

// Machine-readable tail line (workflow parses this)
console.log(
  "\n---\n__PARSE_ISSUE_RESULT__=" + JSON.stringify(res)
);
