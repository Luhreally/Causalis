// A line lived past its cells (Live a Line, S2 and S3): the body it founds, the young it may go on in, and its breeding
// between the generations played. Every body is grown from a genome by the world's own development (gen/evolution.ts
// develop) and must pass the world's physics before it is offered: the weight its frame bears (in its liquid or on land,
// under its pull), what a skin, tubes, gills or lungs can feed at its oxygen, and whether its air bears a flier up (rules:
// largestFrame, breathingCeiling, bodyBreaks). Its founders are its world's own first bodies, each changed a little by a
// draw keyed on the world, the saga, the generation and the child; its young each one change from it by the same draws
// (gen/evolution.ts mutate), told by what changed and what favoured it (innovations, pressures). Between the generations
// played it is bred forward off the screen by those draws and the fitness of its way, and a line too unfit for its world
// dies out: the player goes on as its nearest living kin. Pure reads of the world as generated: nothing here is history.
import { finish, hashString, mix, seedWithAct, type World } from "../kernel/index.ts";
import {
  AGES,
  AGE_MY,
  GENOME_CODE,
  wayIndex,
  ageSpan,
  beastLookOf,
  develop,
  distance,
  fitness,
  inWater,
  innovations,
  isProvinceWorld,
  kindOfBody,
  lineOf,
  massWords,
  mutate,
  pressures,
  protoLifeWorld,
  treeOfLife,
  wayWord,
  worldKindOf,
  worldLife,
  type Env,
  type Genome,
  type HomeWorld,
  type Way,
} from "../gen/index.ts";
import {
  DAWN_WAYS,
  KINDS,
  LIFE_NICHES,
  LIFE_WAYS,
  dawnAct,
  lifeAct,
  type DawnWay,
  bodyBreaks,
  breathingCeiling,
  largestFrame,
  type CreatureBody,
  type LifeWorld,
} from "../rules/index.ts";
import { homePlanet, populationContext, provinceCapacity } from "../sim/index.ts";
import { landCamps } from "./land.ts";
import { installSaga, type SagaStore } from "./saga.ts";

/** A body of the line: what it is called, its way of life, its genome and the body it grows, and why it is as it is. */
export type LineBody = {
  readonly name: string;
  readonly way: Way;
  readonly genome: Genome;
  readonly body: CreatureBody;
  /** What it is, against its world's physics, in plain words. */
  readonly reasons: readonly string[];
  /** A founder's line in the tree of life (its node), that a line made so is a daughter of (absent: not a founder). */
  readonly node?: number;
  /** How well it suits its way here (the world's own fitness), and against its mother (null: a founder). */
  readonly fit: number;
  readonly better: number | null;
};

/** A world's numbers as its life meets them, read once a world. */
const LIFE_WORLDS = new WeakMap<HomeWorld, LifeWorld>();
function lifeWorld(g: HomeWorld): LifeWorld {
  let lw = LIFE_WORLDS.get(g);
  if (!lw)
    LIFE_WORLDS.set(g, (lw = protoLifeWorld(g as unknown as Parameters<typeof protoLifeWorld>[0])));
  return lw;
}

/** A keyed draw in [0, 1): of the world, the saga, the generation, the child and the draw's slot (view/line.ts's own). */
export function bodyDraw(
  digest: string,
  saga: number,
  gen: number,
  child: number,
  k: number,
): number {
  let h = hashString(`line body ${digest}`);
  h = mix(h, saga);
  h = mix(h, gen);
  h = mix(h, child);
  h = mix(h, k);
  return finish(h, 5) / 4294967296;
}

/** The age a moment falls in (-1: before the ages, the sea's dawn). */
export function ageAtMy(my: number): number {
  for (let k = 0; k < AGES; k++) {
    const [from, to] = ageSpan(k);
    if (my <= from && my > to) return k;
  }
  return my > ageSpan(0)[0] ? -1 : AGES - 1;
}

