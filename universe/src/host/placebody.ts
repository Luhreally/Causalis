// One's body, what it is made of and how it lives, and what it is written in (town mode, R4), as Classic's organism
// inspector had it: read off the world's own life (gen/life.ts worldLife: the liquid its life is dissolved in, its
// sugars and their hand, what it breathes and carries its breath on, what hardens its bones, the skins of its cells), the
// people's body (gen/biosphere.ts: its plan, its span, its lineage and the forebear it rose from), and the person (their
// age, sex, weight and health). The shares of a body by what it is made of are an estimate (est.: a warm body's as a
// person's of Earth is, a cold one's leaner). Read only.
import { DAY, type World } from "../kernel/index.ts";
import {
  BLOOD_WORDS,
  BONE_WORDS,
  CLADES,
  FAMILY_WORDS,
  FEMALE,
  HAND_WORDS,
  MEMBRANE_WORDS,
  bodyWords,
  findSubstance,
  needsOf,
  type BodyPlan,
} from "../rules/index.ts";
import { worldLife } from "../gen/index.ts";
import { homePlanet } from "../sim/index.ts";
import { placeBodyRef, placePersonRef, type PlaceInspectBody } from "../bridge/index.ts";
import { placeIndexOf, type Place } from "./place.ts";
import { placeWho } from "./placeplan.ts";

/** Where a body's liquid stays liquid at one air's weight, °C (est.): its life's own liquid. */
const LIQUID_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  water: [0, 100],
  ammonia: [-78, -33],
  methane: [-182, -161],
  oil: [-40, 300],
};
/** A body's shares by what it is made of (est.): its liquid, its flesh, its fat, its bones' mineral, the rest. */
const SHARES_WARM = [0.6, 0.18, 0.15, 0.05, 0.02] as const,
  SHARES_COLD = [0.66, 0.2, 0.07, 0.05, 0.02] as const;

const named = (id: string) => findSubstance(id)?.name ?? id;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One's body and what it is written in (R4; null: none of the town by that number). */
export function placeBody(world: World, place: Place, id: number): PlaceInspectBody | null {
  const i = placeIndexOf(place, id);
  if (i < 0) return null;
  const p = place.people,
    g = homePlanet(world).generated,
    life = worldLife(g),
    needs = needsOf(life),
    people = g.life.people,
    ape = CLADES.find((c) => c.id === "ape")!.body as unknown as BodyPlan,
    body: BodyPlan = people?.body ?? ape,
    age = Math.max(0, (place.t / DAY - p.born[i]!) / 365),
    female = p.sexOcc[i]! >> 4 === FEMALE,
    // (A child's weight grows to its people's grown weight by eighteen: est.)
    kg = Math.max(1, Math.round(body.size * Math.min(1, (age + 2) / 20) * (female ? 0.9 : 1))),
    shares = body.warm ? SHARES_WARM : SHARES_COLD,
    family = FAMILY_WORDS[life.family],
    blood = BLOOD_WORDS[life.blood],
    bone = BONE_WORDS[life.bone],
    skin = MEMBRANE_WORDS[life.membrane],
    hand = HAND_WORDS[life.hand],
    range = LIQUID_RANGE[life.family] ?? LIQUID_RANGE.water!,
    made: readonly (readonly [string, number, string])[] = [
      [cap(named(life.liquid)), shares[0], "the liquid their life is dissolved in"],
      [cap(named(life.flesh)), shares[1], "their flesh"],
      ["Fat", shares[2], "their food stored"],
      [cap(bone.name), shares[3], `their bones' mineral, ${bone.why}`],
      ["Salts and the rest", shares[4], "what their liquid carries"],
    ],
    species = people ? g.life.species[people.species] : undefined,
    forebear = people?.forebear !== undefined ? g.life.species[people.forebear] : undefined,
    who = placeWho(world, place)(i);
  const metabolism: [string, string][] = [
    ["Eats", cap(needs.food)],
    [
      "Burns it with",
      life.breath === "oxygen"
        ? "Oxygen from the air, breathing out carbon dioxide and water"
        : "Hydrogen from the air, breathing out methane",
    ],
    [
      "Blood",
      `${cap(blood.colour)}: it carries their breath on ${blood.subst} (${blood.name}). ${cap(blood.why)}`,
    ],
    [
      "Stores",
      life.sugar
        ? `Fat, and ${named(life.sugar)} in their flesh`
        : "Fat: their liquid dissolves no sugar",
    ],
    [
      "Poisons",
      needs.poisons.length
        ? cap(needs.poisons.join(" and "))
        : "None of their world's own air and water",
    ],
    [
      "Warmth",
      `${body.warm ? "They keep their own warmth" : "They take their warmth from what is about them"}; their bodies' ${family.liquid} stays liquid between ${range[0]} and ${range[1]} °C`,
    ],
  ];
  if (p.health[i])
    metabolism.push(["Now", p.health[i] === 2 ? "Sick" : "Hurt, or mending a wound"]);
  const genome: [string, string][] = [
    [
      "Written in",
      life.backbone
        ? `Chains of silicon's (${life.backbone}s), in ${family.liquid}`
        : `Chains of bases strung on ${family.sugars}: ${hand.sugars} and ${hand.proteins}, ${hand.as}`,
    ],
    ["Cells", `${cap(skin.name)}. ${cap(skin.why)}`],
    ["Bones", `${cap(bone.name)} (${bone.subst})`],
    ["Kind", `${cap(body.name)}, of the ${body.clade}`],
  ];
  if (species)
    genome.push([
      "Lineage",
      `${cap(species.name)}, risen ${species.arose === 0 ? "in the first age" : `in age ${species.arose}`}${forebear ? `, of the ${forebear.name}` : ""}`,
    ]);
  genome.push([
    "Their own",
    `${female ? "Female" : "Male"}, ${Math.floor(age)} years: ${age < 16 ? "still growing" : age > body.span * 0.7 ? "in their age" : "grown"}`,
  ]);
  return {
    kind: "body",
    ref: placeBodyRef(place.town, id),
    personRef: placePersonRef(place.town, id),
    name: `${who.name}: body and making`,
    icon: "🧬",
    sub: `${female ? "Female" : "Male"}, ${Math.floor(age)} of a span of ${body.span} years · about ${kg} kg`,
    body: cap(bodyWords(body)),
    madeOf: made.map(([what, share, words]) => ({
      what,
      share: Math.round(share * 100),
      kg: Math.round(kg * share * 10) / 10,
      words,
    })),
    metabolism,
    genome,
  };
}
