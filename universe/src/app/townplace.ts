// A town entered (town mode, first slice), the page's part: 🏘️ on a town's bar. The town's own scene and eye stay; its
// people are the place's (host/place.ts), kept one by one and found again whenever the town is come back to, drawn where
// the place has them; a tap on one, or on a building, opens the place's page of it. The place runs on the world's own
// clock, set on entering to a pace a day can be watched at (the time bar's keys change it); leaving puts the clock back
// and the town's usual people with it.
import "./townplace.css";
import {
  placeLotRef,
  type HostClient,
  type PlaceFrame,
  type VillagePlan,
} from "../bridge/index.ts";
import type { VillageScene } from "../render/index.ts";
import type { PageWindow, VillagePanel } from "../ui/index.ts";
import { PlaceBodies, type TownThing } from "../view/index.ts";

export type PlaceDeps = {
  readonly client: HostClient;
  readonly village: VillageScene;
  readonly pages: PageWindow;
  readonly panel: VillagePanel;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly reload: (ref: string) => Promise<void>;
  /** What of the town's fabric stands under a point of the screen. */
  readonly townThing: (x: number, y: number) => TownThing | null;
};
export type PlaceFlow = {
  readonly on: boolean;
  /** The town entered (null: none). */
  readonly town: string | null;
  /** 🏘️ pressed: the town shown entered, or left. */
  toggle(): Promise<void>;
  leave(): Promise<void>;
  /** The asking a town's plan is read by: the place's while it is the one entered. */
  planQuery(ref: string): "village.plan" | "place.plan";
  /** The town's plan was read again (main.ts): its people laid anew. */
  planRead(): void;
  /** A tap in the town: taken while it is entered. */
  tapped(x: number, y: number): boolean;
  /** Called every frame: left behind when the town is. */
  frame(): void;
  /** Where the place has its people now, as last told (the look tools). */
  readonly told: PlaceFrame | null;
  /** The pace its clock runs at while it is entered (the clock's seconds a second; 0: stopped). */
  pace(seconds: number): void;
};

const DOING = [
  "at rest",
  "asleep",
  "eating",
  "at work",
  "fetching",
  "carrying",
  "warming",
  "in company",
  "waiting",
];

export function installPlace(d: PlaceDeps): PlaceFlow {
  let town: string | null = null,
    body: PlaceBodies | null = null,
    told: PlaceFrame | null = null,
    stop: (() => void) | null = null,
    /** The clock's pace as it was before the town was entered (put back on leaving), and the pace chosen in it. */
    was: number | null = null,
    pace = 600;

  const say = (): void => {
    if (!town) return d.panel.placeNow(null);
    const f = told;
    if (!f) return d.panel.placeNow("Entering…");
    const hour = Math.floor((f.t % 86_400) / 3600),
      minute = Math.floor((f.t % 3600) / 60),
      most = f.doing
        .map((n, k) => [n, k] as const)
        .filter(([n]) => n > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 4)
        .map(([n, k]) => `${n} ${DOING[k]}`)
        .join(", "),
      kept = f.kept < f.people ? `${f.kept} of ${f.people} kept` : `${f.kept} people kept`;
    d.panel.placeNow(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} · ${kept}, ${f.households} households · ${most}`,
    );
  };

  /** The people of the plan drawn laid where the place has them, and asked after from now on. */
  const lay = (): void => {
    stop?.();
    stop = null;
    const plan = d.plan();
    if (!town || !plan || plan.ref !== town) return;
    body = new PlaceBodies(plan, (lot) => d.village.townLot(lot));
    body.frame = told;
    d.village.posed = body;
    const mine = body;
    stop = d.client.subscribe<PlaceFrame | null>(
      { type: "place.frame", args: { ref: town, ids: body.asked } },
      250,
      (f) => {
        if (body !== mine) return;
        // (No such town any more, or no one in it: left.)
        if (!f) return void leave();
        told = mine.frame = f;
        say();
      },
    );
  };

  const leave = async (): Promise<void> => {
    if (!town) return;
    const left = town;
    town = null;
    stop?.();
    stop = null;
    if (body && d.village.posed === body) d.village.posed = null;
    body = null;
    told = null;
    if (was !== null) d.client.setSpeed(was);
    was = null;
    say();
    // (Its usual people back, if it is still the town shown.)
    if (d.scale() === "village" && d.plan()?.ref === left) await d.reload(left);
  };

  const enter = async (): Promise<void> => {
    const plan = d.plan();
    if (!plan || d.scale() !== "village" || plan.native) return;
    town = plan.ref;
    was = d.client.status?.speed ?? 0;
    d.client.setSpeed(pace);
    say();
    await d.reload(town);
    // (The plan read is laid by planRead; a town left meanwhile is left.)
  };

  return {
    get on() {
      return town !== null;
    },
    get town() {
      return town;
    },
    get told() {
      return told;
    },
    toggle: () => (town ? leave() : enter()),
    leave,
    planQuery: (ref) => (town === ref ? "place.plan" : "village.plan"),
    planRead: () => {
      if (!town) return;
      if (d.plan()?.ref !== town) return void leave();
      lay();
    },
    tapped: (x, y) => {
      const plan = d.plan();
      if (!town || !body || !plan || plan.ref !== town) return false;
      const i = d.village.pick(x, y),
        person = i === null ? undefined : plan.people[i];
      if (person && body.ids[i!] !== null) {
        void d.pages.open(person.ref);
        return true;
      }
      const thing = d.townThing(x, y);
      if (thing?.kind === "civic" || thing?.kind === "lot") {
        void d.pages.open(placeLotRef(town, thing.kind === "civic" ? thing.at : thing.lot));
        return true;
      }
      return false;
    },
    frame: () => {
      if (!town) return;
      // (Gone from the town, or another has taken its people up, a life lived or a body possessed: left.)
      if (d.scale() !== "village" || (body && d.village.posed !== body)) void leave();
    },
    pace: (seconds) => {
      pace = Math.max(0, seconds);
      if (town) d.client.setSpeed(pace);
      say();
    },
  };
}
