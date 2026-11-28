// A town's gate on its own page (town mode, P2): who has come this year and who is to come, as host/placegate.ts reads them
// off its world, each on its day with what sent them a tap away; and its gate's order, shut to newcomers or open. Read only.
import { DAY, HOUR, type World } from "../kernel/index.ts";
import { PLACE_AT, placeGateRef, placeLotRef, type PlaceInspectGate } from "../bridge/index.ts";
import { GATE_ASKS, GATE_ICON, GATE_WHO, gateArrivals } from "./placegate.ts";
import { GATE_TURNED, HAP, gateShut, type Place } from "./place.ts";
import { placeDay } from "./placeplan.ts";

/** The most told on its page: those come lately, then those to come. */
const GATE_PAST = 12,
  GATE_AHEAD = 8;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A town's gate (P2). */
export function placeGate(world: World, place: Place): PlaceInspectGate {
  const year = Math.floor(place.t / (365 * DAY)),
    now = place.t,
    shut = gateShut(world, place),
    all = gateArrivals(world, place.town, place.cell, year),
    at = (x: (typeof all)[number]) => x.day * DAY + x.hour * HOUR,
    // (Come once the place's clock has passed their day's turn, where its log tells them.)
    came = (x: (typeof all)[number]) => x.day * DAY <= now,
    past = all.filter(came).slice(-GATE_PAST),
    ahead = all.filter((x) => !came(x)).slice(0, GATE_AHEAD),
    // (Turned away or taken in as its log told it on their day, whatever its gate's order is now.)
    turned = new Set<string>();
  let away = 0;
  for (const x of place.log)
    if (x.what === HAP.gate && x.b & GATE_TURNED) {
      turned.add(`${place.gates?.[x.a] ?? ""}#${Math.floor(x.t / DAY)}`);
      if (Math.floor(x.t / (365 * DAY)) === year) away += x.b & (GATE_TURNED - 1);
    }
  const asked = all.filter((x) => GATE_ASKS.has(x.kind)),
    askers = asked.reduce((a, x) => a + x.count, 0);
  return {
    kind: "gate",
    ref: placeGateRef(place.town),
    lotRef: placeLotRef(place.town, PLACE_AT.square),
    name: "At the gate",
    icon: "🚪",
    shut,
    orderWords: `${away ? `${away} turned away at its gate this year. ` : ""}${
      shut
        ? "Its gate is shut to newcomers by your order: those who come asking to live in it are turned away, and go on to another of its land's towns. It grows only by its own births till it is opened."
        : "Its gate is open: those who come asking to live in it are taken in, as its land's count brings them."
    }`,
    arrivals: [...past, ...ahead].map((x) => {
      const p = came(x),
        away = turned.has(`${x.kind}|${x.from}|${x.why}|${x.ref ?? ""}#${x.day}`);
      return {
        when: `${cap(placeDay(at(x)))}, ${String(x.hour).padStart(2, "0")}:00`,
        icon: GATE_ICON[x.kind],
        who: GATE_WHO[x.kind](x.count),
        words: `${p ? "came" : "to come"} from ${x.from}, ${x.why}${away ? "; turned away, its gate shut" : ""}`,
        ref: x.ref,
        past: p,
        asks: GATE_ASKS.has(x.kind),
      };
    }),
    words: all.length
      ? `This year ${all.length} ${all.length === 1 ? "comes" : "come"} to its gate, as its world sends them: its land's trade, those its world moved into its land (${askers} asking to live in the town, at its share of its land's people), envoys to its court, raiders.`
      : "No one comes to its gate this year: its land traded with no other, no one moved into it, and no envoy or raider came.",
  };
}
