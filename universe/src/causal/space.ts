// Flight in words (docs/architecture §13, §25; Phase 5 M49): a realm's first satellite,
// first crew and first station, each told with the speed its world asked and the engine
// that gave it.
import { yearOfMoment } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { PROPULSION, STAR_DRIVES } from "../rules/index.ts";
import {
  CONTACT_EVENTS,
  GREAT_ACT_EVENTS,
  FILLED_EVENTS,
  LANE_EVENTS,
  LATE_EVENTS,
  PEOPLES_EVENTS,
  SPACE_EVENTS,
  STARWAR_EVENTS,
  SUMMON_EVENTS,
  TRADE_EVENTS,
  VOYAGE_EVENTS,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";
import { count } from "./words.ts";

type Flight = { realm?: string; speed?: number; engine?: string; stages?: number };

const engineWords = (id: string | undefined) =>
  PROPULSION.find((p) => p.id === id)?.words ?? "rockets";

for (const [kind, what] of [
  ["satellite", "sent its first satellite into orbit"],
  ["crew", "sent its first crew into orbit and brought them home"],
  ["station", "built its first station in orbit"],
] as const)
  registerEventWords(SPACE_EVENTS[kind].type, (_world, e) => {
    const d = (e.data ?? {}) as Flight;
    return `The realm of ${d.realm ?? "a people"} ${what}${d.speed ? `, gaining the ${d.speed} km/s their world asks` : ""} on ${engineWords(d.engine)}${d.stages ? ` in ${d.stages} stage${d.stages > 1 ? "s" : ""}` : ""}, year ${yearOfMoment(e.t)}`;
  });

registerEventWords(SPACE_EVENTS.colony.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; body?: string; settlers?: number };
  return `The realm of ${d.realm ?? "a people"} set ${d.settlers ?? "its first"} settlers down in sealed halls on ${d.body ?? "another world"}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(VOYAGE_EVENTS.sailed.type, (_world, e) => {
  const d = (e.data ?? {}) as {
    realm?: string;
    distance?: number;
    years?: number;
    drive?: string;
    lanes?: number;
    byDrive?: number;
  };
  const drive = STAR_DRIVES.find((x) => x.id === d.drive)?.words ?? "a starship";
  if (d.lanes)
    return `The realm of ${d.realm ?? "a people"} sent a ship to a star ${d.distance ?? "?"} light-years away, through ${d.lanes} lane${d.lanes === 1 ? "" : "s"}: ${d.years ?? "many"} years on the way, where ${drive} alone would have taken ${d.byDrive ?? "?"}, year ${yearOfMoment(e.t)}`;
  return `The realm of ${d.realm ?? "a people"} sent a ship to a star ${d.distance ?? "?"} light-years away, on ${drive}: ${d.years ?? "many"} years on the way, its people living and dying aboard, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LANE_EVENTS.first.type, (_world, e) => {
  const d = (e.data ?? {}) as {
    realm?: string;
    hops?: number;
    years?: number;
    byDrive?: number;
    distance?: number;
  };
  return `A ship of the realm of ${d.realm ?? "a people"} made the first jump, through ${d.hops ?? "?"} lane${d.hops === 1 ? "" : "s"} to a star ${d.distance ?? "?"} light-years away: ${d.years ?? "?"} years on the way, where its drive alone would have taken ${d.byDrive ?? "?"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LANE_EVENTS.sent.type, (_world, e) => {
  const d = (e.data ?? {}) as {
    realm?: string;
    folk?: string;
    hops?: number;
    years?: number;
    byDrive?: number;
    distance?: number;
  };
  return `The realm of ${d.realm ?? "a people"} sent a ship through ${d.hops ?? "?"} lane${d.hops === 1 ? "" : "s"} to the ${d.folk ?? "people"} it had seen ${d.distance ?? "?"} light-years away: ${d.years ?? "?"} years, where its drive alone would have taken ${d.byDrive ?? "?"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LANE_EVENTS.came.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; seen?: string; sailed?: number };
  return `A ship of the realm of ${d.realm ?? "a people"}, sent through the lanes in ${d.sailed ?? "?"}, came to a people it had seen living in ${d.seen ?? "their own places"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(VOYAGE_EVENTS.arrived.type, (_world, e) => {
  const d = (e.data ?? {}) as { distance?: number; people?: number };
  return `A ship came to its star ${d.distance?.toFixed(1) ?? "?"} light-years from home, and its ${d.people ?? ""} people went down into halls on a world there, year ${yearOfMoment(e.t)}`;
});

const cargoWords = (goods: unknown): string =>
  ((goods ?? []) as [string, number][])
    .slice(0, 2)
    .map(([g, n]) => `${count(n)} ${g}`)
    .join(" and ") || "goods";
registerEventWords(TRADE_EVENTS.opened.type, (_world, e) => {
  const d = (e.data ?? {}) as {
    realm?: string;
    house?: string;
    good?: string;
    ly?: number;
    lanes?: number;
    years?: number;
  };
  return `${d.house ?? "A house"} of ${d.realm ?? "a people"} opened a run for ${d.good ?? "goods"}, ${d.ly ?? "?"} light-years${d.lanes ? ` by ${d.lanes} lane${d.lanes === 1 ? "" : "s"}` : ""}, ${d.years ?? "?"} years a crossing, year ${yearOfMoment(e.t)}`;
});
registerEventWords(TRADE_EVENTS.came.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; goods?: unknown };
  return `The first ship of a run from ${d.realm ?? "a people"} came in with ${cargoWords(d.goods)}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(TRADE_EVENTS.first.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; goods?: unknown; between?: boolean; ly?: number };
  return d.between
    ? `For the first time ships of another people came to trade: ${d.realm ?? "strangers"} landed ${cargoWords(d.goods)} at halls of ours, year ${yearOfMoment(e.t)}`
    : `For the first time goods crossed between worlds for gain: ${cargoWords(d.goods)} from ${d.realm ?? "a people"}, ${d.ly ? `${d.ly} light-years` : "among one star's own worlds"}, year ${yearOfMoment(e.t)}`;
});
const raidWords = (_world: unknown, e: { t: number; data: unknown }): string => {
  const d = (e.data ?? {}) as { realm?: string; by?: string; goods?: unknown; lanes?: number };
  return `${d.by ?? "Raiders"} took a hold of ${d.realm ?? "a people"}'s ${d.lanes ? "on the lane" : "in the dark"}: ${cargoWords(d.goods)} lost, year ${yearOfMoment(e.t)}`;
};
registerEventWords(TRADE_EVENTS.raided.type, raidWords as never);
registerEventWords(
  TRADE_EVENTS.firstRaid.type,
  ((world: unknown, e: { t: number; data: unknown }) =>
    `The first time a hold was taken between the worlds. ${raidWords(world, e)}`) as never,
);
registerEventWords(TRADE_EVENTS.closed.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; why?: string; ships?: number };
  const why: Record<string, string> = {
    gone: "the world it ran to is gone",
    war: "war between its two ends",
    empty: "no one left to send to",
    fallen: "no one holds the land it sent from",
    unpaid: "what it carried no longer pays for the crossing",
  };
  return `A run of ${d.realm ?? "a people"} ended after ${d.ships ?? 0} ships: ${why[d.why ?? ""] ?? "it stopped"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(TRADE_EVENTS.rich.type, (_world, e) => {
  const d = (e.data ?? {}) as { house?: string; worth?: number };
  return `${d.house ?? "A house"} grew great on the run it keeps, ${count(d.worth ?? 0)} in grain cleared by it, year ${yearOfMoment(e.t)}`;
});
registerEventWords(FILLED_EVENTS.sailed.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; years?: number };
  return `The realm of ${d.realm ?? "a people"} sent a ship to a star ${d.distance ?? "?"} light-years away, every nearer world being taken: ${d.years ?? "many"} years on the way, year ${yearOfMoment(e.t)}`;
});
registerEventWords(FILLED_EVENTS.landed.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number };
  return `Settlers of ${d.realm ?? "a people"} came down on a world ${d.distance?.toFixed(1) ?? "?"} light-years from home, year ${yearOfMoment(e.t)}`;
});
registerEventWords(FILLED_EVENTS.world.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; people?: number; share?: number; whole?: boolean };
  const many = count(d.people ?? 0);
  return d.whole
    ? `A world ${d.realm ? `first settled by ${d.realm} ` : ""}was filled to its edges: ${many} people on it, year ${yearOfMoment(e.t)}`
    : `A world ${d.realm ? `first settled by ${d.realm} ` : ""}came to hold all it can under its roofs, ${d.share ?? "?"}% of its ground and no more: ${many} people on it, year ${yearOfMoment(e.t)}`;
});

registerEventWords(LATE_EVENTS.mirrors.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; km2?: number };
  return `The realm of ${d.realm ?? "a people"} set the first ${d.km2 ?? ""} km² of mirrors about its star, each works to build the next out of its system's small bodies, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  LATE_EVENTS.gathered.type,
  (_world, e) =>
    `The mirrors about the star came to gather more of its light than falls on the whole of the world, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LATE_EVENTS.remaking.type, (world, e) => {
  const d = (e.data ?? {}) as { realm?: string };
  return `The realm of ${d.realm ?? "a people"} began to remake ${landWords(world, e.place)}'s world, turning comets from their courses and drawing air from its giants, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  LATE_EVENTS.remade.type,
  (world, e) =>
    `The world of ${landWords(world, e.place)} was remade: its people walked out of their halls under its own new sky, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LATE_EVENTS.covered.type, (_world, e) => {
  const d = (e.data ?? {}) as { built?: number; lands?: number };
  return `${d.built ?? "Half"} of the world's ${d.lands ?? ""} peopled lands came to be built on from edge to edge, more towers than fields, year ${yearOfMoment(e.t)}`;
});