/** What a line lives under at a moment: its world's pull, the warmth of its age, how many hunt. */
export function lineEnv(g: HomeWorld, my: number): Env {
  const k = ageAtMy(my),
    a = k >= 0 ? g.deep.ages[k] : undefined;
  return {
    gravity: g.planet.gravity,
    pressure: 1,
    warmth: g.planet.meanTemperature + (a?.warmth ?? 0),
    rain: 1000,
    kind: a?.kind ?? "dawn",
    hunted: 0.15,
  };
}

/** What holds a body's shape, as its genome grows it: its own pressure while it is small and soft, a shell, or bones. */
function frameOf(g: Genome, sea: boolean): "none" | "shell" | "bones" {
  if (g.frame === "none" || g.frame === "shell" || g.frame === "bones") return g.frame;
  if (g.skin === "shell" || g.skin === "plates") return "shell";
  return g.legs === 0 && g.mass <= (sea ? 30 : 1.5) ? "none" : "bones";
}

/** How it breathes: through its skin while it is small, else by gills in the water and lungs ashore. */
function breathOf(g: Genome, sea: boolean): "skin" | "gills" | "lungs" {
  if (g.breath === "skin" || g.breath === "gills" || g.breath === "lungs") return g.breath;
  return g.mass <= 0.05 && g.skin === "slick" ? "skin" : sea ? "gills" : "lungs";
}

/** Whether a body passes its world's physics, and what it is against them in words (empty `breaks`: it passes). */
export function checkBody(
  genome: Genome,
  way: Way,
  lw: LifeWorld,
): { body: CreatureBody; breaks: string[]; reasons: string[] } {
  const sea = inWater(way),
    frame = frameOf(genome, sea),
    breath = breathOf(genome, sea),
    grown = develop(genome, 2),
    body: CreatureBody = {
      ...grown,
      frame,
      breath,
      place: sea ? "sunlit sea" : (grown.place ?? "grassland"),
    },
    breaks = bodyBreaks(body, lw),
    bears = largestFrame(frame, lw.gravity, sea),
    feeds = lw.eatTrade === "breathe-o2" ? breathingCeiling(breath, lw.o2) : Infinity,
    reasons: string[] = [];
  if (genome.mass > bears)
    breaks.push(
      `a frame of ${frame} bears ${massWords(bears)} here, not ${massWords(genome.mass)}`,
    );
  if (genome.mass > feeds && !breaks.some((b) => /oxygen/.test(b)))
    breaks.push(`breathing by ${breath}, its oxygen feeds no more than ${massWords(feeds)}`);
  reasons.push(
    `${massWords(genome.mass)}; ${frame === "none" ? "held in shape by its own pressure" : frame === "shell" ? "held in a shell" : "held up by bones"}: ${sea ? "in the water" : "on land"} under this world's pull (${lw.gravity.toFixed(2)} of Earth's) such a frame bears up to ${massWords(bears)}`,
  );
  if (Number.isFinite(feeds))
    reasons.push(
      `breathes by its ${breath === "skin" ? "skin" : breath}: at ${lw.o2.toFixed(2)} bar of oxygen that feeds a body up to ${massWords(feeds)}`,
    );
  return { body, breaks, reasons };
}

/** The pressures most for and most against a body in its way, in words. */
function pressureWords(g: Genome, way: Way, env: Env): string[] {
  const t = pressures(g, way, env),
    entries = Object.entries(t).filter(([, v]) => Math.abs(v) >= 0.3) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const out: string[] = [];
  const best = entries[0],
    worst = entries.at(-1);
  if (best && best[1] > 0) out.push(`suits its way best by ${PRESSURE_WORDS[best[0]] ?? best[0]}`);
  if (worst && worst[1] < 0) out.push(`pays most for ${PRESSURE_WORDS[worst[0]] ?? worst[0]}`);
  return out;
}
const PRESSURE_WORDS: Readonly<Record<string, string>> = {
  water: "how it goes through the water",
  ashore: "how it gets about on land",
  dry: "how it keeps from drying out",
  air: "its wings",
  cold: "keeping warm in the cold",
  heat: "keeping cool in the heat",
  coat: "its coat",
  stamina: "its warm blood's going on",
  pull: "its legs under this world's pull",
  size: "its size for its way",
  food: "how it feeds",
  hunted: "its armour against hunters",
  rivals: "its show among its own",
  cost: "what its body costs to keep",
  sight: "its eyes and feelers",
};

