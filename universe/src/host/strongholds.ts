// A town's strongholds and seats, read from what the world keeps (bridge/strongholds.ts says the rule; asked 2026-11-21): its
// realm's, where it is the seat, and those of the great houses seated in its land, where it is that land's greatest town.
// The battles that pressed its land are its realm's wars' battles fought on it or beside it; what each foe brought is read
// off what that foe knew when it came, and off the arms its host fought with. Nothing kept.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import {
  designsOf,
  housesOf,
  landReach,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  type Polity,
} from "../sim/index.ts";
import { PRINCIPLES, performanceOf } from "../rules/index.ts";
import {
  BROUGHT,
  holdOf,
  holdWhys,
  type Brought,
  type HoldFacts,
  type HoldThreat,
  type TownHold,
} from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { houseRef } from "./family.ts";
import { landMadeHead } from "./home.ts";
import { spareOf } from "./form.ts";
import { houseColor } from "./rank.ts";

/** How far back a land's battles are read (years), and the most read a stronghold. */
const HISTORY = 700,
  MOST_THREATS = 400;
/** The most great houses' seats drawn about a town. */
const MOST_HOUSES = 3;
/** The share of its land's rent a house must hold for its land to be an estate (its tenants in a hamlet by its seat). */
export const ESTATE_LAND = 120;

/**
 * What throws at walls, by principle: the principles whose `sieges` effect is shot (black powder: the sim's only siege power
 * that throws), the rest of them engines.
 */
const SHOT = new Set(["gunpowder"]),
  ENGINES = PRINCIPLES.filter((p) => (p.effects.sieges ?? 0) > 0 && !SHOT.has(p.id)).map(
    (p) => p.id,
  );

/** What a foe brought to a battle in year `year`: read off what its seat knew then, and off the arms its host bore. */
function broughtBy(
  world: World,
  foe: Polity | undefined,
  year: number,
  design: Ref | null | undefined,
  rockets: boolean,
): Brought {
  if (rockets) return BROUGHT.beyond;
  const d = design ? designsOf(world).get(design) : undefined;
  if (d) {
    const does = performanceOf(d.parts);
    if ((does.firepower ?? 0) > 0 || (does.breach ?? 0) > 0) return BROUGHT.beyond;
  }
  if (!foe) return BROUGHT.hands;
  const lore = loreOf(world),
    knew = (id: string) => {
      const k = lore.get(foe.seat, id);
      return !!k && k.year <= year;
    };
  for (const id of SHOT) if (knew(id)) return BROUGHT.shot;
  return ENGINES.some(knew) ? BROUGHT.engines : BROUGHT.hands;
}

/** The battles of a realm's wars fought on a land (weight 1) or beside it (0.5), oldest first. */
function threatsOn(world: World, realm: Polity, cell: number): HoldThreat[] {
  const ctx = populationContext(world),
    g = ctx.generated.grid,
    near = new Set<number>();
  for (let k = g.offsets[cell]!; k < g.offsets[cell + 1]!; k++) near.add(g.neighbours[k]!);
  const now = Math.floor(world.now / YEAR),
    wars = warsOf(world),
    realms = politiesOf(world),
    out: HoldThreat[] = [];
  for (const w of wars.of(realm.ref)) {
    const ended = w.ended ?? now;
    if (ended < now - HISTORY) continue;
    const ours = w.attacker === realm.ref ? 0 : 1,
      foeRef = ours === 0 ? w.defender : w.attacker,
      foe = realms.get(foeRef),
      rockets = wars.thrownIn(w.ref) > 0;
    for (const b of w.battles) {
      const weight = b.land === cell ? 1 : near.has(b.land) ? 0.5 : 0;
      if (!weight || b.year < now - HISTORY) continue;
      out.push({
        year: b.year,
        brought: broughtBy(world, foe, b.year, b.designs?.[1 - ours], rockets),
        weight,
        event: b.event,
        ...(foe ? { foe: realmName(foe) } : {}),
      });
      if (out.length >= MOST_THREATS) break;
    }
  }
  return out.sort((a, b) => a.year - b.year);
}

/** A town's strongholds and seats (empty: none). `seat`: whether its realm is seated in it; `heart`: it is its land's greatest. */
export function townHolds(
  world: World,
  ref: Ref,
  realm: Polity | undefined,
  cell: number,
  seat: boolean,
  heart: boolean,
): TownHold[] {
  if (!realm || realm.ended !== null) return [];
  const ctx = populationContext(world),
    now = Math.floor(world.now / YEAR),
    lore = loreOf(world),
    walls = lore.effect(cell, "walls"),
    reach = landReach(ctx, cell),
    spare = spareOf(landMadeHead(world, cell)),
    land = `the land about ${ctx.settlements.get(ref)?.name ?? "it"}`,
    out: TownHold[] = [];
  let threats: HoldThreat[] | null = null;
  const pressed = () => (threats ??= threatsOn(world, realm, cell));
  if (seat) {
    const facts: HoldFacts = {
        holder: "realm",
        threats: pressed(),
        now,
        walls,
        // (A realm pays from its seat land's spare and from its lands.)
        means: Math.min(1, 0.5 * spare + 0.5 * Math.min(1, realm.members.length / 8)),
        reach,
        holds: true,
      },
      hold = holdOf(facts),
      name = realmName(realm);
    if (hold.form || hold.show)
      out.push({
        holder: "realm",
        name,
        ref: realm.ref,
        color: realmColor(realm.ref),
        hold,
        whys: holdWhys(hold, facts, name, land),
        k: 0,
      });
  }
  const kept = heart ? housesOf(world)?.of(realm.ref) : undefined;
  if (kept) {
    let all = 0;
    for (const h of kept.houses) all += h.wealth;
    const here = kept.houses
      .filter((h) => h.seat === cell && !h.crown)
      .sort((a, b) => b.wealth - a.wealth || a.id - b.id)
      .slice(0, MOST_HOUSES);
    for (const h of here) {
      const share = all > 0 ? h.wealth / all : 0,
        facts: HoldFacts = {
          holder: "house",
          threats: pressed(),
          now,
          walls,
          // (A house pays from its share of the houses' wealth and the rent of its land.)
          means: Math.min(1, 1.6 * share + 0.25 * spare + h.land / 2000),
          reach,
          holds: true,
        },
        hold = holdOf(facts),
        name = `the house of ${h.name}`;
      if (!hold.form && !hold.show) continue;
      out.push({
        holder: "house",
        name,
        ref: houseRef(realm.ref, h.event),
        color: houseColor(realm.ref, h.name),
        hold,
        whys: holdWhys(hold, facts, name, land),
        ...(h.land >= ESTATE_LAND ? { hamlet: Math.min(9, 3 + Math.floor(h.land / 80)) } : {}),
        k: out.length,
      });
    }
  }
  return out;
}
