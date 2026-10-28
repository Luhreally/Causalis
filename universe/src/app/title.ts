// The title screen (asked for 2026-09-28: a way back to the start, and to make a new world).
// A low-poly world turns slowly behind a menu: Continue (the world last kept), a new world
// (what kind, its seed, where it begins), the worlds kept in this browser (and a kept file
// opened), the sandbox, how to play. Every choice is an address: the page goes there.
import type { HostClient, SaveMeta, SeedLife } from "../bridge/index.ts";
import { seedWithAct, seedWithoutAct } from "../kernel/index.ts";
import {
  MAKINGS,
  MAKING_SUBJECTS,
  MAKING_WORDS,
  makingAct,
  makingsOf,
  type MakingSubject,
} from "../view/index.ts";

export type TitleOptions = {
  /** A host to ask for the worlds kept, and to open a kept file with. */
  connect: () => Promise<{ client: HostClient }>;
  /** The first visit: how to play is shown at once. */
  first: boolean;
};

const YEAR = 365 * 86_400;

/** The words a new world's seed is drawn from: a word and a number, as "amber 412". */
const SEED_WORDS = [
  "amber",
  "kestrel",
  "tide",
  "ember",
  "harrow",
  "lumen",
  "quill",
  "sorrel",
  "vale",
  "wren",
  "cinder",
  "fallow",
  "gale",
  "juniper",
  "marrow",
  "north",
  "osier",
  "rook",
  "saffron",
  "thistle",
];

/** A seed drawn at random. */
export function randomSeed(): string {
  const u = new Uint32Array(2);
  crypto.getRandomValues(u);
  return `${SEED_WORDS[u[0]! % SEED_WORDS.length]} ${u[1]! % 1000}`;
}

/** What kind of world each universe makes, as the menu names it. */
const KINDS = [
  ["earth", "🌍", "Earth-like", "a world like ours: its seas, its lands, its first farmers"],
  ["alien", "🪐", "Never seen", "any star, any body, any sky, any people"],
] as const;

/**
 * Whether a world never seen must be one life arises on (asked for 2026-10-24: "it should give me
 * option to where the world supports life"): one in four is lifeless as its seed falls (one in
 * five before Phase 56, whose worlds of other kinds quicken less often).
 */
const LIFE = [
  ["living", "🌱", "Where life arises", "its first cells, its beasts, and in time a people"],
  ["any", "🎲", "As its seed falls", "any world at all: one in four never knows life"],
] as const;

/**
 * The seed nearest `seed` whose world life arises on, a people in time: the seed itself if it is
 * one, else the next number on from it ("amber 412" → "amber 413"; "amber" → "amber 2"), the
 * acts laid on its dawn and its making kept; why the seed asked for was passed by (null if it was
 * not); and whether one was found within `tries` (if not, the seed as asked). `looked` is told
 * each seed looked at.
 */
export async function livingSeed(
  client: Pick<HostClient, "lifeOf">,
  universe: string,
  seed: string,
  tries = 40,
  looked: (n: number) => void = () => {},
): Promise<{ seed: string; passed: string | null; found: boolean }> {
  const asked = await client.lifeOf(universe, seed);
  if (asked.peopled) return { seed, passed: null, found: true };
  const cut = seed.indexOf(" ~"),
    name = (cut < 0 ? seed : seed.slice(0, cut)).trim(),
    acts = cut < 0 ? "" : seed.slice(cut),
    m = /^(.*?)(\d+)$/.exec(name),
    stem = m ? m[1]! : `${name} `,
    from = m ? Number(m[2]) : 1;
  for (let i = 1; i <= tries; i++) {
    const next = `${stem}${from + i}${acts}`;
    looked(i);
    if ((await client.lifeOf(universe, next)).peopled)
      return { seed: next, passed: asked.words, found: true };
  }
  return { seed, passed: asked.words, found: false };
}

/** A seed's text with its making lifted, the acts laid on its dawn kept: its world as its seed falls. */
export function unmadeSeed(seed: string): string {
  return MAKING_SUBJECTS.reduce((s, m) => seedWithoutAct(s, makingAct(m, "-")), seed);
}

