// How one died, and what could take them now (asked 2026-11-16: "add like the probable cause of death or exact cause of death
// especially if im tracking them", and then: "dont say its probable cause of death like reconstruct the causalistic path with all
// the probabilities and however u determine death"). Each death told is the very rule that decided it, with its numbers:
//   1. the draw: the chance they faced and how the rule drew against it (a year's or a month's draw, a battle's fallen share,
//      a strike's share of the dead);
//   2. the parts of that chance, each with what it laid on it, and which part decided it: the part but for which the draw would
//      have passed them (each rule draws once against the whole: none picks a part);
//   3. the path back from the event that decided it, through the causes history keeps (causal spine);
//   4. what changed it: the god's acts, a parent's care, what they are like, the healers' reach, what the land eats.
// Nothing is guessed. Where a draw is counter-based (a ruler's, one of a court's, a line holder's, a strike's, a battle's order) it
// is drawn again from the world's own seed at the moment it was drawn: nothing is kept for it. One under the hand died by a month's
// draw whose parts change month by month: those are kept at the draw, beside the world (sim/hand/deaths.ts). Pure reads.
import {
  YEAR,
  finish,
  hashString,
  mix,
  parseRef,
  streams,
  yearOfMoment,
  type HistoryEvent,
  type Ref,
  type World,
} from "../kernel/index.ts";
import { bandOf, deathWithin, riskUnder, type LifeHistory } from "../rules/index.ts";
import {
  ACTS_FOR,
  BLESS_BY,
  CURSE_BY,
  KILLING,
  courtOf,
  deathNotesOf,
  handHazardNow,
  handOf,
  personActProblem,
  personActsOf,
  personNow,
  politiesOf,
  populationContext,
  traitWeight,
  type DeathPart,
  type PersonAct,
  type PersonActKind,
  type PersonKind,
  type Polity,
} from "../sim/index.ts";
import { spine } from "../causal/index.ts";
import {
  parseLevyManRef,
  parseTownsfolkRef,
  type Block,
  type Item,
  type Line,
  type PageModel,
} from "../bridge/index.ts";
import { courtFigure } from "./court.ts";
import { bedDeath } from "./kin.ts";
import { townRoster, type Holder, type Roster } from "./roster.ts";
import { resolveLevyMan } from "./roll.ts";
import { battleOf, battleWords } from "./burials.ts";
import { claimOf, item, link } from "./inspect/words.ts";

// —— Words ————————————————————————————————————————————————————————————————————————————————

/** A chance as a share: "11.2%", "0.42%". */
export function pct(x: number): string {
  const p = 100 * x;
  if (p === 0) return "0%";
  return p >= 99.95
    ? "100%"
    : p >= 10
      ? `${p.toFixed(1)}%`
      : p >= 0.1
        ? `${p.toFixed(2)}%`
        : `${p.toFixed(3)}%`;
}
/** A chance as one in so many: "1 in 9". */
const oneIn = (x: number) => (x <= 0 ? "none" : x >= 1 ? "certain" : `1 in ${Math.round(1 / x)}`);
/** A draw, to four places. */
const drawn = (x: number) => x.toFixed(4);
/** A factor laid on a chance: "×1.62". */
const times = (x: number) => `×${x >= 10 ? x.toFixed(0) : x.toFixed(2)}`;

/** Those of an age band, in words: "those 60 to 69", "those 80 and older". */
function bandWords(life: LifeHistory, band: number): string {
  const lo = life.bands[band] ?? 0,
    hi = life.bands[band + 1];
  return hi === undefined ? `those ${lo} and older` : `those ${lo} to ${hi - 1}`;
}

const streamOf = (tag: string) => {
  const s = streams().find((x) => x.tag === tag);
  if (!s) throw new Error(`no stream ${tag}`);
  return s;
};

/** A draw the roster and the family make by a key (host/roster.ts, host/kin.ts `u`). */
const keyed = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

// —— An account ———————————————————————————————————————————————————————————————————————————

/** One part of a chance: what it is, what it laid (a factor, or a chance of its own), and the event it stands on. */
type Part = {
  readonly name: string;
  readonly words: string;
  readonly source: string | null;
};

/** How one died (or what could take them now), as the rule that decides it reads. */
export type Account = {
  /** One line: "died of their years at 61", "fell at the battle at Pounholt". */
  readonly short: string;
  readonly year: number | null;
  readonly age: number | null;
  /** The event that tells it, for a Go to (null: none history keeps). */
  readonly event: string | null;
  /** A code: what kind of death. */
  readonly cause: Cause;
  /** The rule, in a sentence; the chance and the draw, in a sentence. */
  readonly rule: string;
  readonly draw: string | null;
  readonly parts: readonly Part[];
  readonly decided: readonly Line[];
  /** The path back: the event to walk from (its spine), or what stands there instead. */
  readonly from: string | null;
  readonly noPath: string | null;
  readonly changed: readonly Line[];
};

export type Cause =
  "age" | "month" | "battle" | "strike" | "seized" | "struck" | "blow" | "removed" | "unknown";

/** The path back from an event: its strongest cause at each step, two to four steps. */
function pathItems(world: World, from: string | null): Item[] {
  if (!from) return [];
  const steps = spine(world, from as Ref, 5);
  return steps.map((x, i) =>
    item(
      [i === 0 ? "" : "← ", link(x.claim, x.ref)],
      x.ref,
      x.t === null ? undefined : yearOfMoment(x.t),
    ),
  );
}

