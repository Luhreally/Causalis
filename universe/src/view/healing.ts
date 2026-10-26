// Healers tending the wounded (Phase 55 M229; asked for 2026-10-26: "Healers tending the
// wounded"): who tends whom on a town's day. Its healer — the seat its land's herb-lore keeps
// (Phase 55 M225) — goes the round of the wounded abed of a morning, door to door, the nearest
// next; makes salves at home of an afternoon while the wounded who are up come to have their wounds
// dressed; sees the newly wounded again of an evening; or, where the town keeps a hospital, keeps
// the day there. One of a household is kept home to tend one of theirs abed; a neighbour looks in,
// morning and evening, on one abed with no one at home; kin go to the hospital of an evening. Pure:
// the same plan and day, the same care. Where each door is, view/village.ts finds.
import { woundStage, type VillagePlan, type Wound, type WoundTended } from "../bridge/index.ts";
import { hurtOn, woundDay } from "./wounds.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** A healer's round: the most it sees, from when (h), how long at each door (s), the walk's pace (m/s); home by (h); the evening's for the newly wounded (from, the most, how long, how many days since they came home). */
export const ROUNDS = {
  most: 10,
  start: 7.5,
  visit: 20 * 60,
  pace: 1.25,
  home: 17,
  evening: 17.25,
  fresh: 4,
  freshVisit: 15 * 60,
  freshDays: 2,
} as const;
/** One kept home to tend (from, till: h); a neighbour's looks in (at these hours, for so long); kin at the hospital (from, for so long). */
export const TENDING = {
  from: 7,
  until: 19,
  looks: [9, 18],
  look: 30 * 60,
  visit: 18,
  visitLong: 40 * 60,
} as const;

/** One call in the care of the wounded: who comes, to which home (its index in the plan's homes) or the hospital, from and till (world seconds), at what, and why. */
export type CareVisit = {
  readonly who: number;
  readonly to: number | "hospital";
  readonly from: number;
  readonly until: number;
  readonly task: "heal" | "tend" | "grind" | null;
  readonly why: string;
};
/** A day's care: those whose day is given to it (their calls in order), and calls made from their own day. */
export type CareDay = {
  readonly scripts: ReadonlyMap<number, readonly CareVisit[]>;
  readonly calls: readonly CareVisit[];
};
const NONE: CareDay = { scripts: new Map(), calls: [] };
const CARES = new WeakMap<VillagePlan, Map<number, CareDay>>();

const firstName = (name: string) => name.split(" ")[0] ?? name;
const theirs = (sex?: number) => (sex === 0 ? "her" : sex === 1 ? "his" : "their");
const healing = (w: Wound, t: number) => {
  const s = woundStage(w, t);
  return s === "abed" || s === "mending";
};

/** A town's care of its wounded on a day (days since the world began). */
export function careOn(plan: VillagePlan, day: number): CareDay {
  let days = CARES.get(plan);
  if (!days) CARES.set(plan, (days = new Map()));
  const known = days.get(day);
  if (known) return known;
  const made = careOf(plan, day);
  if (days.size > 64) days.clear();
  days.set(day, made);
  return made;
}

