// People out of their place, in words (sim/war/held.ts): what became of those a war's sides held, a wrong done to the beaten
// or to a stormed town and who did it, whether it was answered for, and many fled come over a border. What and who, never how.
import { yearOfMoment } from "../kernel/index.ts";
import {
  COMPANY_EVENTS,
  FLEET_EVENTS,
  HELD_EVENTS,
  RAID_EVENTS,
  SEA_EVENTS,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { grainSum } from "./war.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string, or = "a realm") => {
  const v = (d as Data)?.[k];
  return typeof v === "string" && v ? v : or;
};
const num = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};
const pair = (d: unknown, k: string): readonly [number, number] => {
  const v = (d as Data)?.[k];
  return Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0] : [0, 0];
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const year = (t: number) => `year ${yearOfMoment(t)}`;

/** What became of those two sides held at a peace, as clauses (pages use it too). */
export function heldPhrase(data: unknown): string[] {
  const a = text(data, "a"),
    b = text(data, "b"),
    names = [a, b],
    out: string[] = [],
    exchanged = num(data, "exchanged"),
    grain = num(data, "grain");
  if (exchanged > 0) out.push(`${count(exchanged)} changed for as many, man for man`);
  for (const s of [0, 1]) {
    const by = names[s]!,
      of = names[1 - s]!,
      given = pair(data, "given")[s]!,
      bought = pair(data, "bought")[s]!,
      bound = pair(data, "bound")[s]!,
      freed = pair(data, "freed")[s]!;
    if (given > 0) out.push(`${by} gave up ${count(given)} it held, a term of the peace`);
    if (bought > 0)
      out.push(
        `${of} bought back ${count(bought)} of its people${grain > 0 ? ` for ${grainSum(grain)} grain` : ""}`,
      );
    if (bound > 0) out.push(`${by} kept ${count(bound)} bound to its work`);
    if (freed > 0) out.push(`${by} let ${count(freed)} go home`);
  }
  return out;
}

registerEventWords(HELD_EVENTS.settled.type, (_, e) => {
  const parts = heldPhrase(e.data);
  return parts.length
    ? `Those held in the war between ${text(e.data, "a")} and ${text(e.data, "b")}: ${parts.join("; ")}, ${year(e.t)}`
    : `What became of those held in a war was settled at its peace, ${year(e.t)}`;
});

registerEventWords(HELD_EVENTS.crime.type, (world, e) => {
  const d = e.data as { kind?: string; by?: string; town?: string } | null,
    dead = num(e.data, "dead"),
    who = d?.by ? `, by the order of ${d.by}` : "",
    where = d?.town || landWords(world, e.place);
  return d?.kind === "sword"
    ? `The host of ${text(e.data, "a")} stormed ${where} and put ${dead ? count(dead) : "many"} of its people to the sword${who}, ${year(e.t)}`
    : `The host of ${text(e.data, "a")} gave no quarter at ${where}: ${dead ? count(dead) : "those"} of ${text(e.data, "b")} who had yielded were put to death${who}, ${year(e.t)}`;
});

registerEventWords(HELD_EVENTS.reckoned.type, (world, e) => {
  const d = e.data as { how?: string; by?: string; year?: number } | null,
    who = d?.by ?? "the one who ordered it",
    what = `the killing at ${landWords(world, e.place)}${d?.year !== undefined ? ` in year ${d.year}` : ""}`;
  return d?.how === "tried"
    ? `${cap(who)} was given up by ${text(e.data, "a")} at the peace and put to death for ${what}, ${year(e.t)}`
    : d?.how === "dead"
      ? `At the peace ${text(e.data, "b")} named ${who} for ${what}; they were dead already, ${year(e.t)}`
      : `No one answered for ${what}: ${text(e.data, "a")} was not beaten, and ${text(e.data, "b")} remembers it, ${year(e.t)}`;
});

registerEventWords(HELD_EVENTS.fled.type, (world, e) => {
  const d = e.data as { kind?: string; from?: number } | null,
    n = num(e.data, "count"),
    why =
      d?.kind === "war"
        ? "the war in their land"
        : d?.kind === "hunger"
          ? "hunger"
          : "the ruin of their land";
  return `${n ? cap(count(n)) : "Many"} who fled ${why} came over the border from ${text(e.data, "b")} into ${landWords(world, e.place)}, ${year(e.t)}`;
});