/** The page's section for an account. */
export function accountBlocks(world: World, title: string, a: Account): Block[] {
  const head: Line =
      a.year === null
        ? [a.short]
        : [
            `${title === "At risk now" ? "This year" : `Died in ${a.year}`}${a.age !== null ? `, aged ${a.age}` : ""}: `,
            a.event ? link(a.short, a.event) : a.short,
          ],
    lines: Line[] = [head, [a.rule], ...(a.draw ? [[a.draw]] : [])],
    path = pathItems(world, a.from);
  return [
    { type: "text", title, lines },
    {
      type: "list",
      title:
        title === "At risk now" ? "The parts of this year's chance" : "The parts of that chance",
      items: a.parts.map((p) =>
        item([`${p.name}: `, p.source ? link(p.words, p.source) : p.words], p.source),
      ),
    },
    ...(a.decided.length
      ? [
          {
            type: "text" as const,
            title: title === "At risk now" ? "The greatest part" : "Which part decided it",
            lines: [...a.decided],
          },
        ]
      : []),
    path.length
      ? { type: "list" as const, title: "The path back", items: path }
      : {
          type: "text" as const,
          title: "The path back",
          lines: [[a.noPath ?? "History keeps no cause of it."]],
        },
    ...(a.changed.length
      ? [{ type: "list" as const, title: "What changed it", items: a.changed.map((l) => item(l)) }]
      : []),
  ];
}

// —— The god's acts on them ——————————————————————————————————————————————————————————————————

/** The god's blessings and curses that held on one in a year, by their ref and name (and which of them, where a seat's ref). */
function godActsAt(
  world: World,
  ref: string,
  name: string | null,
  of: string | null,
  year: number,
): PersonAct[] {
  const store = personActsOf(world);
  if (!store) return [];
  return store
    .ever(ref)
    .filter(
      (a) =>
        (a.kind === "bless" || a.kind === "curse") &&
        a.from <= year &&
        year < a.until &&
        (a.used === undefined ||
          a.used === a.event ||
          yearOfMoment(world.events.get(a.used as Ref)?.t ?? Infinity) > year) &&
        (of === null || a.of === null || a.of === of) &&
        (name === null || a.name === name),
    );
}

const godBy = (acts: readonly PersonAct[]) =>
  acts.reduce((x, a) => x * (a.kind === "bless" ? BLESS_BY : CURSE_BY), 1);

const godLines = (acts: readonly PersonAct[], year: number): Line[] =>
  acts.map((a) => [
    link(a.kind === "bless" ? "The god's blessing" : "The god's curse", a.event),
    ` laid ${times(a.kind === "bless" ? BLESS_BY : CURSE_BY)} on the chance, from ${a.from} to ${a.until}${a.until > year ? ` (${a.until - year} years left)` : ""}.`,
  ]);

/** Of a draw against chance = base × the parts, which part decided it: the part but for which the draw would have passed them. */
function decidedBy(
  base: number,
  draw: number,
  chanceOf: (without: number | null) => number,
  names: readonly string[],
): Line[] {
  const out: Line[] = [],
    alone = chanceOf(-1);
  if (draw < alone)
    out.push([
      `Their age alone would have taken them: the draw (${drawn(draw)}) fell inside the life table's own ${pct(alone)}${base !== alone ? "" : ""}.`,
    ]);
  for (let i = 0; i < names.length; i++) {
    const without = chanceOf(i);
    if (draw >= without)
      out.push([
        `But for ${names[i]}, the draw (${drawn(draw)}) would have passed them: without it the chance was ${pct(without)}.`,
      ]);
  }
  if (!out.length)
    out.push([
      `No one part decided it alone: the draw (${drawn(draw)}) fell under the whole, past their age's own ${pct(alone)}, and every part taken away still leaves it inside.`,
    ]);
  return out;
}

// —— A ruler ——————————————————————————————————————————————————————————————————————————————

/** The events by which a seat leaves the one who holds it. */
const SEAT_ENDS: ReadonlySet<string> = new Set([
  "polity.succession",
  "strife.coup",
  "strife.throne",
  "strife.revolution",
  "court.seized",
]);

/** How a ruler's reign ended, by their name (null: it goes on, or history no longer holds it). */
export function rulerEnd(world: World, realm: Ref, name: string, since = 0): HistoryEvent | null {
  const all = world.events.all();
  for (let i = all.length - 1; i >= 0; i--) {
    const e = all[i]!;
    if (e.t < since) break;
    if (!SEAT_ENDS.has(e.type) || !e.subjects.includes(realm)) continue;
    const d = e.data as { old?: string; ruler?: string } | null;
    if (d?.old === name || d?.ruler === name) return e;
  }
  return null;
}

/** The land a realm's seat stood in when an event at its seat was told (null: not found). */
function cellOfPlace(world: World, place: Ref | null): number | null {
  if (!place) return null;
  const p = populationContext(world)
    .provinces.all()
    .find((x) => x.ref === place);
  return p ? p.cell : null;
}