/**
 * A body drawn as its world's life is drawn: on a world of its own stock (not Earth's), the look of the living lineage of
 * its world nearest it in its medium and its size (its forebears were of that stock; gen/stocks.ts).
 */
function lookFor(g: HomeWorld, body: CreatureBody, sea: boolean): CreatureBody {
  if (g.prior === "earthlike") return body;
  let best: { s: (typeof g.life.species)[number]; d: number } | null = null;
  for (const s of g.life.species) {
    if (!s.body || inWater(s.niche === "swimmer" ? "sea swimmer" : "walker") !== sea) continue;
    const d = Math.abs(Math.log((s.body.size || 1) / Math.max(1e-6, body.size)));
    if (!best || d < best.d) best = { s, d };
  }
  const look = best ? beastLookOf(g, best.s) : null;
  return look ? ({ ...body, look } as CreatureBody) : body;
}

/** A body of the line made whole: checked against its world, told, and how fit it is. */
function told(
  name: string,
  genome: Genome,
  way: Way,
  env: Env,
  lw: LifeWorld,
  mother: Genome | null,
  g?: HomeWorld,
): LineBody | null {
  const c0 = checkBody(genome, way, lw),
    c = g ? { ...c0, body: lookFor(g, c0.body, inWater(way)) } : c0;
  if (c.breaks.length) return null;
  const fit = fitness(genome, way, env),
    changed = mother ? innovations(mother, genome, way, env) : [];
  return {
    name,
    way,
    genome,
    body: c.body,
    reasons: [
      ...changed.map((i) => `${i.what}${i.why ? `, ${i.why}` : ""}`),
      ...c.reasons,
      ...pressureWords(genome, way, env),
    ],
    fit: Math.round(fit * 100) / 100,
    better: mother ? Math.round((fit - fitness(mother, way, env)) * 100) / 100 : null,
  };
}

/** The ways a body may live, at a moment: the sea's always, the land's once life has come ashore. */
function waysAt(tree: ReturnType<typeof treeOfLife>, my: number): Way[] {
  const ashore = tree.rungs.find((r) => r.id === "ashore")?.at ?? 400;
  const sea: Way[] = ["sea swimmer", "sea crawler", "burrower", "drifter"];
  return my <= ashore ? [...sea, "walker", "land crawler", "grazer", "small hunter"] : sea;
}

/** The way a body suits best of those open to it (its body decides its way, not the other way about). */
function bestWay(g: Genome, ways: readonly Way[], env: Env, now: Way): Way {
  let best = now,
    bf = fitness(g, now, env) + 0.3;
  for (const w of ways) {
    const f = fitness(g, w, env);
    if (f > bf) [best, bf] = [w, f];
  }
  return best;
}

/**
 * The bodies a line of cells may found, its cells together and its world's first bodies come: its world's own first
 * bodies (the tree's dawn and early stem lines with bodies), each a little changed by keyed draws, all through its
 * world's physics; the first three kinds of body that pass.
 */
export function foundersOf(g: HomeWorld, digest: string, saga: number, gen: number): LineBody[] {
  const tree = treeOfLife(g),
    lw = lifeWorld(g),
    bodies = tree.rungs.find((r) => r.id === "bodies")?.at ?? 600,
    env = lineEnv(g, bodies),
    seen = new Set<string>(),
    out: LineBody[] = [];
  const stems = tree.nodes
    .filter(
      (n) =>
        n.genome &&
        (n.kind === "dawn" || n.kind === "stem") &&
        n.from <= bodies + 1 &&
        n.from >= bodies - 160,
    )
    .sort((a, b) => b.from - a.from || a.id - b.id);
  for (const n of stems) {
    if (out.length >= 3) break;
    const g0 = n.genome!,
      kind = kindOfBody(g0);
    const way = (inWater(n.way) ? n.way : "sea swimmer") as Way;
    if (seen.has(kind) || seen.has(way)) continue;
    const child = out.length;
    let made: LineBody | null = null;
    // (A change drawn, tried against the world's physics; one that breaks them is drawn again, and the body as it first
    // was kept at the last.)
    for (let k = 0; k < 8 && !made; k++) {
      const x = mutate(g0, (s) => bodyDraw(digest, saga, gen, child, k * 16 + s));
      made = told(wayWord(way), x, way, env, lw, null, g);
    }
    made ??= told(wayWord(way), g0, way, env, lw, null, g);
    if (!made) continue;
    seen.add(kind);
    seen.add(way);
    out.push({ ...made, node: n.id, reasons: [`as ${n.name} were: ${n.what}`, ...made.reasons] });
  }
  return out;
}

