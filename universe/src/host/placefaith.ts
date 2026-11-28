// A town's faith and rank (town mode, P7): its land's faith and whom it worships (sim/belief), how devout and how given to
// rank its people are (sim/culture ways), its shrines and temples and what having them or wanting them is to its grown, its
// hall and what it is to those of rank (its leaders by trade and its realm's key figures), as host/place.ts placeRites reads
// them into their moods. Read only.
import { DAY, type World } from "../kernel/index.ts";
import { DEITIES, beliefOf } from "../sim/index.ts";
import { OCC } from "../rules/index.ts";
import {
  PLACE_AT,
  placeFaithRef,
  placeLotRef,
  placePersonRef,
  type PlaceInspectFaith,
} from "../bridge/index.ts";
import { placeRites, type Place } from "./place.ts";
import { lotWords, placeWho } from "./placeplan.ts";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const much = (x: number): string =>
  x >= 0.75
    ? "greatly"
    : x >= 0.55
      ? "much"
      : x >= 0.45
        ? "middling"
        : x >= 0.25
          ? "little"
          : "hardly";
/** The most of its people of rank named (the rest counted). */
const RANKED_LISTED = 20;

/** A town's faith and rank (P7). */
export function placeFaith(world: World, place: Place): PlaceInspectFaith {
  const r = placeRites(world, place),
    p = place.people,
    who = placeWho(world, place),
    f = beliefOf(world).of(place.cell).faith,
    faith = f ? beliefOf(world).get(f) : undefined,
    ranked: PlaceInspectFaith["ranked"][number][] = [];
  for (let i = 0; i < p.n && ranked.length < RANKED_LISTED; i++) {
    const fig = place.figId.indexOf(p.id[i]!),
      leader = (p.sexOcc[i]! & 15) === OCC.leader;
    if (fig < 0 && !leader) continue;
    ranked.push({
      name: who(i).name,
      ref: placePersonRef(place.town, p.id[i]!),
      words: `${fig >= 0 ? "one of its realm's key figures" : "a leader"}, ${Math.floor((place.t / DAY - p.born[i]!) / 365)}`,
    });
  }
  return {
    kind: "faith",
    ref: placeFaithRef(place.town),
    lotRef: placeLotRef(place.town, PLACE_AT.square),
    name: "Faith and rank",
    icon: "⛩️",
    faith: faith
      ? `${faith.name}, who worship ${DEITIES[faith.tenet]}: the faith of its land since the year ${beliefOf(world).of(place.cell).since}`
      : "No faith is kept in its land",
    ways: `Its people are ${much(r.piety)} devout (${Math.round(r.piety * 100)} in a hundred) and hold rank ${much(r.hierarchy)} (${Math.round(r.hierarchy * 100)} in a hundred)`,
    shrines: r.shrines.map((lot) => ({
      name: cap(lotWords(place, lot)),
      ref: placeLotRef(place.town, lot),
    })),
    riteWords: !faith
      ? "With no faith kept, no rite is asked of a shrine."
      : r.shrines.length
        ? `Its grown keep their rites at its ${r.shrines.length === 1 ? "shrine" : `${r.shrines.length} shrines and temples`}: ${r.rite > 0 ? `+${r.rite}` : r.rite} to each one's mood, the more as they are devout.`
        : r.rite < 0
          ? `No shrine stands where their faith keeps its rites: ${r.rite} to each grown one's mood, the more as they are devout. One may be raised (Build).`
          : "No shrine stands, and its people are not so devout as to want one.",
    hall:
      r.hall >= 0
        ? { name: cap(lotWords(place, r.hall)), ref: placeLotRef(place.town, r.hall) }
        : null,
    rankWords:
      r.hall >= 0
        ? `Its hall befits those of rank: ${r.rank > 0 ? `+${r.rank}` : r.rank} to each one's mood.`
        : r.rank < 0
          ? `No hall stands befitting those of rank, as its people hold rank: ${r.rank} to each one's mood. One may be raised (Build).`
          : "No hall stands, and its people hold rank too lightly to ask one.",
    ranked,
    words: `What its people hold sacred and whom they hold high, read off its land's faith and its people's ways; what it gives them is weighed on each one's mood.`,
  };
}