/** How a ruler's reign ended, told as how they died (or that they did not). */
export function rulerDeath(world: World, e: HistoryEvent): Account | null {
  const life = populationContext(world).life,
    year = yearOfMoment(e.t),
    realm = e.subjects[0]!,
    d = (e.data ?? {}) as {
      old?: string;
      age?: number;
      dead?: boolean;
      who?: string;
      ruler?: string;
    },
    name = d.old ?? d.ruler ?? null,
    struck = e.causes.map((c) => world.events.get(c.ref)).find((x) => x?.type === "person.struck");
  if (e.type === "polity.succession") {
    const age = d.age ?? null,
      seat = cellOfPlace(world, e.place);
    if (struck)
      return {
        short: "struck down by the god",
        year,
        age,
        event: struck.id,
        cause: "struck",
        rule: "A ruler's death is drawn once a year, at the year's turn. The god had marked them: at that turn they died, whatever the draw.",
        draw: null,
        parts: [
          {
            name: "the god's hand",
            words: "struck down at their next reckoning",
            source: struck.id,
          },
        ],
        decided: [["The god's act alone: no chance was drawn against."]],
        from: struck.id,
        noPath: null,
        changed: [],
      };
    if (age === null || seat === null) return null;
    const band = bandOf(age, life),
      base = life.mortality[band]!,
      acts = name ? godActsAt(world, `rule:${realm}`, name, null, year) : [],
      by = godBy(acts),
      chance = base * by,
      draw = world.rng.real(streamOf("polity.rule"), seat, e.t, 20);
    // (Drawn again from the world's seed at the very moment: it fell under, or the rule is not what took them.)
    if (!(draw < chance)) return null;
    return {
      short: `died of their years, at ${age}`,
      year,
      age,
      event: e.id,
      cause: "age",
      rule: "A ruler's death is drawn once a year, at the year's turn, against their kind's life table alone: no sickness, hunger or war reaches a ruler's own draw.",
      draw: `That year they faced a ${oneIn(chance)} chance of dying (${pct(chance)}). The year's draw was ${drawn(draw)}: inside it, so they died.`,
      parts: [
        {
          name: `Age ${age}`,
          words: `the life table of their kind gives ${bandWords(life, band)} ${pct(base)} a year`,
          source: null,
        },
        ...acts.map((a) => ({
          name: a.kind === "bless" ? "The god's blessing" : "The god's curse",
          words: `${times(a.kind === "bless" ? BLESS_BY : CURSE_BY)}, from ${a.from} to ${a.until}`,
          source: a.event,
        })),
      ],
      decided:
        by === 1
          ? [
              [
                `The whole of it was their age: the draw (${drawn(draw)}) fell inside the life table's ${pct(base)}.`,
              ],
            ]
          : decidedBy(base, draw, (i) => (i === -1 ? base : i === 0 ? base : chance), [
              "the god's curse",
            ]).slice(0, by > 1 ? 2 : 1),
      from: null,
      noPath: `Age: the life table of their kind at ${age}. It is their body's, and no event of history raised it.`,
      changed: godLines(acts, year),
    };
  }
  if (e.type === "court.seized") {
    const draw = world.rng.real(streamOf("court.plot"), parseRef(realm).b >>> 0, e.t, 6);
    if (!d.dead) {
      const spared = world.events
        .all()
        .find(
          (x) =>
            x.type === "person.spared" && (x.data as { seized?: string } | null)?.seized === e.id,
        );
      return {
        short: "lost the seat to a plot, and lived",
        year,
        age: null,
        event: e.id,
        cause: "removed",
        rule: "When a plot carries the seat, an even chance is drawn whether the ruler lives the night or is put out of the palace door.",
        draw: spared
          ? `The draw was ${drawn(draw)}, inside the even chance; the god's protection spared them.`
          : `The draw was ${drawn(draw)}: past the even chance (0.5000), so they lived.`,
        parts: [{ name: "The seizing", words: "an even chance (50%)", source: e.id }],
        decided: spared ? [[link("The god's protection", spared.id), " spared them."]] : [],
        from: e.id,
        noPath: null,
        changed: [],
      };
    }
    return {
      short: "did not live the night their seat was seized",
      year,
      age: null,
      event: e.id,
      cause: "seized",
      rule: "When a plot carries the seat, an even chance is drawn whether the ruler lives the night. Whether a plot carries is drawn when it begins, by its odds (its decision's factors, on the path back).",
      draw: `The draw was ${drawn(draw)}: inside the even chance (0.5000), so they did not live the night.`,
      parts: [
        {
          name: "The plot carrying the seat",
          words: "drawn when it began, by its odds",
          source: e.id,
        },
        { name: "The night after", words: "an even chance (50%)", source: e.id },
      ],
      decided: [["The plot, and the night's even chance: both had to fall against them."]],
      from: e.id,
      noPath: null,
      changed: [],
    };
  }
  // (A coup, a throne taken, a revolution: the seat taken, no death drawn.)
  return {
    short: "lost the seat",
    year,
    age: null,
    event: e.id,
    cause: "removed",
    rule: "A seat taken by force takes the seat alone: history draws no death for the one put out of it.",
    draw: null,
    parts: [{ name: "How the seat was taken", words: claimOf(world, e.id), source: e.id }],
    decided: [],
    from: e.id,
    noPath: null,
    changed: [],
  };
}

/** A ruler living: their chance of death this year, its parts, and what stands behind the greatest. */
function rulerRisk(world: World, r: Polity): Account {
  const life = populationContext(world).life,
    year = yearOfMoment(world.now),
    age = year - r.ruler.born,
    band = bandOf(age, life),
    base = life.mortality[band]!,
    acts = godActsAt(world, `rule:${r.ref}`, null, r.ruler.event, year),
    by = godBy(acts),
    aged = Math.min(1, base * by),
    c = courtOf(world)?.of(r.ref),
    plot = c?.plot && !c.plot.army ? c.plot : null,
    guarded = personActsOf(world)
      ?.on(`rule:${r.ref}`, r.ruler.event, year)
      .find((a) => a.kind === "protect"),
    plotted = plot && !guarded ? plot.odds * 0.5 : 0,
    total = 1 - (1 - aged) * (1 - plotted);
  return {
    short: "",
    year,
    age,
    event: null,
    cause: "age",
    rule: "A ruler's death is drawn once a year, at the year's turn, against their kind's life table alone. A plot against their seat, if it carries, draws an even chance whether they live the night.",
    draw: `This year they face a ${oneIn(total)} chance of dying (${pct(total)}).`,
    parts: [
      {
        name: `Age ${age}`,
        words: `${pct(aged)}: the life table gives ${bandWords(life, band)} ${pct(base)} a year${by !== 1 ? `, the god's hand ${times(by)}` : ""}`,
        source: null,
      },
      ...(plot
        ? [
            {
              name: "A plot against their seat",
              words: guarded
                ? `the god's protection holds: none`
                : `${pct(plotted)}: its odds ${pct(plot.odds)}, then the night's even chance`,
              source: plot.event as string,
            },
          ]
        : []),
    ],
    decided:
      plot && plotted > aged
        ? [["The plot, more than their years."]]
        : [[`Their years: ${pct(aged)}.`]],
    from: plot && plotted > aged ? plot.event : null,
    noPath: `Age: the life table of their kind at ${age}, their body's; no event of history raises it.`,
    changed: [
      ...godLines(acts, year),
      ...(guarded
        ? [[link("The god's protection", guarded.event), ` holds until ${guarded.until}.`] as Line]
        : []),
    ],
  };
}

