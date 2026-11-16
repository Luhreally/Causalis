// What realms turned to arms and fought for besides the field, in words (the last sweep, war): a siege laid, lifted, stormed
// or starved out; the sea won and a blockade laid; two realms arming against each other; arms sent into another's war. Only
// what happened, who, and what it cost: never how a thing was made.
import { yearOfMoment } from "../kernel/index.ts";
import { ARMING_EVENTS, NAVY_EVENTS, SIEGE_EVENTS } from "../sim/index.ts";
import { registerEventWords } from "./why.ts";

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string, or = "a realm") => {
  const v = (d as Data)?.[k];
  return typeof v === "string" && v ? v : or;
};
const num = (d: unknown, k: string): number | null => {
  const v = (d as Data)?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const year = (t: number) => `year ${yearOfMoment(t)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const whole = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

registerEventWords(SIEGE_EVENTS.siege.type, (_, e) => {
  const kind = (e.data as { kind?: string } | null)?.kind,
    a = text(e.data, "a"),
    b = text(e.data, "b"),
    months = num(e.data, "months"),
    since = num(e.data, "since"),
    camp = num(e.data, "campDead") ?? 0,
    town = num(e.data, "townDead") ?? 0,
    lost =
      camp || town
        ? `; sickness and hunger took ${whole(camp)} of the besiegers and ${whole(town)} of the town`
        : "";
  switch (kind) {
    case "laid":
      return `${cap(a)} laid siege to the seat of ${b}, its stores enough for ${months === null ? "some" : Math.round(months)} months, ${year(e.t)}`;
    case "lifted":
      return `The siege ${a} laid to the seat of ${b}${since !== null ? ` in year ${since}` : ""} was lifted, its besiegers beaten before the walls${lost}, ${year(e.t)}`;
    case "stormed":
      return `${cap(a)} stormed the seat of ${b} through its broken walls${since !== null ? `, besieged since year ${since}` : ""}${lost}, ${year(e.t)}`;
    default:
      return `The seat of ${b} gave itself up to ${a}, its stores gone${since !== null ? `, besieged since year ${since}` : ""}${lost}, ${year(e.t)}`;
  }
});

registerEventWords(NAVY_EVENTS.sea.type, (_, e) => {
  const kind = (e.data as { kind?: string } | null)?.kind,
    a = text(e.data, "a"),
    b = text(e.data, "b");
  return kind === "blockade"
    ? `${cap(a)}'s ships held the sea against ${b}, and closed its sea trade, ${year(e.t)}`
    : `${cap(a)}'s fleet won the sea from ${b}, ${year(e.t)}`;
});

registerEventWords(ARMING_EVENTS.race.type, (_, e) => {
  const f = (e.data as { footing?: number[] } | null)?.footing;
  return `${cap(text(e.data, "a"))} and ${text(e.data, "b")} armed against each other, each answering the other's host${f && f.length === 2 ? ` (${pct(f[0]!)} and ${pct(f[1]!)} of what each makes)` : ""}, ${year(e.t)}`;
});

registerEventWords(ARMING_EVENTS.backed.type, (_, e) => {
  const sends = num(e.data, "sends");
  return `${cap(text(e.data, "a"))} sent arms to ${text(e.data, "b")} in its war with ${text(e.data, "foe")}, a realm it feared${sends !== null ? ` (${pct(sends)} of what it makes)` : ""}, ${year(e.t)}`;
});
