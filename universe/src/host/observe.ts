// The observer's queries (docs/architecture §14): meet a family in a village, list
// the families met, and a person's page — who they are, the life they lived, what
// they remember and what kind of person it made them. Meeting someone writes only to
// the observer ledger, which history never reads, so looking never changes history.
import { YEAR, type Ref, type World } from "../kernel/index.ts";
import { HUMANLIKE } from "../rules/index.ts";
import { populationContext } from "../sim/index.ts";
import {
  LIFE_WORDS,
  MEMORY_WORDS,
  TRAITS,
  deepen,
  landWords,
  meetHousehold,
  observer,
  resolvePerson,
  setWatch,
  settleAll,
  tidings,
  watches,
  type Household,
  type Person,
} from "../causal/index.ts";
import type { QueryHandler } from "./host.ts";

const OCCUPATION_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
/** Each trait said low / middling / high. */
const TRAIT_WORDS: Readonly<Record<string, readonly [string, string, string]>> = {
  boldness: ["cautious", "steady", "bold"],
  warmth: ["reserved", "civil", "warm"],
  thrift: ["free-handed", "careful with food", "thrifty"],
  curiosity: ["set in their ways", "open to new ways", "curious"],
  patience: ["quick-tempered", "even-tempered", "patient"],
};

function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

function nowYear(world: World): number {
  return Math.floor(world.now / YEAR);
}

function villageName(world: World, ref: Ref | null): string | null {
  return ref ? (populationContext(world).settlements.get(ref)?.name ?? null) : null;
}

function brief(world: World, p: Person) {
  const now = nowYear(world),
    age = (p.alive ? now : (p.diedYear ?? now)) - p.birthYear;
  return {
    ref: p.ref,
    name: `${p.name} ${p.surname}`,
    role: p.role,
    sex: p.sex === 0 ? "woman" : "man",
    age,
    grownUp: age >= HUMANLIKE.adulthood,
    occupation: OCCUPATION_WORDS[p.occupation] ?? "",
    alive: p.alive,
    diedYear: p.diedYear,
    village: villageName(world, p.village),
  };
}

function household(world: World, hh: Household) {
  const ledger = observer(world);
  return {
    ref: hh.ref,
    surname: hh.surname,
    village: villageName(world, hh.village),
    metIn: hh.metIn,
    members: hh.members.map((r) => brief(world, ledger.person(r)!)),
  };
}

function traitWords(traits: Record<string, number>): string[] {
  return TRAITS.map((t) => {
    const v = traits[t] ?? 0.5,
      words = TRAIT_WORDS[t]!;
    return v < 0.35 ? words[0] : v > 0.65 ? words[2] : words[1];
  }).filter((w, i) => {
    const v = traits[TRAITS[i]!] ?? 0.5;
    return v < 0.35 || v > 0.65;
  });
}

function personPage(world: World, ref: Ref) {
  const p = resolvePerson(world, ref, 4),
    ledger = observer(world),
    hh = ledger.household(p.household)!;
  return {
    ...brief(world, p),
    birthYear: p.birthYear,
    bornIn: landWords(world, `cell:0:${p.birthCell}` as Ref),
    bornBeforeChronicle: p.bornBeforeChronicle,
    livesIn: landWords(world, `cell:0:${p.cell}` as Ref),
    moves: p.moves.map((m) => ({
      year: m.year,
      from: landWords(world, `cell:0:${m.from}` as Ref),
      to: landWords(world, `cell:0:${m.to}` as Ref),
      event: m.event,
    })),
    household: {
      ref: hh.ref,
      surname: hh.surname,
      members: hh.members.filter((r) => r !== p.ref).map((r) => brief(world, ledger.person(r)!)),
    },
    life: (p.life ?? []).map((l) => ({
      year: l.year,
      age: l.age,
      words: LIFE_WORDS[l.kind] ?? l.kind,
      event: l.event,
    })),
    memories: (p.memories ?? []).map((m) => ({
      ref: m.ref,
      words: `${sentence(MEMORY_WORDS[m.kind] ?? m.kind)}, in year ${m.year}, at ${m.age}`,
    })),
    character: traitWords(p.traits ?? {}),
  };
}

export const OBSERVE_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** Meet a family in a village (or among a province's people when `village` is null). */
  "observe.meet": (world, args) => {
    const a = args as { cell: number; village: string | null };
    const hh = meetHousehold(world, a.cell, a.village as Ref | null);
    for (const r of hh.members) deepen(world, observer(world).person(r)!);
    return household(world, hh);
  },
  /** The families met in a village, followed to now. */
  "observe.households": (world, args) => {
    const village = (args as { village: string }).village as Ref;
    settleAll(world);
    const ledger = observer(world),
      v = populationContext(world).settlements.get(village);
    const met = ledger.allHouseholds().filter((h) => h.village === village);
    return {
      households: met.map((h) => household(world, h)),
      unmet: v ? Math.max(0, v.population - ledger.claimedIn(village)) : 0,
    };
  },
  "observe.person": (world, args) => personPage(world, (args as { ref: string }).ref as Ref),
  /** Follow something (a land, a village, a realm, a person met), or stop; answers what is followed. */
  "observe.watch": (world, args) => {
    const a = args as { ref: string; on: boolean };
    setWatch(world, a.ref as Ref, a.on);
    return watches(world);
  },
  "observe.watches": (world) => watches(world),
  /** What has happened to what is followed since last told. */
  "observe.tidings": (world) => tidings(world),
};