// —— One of a court —————————————————————————————————————————————————————————————————————————

function courtDeath(world: World, ref: string): Account | null {
  const at = courtFigure(world, ref),
    g = at?.gone;
  if (!at || !g) return null;
  const life = populationContext(world).life,
    year = g.year,
    age = year - g.born;
  if (g.how !== "died")
    return {
      short:
        g.how === "found"
          ? "their move was found: gone from the court"
          : g.how === "fled"
            ? "fled the court and raised the far lands"
            : g.how === "seated"
              ? "took the seat"
              : "stood down",
      year,
      age,
      event: g.event,
      cause: "removed",
      rule: "They left the court by another road than death: history draws no death for them after.",
      draw: null,
      parts: [],
      decided: [],
      from: g.event,
      noPath: "History keeps no cause of it.",
      changed: [],
    };
  const struck = g.event ? world.events.get(g.event) : undefined;
  if (struck?.type === "person.struck")
    return {
      short: "struck down by the god",
      year,
      age,
      event: struck.id,
      cause: "struck",
      rule: "Those at court are drawn against for death once a year, at the year's turn. The god had marked them: at that turn they died, whatever the draw.",
      draw: null,
      parts: [
        { name: "the god's hand", words: "struck down at their next reckoning", source: struck.id },
      ],
      decided: [["The god's act alone."]],
      from: struck.id,
      noPath: null,
      changed: [],
    };
  const band = bandOf(age, life),
    base = life.mortality[band]!,
    acts = godActsAt(world, ref, null, null, year),
    by = godBy(acts),
    chance = base * by,
    // (The court's year is drawn at the moment that closes it, which is of that year.)
    draw = world.rng.real(streamOf("court.death"), at.gone!.id, (year + 1) * YEAR, 0);
  if (!(draw < chance)) return null;
  const heir = world.events
    .all()
    .find(
      (e) =>
        e.type === "court.heirdied" &&
        yearOfMoment(e.t) === year &&
        (e.data as { fig?: number } | null)?.fig === g.id,
    );
  return {
    short: `died of their years, at ${age}`,
    year,
    age,
    event: heir?.id ?? null,
    cause: "age",
    rule: "Those at court are drawn against for death once a year, at the year's turn, against their kind's life table alone.",
    draw: `That year they faced a ${oneIn(chance)} chance of dying (${pct(chance)}). The year's draw was ${drawn(draw)}: inside it, so they died.`,
    parts: [
      {
        name: `Age ${age}`,
        words: `the life table of their kind gives ${bandWords(life, band)} ${pct(base)} a year`,
        source: null,
      },
      ...acts.map((a) => ({
        name: a.kind === "bless" ? "The god's blessing" : "The god's curse",
        words: `${times(a.kind === "bless" ? BLESS_BY : CURSE_BY)}, from ${a.from} to ${a.until}`,
        source: a.event,
      })),
    ],
    decided:
      by > 1 && draw >= base
        ? [
            [
              `But for the god's curse the draw (${drawn(draw)}) would have passed them: without it the chance was ${pct(base)}.`,
            ],
          ]
        : [
            [
              `The whole of it was their age: the draw (${drawn(draw)}) fell inside the life table's ${pct(base)}.`,
            ],
          ],
    from: heir?.id ?? null,
    noPath: `Age: the life table of their kind at ${age}. It is their body's, and no event of history raised it.`,
    changed: godLines(acts, year),
  };
}

function courtRisk(world: World, ref: string): Account | null {
  const at = courtFigure(world, ref),
    f = at?.f;
  if (!at || !f) return null;
  const life = populationContext(world).life,
    year = yearOfMoment(world.now),
    age = year - f.born,
    band = bandOf(age, life),
    base = life.mortality[band]!,
    acts = godActsAt(world, ref, null, null, year),
    by = godBy(acts),
    chance = Math.min(1, base * by);
  return {
    short: "",
    year,
    age,
    event: null,
    cause: "age",
    rule: "Those at court are drawn against for death once a year, at the year's turn, against their kind's life table alone.",
    draw: `This year they face a ${oneIn(chance)} chance of dying (${pct(chance)}).`,
    parts: [
      {
        name: `Age ${age}`,
        words: `the life table gives ${bandWords(life, band)} ${pct(base)} a year${by !== 1 ? `, the god's hand ${times(by)}` : ""}`,
        source: null,
      },
    ],
    decided: [],
    from: null,
    noPath: `Age: the life table of their kind at ${age}, their body's; no event of history raises it.`,
    changed: godLines(acts, year),
  };
}

// —— One of a town's many ———————————————————————————————————————————————————————————————————

function holderAt(world: World, ref: string): { roster: Roster; h: Holder; town: string } | null {
  const at = parseTownsfolkRef(ref);
  if (!at || at.n === null) return null;
  const roster = townRoster(world, at.town),
    h = roster.holderOf(at.line, at.n);
  return h ? { roster, h, town: at.town } : null;
}