/** The young a body of the line may go on in: three, each one change from it, through its world's physics. */
export function youngOf(
  g: HomeWorld,
  genome: Genome,
  way: Way,
  my: number,
  digest: string,
  saga: number,
  gen: number,
): LineBody[] {
  const tree = treeOfLife(g),
    lw = lifeWorld(g),
    env = lineEnv(g, my),
    ways = waysAt(tree, my),
    out: LineBody[] = [];
  for (let child = 0; child < 3; child++) {
    let made: LineBody | null = null;
    for (let k = 0; k < 10 && !made; k++) {
      const x = mutate(genome, (s) => bodyDraw(digest, saga, gen, child, k * 16 + s));
      if (distance(x, genome) === 0) continue;
      const w = bestWay(x, ways, env, way);
      made = told(wayWord(w), x, w, env, lw, genome, g);
      if (made && out.some((o) => distance(o.genome, x) === 0)) made = null;
    }
    if (made) out.push(made);
  }
  // (None changed passes: its young are much as it is.)
  if (!out.length) {
    const same = told(wayWord(way), genome, way, env, lw, genome, g);
    if (same) out.push(same);
  }
  return out;
}

/** How many generations of a line pass off the screen between those played, at most (each a round of breeding). */
const ROUNDS_MOST = 12;

/**
 * A line bred on from one moment to another off the screen: round after round, the fittest of a few keyed changes kept
 * for its way (as its world's own lines were bred, gen/evolution.ts), its way the one its body suits. A line whose
 * fitness falls under its world's least lineage's at the time dies out, and goes on in its nearest living kin of the tree.
 */
export function bredOn(
  g: HomeWorld,
  genome: Genome,
  way: Way,
  from: number,
  to: number,
  digest: string,
  saga: number,
  gen: number,
): {
  genome: Genome;
  way: Way;
  rounds: number;
  died: null | { name: string; ref: string };
  line: LineBody | null;
} {
  const tree = treeOfLife(g),
    lw = lifeWorld(g),
    rounds = Math.max(1, Math.min(ROUNDS_MOST, Math.ceil((from - to) / 25)));
  let x = genome,
    w = way;
  for (let r = 0; r < rounds; r++) {
    const my = from - ((from - to) * (r + 1)) / rounds,
      env = lineEnv(g, my),
      ways = waysAt(tree, my);
    let best = x,
      bf = fitness(x, w, env);
    for (let c = 0; c < 6; c++) {
      const y = mutate(x, (s) => bodyDraw(digest, saga, gen * 64 + r, 8 + c, s));
      if (checkBody(y, w, lw).breaks.length) continue;
      const f = fitness(y, w, env);
      if (f > bf + 0.02) [best, bf] = [y, f];
    }
    x = best;
    w = bestWay(x, ways, env, w);
  }
  // Died out: plainly less fit for its way than every lineage of its world living that way then (outdone by them, as
  // its world's own lines were), on a draw: a line no fitter than they goes on as often as not.
  const env = lineEnv(g, to),
    alive = tree.nodes.filter(
      (n) =>
        n.genome &&
        n.kind !== "dawn" &&
        n.from >= to &&
        (n.to === null || n.to <= to) &&
        n.way === w,
    ),
    least = Math.min(...alive.map((n) => fitness(n.genome!, w, env)));
  if (
    alive.length &&
    fitness(x, w, env) < least - 0.3 &&
    bodyDraw(digest, saga, gen, 99, 0) < 0.35
  ) {
    let kin = alive[0]!,
      d = Infinity;
    for (const n of alive) {
      const dd = distance(n.genome!, x);
      if (dd < d) [kin, d] = [n, dd];
    }
    const kw = kin.way as Way;
    return {
      genome: kin.genome!,
      way: kw,
      rounds,
      died: { name: kin.name, ref: kin.ref },
      line: told(wayWord(kw), kin.genome!, kw, lineEnv(g, to), lw, null, g),
    };
  }
  return {
    genome: x,
    way: w,
    rounds,
    died: null,
    line: told(wayWord(w), x, w, env, lw, genome, g),
  };
}

