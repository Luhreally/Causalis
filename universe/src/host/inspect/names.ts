// Names as links (Phase 10 M91): a land by its first town, a realm, a faith, a tongue, a
// lineage, a town — each the words a page says it in, opening its own page.
import { cellRef, isProvinceWorld, offworldSite } from "../../gen/index.ts";
import {
  beliefOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
} from "../../sim/index.ts";
import { landWords, observer, why } from "../../causal/index.ts";
import { isRef, type Ref, type World } from "../../kernel/index.ts";
import type { Span } from "../../bridge/index.ts";
import { link, sentence } from "./words.ts";

/** How many lands the world has of its own (its offworld sites come after them). */
export function landsOf(world: World): number {
  return homePlanet(world).generated.offworld.base;
}

/** A land's name: its first town's land, or where it lies. */
export function landTitle(world: World, cell: number): string {
  const g = homePlanet(world).generated;
  if (offworldSite(g, cell)) return sentence(landWords(world, cellRef(0, cell)));
  const first = populationContext(world).settlements.inProvince(cell)[0];
  return first ? `${first.name}'s land` : sentence(landWords(world, cellRef(0, cell)));
}

/** A land as a link. */
export function landLink(world: World, cell: number): Span {
  return link(landTitle(world, cell), cellRef(0, cell));
}

/** The province a fine spot is part of. */
export function landOfSpot(world: World, spot: number): number {
  const g = homePlanet(world).generated;
  return isProvinceWorld(g) ? g.provinceOf[spot]! : spot;
}

/** A land's middle, as a spot of the fine grid (for the globe to turn to). */
export function spotOfLand(world: World, cell: number): number | null {
  const g = homePlanet(world).generated,
    s = isProvinceWorld(g) ? g.centre[cell] : cell;
  return s === undefined || s < 0 ? null : s;
}

/** A realm as a link (a fallen one in words). */
export function realmLink(world: World, ref: string | null | undefined): Span {
  const r = ref ? politiesOf(world).get(ref as Ref) : undefined;
  return r ? link(realmName(r), r.ref) : "a realm now gone";
}

/** A town as a link. */
export function townLink(world: World, ref: string | null | undefined): Span {
  const t = ref ? populationContext(world).settlements.get(ref as Ref) : undefined;
  return t ? link(t.name, t.ref) : "a town now gone";
}

/** A faith as a link. */
export function faithLink(world: World, ref: string | null | undefined): Span {
  const f = ref ? beliefOf(world).get(ref as Ref) : undefined;
  return f ? link(f.name, f.ref) : "the old beliefs";
}

/** A language as a link. */
export function languageLink(world: World, ref: string | null | undefined): Span {
  const l = ref ? languagesOf(world).get(ref as Ref) : undefined;
  return l ? link(l.name, l.ref) : "a tongue now gone";
}

/** A lineage as a link. */
export function lineageLink(world: World, index: number): Span {
  const s = homePlanet(world).generated.life.species[index];
  return s ? link(s.name, s.ref) : "a lineage";
}

/** A lineage's icon, by what it is. */
export function lineageIcon(niche: string, flies = false): string {
  if (flies) return "🦅";
  switch (niche) {
    case "seed grass":
      return "🌾";
    case "grazer":
      return "🐄";
    case "browser":
      return "🦌";
    case "great beast":
      return "🐘";
    case "hunter":
      return "🐺";
    case "small hunter":
      return "🦊";
    case "scavenger":
      return "🦅";
    case "seed-eater":
      return "🐇";
    case "swimmer":
      return "🐟";
    case "upright ape":
      return "🧑";
    default:
      return "🐾";
  }
}

/** A short name for any ref, as a line would say it (its explainer's words, cut short, if nothing better). */
export function nameOf(world: World, ref: string): string {
  const code = ref.slice(0, ref.indexOf(":")),
    n = Number(ref.split(":")[2]);
  try {
    switch (code) {
      case "cell":
        return landTitle(world, n);
      case "town":
        return populationContext(world).settlements.get(ref as Ref)?.name ?? "a town now gone";
      case "pol": {
        const r = politiesOf(world).get(ref as Ref);
        return r ? realmName(r) : "a realm now gone";
      }
      case "war": {
        const w = warsOf(world).get(ref as Ref),
          realms = politiesOf(world),
          a = w ? realms.get(w.attacker) : undefined,
          d = w ? realms.get(w.defender) : undefined;
        return w
          ? `the war of ${a?.town ?? "the fallen"} upon ${d?.town ?? "the fallen"}`
          : "a war";
      }
      case "faith":
        return beliefOf(world).get(ref as Ref)?.name ?? "a faith";
      case "lang":
        return languagesOf(world).get(ref as Ref)?.name ?? "a tongue";
      case "spec":
        return (
          homePlanet(world).generated.life.species.find((s) => s.ref === ref)?.name ?? "a lineage"
        );
      case "prsn": {
        const p = observer(world).person(ref as Ref);
        return p ? `${p.name} ${p.surname}` : "someone";
      }
      case "hhold": {
        const h = observer(world).household(ref as Ref);
        return h ? `the ${h.surname} household` : "a household";
      }
      case "plnt":
      case "moon":
        return (
          homePlanet(world).generated.system.bodies.find((b) => b.ref === ref)?.designation ??
          "a world"
        );
    }
  } catch {
    // (Fall through to the explainer's words.)
  }
  if (!isRef(ref)) return ref;
  const claim = why(world, ref).claim;
  return claim.length > 60 ? `${claim.slice(0, 57)}…` : claim;
}

/** Any ref as a link, by its short name. */
export function refLink(world: World, ref: string): Span {
  return link(nameOf(world, ref), ref);
}