const STRIKE_WORDS: Readonly<Record<string, string>> = {
  fire: "fire",
  quake: "quake",
  meteor: "fire from the sky",
  raid: "raid",
};

function holderDeath(world: World, ref: string): Account | null {
  const x = holderAt(world, ref);
  if (!x) return null;
  const { roster, h, town } = x,
    ctx = populationContext(world),
    life = ctx.life,
    now = yearOfMoment(world.now),
    fell = h.fates.find((f) => f.fate === "fell");
  if (fell) {
    const b = roster.battle(fell.event),
      [sent, dead] = b?.tally ?? [0, 0],
      lines = b ? b.men.length : 0,
      fallen = b ? roster.fallen(b) : 0,
      order = b ? roster.fell(b, 256).findIndex((y) => y.ref === h.ref) : -1;
    return {
      short: `fell at ${battleWords(world, fell.land)}`,
      year: fell.year,
      age: fell.year - h.born,
      event: fell.event,
      cause: "battle",
      rule: "A town's men are levied by twelves, one line for every twelve it sent. Its fallen are the first of the levy by the battle's keyed order, one line for every twelve it lost.",
      draw: b
        ? `Of the ${sent} men their town sent, ${dead} fell (${pct(dead / Math.max(1, sent))}): ${fallen} of its ${lines} lines in the levy.${order >= 0 ? ` Theirs stood ${order + 1}${["st", "nd", "rd"][order] ?? "th"} in the battle's order, among the ${fallen} to fall.` : ""}`
        : null,
      parts: [
        { name: "The battle", words: claimOf(world, fell.event), source: fell.event },
        ...(b
          ? [
              {
                name: "Their town's fallen share",
                words: `${pct(dead / Math.max(1, sent))} of the men it sent`,
                source: null,
              },
            ]
          : []),
      ],
      decided: [
        ["The battle's losses alone: who fell was its keyed order, not their age or health."],
      ],
      from: fell.event,
      noPath: null,
      changed: [],
    };
  }
  const st = h.struck.find((s) => s.fate === "died");
  if (st) {
    const s = roster.strikes.find((y) => y.event === st.event),
      population = Math.max(1, ctx.settlements.get(town as Ref)?.population ?? 1),
      p = s ? Math.min(1, s.dead / population) : null,
      v = keyed(finish(mix(hashString(st.event), h.line), 3), 1);
    return {
      short: `died in the ${STRIKE_WORDS[st.kind] ?? st.kind} of ${st.year}`,
      year: st.year,
      age: st.year - h.born,
      event: st.event,
      cause: "strike",
      rule: "A fire, a quake or a fire from the sky kills each of a town's lines at the town's share of its dead: one keyed draw for each line.",
      draw:
        p !== null
          ? `The ${STRIKE_WORDS[st.kind] ?? st.kind} killed ${s!.dead} of the town's ${population} (${pct(p)}). Their line's draw was ${drawn(v)}: inside it, so they died.`
          : null,
      parts: [
        {
          name: `The ${STRIKE_WORDS[st.kind] ?? st.kind}`,
          words: claimOf(world, st.event),
          source: st.event,
        },
      ],
      decided: [["The strike alone."]],
      from: st.event,
      noPath: null,
      changed: [],
    };
  }
  // (Past their term: the life table, by a keyed draw a year: host/kin.ts.)
  if (h.end > now) return null;
  const bed = bedDeath(life, h.key ^ 0x5eed, h.born, h.end, now);
  if (!bed) return null;
  return {
    short: bed.last
      ? `died of their years, at ${bed.age}, the oldest of their kind live`
      : `died of their years, at ${bed.age}`,
    year: bed.year,
    age: bed.age,
    event: null,
    cause: "age",
    rule: `History keeps their line while they hold it, to ${h.end - 1}; after it, their death is given by their kind's life table, one draw a year keyed by who they are (given by the rule, not kept by history).`,
    draw: bed.last
      ? `None of their kind outlives their oldest band thrice over: at ${bed.age} their years ended.`
      : `In ${bed.year}, at ${bed.age}, they faced a ${oneIn(bed.chance)} chance (${pct(bed.chance)}). That year's draw was ${drawn(bed.draw)}: inside it.${bed.passed ? ` The ${bed.passed} years' draws before it passed them.` : ""}`,
    parts: [
      {
        name: `Age ${bed.age}`,
        words: `the life table gives ${bandWords(life, bandOf(bed.age, life))} ${pct(bed.chance)} a year`,
        source: null,
      },
    ],
    decided: [["The whole of it was their age."]],
    from: null,
    noPath: `Age: the life table of their kind at ${bed.age}, their body's.`,
    changed: [],
  };
}