function careOf(plan: VillagePlan, day: number): CareDay {
  const people = plan.people;
  if (!people.some((p) => p.wounds?.length)) return NONE;
  const d0 = day * DAY,
    noon = d0 + 12 * HOUR,
    scripts = new Map<number, CareVisit[]>(),
    calls: CareVisit[] = [],
    healer = people.findIndex((p) => !!p.healer),
    homeAt = (i: number) => plan.homes[people[i]!.home] ?? { x: 0, z: 0 },
    far = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.hypot(a.x - b.x, a.z - b.z),
    free = (i: number) =>
      !people[i]!.child && i !== healer && !scripts.has(i) && !hurtOn(plan, i, day);
  // Each one abed today (as noon finds them), at home or at the hospital, and their wound.
  const abed: { i: number; w: Wound; where: "home" | "hospital" }[] = [];
  people.forEach((p, i) => {
    if (!p.wounds?.length) return;
    const wd = woundDay(plan, i, day);
    if (wd.kind !== "abed") return;
    const w = p.wounds.find((x) => woundStage(x, noon) === "abed");
    if (w) abed.push({ i, w, where: wd.where });
  });
  // The healer's day, where they are fit for it.
  if (healer >= 0 && woundDay(plan, healer, day).kind === "whole") {
    const visits: CareVisit[] = [],
      atHospital = people.some((p) =>
        p.wounds?.some((w) => w.tended === "hospital" && healing(w, noon)),
      );
    if (atHospital)
      visits.push({
        who: healer,
        to: "hospital",
        from: d0 + 8 * HOUR,
        until: d0 + ROUNDS.home * HOUR,
        task: "heal",
        why: "Tending the wounded at the hospital",
      });
    else {
      let t = d0 + ROUNDS.start * HOUR,
        here = homeAt(healer);
      const seen = new Set<number>(),
        round = (
          list: readonly number[],
          most: number,
          long: number,
          why: (i: number) => string,
        ) => {
          const left = [...list];
          for (let k = 0; k < most && left.length; k++) {
            left.sort((a, b) => far(here, homeAt(a)) - far(here, homeAt(b)) || a - b);
            const i = left.shift()!,
              to = homeAt(i);
            t += far(here, to) / ROUNDS.pace;
            visits.push({
              who: healer,
              to: people[i]!.home,
              from: t,
              until: t + long,
              task: "heal",
              why: why(i),
            });
            t += long;
            here = to;
            seen.add(i);
          }
        },
        homeAgain = () => {
          t += far(here, homeAt(healer)) / ROUNDS.pace;
          here = homeAt(healer);
        };
      // The morning's round: those abed at home in the healer's care, home before it begins.
      round(
        abed
          .filter(
            (a) => a.where === "home" && a.w.tended === "healer" && a.i !== healer && a.w.home <= t,
          )
          .map((a) => a.i),
        ROUNDS.most,
        ROUNDS.visit,
        (i) => `Dressing ${firstName(people[i]!.name)}'s wounds, abed at home`,
      );
      const dressings = people.some((p, i) => {
          if (!p.wounds?.length) return false;
          const wd = woundDay(plan, i, day);
          return wd.kind === "mending" && wd.dress?.to === "healer";
        }),
        evening = people
          .map((_, i) => i)
          .filter(
            (i) =>
              i !== healer &&
              !seen.has(i) &&
              (people[i]!.wounds ?? []).some(
                (w) =>
                  w.tended === "healer" &&
                  w.home > d0 - ROUNDS.freshDays * DAY &&
                  w.home <= d0 + ROUNDS.home * HOUR &&
                  healing(w, d0 + ROUNDS.evening * HOUR),
              ),
          );
      if (visits.length || dressings || evening.length) {
        if (visits.length) homeAgain();
        // The afternoon at home, salves made; the wounded who are up come to be dressed.
        const from = Math.max(t, d0 + 9 * HOUR);
        if (from < d0 + ROUNDS.home * HOUR)
          visits.push({
            who: healer,
            to: people[healer]!.home,
            from,
            until: d0 + ROUNDS.home * HOUR,
            task: "grind",
            why: "Making salves at home; the wounded who are up come to have their wounds dressed",
          });
        // The evening's: the newly wounded seen again.
        t = Math.max(t, d0 + ROUNDS.evening * HOUR);
        round(
          evening,
          ROUNDS.fresh,
          ROUNDS.freshVisit,
          (i) => `Seeing to ${firstName(people[i]!.name)}'s fresh wounds`,
        );
      }
    }
    if (visits.length) scripts.set(healer, visits);
  }
  // One of a household kept home to tend one of theirs abed.
  for (const a of abed) {
    if (a.where !== "home" || a.w.tended !== "household") continue;
    const p = people[a.i]!,
      mate = people
        .map((_, j) => j)
        .find((j) => j !== a.i && people[j]!.home === p.home && free(j));
    if (mate === undefined) continue;
    scripts.set(mate, [
      {
        who: mate,
        to: p.home,
        from: d0 + TENDING.from * HOUR,
        until: d0 + TENDING.until * HOUR,
        task: "tend",
        why: `At home, tending ${firstName(p.name)}, abed with ${theirs(p.sex)} wounds`,
      },
    ]);
  }
  // A neighbour looking in on one abed with no one at home.
  const calling = (j: number) => calls.some((c) => c.who === j);
  for (const a of abed) {
    if (a.where !== "home" || a.w.tended !== "kin") continue;
    const p = people[a.i]!,
      home = homeAt(a.i),
      near = people
        .map((_, j) => j)
        .filter((j) => people[j]!.home !== p.home && free(j) && !calling(j))
        .sort((x, y) => far(homeAt(x), home) - far(homeAt(y), home) || x - y)[0];
    if (near === undefined) continue;
    for (const h of TENDING.looks)
      calls.push({
        who: near,
        to: p.home,
        from: d0 + h * HOUR,
        until: d0 + h * HOUR + TENDING.look,
        task: "tend",
        why: `Looking in on ${firstName(p.name)}, abed with ${theirs(p.sex)} wounds`,
      });
  }
  // Kin at the hospital of an evening.
  for (const a of abed) {
    if (a.where !== "hospital") continue;
    const p = people[a.i]!,
      kin = people
        .map((_, j) => j)
        .find((j) => j !== a.i && people[j]!.home === p.home && free(j) && !calling(j));
    if (kin === undefined) continue;
    calls.push({
      who: kin,
      to: "hospital",
      from: d0 + TENDING.visit * HOUR,
      until: d0 + TENDING.visit * HOUR + TENDING.visitLong,
      task: null,
      why: `Visiting ${firstName(p.name)} at the hospital`,
    });
  }
  return { scripts, calls };
}