/** What a line is lived in: the world's liquid, its life's chemistry, its pull, and (asked of a line) what its forebears took up. */
export function lineFactsOf(g: HomeWorld, ref: string | null) {
  const life = worldLife(g),
    kind = worldKindOf(g),
    liquid = KINDS[kind].liquid,
    tree = ref ? treeOfLife(g) : null,
    node = tree ? tree.nodes.find((n) => n.ref === ref) : undefined,
    through = (id: string) => {
      const r = tree?.rungs.find((x) => x.id === id);
      return !!node && r?.node != null && lineOf(tree!, node.id).some((n) => n.id === r.node);
    };
  return {
    digest: g.digest,
    kind,
    family: life.family,
    liquid: liquid.subst,
    liquidName: liquid.name,
    pigment: life.pigment,
    membrane: life.membrane,
    gravity: g.planet.gravity,
    line: node
      ? {
          ref: node.ref,
          name: node.name,
          light: through("light") || node.kind === "plant",
          nucleus: through("nucleus"),
          together: through("together"),
        }
      : null,
  };
}

// —— The sagas kept, and the page's askings ——————————————————————————————————————————————————————————————————————————

/** The most sagas kept (the least lately played let go first), and the most bytes they may hold in all. */
const SAGAS_MOST = 6,
  BYTES_MOST = 48_000;

/** A saga kept (id 0: a new one, given its id): the least lately played let go while there are too many or too much. */
export function keepSaga(store: SagaStore, id: number, data: unknown): number {
  const at = ++store.uses,
    was = id > 0 ? store.sagas.find((s) => s.id === id) : undefined,
    sid = was?.id ?? store.next++;
  if (was) Object.assign(was, { at, data });
  else store.sagas.push({ id: sid, at, data });
  while (
    store.sagas.length > 1 &&
    (store.sagas.length > SAGAS_MOST || JSON.stringify(store.sagas).length > BYTES_MOST)
  ) {
    let least = 0;
    for (let i = 1; i < store.sagas.length; i++)
      if (store.sagas[i]!.at < store.sagas[least]!.at) least = i;
    if (store.sagas[least]!.id === sid) break;
    store.sagas.splice(least, 1);
  }
  return sid;
}

/**
 * The act that makes a line lived by a hand so: "line 6 1 11 <code>" (its node, its age, its way, and its body's
 * instructions as the hand left them, gen/homeworld.ts GENOME_CODE's values by commas: linesMade reads them back).
 */
export function lineAct(
  node: number,
  age: number,
  way: number,
  genome: Genome | null = null,
): string {
  const g = genome as Record<string, unknown> | null,
    code = g
      ? GENOME_CODE.map((k) => {
          const v = g[k];
          return v === undefined
            ? ""
            : typeof v === "boolean"
              ? v
                ? "1"
                : "0"
              : Array.isArray(v)
                ? v.join("+")
                : String(v).replace(/ /g, "_");
        })
          .join(",")
          .replace(/,+$/, "")
      : "";
  return `line ${node} ${age + 1} ${way}${code ? ` ${code}` : ""}`;
}

/** The age (oldest 0) a time falls in (millions of years ago). */
function ageOfMy(my: number): number {
  return Math.min(AGES - 1, Math.max(0, AGES - 1 - Math.floor(my / AGE_MY)));
}

