// Why one of a town's people does what they do (town mode, R7): a "Why?" beside each of its figures, as Classic's why
// chains had it. What they do now and where; the reason the place gave it (whyWords, with the numbers that decided it);
// what lies behind that reason, read off the town as it stands (their household's pantry and the town's stores for a
// hunger, the air and their clothes for the cold, their work and who put them to it, what bears on the town for a fire
// or a muster, their health, their day); and what weighs most on their mood. Each step with the page it opens and the
// place the eye can go to. Read only.
import { DAY, type World } from "../kernel/index.ts";
import {
  placeCivicRef,
  placeLotRef,
  placeMakingRef,
  placeWhyRef,
  type PlaceInspectPerson,
  type PlaceInspectWhy,
  type PlaceWhyStep,
} from "../bridge/index.ts";
import { WHY, placeAir, placeIndexOf, type Place } from "./place.ts";
import { dangersSheet, lotWords, stocksSheet } from "./placeplan.ts";

/** The most of what weighs on their mood told. */
const WEIGHS_TOLD = 3;

/** Why one of a town's people does what they do (R7), from their page as the place reads it. */
export function placeWhy(
  world: World,
  place: Place,
  id: number,
  x: PlaceInspectPerson,
): PlaceInspectWhy | null {
  const i = placeIndexOf(place, id);
  if (i < 0) return null;
  const p = place.people,
    why = p.why[i]!,
    lot = (l: number) => ({ ref: placeLotRef(place.town, l), go: { id: null, lot: l } }),
    steps: PlaceWhyStep[] = [
      { label: "Doing", words: x.now, ref: null, go: { id, lot: null } },
      {
        label: "Because",
        words: x.why,
        ...(p.eta[i]! > 0 ? lot(p.to[i]!) : { ref: null, go: null }),
      },
    ],
    behind = (label: string, words: string, more: Partial<PlaceWhyStep> = {}) =>
      steps.push({ label, words, ref: null, go: null, ...more });
  const food = (): void => {
      behind(
        "Their pantry",
        `${x.pantry === "Bare" ? "Bare" : x.pantry}, at ${x.home.words.toLowerCase()}`,
        lot(x.home.lot),
      );
      const s = stocksSheet(world, place);
      behind(
        "The town's stores",
        `${Math.round(s.foodDays)} days' food for all its people${s.hold ? `, ${s.hold} months of it held back in its granary by your order` : ""}`,
        { ref: placeMakingRef(place.town) },
      );
    },
    work = (): void => {
      if (x.work)
        behind("Their work", `${x.work.words}${x.bound ? `; ${x.bound}` : ""}`, lot(x.work.lot));
      if (x.skill) behind("Their hand at it", x.skill);
    },
    dangers = (): void => {
      for (const d of dangersSheet(world, place).now.slice(0, 2))
        behind("Bearing on the town", `${d.icon} ${d.words}`, { ref: d.ref });
    },
    day = (): void => {
      for (const [k, v] of x.dayRows.slice(0, 2)) behind(k, v);
    };
  switch (why) {
    case WHY.hunger:
    case WHY.pantry:
    case WHY.noFood:
      food();
      break;
    case WHY.tired:
    case WHY.asleep:
    case WHY.dark:
      behind("Their bed", `At ${x.home.words.toLowerCase()}`, lot(x.home.lot));
      day();
      break;
    case WHY.cold: {
      const air = placeAir(world, place),
        clothes = x.inventory.slots.find((s) => s.slot === "On the body");
      behind("The air", `${Math.round(air.warmth)}° out of doors now`);
      behind(
        "Their clothes",
        clothes
          ? `${clothes.name}, ${clothes.wear}% worn, ${clothes.state}`
          : "None: nothing to keep the cold off",
        { ref: x.ref },
      );
      behind("Their home", x.home.words, lot(x.home.lot));
      break;
    }
    case WHY.lone:
    case WHY.play:
    case WHY.rest:
      if (x.friend)
        behind("Their friend", x.friend.name, {
          ref: x.friend.ref,
          go: x.friend.id === null ? null : { id: x.friend.id, lot: null },
        });
      behind("Their ties", x.tiesWords);
      day();
      break;
    case WHY.shut:
    case WHY.clear:
      work();
      behind("Your orders", "The town's standing orders, each said", {
        ref: placeCivicRef(place.town),
      });
      break;
    case WHY.work:
    case WHY.turned:
    case WHY.site:
    case WHY.stuff:
    case WHY.stopped:
    case WHY.raised:
    case WHY.noStuff:
    case WHY.billMet:
    case WHY.load:
      work();
      if (why === WHY.site || why === WHY.stuff || why === WHY.stopped || why === WHY.raised)
        behind("Its works", "What is going up, and how far each has got", {
          ref: placeCivicRef(place.town),
        });
      if (why === WHY.noStuff || why === WHY.billMet || why === WHY.stuff)
        behind("What it lives on", "Its stocks by their stuff, and what it is short of", {
          ref: placeMakingRef(place.town),
        });
      break;
    case WHY.fire:
    case WHY.arms:
    case WHY.watch:
    case WHY.siege:
    case WHY.apart:
      dangers();
      break;
    case WHY.abed:
    case WHY.tend:
    case WHY.herbs:
      if (x.healthWords) behind("Their health", x.healthWords, { ref: x.ref });
      if (why !== WHY.abed) dangers();
      break;
    case WHY.burial:
      behind("The burial", `Held at ${lotWords(place, p.to[i]!)}`, lot(p.to[i]!));
      break;
    default:
      day();
  }
  // (What weighs on them most, either way: their mood's figure and its heaviest reasons.)
  const heavy = [...x.thoughts]
    .sort((a, b) => Math.abs(b.size) - Math.abs(a.size))
    .slice(0, WEIGHS_TOLD);
  behind("Their mood", `${x.mood}, ${x.moodWord}`, { ref: x.ref });
  for (const t of heavy)
    behind(
      `${t.size > 0 ? "+" : ""}${Math.round(t.size)}`,
      `${t.icon} ${t.words}${t.days !== null ? `, ${t.days} more ${t.days === 1 ? "day" : "days"}` : ""}`,
      t.from?.ref ? { ref: t.from.ref } : {},
    );
  return {
    kind: "why",
    ref: placeWhyRef(place.town, id),
    id,
    name: x.name,
    icon: "❓",
    sub: `Why ${x.name} ${x.now.charAt(0).toLowerCase()}${x.now.slice(1)}`.slice(0, 140),
    personRef: x.ref,
    steps,
    day: Math.floor(place.t / DAY),
  };
}