registerDecisionWords(
  "held.quarter",
  () => "A host weighed what to do with those who had yielded to it",
);

// Those who fight their holder falling on the soldiers posted in their land (sim/war/raids.ts).
registerEventWords(RAID_EVENTS.raid.type, (world, e) => {
  const d = e.data as { group?: string; kind?: string; leader?: string; won?: boolean } | null,
    dead = pair(e.data, "dead"),
    who = d?.group
      ? `The ${d.group} ${d.kind ?? "resistance"}${d.leader ? ` under ${d.leader}` : ""}`
      : `Those of ${landWords(world, e.place)} who fight their holder`,
    cost =
      dead[0] + dead[1] > 0
        ? `: ${count(dead[0])} of the posted and ${count(dead[1])} of their own died`
        : "";
  return `${who} fell on the soldiers of ${text(e.data, "a")} posted in ${landWords(world, e.place)}${d?.won === false ? " and were beaten off" : ""}${cost}, ${year(e.t)}`;
});

// A hired company on a battle's day (sim/war/companies.ts): gone home unpaid, gone over, or paid from a land's stores.
registerEventWords(COMPANY_EVENTS.company.type, (world, e) => {
  const d = e.data as {
      group?: string;
      kind?: string;
      leader?: string;
      how?: string;
      grain?: number;
    } | null,
    who = d?.group ? `The ${d.group} ${d.kind ?? "free company"}` : "A hired company",
    led = d?.leader ? ` under ${d.leader}` : "",
    a = text(e.data, "a"),
    b = text(e.data, "b");
  return d?.how === "turned"
    ? `${who}${led}, unpaid by ${a}, went over to ${b} before the battle in ${landWords(world, e.place)}, ${year(e.t)}`
    : d?.how === "left"
      ? `${who}${led}, unpaid by ${a}, left the field before a battle it did not expect to win in ${landWords(world, e.place)}, ${year(e.t)}`
      : `${who}${led}, unpaid by ${a}, took its pay from the stores of ${landWords(world, e.place)}${d?.grain ? `: ${grainSum(d.grain)} grain` : ""}, ${year(e.t)}`;
});

// A reach of sea fished poor by the lands on it (sim/ecology/seas.ts).
registerEventWords(SEA_EVENTS.few.type, (world, e) => {
  const d = e.data as { stock?: number; lands?: number; water?: boolean } | null,
    lands = d?.lands ?? 0,
    left = d?.stock !== undefined ? `, ${d.stock} in a hundred of what it held` : "";
  return d?.water
    ? `The waters the people of ${landWords(world, e.place)} live in grew poor${left}: ${lands > 1 ? `${count(lands)} lands draw on them` : "they took more than it gives"}, ${year(e.t)}`
    : `The sea off ${landWords(world, e.place)} was fished poor${lands > 1 ? ` by the boats of ${count(lands)} lands` : " by its boats"}${left}, ${year(e.t)}`;
});

// Two fleets met at sea in a war (sim/war/fleets.ts).
registerEventWords(FLEET_EVENTS.met.type, (world, e) => {
  const d = e.data as {
      flags?: [string, string];
      led?: [string | null, string | null];
      won?: number;
      lost?: number;
    } | null,
    names = [text(e.data, "a"), text(e.data, "b")],
    sunk = pair(e.data, "sunk"),
    won = d?.won === 1 ? 1 : 0,
    under = d?.led?.[won] ? ` under ${d.led[won]}` : "",
    flag = d?.flags?.[won] ? `, its flagship the ${d.flags[won]},` : "",
    where = e.place ? ` off ${landWords(world, e.place)}` : " at sea",
    gone =
      d?.lost === 0 || d?.lost === 1
        ? `; ${names[d.lost]} lost its flagship${d.flags?.[d.lost] ? `, the ${d.flags[d.lost]}` : ""}`
        : "";
  return `The fleet of ${names[won]}${under}${flag} beat the fleet of ${names[1 - won]}${where}: ${count(sunk[1 - won]!)} tonnes of ships sunk for ${count(sunk[won]!)}${gone}, ${year(e.t)}`;
});
