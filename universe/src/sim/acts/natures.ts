// Natures in the god's hand (Phase 16, asked for 2026-09-28: "I'm not able to modify the traits
// on nations or people or creatures"): a realm's ways pushed across all its lands at once; a
// person's ways of being (bold or cautious, warm or reserved, thrifty or free-handed, curious or
// set in their ways, patient or quick-tempered); a lineage's docility and growth — how readily it
// is tamed, how fast it breeds — which the herding of every land that has it reads. Each a
// logged command, cited by what follows; the pushes are kept in the acts store.
import { defineEventType, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { WAY, WAY_TRAITS, cultureOf, pushWays } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";
import { actsOf } from "./acts.ts";
import { WAYS_PUSH } from "./ways.ts";

export const NATURE_EVENTS = {
  realmWays: defineEventType("act.realm-ways", 5),
  nature: defineEventType("act.nature", 4),
};

/** The ways of being a person met is born with (their ends: bold/cautious, …). */
export const PERSON_NATURES = ["boldness", "warmth", "thrift", "curiosity", "patience"] as const;
/** What of a lineage the god may change: how readily it is tamed, how fast it breeds. */
export const LINEAGE_NATURES = ["docility", "growth"] as const;
/** How far one act pushes a nature. */
export const NATURE_PUSH = 0.25;

type RealmWaysArgs = { realm: Ref; way: (typeof WAY_TRAITS)[number]; sign: 1 | -1 };
type NatureArgs = { ref: string; trait: string; sign: 1 | -1 };

/** A nature as the world has it now: what it was born or bred with, and the god's pushes. */
export function natureOf(
  world: World,
  ref: string,
  base: Readonly<Record<string, number>>,
): Record<string, number> {
  const pushed = actsOf(world).nature(ref),
    out: Record<string, number> = { ...base };
  if (pushed)
    for (const [k, v] of Object.entries(pushed))
      out[k] = Math.max(0, Math.min(1, (out[k] ?? 0.5) + v));
  return out;
}

/** A lineage's docility and growth now, the god's pushes counted. */
export function lineageNature(
  world: World,
  s: { readonly ref: string; readonly docility: number; readonly growth: number },
): { docility: number; growth: number } {
  const n = natureOf(world, s.ref, { docility: s.docility, growth: s.growth });
  return { docility: n.docility!, growth: n.growth! };
}

/** Teach a peopled world the god's hand on natures. */
export function installNatureActs(world: World, ctx: () => PopulationContext): void {
  const agent = (command: { id: Ref }) => [{ ref: command.id, role: "agent" as const, weight: 1 }];

  // A realm's ways pushed across all its lands at once, their bases with them, so they last.
  world.defineCommand({
    type: "act.realm-ways",
    validate: (args) => {
      const a = args as Partial<RealmWaysArgs> | null,
        r = typeof a?.realm === "string" ? politiesOf(world).get(a.realm as Ref) : undefined;
      if (!r || r.ended !== null) return "a realm that stands is wanted";
      if (!(WAY_TRAITS as readonly string[]).includes(a!.way as string))
        return `a way is wanted: ${WAY_TRAITS.join(", ")}`;
      if (!r.members.some((c) => cultureOf(world).get(c))) return "its lands have no ways yet";
      return a!.sign === 1 || a!.sign === -1 ? null : "sign must be 1 or -1";
    },
    apply: (command, t) => {
      const { realm, way, sign } = command.args as RealmWaysArgs,
        r = politiesOf(world).get(realm)!,
        c = ctx(),
        trait = WAY[way],
        year = yearOfMoment(t),
        event = world.events.emit({
          type: NATURE_EVENTS.realmWays.type,
          subjects: [realm],
          place: c.provinces.get(r.seat)?.ref ?? null,
          causes: agent(command),
          data: { way, sign },
        });
      for (const cell of r.members) {
        const ways = cultureOf(world).get(cell);
        if (!ways) continue;
        pushWays(ways, { event, year, trait, amount: sign * WAYS_PUSH });
        ways.base[trait] = Math.max(0.02, Math.min(0.98, ways.base[trait]! + sign * WAYS_PUSH));
      }
    },
  });

  // A person's ways of being, or a lineage's docility and growth, pushed.
  world.defineCommand({
    type: "act.nature",
    validate: (args) => {
      const a = args as Partial<NatureArgs> | null,
        ref = String(a?.ref ?? "");
      if (a?.sign !== 1 && a?.sign !== -1) return "sign must be 1 or -1";
      if (ref.startsWith("prsn:"))
        return (PERSON_NATURES as readonly string[]).includes(String(a.trait))
          ? null
          : `a way of being is wanted: ${PERSON_NATURES.join(", ")}`;
      if (ref.startsWith("spec:")) {
        const s = ctx().generated.life.species.find((x) => x.ref === ref);
        if (!s || s.died !== null) return "a living lineage is wanted";
        if (s.niche === "seed grass") return "a beast is wanted, not a grass";
        if (s.niche === "upright ape") return "the people's own lineage is theirs, not the wild's";
        return (LINEAGE_NATURES as readonly string[]).includes(String(a.trait))
          ? null
          : `a nature is wanted: ${LINEAGE_NATURES.join(", ")}`;
      }
      return "a person met or a lineage is wanted";
    },
    apply: (command, t) => {
      const { ref, trait, sign } = command.args as NatureArgs,
        event = world.events.emit({
          type: NATURE_EVENTS.nature.type,
          subjects: [ref as Ref],
          place: null,
          causes: agent(command),
          data: { trait, sign, year: yearOfMoment(t) },
        });
      actsOf(world).pushNature(ref, trait, sign * NATURE_PUSH, event);
    },
  });
}