/**
 * The world a seed makes, in a line: "⭐ an M0V star, 3,435 K · 1.48 g · −16 °C · 85% sea", and its
 * kind where it is not a rocky world (Phase 56: "· 🟠 a methane world").
 */
export function madeWorldWords(w: NonNullable<SeedLife["world"]>): string {
  const t = w.warmth < 0 ? `−${-w.warmth}` : `${w.warmth}`;
  return `⭐ ${/^[AEFHILMNORSX]/.test(w.star) ? "an" : "a"} ${w.star} star, ${w.kelvin.toLocaleString("en")} K · ${w.gravity.toFixed(2)} g · ${t} °C · ${Math.round(w.seas * 100)}% sea${w.kind ? ` · ${w.kind}` : ""}`;
}

/** Where a new world begins. */
const BEGINNINGS = [
  [
    "genesis",
    "🌌",
    "From its very beginning",
    "watch the galaxy born, the world formed, the first cells, beasts and people arise — pause it, lay your hand on it — then begin in their first camp",
  ],
  ["farmers", "🏕️", "At its first farmers", "year 0: the first villages"],
  ["later", "🏛️", "Three centuries on", "realms and wars under way (it takes a moment to reach)"],
  [
    "contact",
    "🛸",
    "When strangers come down",
    "three centuries on, a people of another star called down among the most peopled land — and you there to see them",
  ],
] as const;

