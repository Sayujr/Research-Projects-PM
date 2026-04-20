#!/usr/bin/env node
/**
 * build-data.js
 *
 * Parses all the markdown in this repo into a single docs/data.json that
 * the static website reads. Runs on every push via the build-site GitHub
 * Action.
 *
 * Reads:
 *   projects/*.md        projects + checkpoints + blockers + sections
 *   progress/YYYY-MM.md  append-only progress log
 *   people.md            team + owes-me / I-owe / last_contact
 *   goals.md             year goals + quarterly
 *   week-plans/YYYY-Www.md  this week's blocks + top-5
 *   meta/task-history.json  duration-learning state
 *
 * Output:
 *   docs/data.json        single object the site consumes
 *
 * Robust to missing files — produces an empty-but-valid data.json for a
 * fresh repo (pre-onboarding).
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const REPO = path.resolve(__dirname, "..");
const OUT = path.join(REPO, "docs", "data.json");

const today = new Date().toISOString().slice(0, 10);
const nowIso = new Date().toISOString();

/* ---------- helpers ---------- */

function readDirSafe(dir) {
  const p = path.join(REPO, dir);
  try {
    return fs.readdirSync(p).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(path.join(REPO, p), "utf8");
  } catch {
    return null;
  }
}

function parseSections(body) {
  /* Split a markdown body on `## Heading` into { Heading: content } */
  const out = {};
  const lines = body.split("\n");
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      current = m[1];
      out[current] = "";
    } else if (current !== null) {
      out[current] += line + "\n";
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}

function parseCheckpointsSection(text) {
  /* Each checkpoint line: `- [ ] **Name** — YYYY-MM-DD. DoD: ...` */
  if (!text) return [];
  const out = [];
  const re = /^-\s*\[([ x])\]\s*\*\*(.+?)\*\*\s*—\s*(\d{4}-\d{2}-\d{2})\.?\s*(?:DoD:\s*(.+?))?\.?\s*$/;
  for (const line of text.split("\n")) {
    const m = line.trim().match(re);
    if (m) {
      out.push({
        name: m[2].trim(),
        date: m[3],
        dod: (m[4] || "").trim(),
        status: m[1] === "x" ? "done" : "todo",
      });
    }
  }
  return out;
}

function parseBlockers(text) {
  if (!text) return [];
  // Group continuation lines (starting with whitespace) with the preceding `- ...` item.
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    if (/^-\s+/.test(line)) {
      if (cur !== null) out.push({ text: cur.trim() });
      cur = line.replace(/^-\s+/, "");
    } else if (/^\s+/.test(line) && cur !== null) {
      cur += " " + line.trim();
    } else if (line.trim() === "" && cur !== null) {
      out.push({ text: cur.trim() });
      cur = null;
    }
  }
  if (cur !== null) out.push({ text: cur.trim() });
  return out.filter((b) => b.text);
}

