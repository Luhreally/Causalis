// Wars in words (docs/architecture §23, §13): who fought whom, for which land, how
// many fell, how it ended — and why: the declaration, whose factors reach the
// rivalry and its reasons, the famine and the dry year behind it, and the land
// they wanted, down to its ground.
import { yearOfMoment, type CauseRef } from "../kernel/index.ts";
import {
  FAR_EVENTS,
  FIRE_EVENTS,
  WAR,
  WAR_EVENTS,
  politiesOf,
  realmName,
  warsOf,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(WAR.code, (world, ref) => {
  if (!world.storeNames().includes("war.wars")) return null;
  const w = warsOf(world).get(ref);
  if (!w) return null;
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    b = realms.get(w.defender),
    names = `${a ? realmName(a) : "a realm"} against ${b ? realmName(b) : "a realm"}`,
    fallen = w.fallen[0] + w.fallen[1],
    taken = w.battles.filter((x) => x.won).length;
  const claim = `The war of ${names}, from year ${w.declared}${w.ended !== null ? ` to year ${w.ended}` : ", still fought"}: ${count(w.battles.length)} battle${w.battles.length === 1 ? "" : "s"}, ${count(fallen)} fallen, ${taken ? `${count(taken)} land${taken === 1 ? "" : "s"} taken` : "no land taken"}`;
  const causes: CauseRef[] = [{ ref: w.event, role: "trigger", weight: 0.8 }];
  if (w.peace) causes.push({ ref: w.peace, role: "enabler", weight: 0.2 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

const text = (d: unknown, k: string) => {
  const v = (d as Readonly<Record<string, unknown>> | null)?.[k];
  return typeof v === "string" ? v : "a realm";
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

// (A civil war says what it is fought over: M146.)
const CIVIL: Readonly<Record<string, string>> = {
  succession: "for the throne, in a war of succession",
  general: "in a general's revolt",
  pretender: "for a pretender's claim",
  revolution: "for the old court's return",
  freed: "to take back the freed",
};
registerEventWords(WAR_EVENTS.declared.type, (world, e) => {
  const civil = (e.data as { civil?: string } | null)?.civil,
    by = (e.data as { by?: string } | null)?.by;
  if (by)
    return `By your hand, at the word of ${by}, ${text(e.data, "a")} went to war with ${text(e.data, "b")} for ${landWords(world, e.place)}, ${year(e.t)}`;
  return civil
    ? `${cap(text(e.data, "a"))} rose against ${text(e.data, "b")} ${CIVIL[civil] ?? "in a civil war"}, marching on ${landWords(world, e.place)}, ${year(e.t)}`
    : `${cap(text(e.data, "a"))} went to war with ${text(e.data, "b")} for ${landWords(world, e.place)}, ${year(e.t)}`;
});
registerEventWords(WAR_EVENTS.battle.type, (world, e) => {
  const d = e.data as { won?: boolean; fallen?: number; tip?: boolean } | null;
  // (Where arms decided it, Phase 52 M217: the winner's.)
  return `${cap(text(e.data, "a"))} ${d?.won ? "won" : "lost"} a battle against ${text(e.data, "b")} in ${landWords(world, e.place)}${d?.tip ? `, ${text(e.data, d.won ? "a" : "b")}'s arms deciding it` : ""}; ${count(d?.fallen ?? 0)} fell, ${year(e.t)}`;
});
registerEventWords(
  WAR_EVENTS.taken.type,
  (world, e) =>
    `${cap(text(e.data, "a"))} took ${landWords(world, e.place)} from ${text(e.data, "b")}, ${year(e.t)}`,
);
registerEventWords(
  WAR_EVENTS.rebellion.type,
  (world, e) =>
    `${cap(landWords(world, e.place))} rose against ${text(e.data, "a")} and returned to ${text(e.data, "b")}, ${year(e.t)}`,
);
registerEventWords(FIRE_EVENTS.begun.type, (_, e) => {
  const d = e.data as { place?: string; ruler?: string; years?: number; share?: number } | null;
  return `${cap(text(e.data, "a"))} began a great works at ${d?.place ?? "its seat"}, by the word of ${d?.ruler ?? "its ruler"}: ${count(d?.years ?? 0)} years, and ${count(d?.share ?? 0)} in a hundred of its machines, iron and fuel in each of them, ${year(e.t)}`;
});
registerEventWords(FIRE_EVENTS.held.type, (_, e) => {
  const d = e.data as { place?: string; years?: number; machines?: number; first?: boolean } | null;
  return `${cap(text(e.data, "a"))}${d?.first ? ", first of all the world," : ""} holds the greatest fire: ${count(d?.years ?? 0)} years at ${d?.place ?? "its seat"}, ${count(d?.machines ?? 0)} machines gone into it, ${year(e.t)}`;
});
registerEventWords(FIRE_EVENTS.crisis.type, (_, e) => {
  const d = e.data as { ruler?: string; war?: boolean; answer?: boolean } | null;
  return d?.answer
    ? `The whole world holds its breath: struck by ${text(e.data, "b")}, ${d?.ruler ?? "the ruler"} of ${text(e.data, "a")} could answer in kind, ${year(e.t)}`
    : d?.war
      ? `The whole world holds its breath: its war with ${text(e.data, "b")} going badly, ${d?.ruler ?? "the ruler"} of ${text(e.data, "a")} could loose the greatest fire, ${year(e.t)}`
      : `The whole world holds its breath: ${text(e.data, "a")} and ${text(e.data, "b")}, who both hold the greatest fire, stand at the brink with no war between them, ${year(e.t)}`;
});
registerEventWords(FIRE_EVENTS.stepped.type, (_, e) => {
  const d = e.data as { ruler?: string; who?: string; held?: boolean } | null;
  const by = d?.ruler ?? "its ruler";
  return d?.held
    ? `${by} of ${text(e.data, "a")} held their hand, by your word, and the world breathed again, ${year(e.t)}`
    : d?.who === "foe"
      ? `${cap(text(e.data, "b"))} stepped back from ${text(e.data, "a")}, and the world breathed again, ${year(e.t)}`
      : `${by} of ${text(e.data, "a")} held their hand and stepped back, and the world breathed again, ${year(e.t)}`;
});
registerEventWords(FIRE_EVENTS.cold.type, (_, e) => {
  const d = e.data as { name?: string; cold?: number } | null;
  return `The soot of ${d?.name ?? "what burned"} darkens the whole sky: ${d?.cold ?? 0} degrees colder and the harvests failing, ${year(e.t)}`;
});
registerEventWords(FIRE_EVENTS.clear.type, (_, e) => {
  const d = e.data as { name?: string; years?: number } | null;
  return `The sky clears after ${count(d?.years ?? 0)} dark year${d?.years === 1 ? "" : "s"}, ${year(e.t)}`;
});
registerEventWords(
  FIRE_EVENTS.given.type,
  (_, e) => `By the god's hand ${text(e.data, "a")} holds the greatest fire, ${year(e.t)}`,
);
registerEventWords(
  FIRE_EVENTS.taken.type,
  (_, e) => `By the god's hand ${text(e.data, "a")} holds the greatest fire no more, ${year(e.t)}`,
);
registerEventWords(FAR_EVENTS.begun.type, (_, e) => {
  const d = e.data as { ruler?: string; place?: string; years?: number; share?: number } | null;
  return `${d?.ruler ?? "Its ruler"} of ${text(e.data, "a")} began turning their star's light, at ${d?.place ?? "their seat"}: ${d?.years ?? 0} years and ${d?.share ?? 0} in a hundred of all they have in each, ${year(e.t)}`;
});
registerEventWords(FAR_EVENTS.held.type, (_, e) => {
  const d = e.data as { place?: string; years?: number; machines?: number } | null;
  return `${cap(text(e.data, "a"))} can turn its star's light on a far mark, after ${d?.years ?? 0} years at ${d?.place ?? "its seat"} and ${count(d?.machines ?? 0)} machines, ${year(e.t)}`;
});
registerEventWords(FAR_EVENTS.crisis.type, (_, e) => {
  const d = e.data as { ruler?: string; rung?: string; distance?: number } | null;
  return `Everyone in reach of the stars holds their breath: ${d?.ruler ?? "its ruler"} of ${text(e.data, "a")} has a fleet a year from a world ${d?.distance ?? "?"} light-years out, and could bring ${d?.rung === "world" ? "that world's end" : d?.rung === "sky" ? "fire to its whole sky" : "the greatest fire"}, ${year(e.t)}`;
});
registerEventWords(FAR_EVENTS.stepped.type, (_, e) => {
  const d = e.data as { ruler?: string; held?: boolean } | null;
  return `${d?.ruler ?? "Its ruler"} of ${text(e.data, "a")} held their hand${d?.held ? ", by your word" : ""}, and everyone in reach of the stars breathed again, ${year(e.t)}`;
});
registerEventWords(FAR_EVENTS.fell.type, (_, e) => {
  const d = e.data as { rung?: string; god?: boolean; dead?: number; first?: boolean } | null,
    by = d?.god ? "The god's hand" : text(e.data, "a"),
    what =
      d?.rung === "world"
        ? "unmade a world"
        : d?.rung === "sky"
          ? "burned a world's whole sky"
          : "carried the greatest fire to another world";
  return `${cap(by)} ${what}${d?.first ? ", the first ever" : ""}: ${count(d?.dead ?? 0)} dead, ${year(e.t)}`;
});
registerEventWords(
  FAR_EVENTS.given.type,
  (_, e) => `By the god's hand ${text(e.data, "a")} can turn its star's light on a far mark, ${year(e.t)}`,
);
registerDecisionWords("far.use", (world, d) => {
  const o = d.outcome as { loose?: boolean; rung?: string; ruler?: string };
  return `${o.ruler ?? "A ruler"} ${o.loose ? "loosed" : "held back"} ${o.rung === "world" ? "what would unmake a world" : o.rung === "sky" ? "what would burn a world's sky" : "the greatest fire, carried to another world"}`;
});
registerDecisionWords("far.works", (_, d) => {
  const o = d.outcome as { ruler?: string };
  return `${o.ruler ?? "A ruler"} chose to turn their star's light`;
});
registerDecisionWords("fire.use", (world, d) => {
  const realm = politiesOf(world).get(d.subject),
    o = d.outcome as { loose?: boolean; ruler?: string } | null;
  return `${o?.ruler ?? "The ruler"} of ${realm ? realmName(realm) : "a realm"} ${o?.loose ? "loosed the greatest fire" : "held their hand"}`;
});
registerDecisionWords("fire.works", (world, d) => {
  const realm = politiesOf(world).get(d.subject);
  return `${cap(realm ? realmName(realm) : "A realm")} chose to raise a great works`;
});
registerEventWords(WAR_EVENTS.strike.type, (_, e) => {
  const d = e.data as {
    name?: string;
    dead?: number;
    homes?: number;
    rocket?: boolean;
    km?: number;
    great?: boolean;
    first?: boolean;
    ruler?: string;
  } | null;
  if (d?.great)
    return `${d.first ? "The first of all time: the" : "The"} greatest fire fell on ${d.name ?? "a town"} of ${text(e.data, "b")}, at the word of ${d.ruler ?? "the ruler"} of ${text(e.data, "a")}; ${count(d.dead ?? 0)} died and ${count(d.homes ?? 0)} home${d.homes === 1 ? "" : "s"} are gone, ${year(e.t)}`;
  if (d?.rocket)
    return `Rockets of ${text(e.data, "a")} fell on ${d.name ?? "a town"} of ${text(e.data, "b")} from ${count(d.km ?? 0)} km away; ${count(d.dead ?? 0)} died and ${count(d.homes ?? 0)} home${d.homes === 1 ? "" : "s"} came down, ${year(e.t)}`;
  return `Machines of ${text(e.data, "a")} struck ${d?.name ?? "a town"} of ${text(e.data, "b")} from the air; ${count(d?.dead ?? 0)} died and ${count(d?.homes ?? 0)} home${d?.homes === 1 ? "" : "s"} came down, ${year(e.t)}`;
});
registerEventWords(WAR_EVENTS.peace.type, (_, e) => {
  const d = e.data as { years?: number; won?: boolean; by?: string } | null;
  return `${d?.by ? `By your hand, at the asking of ${d.by}: peace` : "Peace"} between ${text(e.data, "a")} and ${text(e.data, "b")} after ${count(d?.years ?? 0)} year${d?.years === 1 ? "" : "s"}${d?.won ? ", the land they fought for won" : ""}, ${year(e.t)}`;
});
registerDecisionWords("war.declare", (world, d) => {
  const realm = politiesOf(world).get(d.subject);
  return `${cap(realm ? realmName(realm) : "A realm")} chose war`;
});

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
