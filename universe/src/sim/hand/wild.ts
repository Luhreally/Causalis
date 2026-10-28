// The god's hand in a beast (Phase 61; asked for 2026-10-27: "add in functionality to possess
// anything like worldbox/worldfall mod ... make sure it works right in mobile"): one of a town's
// flock, of the game about it or of the beasts that hunt them, taken as the page drew it. The beasts
// about it are made the bodies of a small world of its own (rules/wild.ts), each moving by its own
// lineage's body (gen/biosphere.ts: its weight, its legs or wings, what it eats and bears), stepped
// a second at a time by the bids the page sends (twenty to the second, as a person's). Letting go
// writes back what lasts: one of the flock killed or run off from its herd is lost to it (the town's
// flock is drawn without it until a year on: HandStore.strays), one of the wild killed is a death in
// the land's count of its kind (sim/ecology/ecology.ts). Told as the god's act (hand.ran). Nothing is
// kept until a beast is taken, so a world where none was keeps every hash.
import {
  YEAR,
  defineEventType,
  defineStream,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, type Species } from "../../gen/index.ts";
import {
  POSSESS_HZ,
  WILD_MOST,
  WILD_PACKED,
  bidsOf,
  copyWild,
  stepWild,
  strayed,
  unpackWild,
  wildFrame,
  wildWorld,
  type LocalDraw,
  type WildScene,
  type WildWorld,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { ecologyOf, wildsOf, type Wilds } from "../ecology/ecology.ts";
import { handOf, type HeldBeast } from "./hand.ts";

export const WILD_EVENTS = {
  beast: defineEventType("hand.beast", 4),
  ran: defineEventType("hand.ran", 4),
};

/** A beast's small world's own draws, keyed by the beast, the step (from the taking's first), and what for. */
export const HAND_WILD = defineStream("hand.wild");

/** How much of a land's count of a kind one of it killed by the god's hand takes (its share of what the land first held). */
export const WILD_KILL = 0.004;

/** Taking a beast: the town it was drawn about, what it is called, and the small world as the page drew it. */
export type BeastArgs = {
  readonly village: string;
  readonly name: string;
  /** The kinds of the small world: each a living lineage of the land's (its ref). */
  readonly kinds: readonly string[];
  /** The bodies, it first: WILD_PACKED numbers each (rules/wild.ts unpackWild). */
  readonly bodies: readonly number[];
  /** Each body's member of the town's flock (-1: the wild's), in the same order. */
  readonly members: readonly number[];
  /** Each herd's middle and whether it is the town's flock: x, z, flock (0, 1) each. */
  readonly herds: readonly number[];
  /** The water near, and the flock's pasture: x, z, r ([]: none). */
  readonly water: readonly number[];
  readonly pasture: readonly number[];
};

const finite = (v: unknown, most: number): boolean =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= most;

/** A lineage of the world's life by its ref, if it is a beast (it has a body). */
function beastOf(c: PopulationContext, ref: unknown): Species | null {
  if (typeof ref !== "string") return null;
  const s = c.generated.life.species.find((x) => x.ref === ref);
  return s && s.body ? s : null;
}

/** Why a circle (x, z, r) is not one ([] none; null: it is). */
const circle = (v: unknown): boolean =>
  Array.isArray(v) &&
  (v.length === 0 || (v.length === 3 && v.every((x) => finite(x, 1e4)) && (v[2] as number) > 0));

/** Why a beast cannot be taken (null: it can). */
function beastProblem(world: World, c: PopulationContext, args: unknown): string | null {
  const store = handOf(world);
  if (store.resting?.possessed || store.held)
    return "your hand is in a body already: let it go first";
  const a = args as Partial<BeastArgs> | null;
  if (!a || typeof a.village !== "string" || !c.settlements.get(a.village as Ref))
    return "village must be the town it was drawn about";
  if (typeof a.name !== "string" || !a.name.trim() || a.name.length > 80)
    return "a beast is called something";
  const kinds = a.kinds;
  if (!Array.isArray(kinds) || !kinds.length || kinds.length > 8)
    return "the kinds are one to eight lineages of the land's";
  if (!kinds.every((k) => beastOf(c, k))) return "a kind is a lineage of beasts of this world";
  const herds = a.herds;
  if (
    !Array.isArray(herds) ||
    herds.length % 3 ||
    herds.length > 16 * 3 ||
    !herds.every((x) => finite(x, 1e4))
  )
    return "the herds are x, z and flock each, sixteen at most";
  const v = a.bodies;
  if (
    !Array.isArray(v) ||
    !v.length ||
    v.length % WILD_PACKED ||
    v.length > WILD_MOST * WILD_PACKED ||
    !v.every((x) => finite(x, 1e6))
  )
    return `the bodies are ${WILD_PACKED} numbers each, ${WILD_MOST} at most`;
  for (let i = 0; i < v.length; i += WILD_PACKED)
    if (
      !Number.isInteger(v[i]) ||
      !Number.isInteger(v[i + 1]) ||
      v[i + 1]! < 0 ||
      v[i + 1]! >= kinds.length ||
      !Number.isInteger(v[i + 2]) ||
      v[i + 2]! < -1 ||
      v[i + 2]! >= herds.length / 3 ||
      Math.abs(v[i + 3]!) > 1e4 ||
      Math.abs(v[i + 4]!) > 1e4 ||
      Math.abs(v[i + 5]!) > 100
    )
      return "a body is one of a kind, of a herd, where it stands";
  const m = a.members;
  if (
    !Array.isArray(m) ||
    m.length !== v.length / WILD_PACKED ||
    !m.every((x) => Number.isInteger(x) && x >= -1 && x < 1000)
  )
    return "each body's member of the flock (-1: none), in the same order";
  if (!circle(a.water) || !circle(a.pasture)) return "water and pasture are x, z and r, or none";
  return null;
}

/** The small world's draws for a beast held. */
function drawsOf(world: World, h: Pick<HeldBeast, "from">): LocalDraw {
  const at = h.from * POSSESS_HZ;
  return (subject, step, purpose, n = 0) =>
    world.rng.real(HAND_WILD, subject, at + step, purpose, n);
}

/**
 * The small world of the beast held as the bids not yet sent would make it (the host's, for the page
 * between the seconds it sends): a copy stepped by them, or `onto` stepped on. Null: no beast is
 * held, or the bids are not.
 */
export function beastAhead(world: World, letters: string, onto?: WildWorld): WildWorld | null {
  const h = handOf(world).held;
  if (!h || h.kind !== "beast" || letters.length > POSSESS_HZ * 3) return null;
  const bids = bidsOf(letters);
  if (!bids) return null;
  const w = onto ?? copyWild(h.wild),
    draw = drawsOf(world, h);
  for (const bid of bids) stepWild(h.scene, w, bid, draw);
  return w;
}

/** Teach a peopled world the god's hand in a beast: "possess.beast" (stepped and let go as a soldier is). */
export function installWild(world: World, ctx: () => PopulationContext): void {
  const store = handOf(world);
  world.defineCommand({
    type: "possess.beast",
    validate: (args) => beastProblem(world, ctx(), args),
    apply: (command, t) => {
      const c = ctx(),
        a = command.args as BeastArgs,
        v = c.settlements.get(a.village as Ref)!,
        kinds = a.kinds.map((ref) => {
          const s = beastOf(c, ref)!;
          return { frame: wildFrame(s.body!, s.niche), niche: s.niche };
        }),
        herds: { x: number; z: number; flock: boolean }[] = [];
      for (let i = 0; i < a.herds.length; i += 3)
        herds.push({ x: a.herds[i]!, z: a.herds[i + 1]!, flock: a.herds[i + 2] === 1 });
      const at = (q: readonly number[]) => (q.length ? { x: q[0]!, z: q[1]!, r: q[2]! } : null),
        bodies = unpackWild(a.bodies),
        scene: WildScene = {
          kinds,
          herds,
          water: at(a.water),
          pasture: at(a.pasture),
          x: bodies[0]!.x,
          z: bodies[0]!.z,
        },
        species = beastOf(c, a.kinds[bodies[0]!.kind])!,
        event = world.events.emit({
          type: WILD_EVENTS.beast.type,
          subjects: [v.ref],
          place: c.provinces.get(v.cell)?.ref ?? cellRef(0, v.cell),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { name: a.name.trim(), kind: species.name, town: v.name },
        });
      // (A flock's beast lost by the hand is drawn again a year on: the older are let go.)
      if (store.strays.length) store.strays = store.strays.filter((s) => t - s.at < YEAR);
      store.held = {
        kind: "beast",
        command: command.id,
        event,
        from: t,
        village: v.ref,
        cell: v.cell,
        name: a.name.trim(),
        species: species.ref,
        kinds: [...a.kinds],
        scene,
        members: [...a.members],
        wild: wildWorld(bodies),
        inputs: [],
      };
    },
  });
}

/** Why a second's bids for the beast held cannot be taken (null: they can). */
export function beastBidsProblem(h: HeldBeast, args: unknown, whole: boolean): string | null {
  const a = args as Partial<{ step: number; steps: string }> | null;
  if (!a || a.step !== h.wild.step) return `out of step: it stands at step ${h.wild.step}`;
  if (
    typeof a.steps !== "string" ||
    (whole ? a.steps.length !== POSSESS_HZ * 3 : a.steps.length > POSSESS_HZ * 3) ||
    !bidsOf(a.steps)
  )
    return whole
      ? `a second's bids are ${POSSESS_HZ}, three letters each`
      : `the bids of a second begun: at most ${POSSESS_HZ}, three letters each`;
  return null;
}

/** The beast held stepped by a second's bids (fewer, letting go); let go where it went too far. */
export function stepBeast(
  world: World,
  c: PopulationContext,
  h: HeldBeast,
  steps: string,
  cause: Ref,
  t: SimTime,
  release: boolean,
): void {
  if (steps) {
    const draw = drawsOf(world, h);
    for (const bid of bidsOf(steps)!) stepWild(h.scene, h.wild, bid, draw);
    h.inputs.push({ at: t, steps });
  }
  if (release || h.wild.ended) ranOut(world, c, h, cause, t);
}

/** Which of a land's counts a kind of beast is of, by its way of life (host/village.ts faunaOf's). */
export function wildCount(
  niche: string,
): "wild" | "hunters" | "lesser" | "carrion" | "fish" | "small" {
  return niche === "hunter"
    ? "hunters"
    : niche === "small hunter"
      ? "lesser"
      : niche === "scavenger"
        ? "carrion"
        : niche === "swimmer"
          ? "fish"
          : niche === "seed-eater"
            ? "small"
            : "wild";
}

/** Let go of the beast: those of the flock killed or run off lost to it, the wild's killed off its land's count, told. */
function ranOut(world: World, c: PopulationContext, h: HeldBeast, cause: Ref, t: SimTime): void {
  const store = handOf(world),
    w = h.wild,
    v = c.settlements.get(h.village),
    kills = w.deeds.filter((d) => d.kind === "killed"),
    lost = h.members[0]! >= 0 && strayed(h.scene, w),
    strays: { member: number; how: "strayed" | "killed" }[] = [];
  store.held = null;
  if (lost) strays.push({ member: h.members[0]!, how: "strayed" });
  // The killed: of the flock, lost to it; of the wild, so much off the land's count of its kind.
  let wildKilled = 0;
  const eco = ecologyOf(world);
  for (const d of kills) {
    const i = w.bodies.findIndex((b) => b.id === d.id);
    if (i < 0) continue;
    const member = h.members[i]!;
    if (member >= 0) {
      strays.push({ member, how: "killed" });
      continue;
    }
    const count = wildCount(h.scene.kinds[w.bodies[i]!.kind]!.niche),
      next: Wilds = { ...wildsOf(c, h.cell) };
    next[count] = Math.max(0, next[count] - WILD_KILL);
    eco.set(next);
    wildKilled++;
  }
  const event = world.events.emit({
    type: WILD_EVENTS.ran.type,
    subjects: [h.village],
    place: c.provinces.get(h.cell)?.ref ?? cellRef(0, h.cell),
    causes: [
      { ref: cause, role: "agent", weight: 0.7 },
      { ref: h.event, role: "enabler", weight: 0.3 },
    ],
    data: {
      name: h.name,
      kind: c.generated.life.species.find((s) => s.ref === h.species)?.name ?? "",
      town: v?.name ?? "",
      seconds: Math.round(w.step / POSSESS_HZ),
      killed: kills.length,
      wild: wildKilled,
      flock: strays.filter((s) => s.how === "killed").length,
      ate: w.deeds.filter((d) => d.kind === "ate").length,
      drank: w.deeds.filter((d) => d.kind === "drank").length,
      called: w.deeds.filter((d) => d.kind === "called").length,
      courted: w.deeds.filter((d) => d.kind === "courted").length,
      strayed: lost,
      ended: w.ended || "let go",
    },
  });
  for (const s of strays) store.strays.push({ village: h.village, at: t, event, ...s });
}
