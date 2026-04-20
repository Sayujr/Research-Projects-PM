/* research-pm demo app state.
   Single source of truth in the browser: localStorage.
   Every page reads/writes the same `state` object.

   In a live install this data is served from a Github-Action-built
   data.json that parses the repo markdown on every commit. Writes go
   back via the issue-form/PWA flow. */

const SEED_STATE = {
  today: '2026-04-21',

  project: {
    id: 'tnf-paper',
    title: 'TNF paper',
    tagline: 'First-author submission to Cell Reports, targeting Oct 2026.',
    objective: 'Q2 — TNF paper draft complete, co-authors have it.',
    krs: [
      { label: 'KR1 · Methods section drafted (2000 words)', pct: 100 },
      { label: 'KR2 · Figures finalised (6/6 at v3)',        pct: 67  },
      { label: 'KR3 · Co-authors have the draft',            pct: 0   },
    ],
    checkpoints: [
      { name: 'Intro drafted',    date: '2026-04-08', dod: '1500 words, citations done', status: 'done'  },
      { name: 'Methods drafted',  date: '2026-04-30', dod: '2000 words, protocol refs',  status: 'doing' },
      { name: 'Results drafted',  date: '2026-05-15', dod: 'numbers + structure + captions', status: 'todo' },
      { name: 'Figures v3',       date: '2026-05-31', dod: '6 of 6 panels finalised',    status: 'todo' },
      { name: 'Co-authors review',date: '2026-06-15', dod: 'all replies incorporated',   status: 'todo' },
    ],
    blockers: [
      { text: 'Antibody reorder pending — ETA Apr 28. Replicate blocked.' },
    ],
    recentLog: [
      { date: '2026-04-20', text: 'Methods section — drafted 2000 words', duration: '2h 10m' },
      { date: '2026-04-17', text: 'Figures 1–3 finalised at v3',          duration: '3h' },
      { date: '2026-04-16', text: 'Replicate run matches primary within 5%', duration: '3h 15m' },
    ],
  },

  people: [
    {
      name: 'Sara', role: 'postdoc', cadence: 'bi-weekly', lastContact: '2026-04-10',
      projects: ['tnf-paper', 'organoid'],
      owesMe: [
        { text: 'Organoid protocol v2',   committed: '2026-04-08', due: '2026-04-22' },
        { text: 'Figure 4 first draft',   committed: '2026-04-14', due: '2026-04-30' },
      ],
      iOwe: [
        { text: 'Feedback on cell type B results', due: '2026-04-23' },
      ],
    },
    {
      name: 'Ravi', role: 'postdoc', cadence: 'bi-weekly', lastContact: '2026-04-15',
      projects: ['tnf-paper'],
      owesMe: [
        { text: 'Dose-response replicate draft', committed: '2026-04-10', due: '2026-04-24' },
      ],
      iOwe: [],
    },
    {
      name: 'Jim', role: 'lab tech', cadence: 'weekly', lastContact: '2026-04-13',
      projects: ['tnf-paper', 'organoid'],
      owesMe: [],
      iOwe: [
        { text: 'Order new pipette tips', due: '2026-04-22' },
      ],
    },
    {
      name: 'Prof Smith', role: 'PI', cadence: 'weekly report', lastContact: '2026-04-14',
      projects: ['tnf-paper'],
      owesMe: [],
      iOwe: [
        { text: 'Weekly report (Apr 14–20)', due: '2026-04-25' },
      ],
    },
  ],

  // Progress log — all projects, last 14 days
  progressLog: [
    { date: '2026-04-20', project: 'tnf-paper', text: 'Methods section — drafted 2000 words', duration: '2h 10m' },
    { date: '2026-04-18', project: 'organoid',  text: 'Cell type B contamination traced to shared incubator', duration: '45m' },
    { date: '2026-04-17', project: 'tnf-paper', text: 'Figures 1–3 finalised at v3',           duration: '3h' },
    { date: '2026-04-17', project: 'r01',        text: 'R01 Aim 3 outline drafted',             duration: '1h 30m' },
    { date: '2026-04-16', project: 'tnf-paper', text: 'Replicate run matches primary within 5%', duration: '3h 15m' },
    { date: '2026-04-15', project: 'organoid',  text: 'Media v2 protocol documented',           duration: '1h' },
    { date: '2026-04-14', project: 'tnf-paper', text: 'Intro section polished',                 duration: '1h 45m' },
  ],

  // For the Plan Board (plan.html has its own constants but could migrate here)
  // Not moving plan board blocks to state yet to avoid breaking drag-drop.
};

const STORAGE_KEY = 'research-pm-demo-v1';
const LIVE_DATA_URL = 'data.json';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return structuredClone(SEED_STATE);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('localStorage unavailable; edits will not persist this session.');
  }
}

function resetAll() {
  if (!confirm('Reset all demo data back to seed / live data? Your edits will be lost.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/**
 * Hydrate from docs/data.json if available.
 *
 * data.json is produced by tools/build-data.js (GH Action on every push).
 * If it's present AND the user has not edited anything locally (no
 * STORAGE_KEY in localStorage), overwrite state with live data so the
 * site reflects the real repo. Otherwise, respect the user's edits.
 *
 * After hydration, fires a `state:hydrated` CustomEvent so pages can
 * re-render if they want to.
 */
async function hydrateFromLive() {
  try {
    const res = await fetch(LIVE_DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const live = await res.json();

    // Merge strategy: if the user has a saved localStorage state, keep
    // it (they've been editing). Otherwise, take live data.
    const hasLocalEdits = localStorage.getItem(STORAGE_KEY) !== null;
    if (hasLocalEdits) {
      window.__liveData = live;  // exposed for a manual "pull live" button
      return { source: 'local', state };
    }
    // Transform live shape into the shape app.js expects.
    state = mergeLiveIntoState(live);
    window.dispatchEvent(new CustomEvent('state:hydrated', { detail: { source: 'live' } }));
    document.body.classList.add('live-data');
    return { source: 'live', state };
  } catch (e) {
    // No data.json yet (fresh install, or offline). Seed data is fine.
    window.dispatchEvent(new CustomEvent('state:hydrated', { detail: { source: 'seed' } }));
    document.body.classList.add('seed-data');
    return { source: 'seed', state };
  }
}

function mergeLiveIntoState(live) {
  // Pick the first active project as the "focus" project for project.html.
  const primary = (live.projects || []).find((p) => p.status === 'active') ||
                  live.projects?.[0] ||
                  SEED_STATE.project;

  const krs = (primary.krs || SEED_STATE.project.krs || []).slice();

  return {
    today: live.today || SEED_STATE.today,
    project: {
      id: primary.id || SEED_STATE.project.id,
      title: primary.title || primary.id || SEED_STATE.project.title,
      tagline: primary.goal || SEED_STATE.project.tagline,
      objective: primary.objective || SEED_STATE.project.objective,
      krs,
      checkpoints: primary.checkpoints || [],
      blockers: primary.blockers || [],
      recentLog: (live.progress || []).filter((l) => l.project === primary.id).slice(0, 5),
    },
    people: live.people && live.people.length ? live.people : SEED_STATE.people,
    progressLog: live.progress || SEED_STATE.progressLog,
    goals: live.goals || null,
    stats: live.stats || null,
    weekPlan: live.weekPlan || null,
    _liveMeta: { generated_at: live.generated_at, week: live.week },
  };
}

// Global state, usable from every page.
let state = loadState();

// Kick off hydration. Pages that care about the refresh can listen for
// `state:hydrated` and call their render function again.
hydrateFromLive();