const HOW = [
  "The world runs on its own. Watch it, and tap any place, person or event to ask “why?” — every answer opens onto its causes.",
  "The lenses colour the world by what you want to see: people, food, trade, realms, tongues, faiths, their ways, what they have seen of you.",
  "“Look closer” goes down to a land and its villages; “The sky” goes out to the stars.",
  "Steer as in a builder's game: W A S D to go, Q E to turn, R F to tilt, + − or the wheel to zoom, Shift to hurry; drag to move the land, right-drag to turn it. Space pauses, 1 2 3 set the speed. On a phone: drag, pinch, and twist two fingers.",
  "Your hand — rain, harvest, plague, quakes, settlers, wars and peace, a people's ways, a tongue, a faith — is always a choice, and always in the chronicle.",
  "Lay your hand on a village and everyone there is someone: their traits, their families, their children.",
  "The world keeps itself every minute and when you switch away; “Continue” takes up the world last kept.",
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A menu choice: an icon, its words, a line under them. */
function choice(icon: string, words: string, note: string, act: () => void): HTMLButtonElement {
  const b = el("button", "choice"),
    small = el("small", undefined, note);
  b.append(el("span", "choice-icon", icon), el("span", "choice-words", words), small);
  b.onclick = act;
  return b;
}

/** A kept world in words: its kind and seed. */
function worldWords(s: SaveMeta): string {
  const kind =
    s.universe === "earth" ? "Earth" : s.universe === "alien" ? "A world never seen" : s.universe;
  return `${kind} — “${s.seed}”`;
}

/** How long ago a thing was kept, in words. */
function ago(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  if (s < 86_400 * 1.5) return `${Math.round(s / 3600)} hours ago`;
  return `${Math.round(s / 86_400)} days ago`;
}

/** The address that takes up a kept world. */
function keptAddress(s: SaveMeta): string {
  return `?universe=${encodeURIComponent(s.universe)}&seed=${encodeURIComponent(s.seed)}&load=${encodeURIComponent(s.name)}`;
}

/** Show the title screen in the page. */
export function showTitle(options: TitleOptions): void {
  const app = document.getElementById("app")!,
    screen = el("div", "title-screen"),
    sky = el("canvas", "title-sky"),
    box = el("div", "welcome title-window"),
    body = el("div", "title-body");
  const heading = el("h1", undefined, "Causalis Universe"),
    lead = el(
      "p",
      "title-lead",
      "A universe that runs on its own: worlds, their living things, peoples and their histories, out to the stars. You watch it, ask why anything is so, and — when you choose — lay your hand on it.",
    );
  box.append(heading, lead, body);
  screen.append(sky, box);
  app.replaceChildren(screen);
  const stop = turnWorld(sky);
  const go = (search: string) => {
    stop();
    location.search = search;
  };
  let saves: SaveMeta[] | null = null,
    client: HostClient | null = null;
  /** The host asked (one, once it has started). */
  const host = async () => client ?? (client = (await options.connect()).client);

  const back = (to: () => void) => {
    const b = el("button", "link title-back", "‹ Back");
    b.onclick = to;
    return b;
  };

  // The menu.
  const menu = () => {
    const list = el("div", "choices title-menu"),
      latest = saves?.[0];
    if (latest)
      list.append(
        choice(
          "▶️",
          "Continue",
          `${worldWords(latest)} · year ${Math.floor(latest.t / YEAR)} · kept ${ago(latest.savedAt)}`,
          () => go(keptAddress(latest)),
        ),
      );
    list.append(
      choice("✨", "New world", "what kind, its seed, where it begins", () => newWorld()),
    );
    if (saves?.length)
      list.append(
        choice(
          "📂",
          "Worlds kept",
          `${saves.length} kept in this browser, or open a kept file`,
          () => kept(),
        ),
      );
    else
      list.append(
        choice("📂", "Open a kept file", "a world kept as a file, from anywhere", () => kept()),
      );
    list.append(
      choice("🧪", "The sandbox", "a small ring of cells to try the hand on", () =>
        go("?universe=sandbox"),
      ),
      choice("❓", "How to play", "what the universe is, and how to watch it", () => how()),
    );
    body.replaceChildren(list);
    lead.hidden = false;
    if (options.first && !saves?.length) body.append(howList());
  };

  // A new world: its kind, its seed, where it begins.
  const newWorld = () => {
    let kind: string = KINDS[0][0],
      begin: string = BEGINNINGS[1][0],
      life: string = LIFE[0][0];
    const form = el("div", "title-form"),
      kinds = el("div", "choice-row"),
      lifeHead = el("h3", undefined, "Life on it"),
      lives = el("div", "choice-row"),
      beginnings = el("div", "choice-row"),
      seedRow = el("div", "seed-row"),
      seed = el("input", "seed-input"),
      roll = el("button", "seed-roll", "🎲"),
      seedNote = el("p", "muted seed-life"),
      // Its making (Phase 35 M180): a world never seen made by the hand before it forms — its
      // star, its pull, its orbit, its seas, its air — each an act laid in its seed's text, the
      // rest as the seed falls; and the world it makes, told.
      makingHead = el("h3", undefined, "Its making"),
      makingRow = el("div", "making-row"),
      madeNote = el("p", "muted seed-made"),
      start = el("button", "begin", "Begin ▶");
    seed.value = randomSeed();
    seed.maxLength = 60;
    seed.spellcheck = false;
    seed.setAttribute("aria-label", "The world's seed");
    roll.title = "Another seed";
    roll.setAttribute("aria-label", "Another seed");
    seedRow.append(seed, roll);
    const pick = (row: HTMLElement, id: string) => {
      for (const b of row.children) b.classList.toggle("on", (b as HTMLElement).dataset.id === id);
    };
    // Its making: a dial for each, turned through its choices and back to "as it falls".
    const dials = MAKING_SUBJECTS.map((subject) => {
      const b = el("button", "making-dial");
      b.dataset.subject = subject;
      b.onclick = () => {
        const choices: (string | undefined)[] = [undefined, ...Object.keys(MAKINGS[subject])],
          next = choices[(choices.indexOf(makingsOf(seed.value)[subject]) + 1) % choices.length];
        seed.value =
          next === undefined
            ? seedWithoutAct(seed.value, makingAct(subject, "-"))
            : seedWithAct(seed.value, makingAct(subject, next));
        showMakings();
        void tell();
      };
      return b;
    });
    const showMakings = () => {
      const m = makingsOf(seed.value);
      for (const b of dials) {
        const subject = b.dataset.subject as MakingSubject,
          w = MAKING_WORDS[subject],
          c = m[subject],
          words = c !== undefined ? w.choices[c] : undefined;
        b.textContent = `${w.icon} ${w.name.replace(/^Its /, "").replace(/^./, (c) => c.toUpperCase())}: ${words ? words[0] : "as it falls"}`;
        b.title = words ? `${w.name}: ${words[1]}` : `${w.name}: as the seed falls — tap to choose`;
        b.classList.toggle("on", !!words);
      }
    };
    makingRow.append(...dials);
    // A world never seen: whether life arises on the seed's world is told as it is typed, and
    // where it would not, Begin goes on to the nearest seed whose world it does.
    let asked = 0;
    const tell = async () => {
      const n = ++asked,
        s = seed.value.trim();
      lifeHead.hidden = lives.hidden = kind !== "alien";
      makingHead.hidden = makingRow.hidden = madeNote.hidden = kind !== "alien";
      if (kind !== "alien" || !s) {
        seedNote.textContent = madeNote.textContent = "";
        return;
      }
      seedNote.textContent = "…";
      try {
        const got = await (await host()).lifeOf(kind, s);
        if (n !== asked) return;
        seedNote.textContent = got.peopled
          ? "🌱 Life arises on this world, and in time a people."
          : `❄️ No people will rise here: ${got.words}.${life === "living" ? " Begin will take the nearest world where life arises." : ""}`;
        madeNote.textContent = got.world ? madeWorldWords(got.world) : "";
      } catch {
        if (n === asked) seedNote.textContent = madeNote.textContent = "";
      }
    };
    let typing = 0;
    seed.addEventListener("input", () => {
      showMakings();
      clearTimeout(typing);
      typing = window.setTimeout(() => void tell(), 350);
    });
    // (Another seed, its making kept.)
    roll.onclick = () => {
      const cut = seed.value.indexOf(" ~");
      seed.value = randomSeed() + (cut < 0 ? "" : seed.value.slice(cut));
      void tell();
    };
    for (const [id, icon, words, note] of KINDS) {
      const b = choice(icon, words, note, () => {
        kind = id;
        pick(kinds, id);
        void tell();
      });
      b.dataset.id = id;
      kinds.append(b);
    }
    for (const [id, icon, words, note] of LIFE) {
      const b = choice(icon, words, note, () => {
        life = id;
        pick(lives, id);
        void tell();
      });
      b.dataset.id = id;
      lives.append(b);
    }
    for (const [id, icon, words, note] of BEGINNINGS) {
      const b = choice(icon, words, note, () => {
        begin = id;
        pick(beginnings, id);
      });
      b.dataset.id = id;
      beginnings.append(b);
    }
    pick(kinds, kind);
    pick(lives, life);
    pick(beginnings, begin);
    showMakings();
    lifeHead.hidden = lives.hidden = true;
    makingHead.hidden = makingRow.hidden = madeNote.hidden = true;
    const begun = async () => {
      let s = seed.value.trim() || randomSeed();
      if (kind === "alien" && life === "living") {
        start.disabled = true;
        seedNote.textContent = "Finding a world where life arises…";
        try {
          const found = await livingSeed(await host(), kind, s, 40, (k) => {
            seedNote.textContent = `Finding a world where life arises… ${k} looked at`;
          });
          if (!found.found) {
            // (None near it so made: told, and not begun — a making lifted, or another seed.)
            seedNote.textContent = `❄️ No world near this seed knows life so made: ${found.passed}. Lift a making, or try another seed.`;
            start.disabled = false;
            return;
          }
          s = found.seed;
          seed.value = s;
        } catch {
          // (No host to ask: begun as typed.)
        }
        start.disabled = false;
      }
      const at = `?universe=${kind}&seed=${encodeURIComponent(s)}`;
      go(
        begin === "genesis"
          ? `${at}&genesis=1`
          : begin === "later"
            ? `${at}&year=300`
            : begin === "contact"
              ? `${at}&year=300&contact=1`
              : at,
      );
    };
    start.onclick = () => void begun();
    seed.onkeydown = (e) => {
      if (e.key === "Enter") void begun();
    };
    form.append(
      el("h2", undefined, "A new world"),
      el("h3", undefined, "What kind of world"),
      kinds,
      lifeHead,
      lives,
      makingHead,
      makingRow,
      el("h3", undefined, "Its seed"),
      seedRow,
      seedNote,
      madeNote,
      el("p", "muted", "The same seed makes the same world, every time: keep it to share it."),
      el("h3", undefined, "Where it begins"),
      beginnings,
      el("div", "title-actions"),
    );
    form.lastElementChild!.append(back(menu), start);
    body.replaceChildren(form);
    lead.hidden = true;
    seed.focus();
  };

  // The worlds kept, newest first, and a kept file opened.
  const kept = () => {
    const form = el("div", "title-form"),
      list = el("div", "choices"),
      said = el("p", "muted"),
      file = el("input");
    file.type = "file";
    file.accept = ".causalis,application/gzip";
    file.hidden = true;
    const open = el("button", "choice");
    open.append(
      el("span", "choice-icon", "📄"),
      el("span", "choice-words", "Open a kept file…"),
      el("small", undefined, "a world kept as a file (.causalis)"),
    );
    open.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      said.textContent = "opening…";
      try {
        const c = client ?? (await options.connect()).client,
          got = await c.importSave(new Uint8Array(await f.arrayBuffer())),
          name = `${got.universe}:${got.seed}`;
        await c.save(name);
        go(
          `?universe=${encodeURIComponent(got.universe)}&seed=${encodeURIComponent(got.seed)}&load=${encodeURIComponent(name)}`,
        );
      } catch (error) {
        said.textContent = `not opened: ${(error as Error).message}`;
      }
    };
    // Each kept world, and beside it its delete (asked twice: what will go, then gone).
    const row = (s: SaveMeta): HTMLElement => {
      const line = el("div", "kept-row"),
        del = el("button", "kept-delete", "🗑");
      del.title = "Delete this kept world";
      del.setAttribute("aria-label", `Delete ${worldWords(s)}`);
      del.onclick = () => {
        const ask = el("div", "kept-ask"),
          yes = el("button", "act kept-yes", "Delete"),
          no = el("button", "link", "Keep it");
        ask.append(
          el(
            "span",
            undefined,
            `Delete ${worldWords(s)}, year ${Math.floor(s.t / YEAR)}${s.name.endsWith(":auto") ? " (kept on its own)" : ""}, for good?`,
          ),
          yes,
          no,
        );
        no.onclick = () => line.replaceWith(row(s));
        yes.onclick = async () => {
          yes.disabled = true;
          try {
            await (await host()).deleteSave(s.name);
            saves = (saves ?? []).filter((x) => x.name !== s.name);
            kept();
            body
              .querySelector(".title-form")
              ?.prepend(
                el(
                  "p",
                  "muted kept-said",
                  `${worldWords(s)}, year ${Math.floor(s.t / YEAR)}, deleted.`,
                ),
              );
          } catch (error) {
            said.textContent = `not deleted: ${(error as Error).message}`;
            yes.disabled = false;
          }
        };
        line.replaceChildren(ask);
        yes.focus();
      };
      line.append(
        choice(
          s.universe === "alien" ? "🪐" : "🌍",
          worldWords(s),
          `year ${Math.floor(s.t / YEAR)} · kept ${ago(s.savedAt)}${s.name.endsWith(":auto") ? " (on its own)" : ""} · ${(s.bytes / 1e6).toFixed(1)} MB`,
          () => go(keptAddress(s)),
        ),
        del,
      );
      return line;
    };
    for (const s of saves ?? []) list.append(row(s));
    if (!saves?.length) list.append(el("p", "muted", "No world is kept in this browser yet."));
    list.append(open);
    form.append(el("h2", undefined, "Worlds kept"), list, file, said, back(menu));
    body.replaceChildren(form);
    lead.hidden = true;
  };

  const howList = () => {
    const ul = el("ul", "title-how");
    for (const line of HOW) ul.append(el("li", undefined, line));
    return ul;
  };
  const how = () => {
    const form = el("div", "title-form");
    form.append(el("h2", undefined, "How to play"), howList(), back(menu));
    body.replaceChildren(form);
    lead.hidden = true;
  };

  menu();
  // The worlds kept, asked of a host (a moment while it starts): Continue joins the menu.
  void options
    .connect()
    .then(async (c) => {
      client = c.client;
      const all = await c.client.saves();
      saves = [...all].sort((a, b) => b.savedAt - a.savedAt);
      // (Redrawn only on the menu itself: a form being filled in is left alone.)
      if (body.querySelector(".title-menu")) menu();
    })
    .catch(() => {
      // No storage (a private window): new worlds only.
    });
}