/**
 * "Make it so" (Live a Line, 2026-11-28): the seed's text with the acts the line lived lays on the world's dawn. The way its
 * cell took is the way that prospered in the first seas (dawn); each land age its body was played in, the way of life that
 * prospered there (life); and the line itself, a daughter of the line its body was founded from, in the age it was last
 * lived in (line). A new world is made from it; the world it was lived in is kept.
 */
export function makeSo(
  text: string,
  a: {
    cell: string | null;
    bodies: readonly { my: number; way: Way }[];
    node: number | null;
    genome?: Genome | null;
  },
): { seed: string; acts: string[] } {
  const acts: string[] = [];
  const dawn = {
    eater: "eaters",
    light: "light",
    hunter: "hunters",
    colony: "together",
    together: "together",
  }[a.cell ?? ""];
  if (dawn && (DAWN_WAYS as readonly string[]).includes(dawn)) acts.push(dawnAct(dawn as DawnWay));
  for (const b of a.bodies) {
    const life = LIFE_WAYS.find((w) => LIFE_NICHES[w].includes(b.way));
    if (life) acts.push(lifeAct(ageOfMy(b.my), life));
  }
  const last = a.bodies.at(-1);
  if (last && a.node !== null && wayIndex(last.way) >= 0)
    acts.push(lineAct(a.node, ageOfMy(last.my), wayIndex(last.way), a.genome ?? null));
  return { seed: acts.reduce(seedWithAct, text), acts };
}

/**
 * The band a hand leads (Live a Line's tribe, S6): a camp of the most peopled land that has camps (its first, the
 * greatest), whether a wild grain grows in or beside that land (or its ground would bear a garden), and whether it sows
 * already: the world's own rule for the next way of life a land may be taught (sim/population/world.ts, act.inspire).
 * Null: no people camp anywhere now.
 */
export function bandOf(
  world: World,
): { cell: number; id: number; grain: boolean; sows: boolean } | null {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    lands = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell);
  for (const p of lands.slice(0, 12)) {
    if (!landCamps(world, p.cell).length) continue;
    const cell = p.cell,
      seed = g.life.seedGrass;
    let near = seed[cell]! >= 0;
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]! && !near; k++)
      near = seed[g.grid.neighbours[k]!]! >= 0;
    return {
      cell,
      id: 0,
      grain: near || provinceCapacity(ctx, cell).farm > 0,
      sows: p.knowsCultivation,
    };
  }
  return null;
}

type Asked = {
  cell: string | null;
  bodies: { my: number; way: Way }[];
  node: number | null;
  ref?: string;
  id: number;
  data: unknown;
  digest: string;
  saga: number;
  gen: number;
  genome: Genome;
  way: Way;
  my: number;
  to: number;
};

/** The page's askings of a line (host/saga.ts hands them here): pure reads of the world as generated, and its sagas. */
export function ask(type: string, world: World, args: unknown): unknown {
  const a = (args ?? {}) as Asked,
    store = () => {
      installSaga(world);
      return world.peek<SagaStore>("readings.saga")!;
    },
    fine = () => {
      const g0 = homePlanet(world).generated;
      return isProvinceWorld(g0) ? g0.fine : g0;
    };
  switch (type) {
    case "line.facts":
      return lineFactsOf(fine(), a.ref ?? null);
    case "line.founders":
      return foundersOf(fine(), a.digest, a.saga, a.gen);
    case "line.young":
      return youngOf(fine(), a.genome, a.way, a.my, a.digest, a.saga, a.gen);
    case "line.bred":
      return bredOn(fine(), a.genome, a.way, a.my, a.to, a.digest, a.saga, a.gen);
    case "saga.list":
      return [...store().sagas]
        .sort((x, y) => y.at - x.at)
        .map((s) => ({ id: s.id, data: s.data }));
    case "saga.keep":
      return keepSaga(store(), a.id, a.data);
    case "line.band":
      return bandOf(world);
    case "line.makeSo":
      return makeSo(world.seed.text, a);
  }
  throw new Error(`no asking ${type}`);
}