function holderRisk(world: World, ref: string): Account | null {
  const x = holderAt(world, ref);
  if (!x) return null;
  const { roster, h } = x,
    life = populationContext(world).life,
    year = yearOfMoment(world.now),
    age = year - h.born;
  if (h.died !== null) return null;
  if (h.end <= year) {
    if (bedDeath(life, h.key ^ 0x5eed, h.born, h.end, year - 1)) return null;
    const band = bandOf(age, life),
      chance = life.mortality[band]!;
    return {
      short: "",
      year,
      age,
      event: null,
      cause: "age",
      rule: "Past their term, their death is given by their kind's life table, one keyed draw a year.",
      draw: `This year they face a ${oneIn(chance)} chance of dying (${pct(chance)}).`,
      parts: [
        {
          name: `Age ${age}`,
          words: `the life table gives ${bandWords(life, band)} ${pct(chance)} a year`,
          source: null,
        },
      ],
      decided: [],
      from: null,
      noPath: `Age: the life table of their kind at ${age}.`,
      changed: [],
    };
  }
  // While they hold their line: only a battle their town sends men to, or a strike on it.
  const last = [...roster.battles].reverse().find((b) => b.tally[0] > 0),
    share = last ? last.tally[1] / Math.max(1, last.tally[0]) : 0;
  return {
    short: "",
    year,
    age,
    event: null,
    cause: "battle",
    rule: "While they hold their line, history takes them only by a battle their town sends men to, or a fire, quake or fire from the sky on it: their years do not.",
    draw: last
      ? `In its last battle (${last.year}) their town lost ${last.tally[1]} of the ${last.tally[0]} men it sent (${pct(share)}): the share a man it sends to the next would face, if it went as that one did.`
      : "Their town has sent no one to battle in the years the roster holds.",
    parts: last
      ? [
          {
            name: "Their town's last battle",
            words: `${last.tally[1]} of ${last.tally[0]} fell`,
            source: last.event,
          },
        ]
      : [],
    decided: [],
    from: last?.event ?? null,
    noPath: "No battle and no strike stand over them now.",
    changed: [],
  };
}

// —— One of a battle's levy ——————————————————————————————————————————————————————————————————

function levyDeath(world: World, ref: string): Account | null {
  const m = resolveLevyMan(world, ref);
  if (!m || m.fate !== "fell") return null;
  const parsed = parseLevyManRef(ref),
    fought = parsed && battleOf(world, parsed.event),
    b = fought?.b,
    side = m.side,
    brought = b?.fielded?.[side] ?? 0,
    lost = b?.fallen[side] ?? 0;
  return {
    short: `fell at ${battleWords(world, m.land)}`,
    year: m.year,
    age: m.age,
    event: m.event,
    cause: "battle",
    rule: "A battle's roll names its men by their places and gives each his fate by its keyed order: the first fall, by the share of his side that fell.",
    draw:
      brought > 0 ? `His side brought ${brought} and lost ${lost} (${pct(lost / brought)}).` : null,
    parts: [{ name: "The battle", words: claimOf(world, m.event), source: m.event }],
    decided: [["The battle's losses alone."]],
    from: m.event,
    noPath: null,
    changed: [],
  };
}

// —— One under the hand ———————————————————————————————————————————————————————————————————

/** The parts of a month's chance, as the page says them, with the counterfactual of each. */
function monthParts(
  base: number,
  months: number,
  parts: readonly DeathPart[],
): { parts: Part[]; chanceOf: (without: number | null) => number; names: string[] } {
  const hazard = parts.filter((p) => !p[0].endsWith("*")),
    after = parts.filter((p) => p[0].endsWith("*")),
    all = (skip: number | null) => {
      const m = hazard.reduce((x, p, i) => (i === skip ? x : x * p[1]), 1),
        k = after.reduce((x, p, i) => (i + hazard.length === skip ? x : x * p[1]), 1);
      return Math.min(1, deathWithin(riskUnder(base, m), months) * k);
    },
    // (A part that raised the chance: those a "but for" is asked of.)
    raised = parts
      .map((p, i) => ({
        p,
        i: p[0].endsWith("*") ? hazard.length + after.indexOf(p) : hazard.indexOf(p),
      }))
      .filter((x) => x.p[1] > 1.0005),
    shown: Part[] = [
      {
        name: "Their age",
        words: `${pct(deathWithin(base, months))} over ${months === 1 ? "the month" : `the ${months} months`} (${pct(base)} a year)`,
        source: null,
      },
      ...parts
        .filter((p) => Math.abs(p[1] - 1) > 0.0005)
        .map((p) => ({
          name: p[0].replace(/\*$/, ""),
          words: `${times(p[1])}${p[1] > 1 ? ", raising it" : ", lowering it"}`,
          source: p[2],
        })),
    ];
  return {
    parts: shown,
    chanceOf: (without) =>
      without === -1
        ? deathWithin(base, months)
        : all(without === null ? null : raised[without]!.i),
    names: raised.map((x) => x.p[0].replace(/\*$/, "")),
  };
}