type V3 = [number, number, number];

const unit = (v: V3): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};

/** An icosphere: the icosahedron's faces each split in four `levels` times, on the unit sphere. */
function icosphere(levels: number): { verts: V3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: V3[] = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as V3[]
  ).map(unit);
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let l = 0; l < levels; l++) {
    const mid = new Map<number, number>(),
      m = (a: number, b: number) => {
        const key = Math.min(a, b) * 65_536 + Math.max(a, b);
        let i = mid.get(key);
        if (i === undefined) {
          const p = verts[a]!,
            q = verts[b]!;
          i = verts.push(unit([p[0] + q[0], p[1] + q[1], p[2] + q[2]])) - 1;
          mid.set(key, i);
        }
        return i;
      };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = m(a, b),
        bc = m(b, c),
        ca = m(c, a);
      return [
        [a, ab, ca],
        [b, bc, ab],
        [c, ca, bc],
        [ab, bc, ca],
      ] as [number, number, number][];
    });
  }
  return { verts, faces };
}

/** A height on the sphere: a few broad swells, a little ripple (above 0: land). */
function heightAt(p: V3, swells: readonly { c: V3; w: number; k: number }[]): number {
  let h = -0.42;
  for (const s of swells) {
    const d = (p[0] - s.c[0]) ** 2 + (p[1] - s.c[1]) ** 2 + (p[2] - s.c[2]) ** 2;
    h += s.w * Math.exp(-s.k * d);
  }
  return h + 0.06 * Math.sin(9 * p[0] + 2) * Math.cos(7 * p[2] - 1) + 0.04 * Math.sin(13 * p[1]);
}

