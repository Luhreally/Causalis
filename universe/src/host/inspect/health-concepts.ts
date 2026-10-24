// The book of concepts on sickness (Phase 20 M140): what a sickness is and how it travels, what an
// outbreak and a great dying are, how the survivors are spared, what healers and drains do, and
// why the bound die the more. Each says how the world works it, as it does.
import type { Concept } from "./concepts.ts";

const LEDGER = { text: "Every sickness, side by side", ref: "world:ledger#sickness" };

export const HEALTH_CONCEPTS: Readonly<Record<string, Concept>> = {
  sickness: {
    icon: "🦠",
    title: "Sickness",
    what: [
      "A sickness is a thing of its own, with a name and a nature: how it passes — on the breath, in foul water, by vermin, by touch — how many of those it reaches take it, how many of those die, and how long the survivors are spared it.",
      "It rises where life crowds: among herds kept close, in great crowded towns, in hot wet marshes. Most sicknesses are mild; a few of those whose survivors are spared for life are terrible — one that spares them only for some years kills few. Unseen for a generation it sleeps where it rose, and wakes there now and then; unseen for two centuries, it is gone.",
    ],
    drives: [
      "Herds, great towns and hot marshes, and many people among them.",
      "Strangers come down from the stars, with the sicknesses of their own world.",
      "The god may loose one, or make a new one.",
    ],
    leads: [
      "Outbreaks, land after land, and their dead.",
      "Grief laid on a realm, a people turned to their gods, and from strangers.",
    ],
    see: [LEDGER],
    related: ["outbreak", "immunity", "great-dying", "healers", "drains", "star-sickness"],
  },
  outbreak: {
    icon: "🔥",
    title: "An outbreak",
    what: [
      "A sickness comes to a land by what carries it: from the land next door, down a trade road, over the sea, or with an army on the march. Each year it goes on from every land it came to the year before.",
      "Whether it takes hold is a draw weighed by its carrier, how many it reaches, how few of the land's people are spared it, how crowded and how hungry they are — and, for a sickness of foul water, whether they have drains and clean water; for one of vermin, whether the land is warm. A people who keep the sick apart are reached half as often.",
    ],
    drives: [
      "Trade roads and sea routes, armies, neighbours.",
      "Crowding and hunger; none spared it.",
    ],
    leads: [
      "Of those it reaches who are not spared it, a share take it; of those, a share die — the small and the old the most.",
      "Those who survive are spared it, for a while or for life.",
    ],
    see: [LEDGER],
    related: ["sickness", "immunity", "great-dying", "unequal-dying"],
  },
  immunity: {
    icon: "🛡️",
    title: "Being spared",
    what: [
      "Those who take a sickness and live are spared it after — for life, for some sicknesses; for some years, for others. Each land keeps, for each sickness, the share of its people spared it.",
      "The spared forget as the years pass, and their children are born never having had it: so a sickness that burned out comes again on a generation that never knew it.",
    ],
    drives: [
      "A sickness survived; the god's ward.",
      "Vaccination: where a people know it, their young are given each sickness the spared are spared for life, in a mild form — so the spared of it rise year by year, toward most of them.",
    ],
    leads: [
      "A sickness that comes to a land of the spared takes few, and goes on the less.",
      "A people who never met a sickness — across the sea, at the end of a new road — die of it in great numbers.",
    ],
    see: [LEDGER],
    related: ["sickness", "outbreak", "great-dying"],
  },
  "great-dying": {
    icon: "💀",
    title: "A great dying",
    what: [
      "A sickness that kills more than fifteen in a hundred of a land's people is a great dying: most often a terrible sickness on a people never spared it, or one that came to the hungry.",
    ],
    drives: ["A deadly sickness; none spared it; hunger; no healers."],
    leads: [
      "Grief on its realm, and a people turned to their gods.",
      "Fewer hands for the fields: where a land's people fall by a tenth, the bonds of its serfs loosen.",
    ],
    see: [LEDGER],
    related: ["sickness", "immunity", "serfdom"],
  },
  healers: {
    icon: "🌿",
    title: "Healers",
    what: [
      "What a people know of healing — herb-lore, medicine, drains and clean water, aqueducts, the seeds of sickness seen through glass, vaccination — spares some of those a sickness would kill, up to six in ten.",
    ],
    drives: ["Herb-lore, then medicine; the lore of building in stone and of water."],
    leads: ["Fewer dead of every sickness."],
    see: [LEDGER],
    related: ["drains", "sickness"],
  },
  drains: {
    icon: "💧",
    title: "Drains and clean water",
    what: [
      "A people with drains and clean water do not drink their own filth: a sickness of foul water comes to them less than half as often.",
    ],
    drives: ["Building in stone, and medicine, in a land of towns."],
    leads: ["Fewer outbreaks of the sicknesses of foul water."],
    see: [LEDGER],
    related: ["healers", "outbreak"],
  },
  "unequal-dying": {
    icon: "⚖️",
    title: "Who dies the more",
    what: [
      "Sickness does not take all alike. The small and the old die the most; the hungry the more; and the bound — crowded, ill-fed and untended — half again as often as the free, so that a sickness thins a land's bound the more.",
    ],
    drives: ["Bondage; hunger; age."],
    leads: ["A land's bound fewer after a sickness; its grievance the deeper."],
    see: [LEDGER],
    related: ["bondage", "outbreak", "great-dying"],
  },
  "star-sickness": {
    icon: "🛸",
    title: "A sickness from the stars",
    what: [
      "Strangers from another star who come down among a people bring the small life of their own world with them, and now and then a sickness of it takes: one no one here was ever spared, named for the strangers, that goes on from land to land as any sickness does. Come down again, they may bring it again.",
      "It goes the other way too. A sickness about the land they came down in may go home with them — each of ours once with each people — and a people whose own were sickened by the home world fear it the more, the more as it kills: their regard falls, and a people that stands ill enough with the home world sends fleets against it.",
    ],
    drives: [
      "Strangers come down: to talk and trade (one time in two a sickness comes with them), only to look (one in four), or in war (one in three).",
      "A people who keep the sick apart are reached half as often.",
    ],
    leads: [
      "A new sickness that no one is spared, and a people turned from strangers.",
      "Their regard for the home world soured.",
    ],
    see: [LEDGER],
    related: ["sickness", "immunity", "great-dying", "contact"],
  },
};

/** The labels on pages that are measures of these concepts. */
export const HEALTH_CONCEPT_OF: Readonly<Record<string, string>> = {
  Sickness: "sickness",
  "Last came": "outbreak",
  "It took": "outbreak",
  "Its healers": "healers",
  "Drains and clean water": "drains",
  "Warded by the god": "immunity",
  "It passes": "sickness",
  "The survivors": "immunity",
  "Their sickness": "star-sickness",
  "Ours they carried home": "star-sickness",
  "Gone to the stars": "star-sickness",
};
