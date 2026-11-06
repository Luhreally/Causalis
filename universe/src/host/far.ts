// Arms past the greatest fire, told (War past the line, W6): what it would take to burn a world's sky or unmake it, what the
// nearest people commands against that, and why no one can; what fell, who chose it, what it cost, what it did, and the film of it.
// Never how. Pure reads: asking moves nothing.
import { yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import {
  FAR,
  FIRE,
  cruise,
  mjWords,
  rungName,
  shareWords,
  skyMj,
  starDriveFor,
  unmakeMj,
  type FarWorld,
  type Rung,
} from "../rules/index.ts";
import {
  clusterOf,
  commandOf,
  farOf,
  farStar,
  farWorksOf,
  farWorldOf,
  fireOf,
  knows,
  populationContext,
  politiesOf,
  realmName,
  starWarsOf,
  type FarFall,
} from "../sim/index.ts";
import { matterWorldOf } from "./reading.ts";
import type { Block, FarFilmPlan, FarReach, Stat } from "../bridge/index.ts";
import { count, item, link, stat } from "./inspect/words.ts";

const peopleWords = (n: number): string =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)} billion`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`
      : count(n);

/** The most any living people commands, and who. Null: nothing at all. */
function nearestOf(world: World): {
  readonly ref: Ref;
  readonly name: string;
  readonly mj: number;
  readonly how: string;
} | null {
  if (!world.hasStore("war.fire") || !world.hasStore("space.starwars")) return null;
  const ctx = populationContext(world),
    year = yearOfMoment(world.now);
  let best: { ref: Ref; name: string; mj: number; how: string } | null = null;
  for (const p of politiesOf(world).living()) {
    const c = commandOf(ctx, p, year),
      drive = starDriveFor((id) => knows(ctx, p.seat, id)),
      ways: [number, string][] = [
        [c.fireMj > 0 ? FIRE.mj : 0, "one of its greatest fire"],
        [
          c.hullMj,
          `a fleet of ${FAR.hulls} great hulls at ${drive ? Math.round(cruise(drive) * 100) : 0} in a hundred of light's speed, their own speed the strike`,
        ],
        [c.works ? c.lightMj : 0, `its star's light turned on one mark for ${FAR.gatherYears} years`],
      ];
    for (const [mj, how] of ways)
      if (mj > (best?.mj ?? 0)) best = { ref: p.ref, name: realmName(p), mj, how };
  }
  return best;
}

/** What it would take, on a world's own numbers, and what the nearest people commands against that. */
export function farReachOf(world: World, n: FarWorld): FarReach {
  const near = nearestOf(world),
    sky = skyMj(n),
    unmake = unmakeMj(n);
  return {
    skyMj: Number.isFinite(sky) ? sky : null,
    unmakeMj: unmake,
    nearest: near ? near.name : null,
    mj: near?.mj ?? 0,
    words: [
      Number.isFinite(sky)
        ? `To burn its whole sky would take ${mjWords(sky)}, its air warmed through (a game's estimate).`
        : "It has no sky to burn.",
      `To unmake it, its binding energy, by its own mass and size: ${mjWords(unmake)}.`,
      near
        ? `The most anyone commands: ${near.name}, ${mjWords(near.mj)}, by ${near.how}. That is ${shareWords(near.mj, unmake)} of what would unmake it${Number.isFinite(sky) ? `, and ${shareWords(near.mj, sky)} of what would burn its sky` : ""}.`
        : "No people anywhere commands anything that could reach it.",
    ],
  };
}

/** The ladder on the principle's page, on the home world's own numbers: what is there, even where no one here can ever have the fire. */
export function farLadderStats(world: World): Stat[] {
  const m = matterWorldOf(world).means,
    r = farReachOf(world, { pull: m.pull, radius: m.radius, airBar: m.airBar }),
    near = r.nearest;
  return [
    stat(
      "Past it",
      `Energy goes on. ${r.words[0]} ${r.words[1]} ${near ? r.words[2] : "No people here commands anything past their own world."}`,
    ),
  ];
}

const rungWords = (rung: Rung): string =>
  rung === "world" ? "a world unmade" : rung === "sky" ? "a world's sky burned" : "a fire carried to another world";

const worldWords = (f: Pick<FarFall, "planet">): string =>
  `its ${["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"][f.planet] ?? `${f.planet + 1}th`} world`;