/** A face's colour by its height and how near a pole it lies. */
function faceColor(h: number, y: number): V3 {
  if (Math.abs(y) > 0.93 - Math.max(0, h) * 0.12) return [236, 244, 255];
  if (h < -0.18) return [22, 64, 150];
  if (h < 0) return [34, 104, 190];
  if (h < 0.05) return [222, 204, 140];
  if (h < 0.22) return [86, 170, 74];
  if (h < 0.38) return [52, 128, 60];
  if (h < 0.5) return [128, 118, 96];
  return [232, 236, 244];
}

/** Turn a low-poly world on a canvas, with its clouds and the stars behind; returns its stop. */
function turnWorld(canvas: HTMLCanvasElement): () => void {
  const g = canvas.getContext("2d");
  if (!g) return () => {};
  const rand = Math.random,
    ground = icosphere(3),
    air = icosphere(3),
    swells = Array.from({ length: 9 }, () => ({
      c: unit([rand() * 2 - 1, rand() * 1.6 - 0.8, rand() * 2 - 1]),
      w: 0.35 + rand() * 0.45,
      k: 2.5 + rand() * 5,
    })),
    centre = (verts: V3[], f: readonly number[]): V3 =>
      unit([
        verts[f[0]!]![0] + verts[f[1]!]![0] + verts[f[2]!]![0],
        verts[f[0]!]![1] + verts[f[1]!]![1] + verts[f[2]!]![1],
        verts[f[0]!]![2] + verts[f[1]!]![2] + verts[f[2]!]![2],
      ]),
    faces = ground.faces.map((f) => {
      const c = centre(ground.verts, f);
      return { f, c, color: faceColor(heightAt(c, swells), c[1]) };
    }),
    // (Clouds in small drifts: many narrow swells, each a patch.)
    puffs = Array.from({ length: 16 }, () => ({
      c: unit([rand() * 2 - 1, rand() * 1.8 - 0.9, rand() * 2 - 1]),
      w: 1,
      k: 14 + rand() * 18,
    })),
    clouds = air.faces
      .map((f) => ({ f, c: centre(air.verts, f) }))
      .filter(({ c }) => heightAt(c, puffs) > 0.32),
    stars = Array.from({ length: 240 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.4 + rand() * 1.2,
      p: rand() * 6.3,
    })),
    still = matchMedia("(prefers-reduced-motion: reduce)").matches,
    light = unit([-0.55, 0.45, 0.7]),
    tilt = 0.4;
  let yaw = rand() * 6.3,
    frame = 0,
    last = performance.now(),
    running = true;
  const draw = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!still) yaw += dt * 0.07;
    const dpr = Math.min(2, devicePixelRatio || 1),
      w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    for (const s of stars) {
      g.globalAlpha = 0.45 + 0.4 * Math.sin(now / 900 + s.p);
      g.fillStyle = "#dfe8ff";
      g.fillRect(s.x * w, s.y * h, s.r, s.r);
    }
    g.globalAlpha = 1;
    // Beside the menu on a wide screen; above it on a narrow one.
    const wide = w > 900,
      cx = wide ? w * 0.68 : w / 2,
      cy = wide ? h * 0.5 : Math.min(h * 0.24, w * 0.42),
      r = wide ? Math.min(h * 0.34, w * 0.24) : Math.min(w * 0.34, h * 0.19);
    const cy1 = Math.cos(yaw),
      sy1 = Math.sin(yaw),
      ct = Math.cos(tilt),
      st = Math.sin(tilt),
      turn = (v: V3, k = 1): V3 => {
        const x = v[0] * cy1 + v[2] * sy1,
          z = -v[0] * sy1 + v[2] * cy1,
          y = v[1];
        return [x * k, (y * ct - z * st) * k, (y * st + z * ct) * k];
      };
    // The glow of its air, behind.
    const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
    halo.addColorStop(0, "rgba(111, 200, 255, 0.45)");
    halo.addColorStop(1, "rgba(111, 200, 255, 0)");
    g.fillStyle = halo;
    g.fillRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8);
    const paint = (
      verts: V3[],
      list: readonly { f: readonly number[]; c: V3; color?: V3 }[],
      k: number,
      alpha: number,
      // (How lit its dark side is: clouds are lit through.)
      floor = 0.28,
    ) => {
      const seen = list
        .map((x) => ({ x, n: turn(x.c) }))
        .filter(({ n }) => n[2] > 0)
        .sort((a, b) => a.n[2] - b.n[2]);
      for (const { x, n } of seen) {
        const lit =
            floor + (1 - floor) * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]),
          col = x.color ?? [255, 255, 255],
          fill = `rgba(${Math.round(col[0] * lit)}, ${Math.round(col[1] * lit)}, ${Math.round(col[2] * lit)}, ${alpha})`;
        g.beginPath();
        x.f.forEach((i, j) => {
          const p = turn(verts[i]!, k);
          if (j) g.lineTo(cx + p[0] * r, cy - p[1] * r);
          else g.moveTo(cx + p[0] * r, cy - p[1] * r);
        });
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        if (alpha === 1) {
          g.strokeStyle = fill;
          g.lineWidth = 0.6;
          g.stroke();
        }
      }
    };
    paint(ground.verts, faces, 1, 1);
    paint(air.verts, clouds, 1.025, 0.42, 0.7);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => {
    running = false;
    cancelAnimationFrame(frame);
  };
}