registerEventWords(CONTACT_EVENTS.heard.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; clade?: string; sent?: number };
  return `The realm of ${d.realm ?? "a people"} heard the signals of another people — ${d.clade ?? "strangers"}, of a world ${d.distance ?? "?"} light-years away — sent in our year ${d.sent ?? "?"}, heard only now, year ${yearOfMoment(e.t)}`;
});

registerEventWords(STARWAR_EVENTS.declared.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; years?: number };
  return `The realm of ${d.realm ?? "a people"} went to war across ${d.distance ?? "?"} light-years, its fleet to be ${d.years ?? "many"} years on the way, year ${yearOfMoment(e.t)}`;
});
registerEventWords(STARWAR_EVENTS.battle.type, (_world, e) => {
  const d = (e.data ?? {}) as { won?: boolean };
  return `A fleet came at last to its war among the stars, and ${d.won ? "won" : "was lost"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(STARWAR_EVENTS.peace.type, (_world, e) => {
  const d = (e.data ?? {}) as { won?: boolean };
  return `The war among the stars ended, ${d.won ? "the fleet's realm the victor" : "its fleet lost"}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(GREAT_ACT_EVENTS.warm.type, (_world, e) => {
  const d = (e.data ?? {}) as { sign?: number; years?: number };
  return `By your hand the whole world grew ${d.sign === -1 ? "colder" : "warmer"} for ${d.years ?? "some"} years, year ${yearOfMoment(e.t)}`;
});
registerEventWords(GREAT_ACT_EVENTS.flare.type, (_world, e) => {
  const d = (e.data ?? {}) as { sign?: number; years?: number };
  return `By your hand a star ${d.sign === -1 ? "flared, its light deadlier to all under it" : "grew calm, its light kinder"} for ${d.years ?? "some"} years, year ${yearOfMoment(e.t)}`;
});

// The peoples of the stars (Phase 18 M133): their ships, landings, meetings, exchanges and fleets.
type Peoples = {
  name?: string;
  kind?: string;
  realm?: string | null;
  other?: string | null;
  otherKind?: string | null;
  theirs?: string;
  ours?: string;
  omen?: boolean;
  far?: boolean;
  heard?: boolean;
  years?: number;
  distance?: number;
  what?: string;
  principle?: string | null;
  machines?: number;
  won?: boolean;
  taken?: boolean;
  called?: boolean;
};
const people = (d: Peoples) => `the ${d.name ?? "strangers"}`;
const realmOf = (d: Peoples) => (d.realm ? `the realm of ${d.realm}` : "a land with no realm");
const IN: Readonly<Record<string, string>> = {
  wonder: "in wonder",
  fear: "in fear",
  trade: "to trade",
  war: "for war",
};
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

registerEventWords(PEOPLES_EVENTS.sailed.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples & { kind?: string };
  const what =
    d.kind === "envoys"
      ? `sent envoys toward the home world, ${d.heard ? "having heard its signals" : "having seen that it lives"}`
      : d.kind === "fleet"
        ? `sent a fleet against ${d.realm ? `the realm of ${d.realm}` : "a foe among the stars"}`
        : "sent settlers to another star";
  return `${cap(people(d))} ${what}: ${d.years ?? "many"} years on the way, year ${yearOfMoment(e.t)}`;
});
registerEventWords(PEOPLES_EVENTS.settled.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples;
  return `Settlers of ${people(d)}${d.kind ? `, ${d.kind},` : ""} came down about a star ${d.distance ?? "?"} light-years from their own, year ${yearOfMoment(e.t)}`;
});
registerEventWords(PEOPLES_EVENTS.landed.type, (world, e) => {
  const d = (e.data ?? {}) as Peoples,
    where = d.called
      ? `in ${landWords(world, e.place)} at the god's call`
      : d.realm
        ? `by the seat of the realm of ${d.realm}`
        : "in the most peopled land";
  return d.omen
    ? `A ship of ${people(d)} — ${d.kind ?? "strangers"} of another star — came down ${where}; they looked, and were seen, and went, year ${yearOfMoment(e.t)}`
    : `Envoys of ${people(d)}, ${d.kind ?? "strangers"} of another star, came down ${where}${d.heard ? ", come because they heard the world's signals" : ""}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(SUMMON_EVENTS.called.type, (world, e) => {
  const d = (e.data ?? {}) as Peoples;
  return `At the god's call ${people(d)} — ${d.kind ?? "strangers"} of another star — crossed the dark in a year, for ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}`;
});
registerCommandWords(
  "act.summon",
  (world, c) =>
    `Your act: you called strangers from the stars down to ${landWords(world, cellRef(0, (c.args as { cell: number }).cell))}, year ${yearOfMoment(c.t)}`,
);
registerEventWords(PEOPLES_EVENTS.met.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples;
  return `${cap(people(d))} met ${realmOf(d)}${d.far ? " at another star" : ""}: they came ${IN[d.theirs ?? ""] ?? "unknown"}, and were met ${IN[d.ours ?? ""] ?? "unknown"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(PEOPLES_EVENTS.among.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples;
  return `${cap(people(d))} met the ${d.other ?? "strangers"}${d.otherKind ? `, ${d.otherKind},` : ""} among the stars: they came ${IN[d.theirs ?? ""] ?? "unknown"}, and were met ${IN[d.ours ?? ""] ?? "unknown"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(PEOPLES_EVENTS.exchange.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples,
    y = yearOfMoment(e.t);
  if (d.other)
    return `${cap(people(d))} and the ${d.other} exchanged ${d.what ?? "gifts"}, year ${y}`;
  return d.what === "knowledge"
    ? `${cap(people(d))} taught ${realmOf(d)} ${d.principle ?? "something new"}, year ${y}`
    : d.what === "goods"
      ? `${cap(people(d))} traded ${realmOf(d)} goods worth ${count(d.machines ?? 0)} machines, year ${y}`
      : `Time among ${people(d)} opened the ways of ${realmOf(d)} to strangers, year ${y}`;
});
registerEventWords(PEOPLES_EVENTS.raid.type, (_world, e) => {
  const d = (e.data ?? {}) as Peoples,
    y = yearOfMoment(e.t);
  if (d.other)
    return d.won
      ? `A fleet of ${people(d)} ${d.taken ? "took a star" : "struck"} of the ${d.other}, year ${y}`
      : `A fleet of ${people(d)} came against the ${d.other} and was beaten off, year ${y}`;
  return d.won
    ? `A fleet of ${people(d)} fell on ${d.far ? "the halls of " : ""}${realmOf(d)}${d.far ? " at another star" : ""} and burned them, year ${y}`
    : `A fleet of ${people(d)} came against ${realmOf(d)} and was beaten off, year ${y}`;
});