/** How one under the hand died, from what was kept at the draw. */
export function agentDeath(world: World, village: string, id: number): Account | null {
  const n = deathNotesOf(world)?.of(village, id);
  if (!n) return null;
  if (n.how === "blow")
    return {
      short: "struck down by a blow",
      year: n.year,
      age: n.age,
      event: n.event ?? null,
      cause: "blow",
      rule: "In a possessed body's small world, a blow that strikes one down kills them or wounds them where it lands, by the small world's own keyed draws.",
      draw: null,
      parts: [
        {
          name: "The blow",
          words: n.event ? claimOf(world, n.event) : "a blow",
          source: n.event ?? null,
        },
      ],
      decided: [["The blow alone."]],
      from: n.event ?? null,
      noPath: null,
      changed: [],
    };
  if (n.how === "struck")
    return {
      short: "struck down by the god",
      year: n.year,
      age: n.age,
      event: n.event ?? null,
      cause: "struck",
      rule: "Under the hand a month's death draw is reckoned for each of its people. The god had marked them: at the month's end they died, whatever the draw.",
      draw:
        n.chance !== undefined
          ? `Their chance that month was ${pct(n.chance)}; the draw was ${drawn(n.draw ?? 0)}.`
          : null,
      parts: [
        {
          name: "the god's hand",
          words: "struck down at their next reckoning",
          source: n.event ?? null,
        },
      ],
      decided: [["The god's act alone."]],
      from: n.event ?? null,
      noPath: null,
      changed: [],
    };
  const m = monthParts(n.base ?? 0, n.months ?? 1, n.parts ?? []),
    chance = n.chance ?? 0,
    draw = n.draw ?? 0,
    biggest = [...(n.parts ?? [])].filter((p) => p[1] > 1).sort((a, b) => b[1] - a[1])[0],
    // (The part but for which the draw would have passed them, if one was; else their age's own chance took them.)
    tipped = m.names.find((_, i) => draw >= m.chanceOf(i)),
    alone = draw < m.chanceOf(-1);
  return {
    short: tipped
      ? `died at ${n.age}: but for ${tipped}, they would have lived`
      : alone
        ? `died of their years, at ${n.age}`
        : `died at ${n.age}, of their years and what pressed on them together`,
    year: n.year,
    age: n.age,
    event: null,
    cause: "month",
    rule: `Under the hand each of its people is drawn against once a month: their age's chance on the life table, raised or lowered by each part that pressed on their land and on them${(n.months ?? 1) > 1 ? `, reckoned for ${n.months} months at once` : ""}.`,
    draw: `That ${(n.months ?? 1) > 1 ? `stretch of ${n.months} months` : "month"} they faced a ${oneIn(chance)} chance of dying (${pct(chance)}). The draw was ${drawn(draw)}: inside it, so they died.`,
    parts: m.parts,
    decided: decidedBy(n.base ?? 0, draw, m.chanceOf, m.names),
    from: biggest?.[2] ?? null,
    noPath: biggest
      ? `${biggest[0].replace(/\*$/, "")}: a part read from their land as it stood that month; no single event of history is kept as its cause.`
      : `Age: the life table of their kind at ${n.age}.`,
    changed: (n.parts ?? [])
      .filter((p) =>
        [
          "the god's hand*",
          "a parent's care*",
          "what they are like*",
          "the healers' reach",
          "what its diet goes short of",
          "the aid of its societies",
        ].includes(p[0]),
      )
      .map((p) => [`${p[0].replace(/\*$/, "")}: ${times(p[1])} on the chance.`] as Line),
  };
}

function agentRisk(world: World, id: number): Account | null {
  const w = handOf(world).resting,
    a = w?.agents.find((x) => x.id === id);
  if (!w || !a) return null;
  const ctx = populationContext(world),
    year = yearOfMoment(world.now),
    byId = new Map(w.agents.map((x) => [x.id, x])),
    careOf = (k: number | undefined) => {
      const parent = k === undefined ? undefined : byId.get(k);
      return parent ? traitWeight(parent, "care") : 1;
    },
    care = year - a.birthYear < ctx.life.adulthood ? careOf(a.mother) * careOf(a.father) : 1,
    now = handHazardNow(ctx, w.cell, a, care);
  if (!now) return null;
  const parts: DeathPart[] = [
      ...now.hazard,
      ...now.after.map((p) => [`${p[0]}*`, p[1], p[2]] as DeathPart),
    ],
    m = monthParts(now.base, 1, parts),
    blessed = a.blessedUntil !== undefined && year < a.blessedUntil,
    top = parts
      .filter((p) => p[1] > 1.0005)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3),
    guard = personActsOf(world)
      ?.on(`agent:${id}`, w.village, year)
      .find((x) => x.kind === "protect");
  return {
    short: "",
    year,
    age: year - a.birthYear,
    event: null,
    cause: "month",
    rule: "Under the hand each of its people is drawn against once a month: their age's chance on the life table, raised or lowered by each part that presses on their land and on them.",
    draw: blessed
      ? `The god's blessing spares them death until ${a.blessedUntil}: no draw takes them.`
      : `This month they face a ${oneIn(now.chance)} chance of dying (${pct(now.chance)}), ${pct(1 - (1 - now.chance) ** 12)} over a year like it.`,
    parts: m.parts,
    decided: top.length
      ? top.map((p) => [`${p[0].replace(/\*$/, "")} ${times(p[1])}.`] as Line)
      : [[`Their age alone: ${pct(deathWithin(now.base, 1))} a month.`]],
    from: top.find((p) => p[2])?.[2] ?? null,
    noPath: top.length
      ? `${top[0]![0].replace(/\*$/, "")}: read from their land as it stands this month; no single event of history is kept as its cause.`
      : "Age: the life table of their kind.",
    changed: [
      ...(guard
        ? [
            [
              link("The god's protection", guard.event),
              ` holds until ${guard.until}: a death in the land's killing's share is spared.`,
            ] as Line,
          ]
        : []),
      ...parts
        .filter(
          (p) =>
            [
              "the god's hand*",
              "a parent's care*",
              "what they are like*",
              "the healers' reach",
            ].includes(p[0]) && p[1] !== 1,
        )
        .map((p) => [`${p[0].replace(/\*$/, "")}: ${times(p[1])} on the chance.`] as Line),
    ],
  };
}

// —— Whom a page is of ——————————————————————————————————————————————————————————————————————

/**
 * How one a page is about died (null: they live, or history keeps no death of them). A ruler's page is the seat's, so a ruler gone
 * is told by name (`name`, the one pinned or followed) or by the event that ended their reign.
 */