/** What a realm can bring and what it has done, on its page. */
export function farRealmStats(world: World, realm: Ref): Stat[] {
  const out: Stat[] = [],
    far = farOf(world),
    w = farWorksOf(world, realm),
    year = yearOfMoment(world.now),
    p = politiesOf(world).get(realm);
  if (w)
    out.push(
      w.done === null
        ? stat(
            "A greater works",
            `Its star's light being turned, at ${w.place}, since year ${w.begun}: ${count(year - w.begun)} of ${count(FAR.worksYears)} years, ${count(Math.round(w.paid))} machines gone into it, ${Math.round(FAR.worksShare * 100)} in a hundred of all its machines, iron and fuel a year`,
            { why: w.event },
          )
        : stat(
            "Can turn its star's light",
            w.given
              ? `By the god's hand, since year ${w.done}`
              : `Since year ${w.done}: ${count(w.done - w.begun)} years at ${w.place}, ${count(Math.round(w.paid))} machines`,
            { why: w.held },
          ),
    );
  if (p && p.ended === null && world.hasStore("space.starwars")) {
    const c = commandOf(populationContext(world), p, year),
      most = Math.max(c.hullMj, c.works ? c.lightMj : 0);
    if (most > 0)
      out.push(
        stat(
          "What it could bring across the stars",
          `${mjWords(most)}, ${c.works && c.lightMj > c.hullMj ? "its star's light" : "its great hulls' own speed"}: ${shareWords(most, skyMj({ pull: 1, radius: 1, airBar: 1 }))} of what would burn a sky of one bar, ${shareWords(most, unmakeMj({ pull: 1, radius: 1 }))} of what would unmake the world under it (a game's estimates)`,
        ),
      );
  }
  const fell = far?.falls.filter((f) => f.by === realm) ?? [];
  if (fell.length)
    out.push(
      stat(
        "What it has done past any town",
        fell
          .map((f) => `${rungWords(f.rung)} in year ${f.year}, ${peopleWords(f.dead)} dead`)
          .join("; "),
        { why: fell.at(-1)!.event },
      ),
    );
  return out;
}

/** A war between the stars' page: the year it came to the brink, and what fell. */
export function farWarBlocks(world: World, war: Ref): Block[] {
  const far = farOf(world);
  if (!far) return [];
  const crises = far.crises.filter((c) => c.war === war),
    falls = far.falls.filter((f) => f.war === war),
    out: Block[] = [];
  if (falls.length)
    out.push({
      type: "list",
      title: "What fell",
      items: falls.map((f) =>
        item(
          [
            link(`${rungWords(f.rung)}`, `${f.star}/${f.planet}`),
            `, year ${f.year}: ${peopleWords(f.dead)} dead`,
          ],
          f.event,
        ),
      ),
    });
  if (crises.length)
    out.push({
      type: "list",
      title: "The years everyone in reach of the stars held their breath",
      items: crises.map((c) =>
        item(
          `Year ${c.year}: ${c.ruler} could have brought ${rungWords(c.rung)}: ${c.end === "fell" ? "it fell" : c.end === "stepped" ? "they held their hand" : c.ended === null ? "no one knows yet" : "it passed"}`,
          c.endEvent ?? c.event,
        ),
      ),
    });
  return out;
}

/** What fell on a world, on its page and its star's. */
export function farWorldBlocks(world: World, star: string, planet: number): Block[] {
  const store = world.hasStore("war.fire") ? fireOf(world) : null,
    s = farStar(world, star);
  if (!store) return [];
  const gone = store.unmade(star, planet),
    falls = (farOf(world)?.falls ?? []).filter(
      (f) => f.planet === planet && s && f.star === (s.ref as string),
    ),
    n = s ? farWorldOf(world, s, planet) : null,
    out: Block[] = [];
  if (gone)
    out.push({
      type: "text",
      title: "It is gone",
      lines: [
        [
          `In year ${gone.year} ${gone.by ? `${gone.name} unmade it` : "the god's hand unmade it"}: ${mjWords(gone.mj)} brought against the ${mjWords(gone.need)} that was its binding energy, by its own mass and size. ${gone.dead > 0 ? `${peopleWords(gone.dead)} people died with it.` : "No one lived on it."} What is left of it goes round its star as rubble, and no ship goes there.`,
        ],
      ],
    });
  if (falls.length)
    out.push({
      type: "list",
      title: gone ? "What it came to" : "What fell on it",
      items: falls.map((f) =>
        item(
          `${rungWords(f.rung)}, year ${f.year}, by ${f.by ? f.name : "the god's hand"}: ${peopleWords(f.dead)} dead`,
          f.event,
        ),
      ),
    });
  for (const f of falls)
    out.push({
      type: "tool",
      tool: "watch.far",
      args: { id: f.event, label: f.rung === "world" ? "🌑 Watch it unmade" : "▶ Watch it" },
    });
  if (!gone && n)
    out.push({
      type: "text",
      title: "What it would take",
      lines: farReachOf(world, n).words.map((w) => [w]),
    });
  return out;
}

/** What it says on the page of a land that stood on a world unmade. */
export function farLandStats(world: World, cell: number): Stat[] {
  return (farOf(world)?.falls ?? [])
    .filter((f) => f.lands.includes(cell))
    .map((f) =>
      stat(
        f.rung === "world" ? "Its world was unmade" : f.rung === "sky" ? "Its sky burned" : "A fire carried here",
        `Year ${f.year}, by ${f.by ? f.name : "the god's hand"}: ${peopleWords(f.dead)} dead on that world`,
        { why: f.event },
      ),
    );
}

