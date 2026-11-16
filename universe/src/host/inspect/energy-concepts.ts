// The book of concepts on a land's energy (Round A; sim/economy/energy.ts, rules/energy.ts): the account itself, and the heat
// engine. Each says how the world works it, as it does; every number is the rule's own.
import {
  BEAST_WORK,
  COOK_KW,
  FOOD_KW,
  FUEL_UNIT_KWY,
  MUSCLE_WORK,
  WARM_KW,
  WOOD_TAKEN,
  WORK_KW,
  craftShare,
  heldHeat,
} from "../../rules/index.ts";
import {
  ACID_FIFTH,
  BEANS_GIVE,
  MANURE_GIVES,
  METAL_FIFTH,
  SALT_HALF,
  TAKEN,
  WASHED,
} from "../../rules/index.ts";
import type { Concept } from "./concepts.ts";

const pc = (x: number) => `${Math.round(x * 100)}`;

export const ENERGY_CONCEPTS: Readonly<Record<string, Concept>> = {
  energy: {
    icon: "🔥",
    title: "A land's energy",
    what: [
      `Each land keeps one account a year of what it draws on, and from where. Its people eat ${FOOD_KW} kW each (by their kind's appetite) and turn ${pc(MUSCLE_WORK)} in a hundred of what its workers eat into work; its beasts that pull eat by their weight (Kleiber's law) and turn ${pc(BEAST_WORK)} in a hundred of it. Its hearths want ${COOK_KW} kW a head to cook and up to ${WARM_KW} more to keep warm where it is cold, and its smelters heat by the metal they make; its works want ${WORK_KW} kW of work for each crafter at their industry, its engine-driven carriers and its homes beside.`,
      `It draws the nearest first. Its woods give ${pc(WOOD_TAKEN)} in a hundred of what they grow a year without thinning (what grows is read off its warmth, its rain and its star's light); then its herds' dung and its fields' straw; then the coal and oil its market holds, a unit of either ${FUEL_UNIT_KWY} kW for a year; past all that, it fells its woods. What flows (a river's fall, the wind, the tides) is turned by mills and, once dynamos carry it, by turbines on its dammed rivers and its tides, and on its winds once blades are light and strong enough to stand in a gale (shaped as a wing, of glass-fibre or carbon); the ground's heat, a sea floor's vents, the star's light gathered in mirrors, the atom and a held flame each drive engines where a people has learned to tap them.`,
      `The heat in a fuel is its reaction's: the heats of formation of what goes in and what comes out, burned with whatever its world's air holds to burn with. Wood, coal and oil burn in oxygen; a methane world's haze joins with its air's hydrogen; on a world whose air holds neither, nothing burns, and its people's works run on what flows and what rises from the ground.`,
    ],
    drives: [
      "Its people, beasts and herds; its woods, rivers, wind, tides, ground and star; the fuel its crust buried.",
      "What its people know how to tap, and the engines its stuffs and fits allow.",
    ],
    leads: [
      "Its works' power (and so what its crafters make), the machines it wants, the coal and oil its market wants.",
      "Woods felled; carbon and smoke in its air; the ages of steam, oil and the dynamo, read off where its account stands.",
    ],
    see: [{ text: "Its ages", ref: "world:means" }],
    related: ["heat-engine", "climate", "markets", "ages", "matter"],
  },
  "heat-engine": {
    icon: "⚙️",
    title: "The heat engine",
    what: [
      `No engine turns more of a heat into work than Carnot's bound, one less the cold it sheds its heat to over the heat it holds, both counted from the absolute zero. So a colder world's engines do better on the same fire, and a hotter fire better than a cooler one, but only as hot as the engine's stuffs bear: wrought iron's boilers about ${Math.round(heldHeat(370))} °C, steel's ${Math.round(heldHeat(800))} °C, the arc's alloys ${Math.round(heldHeat(1200))} °C.`,
      `A people's craft takes its engines only part of the way to that bound, by the finest fit they can make: ${pc(craftShare(0.1))} in a hundred of it at a tenth of a millimetre (steam leaks past every piston), ${pc(craftShare(0.02))} at a fiftieth, ${pc(craftShare(0.002))} at the fits of a gyroscope. Coal and steam on Earth turn some two in a hundred of their heat into work; the turbines of the age of guidance, near half.`,
    ],
    drives: ["The hottest stuff a people works; its finest fit; its world's cold."],
    leads: ["How much a land burns for the work its works want."],
    see: [],
    related: ["energy", "matter", "ages"],
  },
  "field-ground": {
    icon: "🌱",
    title: "What feeds a field",
    what: [
      `A field's ground holds nitrogen, phosphorus and potassium, each a stock against what it held before anyone farmed it, and the field gives by the one that stands lowest. A year's full harvest takes ${pc(TAKEN.N)} in a hundred of its nitrogen, ${pc(TAKEN.P)} of its phosphorus, ${pc(TAKEN.K)} of its potassium (to a tenth of a part); ground left unfarmed comes back, as fast as its world's crust holds the rock's share of each and its air the nitrogen its life fixes. Beans in a rotation give back ${pc(BEANS_GIVE)} in a hundred of the nitrogen taken, the dung of its herds ${pc(MANURE_GIVES.N)} of the nitrogen and ${pc(MANURE_GIVES.P)} of the phosphorus and potassium, a people with a current and vessels strong enough fix nitrogen from the air, at the work it takes, and where engines haul bulk, rock dug for phosphorus and potassium is spread on the fields. Each step a field's scarcest nutrient falls costs more of its yield than the one before (Mitscherlich's law): worn by a fifth, it gives some 6% less; by half, a fifth less.`,
      `Its topsoil is washed off by its rain, as hard as the rain falls, as steep as the land, as bare as its fields leave it (some ${(WASHED * 100).toFixed(1)} in a hundred a year, ploughed on a gentle slope under a metre of rain; terraces halve it, woods hold it); what washes off is laid down on the flat land its river runs to, with the nutrients it carries. Where its fields are watered past the rain, the water comes from its river and then from under its ground, and leaves its salt behind where the rain is too little to wash it out: at ${SALT_HALF.toLocaleString("en-US")} tonnes a square kilometre a field gives half.`,
    ],
    drives: [
      "Its harvests; rest, beans, dung, fertiliser; its rain, slopes and woods; its rivers and groundwater.",
    ],
    leads: ["Its soil's strength, and so its food."],
    see: [],
    related: ["fouled-ground", "food", "energy", "matter"],
  },
  "fouled-ground": {
    icon: "☣️",
    title: "Fouled ground",
    what: [
      `The sulphur a land burns comes down as sour rain, most of it on the land itself and the rest on its neighbours, and its rock takes it up in a few years; held at ${ACID_FIFTH} kg a hectare its fields and woods give a fifth less. Its smelters lose metals to its ground and water, and its rivers carry them to the lands below, where they are bound into the silt in time; at ${METAL_FIFTH} kg a hectare its fields give a fifth less, and its people drink them. The dug heaps of its coal weather sour.`,
    ],
    drives: ["Coal and oil burned; metal smelted; coal dug; the lands upriver."],
    leads: ["Less from its fields; worse health; time to undo it."],
    see: [],
    related: ["field-ground", "energy", "climate"],
  },
};

/** Which concept a number is a measure of, by its label on the pages. */
export const ENERGY_CONCEPT_OF: Readonly<Record<string, string>> = {
  "All told": "energy",
  "Its works run on": "energy",
  "Work turned": "energy",
  "Its engines turn": "heat-engine",
  "Energy a head": "energy",
  Nitrogen: "field-ground",
  Phosphorus: "field-ground",
  Potassium: "field-ground",
  Topsoil: "field-ground",
  "Its groundwater": "field-ground",
  "Sour rain held": "fouled-ground",
  "Metals in its ground and water": "fouled-ground",
  Fouled: "fouled-ground",
};