function toDateString(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function parseProgressEntry(line) {
  /* `YYYY-MM-DD <project-id> — <note> (Nm | Nh)` */
  const re = /^(\d{4}-\d{2}-\d{2})\s+(\S+)\s+—\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/;
  const m = line.match(re);
  if (!m) return null;
  return {
    date: m[1],
    project: m[2],
    text: m[3].trim(),
    duration: m[4] ? m[4].trim() : null,
  };
}

function parsePeople(text) {
  /* people.md format: `### Name` then `- **Field**: value` lines */
  if (!text) return [];
  const out = [];
  const entries = text.split(/^###\s+/m).slice(1);
  for (const entry of entries) {
    const [nameLine, ...rest] = entry.split("\n");
    const name = nameLine.trim();
    if (!name || name === "Template" || name.startsWith("<")) continue;
    const person = {
      name,
      role: "",
      cadence: "",
      lastContact: null,
      projects: [],
      owesMe: [],
      iOwe: [],
      notes: "",
    };
    let currentList = null;
    for (const line of rest) {
      const roleM = line.match(/^-\s*\*\*Role\*\*:\s*(.+)$/);
      const projM = line.match(/^-\s*\*\*Projects\*\*:\s*\[(.+)\]/);
      const cadM = line.match(/^-\s*\*\*Cadence\*\*:\s*(.+)$/);
      const notesM = line.match(/^-\s*\*\*Notes\*\*:\s*(.+)$/);
      const owesHead = /^-\s*\*\*Owes me\*\*:/.test(line);
      const iOweHead = /^-\s*\*\*I owe\*\*:/.test(line);
      const itemM = line.match(/^\s+-\s*\[[ x]\]\s*(.+?)(?:\s*—\s*(.+))?$/);
      if (roleM) person.role = roleM[1].trim();
      else if (projM) person.projects = projM[1].split(",").map((s) => s.trim());
      else if (cadM) {
        person.cadence = cadM[1].trim();
        const dateM = cadM[1].match(/(\d{4}-\d{2}-\d{2})/);
        if (dateM) person.lastContact = dateM[1];
      } else if (notesM) person.notes = notesM[1].trim();
      else if (owesHead) currentList = "owesMe";
      else if (iOweHead) currentList = "iOwe";
      else if (itemM && currentList) {
        person[currentList].push({
          text: itemM[1].trim(),
          meta: (itemM[2] || "").trim(),
        });
      }
    }
    out.push(person);
  }
  return out;
}

function parseGoals(text) {
  if (!text) return { year: [], quarters: {} };
  /* Simple: pull lines that look like numbered year goals under
     `## YEAR <year>` sections, and `### Q<N>` sub-sections. */
  const out = { year: [], quarters: {} };
  let mode = null;
  let currentQ = null;
  for (const line of text.split("\n")) {
    const yearM = line.match(/^##\s+YEAR\s+(\d{4})/);
    const qM = line.match(/^###\s+Q(\d)\s/i);
    if (yearM) { mode = "year"; continue; }
    if (qM) { mode = "quarter"; currentQ = `Q${qM[1]}`; out.quarters[currentQ] = []; continue; }
    if (mode === "year") {
      const ym = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(?:—|-)?\s*(.*)$/);
      if (ym) out.year.push({ title: ym[1].trim(), detail: ym[2].trim() });
    } else if (mode === "quarter" && currentQ) {
      const qm = line.match(/^-\s+(.+)$/);
      if (qm) out.quarters[currentQ].push(qm[1].trim());
    }
  }
  return out;
}

function parseWeekPlan(text) {
  if (!text) return null;
  const { data } = matter(text);
  return data;
}

function currentWeek() {
  /* Returns a string like "2026-W17" for today */
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---------- main ---------- */

function build() {
  const data = {
    generated_at: nowIso,
    today,
    week: currentWeek(),
    projects: [],
    progress: [],
    people: [],
    goals: { year: [], quarters: {} },
    weekPlan: null,
    taskHistory: {},
    stats: { activeProjects: 0, writingStreak: 0, overdue: 0 },
  };

  /* projects/*.md */
  const projectFiles = readDirSafe("projects").filter((f) => f.endsWith(".md") && !f.endsWith("_template.md"));
  for (const pf of projectFiles) {
    const raw = readFileSafe(pf);
    if (!raw) continue;
    const { data: fm, content } = matter(raw);
    if (fm && fm.id) {
      const sections = parseSections(content);
      data.projects.push({
        id: fm.id,
        title: fm.title || fm.id,
        status: fm.status || "active",
        goalModel: fm.goal_model || "narrative",
        deadline: toDateString(fm.deadline),
        priority: fm.priority || 3,
        collaborators: fm.collaborators || [],
        team: fm.team || [],
        tags: fm.tags || [],
        checkpoints: parseCheckpointsSection(sections.Checkpoints || ""),
        blockers: parseBlockers(sections.Blockers || ""),
        goal: (sections.Goal || "").split("\n")[0] || "",
        rawSections: sections,
      });
    }
  }

  /* progress/*.md  — all log entries across files */
  const progressFiles = readDirSafe("progress").filter((f) => f.match(/\d{4}-\d{2}\.md$/));
  for (const pf of progressFiles) {
    const raw = readFileSafe(pf);
    if (!raw) continue;
    for (const line of raw.split("\n")) {
      const entry = parseProgressEntry(line.trim());
      if (entry) data.progress.push(entry);
    }
  }
  data.progress.sort((a, b) => b.date.localeCompare(a.date));

  /* people.md */
  data.people = parsePeople(readFileSafe("people.md"));

  /* goals.md */
  data.goals = parseGoals(readFileSafe("goals.md"));

  /* week-plans/<current>.md */
  data.weekPlan = parseWeekPlan(readFileSafe(`week-plans/${data.week}.md`));

  /* meta/task-history.json */
  const th = readFileSafe("meta/task-history.json");
  if (th) {
    try { data.taskHistory = JSON.parse(th); } catch {}
  }

  /* derived stats */
  data.stats.activeProjects = data.projects.filter((p) => p.status === "active").length;

  /* writing streak: consecutive days from today going back with any writing-tagged progress entry */
  const dates = new Set(
    data.progress
      .filter((e) => {
        const project = data.projects.find((p) => p.id === e.project);
        return project && project.tags && project.tags.includes("paper");
      })
      .map((e) => e.date)
  );
  let streak = 0;
  const d = new Date(today);
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  data.stats.writingStreak = streak;

  /* overdue: any checkpoint whose date < today and status != done */
  data.stats.overdue = data.projects
    .flatMap((p) => p.checkpoints)
    .filter((c) => c.date < today && c.status !== "done").length;

  /* write */
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(
    `Wrote ${OUT} — ${data.projects.length} projects, ` +
      `${data.progress.length} progress entries, ${data.people.length} people`
  );
}

build();