/** The film of a fall (null: none such). */
export function farPlan(world: World, event: string): FarFilmPlan | null {
  const f = farOf(world)?.falls.find((x) => x.event === event);
  if (!f) return null;
  const star = farStar(world, f.star),
    n = star ? farWorldOf(world, star, f.planet) : null,
    sun = star ? { sunWm2: 1361 * (star.luminosity || 1) } : { sunWm2: 1000 },
    who = f.by ? f.name : "The god's hand",
    name = rungName(f.rung, sun),
    rows = [
      { head: "Who", text: f.by ? `${f.name}${f.decision ? ", its ruler's word" : ""}` : "The god's hand" },
      {
        head: "What it took",
        text: `${mjWords(f.mj)} ${f.byLight ? "of its star's gathered light" : f.by && f.rung !== "carried" ? "by its great hulls' own speed" : "brought"}, against the ${mjWords(f.need)} ${f.rung === "world" ? "that was this world's binding energy" : f.rung === "sky" ? "that was its whole sky's" : "of one greatest fire"}`,
      },
      {
        head: "What it did",
        text:
          f.rung === "world"
            ? `The world is gone${f.dead > 0 ? `, and ${peopleWords(f.dead)} with it, all who were on it` : ", though no one lived on it"}. Rubble goes round its star where it was, and no ship goes there.`
            : f.rung === "sky"
              ? `${peopleWords(f.dead)} dead of the dark and the hunger. Its sky stays dark until year ${f.until ?? f.year}.`
              : `${peopleWords(f.dead)} dead, and the mark of it on the ground.`,
      },
      {
        head: "Who was told",
        text: "Every people in reach of the stars. Every ruler after will weigh this by it.",
      },
    ];
  return {
    event,
    rung: f.rung,
    star: f.star,
    planet: f.planet,
    year: f.year,
    name,
    title:
      f.rung === "world"
        ? `A world unmade, year ${f.year}`
        : f.rung === "sky"
          ? `A sky burned, year ${f.year}`
          : `A fire carried to another world, year ${f.year}`,
    whole: `${f.people > 0 ? `${peopleWords(f.people)} people on this world.` : "A world of another star."} ${f.by ? `${who} ${f.rung === "world" ? "has turned its star's light on it" : "has sent its fleet"}.` : "The god's hand is laid on it."}`,
    strikes:
      f.rung === "world"
        ? `${name}: ${mjWords(f.mj)}, what it takes to undo all that holds this world together.`
        : f.rung === "sky"
          ? `${name}: ${mjWords(f.mj)}, arriving at the speed it was sent.`
          : `${name}: ${mjWords(f.mj)}.`,
    breaks:
      f.rung === "world"
        ? "It is coming apart."
        : f.rung === "sky"
          ? "Its whole sky takes fire, and then goes dark."
          : "Far off, it can be seen from here.",
    gone: f.rung === "world" ? "Its light is going out." : "",
    after:
      f.rung === "world"
        ? "What is left of it."
        : f.rung === "sky"
          ? `Its fields will lie under this until year ${f.until ?? f.year}.`
          : "It will be remembered on every world there is.",
    rows,
    foot: n
      ? f.rung === "world"
        ? `Its mass and size set what that took: a page says what anyone now commands against the next.`
        : `To unmake this world would have taken ${mjWords(unmakeMj(n))}.`
      : "",
    god: !f.by,
    chance: f.decision ? (world.decisions.get(f.decision)?.score ?? null) : null,
  };
}

export const FAR_QUERIES = {
  /** A fall, for its film. */
  "far.plan": (world: World, args: unknown) => farPlan(world, (args as { event: string }).event),
  /** Every fall there has been, the last last. */
  "far.falls": (world: World) => (world.hasStore("war.fire") ? (farOf(world)?.falls ?? []) : []),
  /** What a world's numbers ask, and what anyone commands. */
  "far.reach": (world: World, args: unknown) => {
    const a = args as { star: string; planet: number },
      s = farStar(world, a.star),
      n = s ? farWorldOf(world, s, a.planet) : null;
    return n ? farReachOf(world, n) : null;
  },
  /** The stars with a world unmade: their places in the cluster's list, and where they lie. */
  "far.scars": (world: World) => {
    const far = world.hasStore("war.fire") ? farOf(world) : null,
      stars = clusterOf(world),
      out: { stars: number[]; at: { x: number; y: number }[] } = { stars: [], at: [] };
    for (const f of far?.falls ?? []) {
      if (f.rung !== "world") continue;
      const i = stars.findIndex((s) => s.ref === f.star);
      if (i < 0 || out.stars.includes(i)) continue;
      out.stars.push(i);
      out.at.push({ x: stars[i]!.x, y: stars[i]!.y });
    }
    return out;
  },
  /** How many of each there have been, for a measure. */
  "far.counts": (world: World) => {
    const far = world.hasStore("war.fire") ? farOf(world) : null;
    return {
      crises: far?.crises.length ?? 0,
      stepped: far?.crises.filter((c) => c.end === "stepped").length ?? 0,
      falls: far?.falls.length ?? 0,
      works: far?.works.length ?? 0,
      wars: world.hasStore("space.starwars") ? starWarsOf(world).all().length : 0,
    };
  },
} as const;