export function deathOf(world: World, ref: string, name?: string | null): Account | null {
  try {
    if (ref.startsWith("rule:")) {
      const r = politiesOf(world).get(ref.slice(5) as Ref);
      if (!r || !name || name === r.ruler.name) return null;
      const e = rulerEnd(world, r.ref, name);
      return e ? rulerDeath(world, e) : null;
    }
    if (ref.startsWith("court:")) return courtDeath(world, ref);
    if (ref.startsWith("folk:town:")) return holderDeath(world, ref);
    if (ref.startsWith("lv:")) return levyDeath(world, ref);
    if (ref.startsWith("agent:")) {
      const w = handOf(world).resting,
        id = Number(ref.slice(6));
      if (!w || w.agents.some((a) => a.id === id)) return null;
      return agentDeath(world, w.village, id);
    }
    if (ref.startsWith("ev:")) {
      const e = world.events.get(ref as Ref);
      return e && SEAT_ENDS.has(e.type) ? rulerDeath(world, e) : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** What could take one living now: this year's (or month's) chance, its parts, the path behind the greatest (null: none read). */
export function riskOf(world: World, ref: string): Account | null {
  try {
    if (ref.startsWith("rule:")) {
      const r = politiesOf(world).get(ref.slice(5) as Ref);
      return r && r.ended === null ? rulerRisk(world, r) : null;
    }
    if (ref.startsWith("court:")) return courtRisk(world, ref);
    if (ref.startsWith("folk:town:")) return holderRisk(world, ref);
    if (ref.startsWith("agent:")) return agentRisk(world, Number(ref.slice(6)));
  } catch {
    return null;
  }
  return null;
}

/** A death in a line, for a family tree, a house's list, the people bar: "died of their years, at 61 (1342)". */
export function deathWords(world: World, ref: string, name?: string | null): string | null {
  const a = deathOf(world, ref, name);
  return a ? `${a.short}${a.year !== null ? ` (${a.year})` : ""}` : null;
}

/** Unused imports kept honest for a reader: what a seat's ref names now. */
export type { Polity };

// —— On a page ——————————————————————————————————————————————————————————————————————————————

/** One act the god could do on them now, or why not; and what holds on them, with the years left. */
export type GodPersonAct = {
  readonly kind: PersonActKind;
  readonly aim?: "war" | "peace";
  readonly problem: string | null;
};
export type GodPersonHeld = {
  readonly kind: PersonActKind;
  readonly aim?: "war" | "peace";
  readonly from: number;
  readonly until: number;
  readonly left: number;
  readonly event: string;
  readonly spent: string | null;
};

/** What the god can do on one, and what holds on them (null: none of the god's acts reach their kind). */
export function godActsFor(
  world: World,
  ref: string,
): { kind: PersonKind; name: string; acts: GodPersonAct[]; held: GodPersonHeld[] } | null {
  const ctx = populationContext(world),
    who = personNow(ctx, ref);
  if (!who) return null;
  const year = yearOfMoment(world.now),
    acts: GodPersonAct[] = [];
  for (const kind of ACTS_FOR[who.kind])
    for (const aim of kind === "whisper" ? (["war", "peace"] as const) : [undefined])
      acts.push({
        kind,
        ...(aim ? { aim } : {}),
        problem: personActProblem(ctx, { ref, kind, ...(aim ? { aim } : {}) }),
      });
  const held = (personActsOf(world)?.ever(ref) ?? [])
    .filter((a) => a.of === null || a.of === who.of)
    .map((a): GodPersonHeld => ({
      kind: a.kind,
      ...(a.aim ? { aim: a.aim } : {}),
      from: a.from,
      until: a.until,
      left: Math.max(0, a.until - year),
      event: a.event,
      spent: a.used && a.used !== a.event ? a.used : null,
    }));
  return { kind: who.kind, name: who.name, acts, held };
}

/** A ruler's or one of a court's card on their page, for Play as them. */
function leaderOnPage(page: PageModel): unknown {
  for (const t of page.tabs)
    for (const b of t.blocks)
      if (b.type === "tool" && b.tool === "leader.card") {
        const l = (b.args as { leader?: { ref?: string } }).leader;
        if (l?.ref === page.ref) return l;
      }
  return null;
}

/**
 * A person's page with how they died (dead), or what could take them now and the god's acts on them (living): asked 2026-11-16.
 * An event that ended a reign tells how its ruler died.
 */
export function withDeath(world: World, ref: string, page: PageModel): PageModel {
  const person = page.kind === "person" || page.kind === "agent";
  if (!person && !(ref.startsWith("ev:") && page.tabs.length)) return page;
  const blocks: Block[] = [];
  if (!person) {
    const e = world.events.get(ref as Ref);
    if (!e || !SEAT_ENDS.has(e.type)) return page;
    const a = rulerDeath(world, e),
      d = e.data as { old?: string; ruler?: string } | null;
    if (!a) return page;
    blocks.push(
      ...accountBlocks(
        world,
        `How ${d?.old ?? d?.ruler ?? "they"} ${a.cause === "removed" ? "left the seat" : "died"}`,
        a,
      ),
    );
  } else {
    const dead = deathOf(world, ref, page.title),
      risk = dead ? null : riskOf(world, ref);
    if (dead) blocks.push(...accountBlocks(world, "How they died", dead));
    else if (risk) blocks.push(...accountBlocks(world, "At risk now", risk));
    const god = dead ? null : godActsFor(world, ref);
    if (god) {
      const x = parseTownsfolkRef(ref),
        portrait = page.portrait as { age?: number; occupation?: number } | undefined,
        holder = x ? holderAt(world, ref)?.h : undefined;
      blocks.push({
        type: "tool",
        tool: "acts.god-person",
        args: {
          ref,
          name: page.title,
          kind: god.kind,
          acts: god.acts,
          held: god.held,
          year: yearOfMoment(world.now),
          ...(god.kind === "agent" ? { agent: Number(ref.slice(6)) } : {}),
          ...(god.kind === "ruler" || god.kind === "court" ? { leader: leaderOnPage(page) } : {}),
          ...(x && holder
            ? {
                touch: {
                  town: x.town,
                  name: page.title,
                  age: portrait?.age ?? yearOfMoment(world.now) - holder.born,
                  occupation: portrait?.occupation ?? 0,
                  sex: holder.sex,
                },
              }
            : {}),
        },
      });
    }
  }
  if (!blocks.length) return page;
  const [first, ...rest] = page.tabs;
  return { ...page, tabs: [{ ...first!, blocks: [...first!.blocks, ...blocks] }, ...rest] };
}
