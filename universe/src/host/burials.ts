// Where a battle's fallen are buried (Phase 55 M225): a town's dead of a battle fought in its own land
// are borne from its square two days after the battle was watched, those of a battle in a land beside
// its own brought home and buried four days after, those of a battle farther off buried where they
// fell. Read from the battle's record — the town's tally of its men — never drawn: a battle of an older
// save, with no record of its men, buries no one by war.
import { DAY, type Ref, type World } from "../kernel/index.ts";
import { unpackTowns } from "../rules/index.ts";
import { handOf, populationContext, warsOf, type Battle, type War } from "../sim/index.ts";
import { WAR_BURIAL, type WarRest } from "../bridge/index.ts";
import { landTitle } from "./inspect/names.ts";

/** A battle of history, and its war. */
export type Fought = { readonly war: War; readonly b: Battle };
/** Where a land's dead of a battle lie: at home from the battle's own land, brought home from a land beside it, or on the field. */
export type Burial = "here" | "home" | "field";
/** Those of a battle's fallen known by name. */
export type Named = WarRest["named"];

type Index = {
  readonly count: number;
  readonly at: Map<string, readonly [War, number]>;
  readonly byYear: Map<number, (readonly [War, number])[]>;
};
const INDEX = new WeakMap<World, Index>();

/** Every battle by its event and by its year: rebuilt when one is fought (each read fresh from its war, whose towns may since have been let go). */
function indexOf(world: World): Index {
  const wars = warsOf(world).all();
  let count = 0;
  for (const w of wars) count += w.battles.length;
  const known = INDEX.get(world);
  if (known && known.count === count) return known;
  const at = new Map<string, readonly [War, number]>(),
    byYear = new Map<number, (readonly [War, number])[]>();
  for (const w of wars)
    w.battles.forEach((b, k) => {
      at.set(b.event, [w, k]);
      const list = byYear.get(b.year);
      if (list) list.push([w, k]);
      else byYear.set(b.year, [[w, k]]);
    });
  const built: Index = { count, at, byYear };
  INDEX.set(world, built);
  return built;
}

/** A battle by its event (null: none). */
export function battleOf(world: World, event: string): Fought | null {
  const e = indexOf(world).at.get(event);
  if (!e) return null;
  // (A battle the god fought in a soldier's body is named as history had it before him: its roll
  // as it was laid when he was taken, its men's fates by history but where his fight says — Phase 61.)
  return { war: e[0], b: handOf(world).foughtOf(event)?.was ?? e[0].battles[e[1]]! };
}

/** The battles of a year (fought at its turn), in their wars' order. */
export function battlesOfYear(world: World, year: number): Fought[] {
  return (indexOf(world).byYear.get(year) ?? []).map(([war, k]) => ({ war, b: war.battles[k]! }));
}

/** "the battle at Pounholt's land". */
export function battleWords(world: World, land: number): string {
  return `the battle at ${landTitle(world, land, true)}`;
}

/** Where a land's dead of a battle fought in `land` lie. */
export function burialOf(world: World, land: number, cell: number): Burial {
  if (cell === land) return "here";
  const grid = populationContext(world).generated.grid;
  for (let k = grid.offsets[land]!; k < grid.offsets[land + 1]!; k++)
    if (grid.neighbours[k] === cell) return "home";
  return "field";
}

/** Where they were buried, in words (`place`: their town's name, or their land's). */
export function burialWords(world: World, land: number, cell: number, place: string): string {
  const kind = burialOf(world, land, cell);
  return kind === "here"
    ? `buried in ${place} two days after the battle`
    : kind === "home"
      ? `brought home and buried in ${place} four days after the battle`
      : `buried where they fell, at ${battleWords(world, land)}`;
}

/** A town's men in a battle's side — sent, fallen, wounded who lived (null: no record of its towns, or its land not of that side). */
export function townTally(
  world: World,
  b: Battle,
  side: 0 | 1,
  town: string,
): [number, number, number] | null {
  const ctx = populationContext(world),
    s = ctx.settlements.get(town as Ref);
  if (!s || !b.fell) return null;
  const land = b.fell[side].find((l) => l[0] === s.cell);
  if (!land || land[4] === undefined) return null;
  const k = ctx.settlements.inProvince(s.cell).findIndex((t) => t.ref === s.ref),
    t = k < 0 ? undefined : unpackTowns(land[4])[k];
  return t ? [t[0], t[1], t[2]] : [0, 0, 0];
}

/** A town's fallen in the battles of a year, both sides, wherever they lie. */
export function townWarDead(world: World, town: string, year: number): number {
  let dead = 0;
  for (const { b } of battlesOfYear(world, year))
    for (const side of [0, 1] as const) dead += townTally(world, b, side, town)?.[1] ?? 0;
  return dead;
}

/** A town's war funerals of these battles: its fallen of each, buried here or brought home, the first first. */
export function restsFrom(
  world: World,
  town: string,
  fought: readonly Fought[],
  namesOf: (event: string, side: 0 | 1) => Named = () => [],
): WarRest[] {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s) return [];
  const out: WarRest[] = [];
  for (const { b } of fought)
    for (const side of [0, 1] as const) {
      const dead = townTally(world, b, side, town)?.[1] ?? 0,
        kind = burialOf(world, b.land, s.cell);
      if (dead <= 0 || kind === "field") continue;
      out.push({
        event: b.event,
        at:
          ((b.year + 1) * 365 + (kind === "here" ? WAR_BURIAL.near : WAR_BURIAL.home)) * DAY +
          WAR_BURIAL.leaves,
        dead,
        home: kind === "home",
        where: battleWords(world, b.land),
        named: namesOf(b.event, side).slice(0, WAR_BURIAL.named),
      });
    }
  return out.sort((p, q) => p.at - q.at || (p.event < q.event ? -1 : p.event > q.event ? 1 : 0));
}

/** The war funerals of a town's year `year`: those of the battles at its turn (year − 1). */
export function warRests(
  world: World,
  town: string,
  year: number,
  namesOf?: (event: string, side: 0 | 1) => Named,
): WarRest[] {
  return restsFrom(world, town, battlesOfYear(world, year - 1), namesOf);
}
