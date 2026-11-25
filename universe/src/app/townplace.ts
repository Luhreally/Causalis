// A town entered (town mode), the page's part: 🏘️ on a town's bar. The town's own scene stays, the eye goes near; its
// people are the place's (host/place.ts), kept one by one and found again whenever the town is come back to, drawn where
// the place has them; the chrome is the mode's own (ui/place-hud.ts): its clock and paces, a notice line, and six
// sheets, its people, its stocks, its work, what it can raise, what threatens it, and its log. A tap on one of its people, or on a building, opens
// the place's page of it. Orders are commands (sim/town/managed.ts); what the town did by them is told to its land at
// each month's turn while it is watched, and on leaving. The place runs on the world's own clock, set on entering to a
// pace a day can be watched at; leaving puts the clock and the god game's chrome back, and the town's usual people.
// How it is run (by hand, or watched: bridge/placemodes.ts) is the place's own to keep, asked on entering; a town watched
// is given no order from here, and the eye is led over it (app/townwatch.ts).
import "./townplace.css";
import {
  askedGrown,
  placeLotRef,
  type HostClient,
  type PlaceDangersSheet,
  type PlaceFrame,
  type PlaceLogSheet,
  type PlaceMode,
  type PlacePeopleSheet,
  type PlaceStocksSheet,
  type PlaceWorkSheet,
  type TownOffers,
  type VillagePlan,
} from "../bridge/index.ts";
import type { OrbitRig, VillageScene } from "../render/index.ts";
import { PlaceHud, type PageWindow, type PlaceTab, type VillagePanel } from "../ui/index.ts";
import { PlaceBodies, type TownThing } from "../view/index.ts";
import { installWatch, type WatchFlow } from "./townwatch.ts";

export type PlaceDeps = {
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly village: VillageScene;
  readonly rig: OrbitRig;
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
  /** A sheet opened, or closed (the look tools). */
  sheet(tab: PlaceTab | null): void;
  /** An order given (the look tools): the command, and what it asks beside the town. */
  order(type: string, args: Record<string, unknown>): Promise<string | null>;
  /** What its notice line tells (the look tools). */
  readonly noticed: string | null;
  /** Where a lot of the town entered stands on its ground (metres from its square; the look tools). */
  lotAt(lot: number): { x: number; z: number } | null;
  /** Where its walls' site is now, the length their line has come to (metres from its square; null: none going up; the look tools). */
  wallsAt(): { x: number; z: number } | null;
  /** How the town entered is run, and another way chosen: kept with its place. */
  readonly ran: PlaceMode;
  mode(mode: PlaceMode): Promise<void>;
  /** A town watched: what the eye is with, and what its line says (the look tools; null: not watched). */
  readonly watching: WatchFlow["now"];
  readonly captioned: { title: string; words: string; stay: boolean } | null;
  watchStay(on: boolean): void;
  watchNext(): void;
};

/** The eye over a town entered (world units; as a life's: app/life.ts): a few homes across. */
const EYE_NEAR = 9,
  EYE_PITCH = -48,
  /** How near a finger must come to one of its people (px): a fingertip's breadth. */
  TAP_REACH = 44,
  /** How often an open sheet is read again (ms). */
  SHEET_EVERY = 1000;

export function installPlace(d: PlaceDeps): PlaceFlow {
  const hud = new PlaceHud(d.hud);
  let town: string | null = null,
    body: PlaceBodies | null = null,
    told: PlaceFrame | null = null,
    stop: (() => void) | null = null,
    stopSheet: (() => void) | null = null,
    /** The clock's pace as it was before the town was entered (put back on leaving), and the pace chosen in it. */
    was: number | null = null,
    pace = 600,
    /** The month its doings were last told to its land in (sim/town/managed.ts place.settle). */
    settled = -1,
    settling = false,
    /** The sites it had in hand when last told, and when its plan was last read again for them (the page's clock, ms). */
    sited = "",
    replanned = 0,
    /** How it is run (the place's own to keep: asked on entering). */
    mode: PlaceMode = "hand";
  const watch = installWatch({
    client: d.client,
    village: d.village,
    rig: d.rig,
    plan: d.plan,
    ids: () => body?.ids ?? null,
    told: () => told,
    wallsAt: () => flow.wallsAt(),
    caption: (c) => hud.caption(c),
  });
  /** The way it is run taken up: its chrome, and the eye led where it is watched. */
  const ran = (next: PlaceMode): void => {
    mode = next;
    hud.mode(next);
    if (next === "watch" && town) watch.start(town);
    else watch.stop();
  };

  /** What the town did by its orders told to its land: at a month's turn, and on leaving. */
  const settle = async (): Promise<void> => {
    if (!town || settling) return;
    settling = true;
    try {
      await d.client.command("place.settle", { town });
    } catch {
      // (Nothing to tell, or the town given no order: nothing told.)
    } finally {
      settling = false;
    }
  };

  /** The people of the plan drawn laid where the place has them, and asked after from now on. */
  const lay = (): void => {
    stop?.();
    stop = null;
    const plan = d.plan();
    if (!town || !plan || plan.ref !== town) return;
    body = new PlaceBodies(
      plan,
      (lot) => d.village.townLot(lot),
      // (Its walls' site: the length their line has come to, as the town drawn has it.)
      (t) => {
        const ref = plan.town?.walls?.asked?.ref;
        return ref ? d.village.askedSpot(ref, t) : null;
      },
    );
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
        hud.time(f.t, pace);
        hud.notices(f.notices);
        // (A month's turn: what it did by its orders is told to its land.)
        if (settled < 0) settled = f.month;
        if (f.month !== settled) {
          settled = f.month;
          if (f.managed && (f.unsettled > 0 || f.sites.length > 0)) void settle();
        }
        sites(f);
      },
    );
  };

  /**
   * Its sites in hand, as told: one all done here is told to its land at once (then it stands); and the town is drawn
   * again where a site has got further, or less far, than its drawing has it going (a twenty-fifth of the whole), or has
   * been stopped, finished or given back.
   */
  const sites = (f: PlaceFrame): void => {
    if (f.sites.some((x) => x.raised)) void settle();
    const key = f.sites.map((x) => `${x.lot}${x.stopped || x.raised ? "s" : ""}`).join(","),
      civics = d.plan()?.town?.civics ?? [],
      off = f.sites.some((x) => {
        const c = civics.find((q) => (q.truly ?? q.at) === x.lot);
        return !!c?.asked && Math.abs(askedGrown(c.asked, f.t) - x.share) > 0.04;
      });
    if ((key === sited && !off) || performance.now() - replanned < 4000) return;
    sited = key;
    replanned = performance.now();
    if (town) void d.reload(town);
  };

  /** The sheet open read, and read again while it stays open. */
  const sheet = (tab: PlaceTab | null): void => {
    stopSheet?.();
    stopSheet = null;
    if (!town || !tab) return;
    const ref = town;
    if (tab === "people")
      stopSheet = d.client.subscribe<PlacePeopleSheet | null>(
        { type: "place.people", args: { ref, occ: hud.occ } },
        SHEET_EVERY,
        (s) => s && hud.people(s),
      );
    else if (tab === "stocks")
      stopSheet = d.client.subscribe<PlaceStocksSheet | null>(
        { type: "place.stocks", args: { ref } },
        SHEET_EVERY,
        (s) => s && hud.stocks(s),
      );
    else if (tab === "work")
      stopSheet = d.client.subscribe<PlaceWorkSheet | null>(
        { type: "place.work", args: { ref, occ: hud.gridOcc } },
        SHEET_EVERY,
        (s) => s && hud.work(s),
      );
    else if (tab === "dangers")
      stopSheet = d.client.subscribe<PlaceDangersSheet | null>(
        { type: "place.dangers", args: { ref } },
        SHEET_EVERY,
        (s) => s && hud.dangers(s),
      );
    else if (tab === "log")
      stopSheet = d.client.subscribe<PlaceLogSheet | null>(
        { type: "place.log", args: { ref } },
        SHEET_EVERY,
        (s) => s && hud.log(s),
      );
    else
      stopSheet = d.client.subscribe<TownOffers | null>(
        { type: "town.offers", args: { ref } },
        SHEET_EVERY,
        (s) => hud.build(s),
      );
  };

  const order = async (type: string, args: Record<string, unknown>): Promise<string | null> => {
    if (!town) return "no town is entered";
    if (mode === "watch") return "the town is watched: no order is given it";
    try {
      // (A site given back: what its crew did is told to its land first, or it would be lost with them.)
      if (type === "place.site" && args.hands === null) await settle();
      // (What a town is asked to raise is asked as the god game asks it: sim/town/asks.ts.)
      await d.client.command(
        type,
        type === "town.ask" ? { village: town, ...args } : { town, ...args },
      );
      // (The sheet read again at once: an order shows as soon as it is given.)
      sheet(hud.tab);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };

  const leave = async (): Promise<void> => {
    if (!town) return;
    const left = town;
    // (What it did by its orders told to its land before it is left.)
    if (told?.managed && (told.unsettled > 0 || told.sites.length > 0)) await settle();
    town = null;
    sited = "";
    ran("hand");
    stop?.();
    stopSheet?.();
    stop = stopSheet = null;
    if (body && d.village.posed === body) d.village.posed = null;
    body = null;
    told = null;
    settled = -1;
    if (was !== null) d.client.setSpeed(was);
    was = null;
    hud.hide();
    d.panel.placeNow(null);
    // (Its usual people back, if it is still the town shown.)
    if (d.scale() === "village" && d.plan()?.ref === left) await d.reload(left);
  };

  const enter = async (): Promise<void> => {
    const plan = d.plan();
    if (!plan || d.scale() !== "village" || plan.native) return;
    town = plan.ref;
    was = d.client.status?.speed ?? 0;
    d.client.setSpeed(pace);
    d.pages.close();
    hud.show(plan.name);
    hud.time(d.client.status?.t ?? 0, pace);
    // (The eye near: a few homes across, its people to be told apart.)
    d.rig.flyTo({ distance: EYE_NEAR, pitch: EYE_PITCH }, 0.9);
    const ref = town;
    await d.reload(ref);
    // (The plan read is laid by planRead; a town left meanwhile is left.)
    // (How it was run when it was last left, as its place keeps it.)
    try {
      const kept = await d.client.query<PlaceMode | null>({ type: "place.mode", args: { ref } });
      if (town === ref && kept) ran(kept);
    } catch {
      // (By hand.)
    }
  };

  hud.onPace = (seconds) => flow.pace(seconds);
  hud.onLeave = () => void leave();
  hud.onTab = (tab) => sheet(tab);
  hud.onOpen = (ref) => void d.pages.open(ref);
  hud.onOrder = (type, args) => void order(type, args);
  hud.onMode = (next) => void flow.mode(next);
  hud.onStay = (on) => watch.stay(on);
  hud.onNext = () => watch.next();

  const flow: PlaceFlow = {
    get on() {
      return town !== null;
    },
    get town() {
      return town;
    },
    get told() {
      return told;
    },
    get noticed() {
      return hud.noticed;
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
      if (!town) return false;
      // (Every tap in a town entered is the mode's: one that finds no one and nothing of it opens no page of the god
      // game's, whose chrome is away. Found by the look: a tap beside one of its people opened its land's page.)
      const plan = d.plan();
      if (!body || !plan || plan.ref !== town) return true;
      // The nearest of the place's own people within a fingertip (of those the plan draws, never one of the town
      // view's own figures drawn beside them).
      let person: (typeof plan.people)[number] | undefined,
        near = TAP_REACH * TAP_REACH;
      plan.people.forEach((q, i) => {
        const s = d.village.personOnScreen(i);
        if (!s) return;
        const far = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
        if (far < near) {
          near = far;
          person = q;
        }
      });
      if (person) {
        // (In a town watched the eye goes with them, and stays; their page is a tap on their line away.)
        const id = mode === "watch" ? body.ids[plan.people.indexOf(person)] : null;
        if (id !== null && id !== undefined) watch.goWith(id);
        else void d.pages.open(person.page ?? person.ref);
        return true;
      }
      const thing = d.townThing(x, y);
      if (thing?.kind === "civic" || thing?.kind === "lot")
        void d.pages.open(placeLotRef(town, thing.kind === "civic" ? thing.at : thing.lot));
      return true;
    },
    frame: () => {
      if (!town) return;
      // (Gone from the town, or another has taken its people up, a life lived or a body possessed: left.)
      if (d.scale() !== "village" || (body && d.village.posed !== body)) return void leave();
      watch.frame();
    },
    pace: (seconds) => {
      pace = Math.max(0, seconds);
      if (town) d.client.setSpeed(pace);
      if (told) hud.time(told.t, pace);
    },
    sheet: (tab) => hud.open(tab),
    order,
    lotAt: (lot) => (town ? d.village.townLot(lot) : null),
    wallsAt: () => {
      const ref = d.plan()?.town?.walls?.asked?.ref,
        at = town && ref ? d.village.askedSpot(ref, told?.t ?? d.client.status?.t ?? 0) : null;
      return at ? { x: at.x, z: at.z } : null;
    },
    get ran() {
      return mode;
    },
    mode: async (next) => {
      const ref = town;
      if (!ref || next === mode) return;
      const kept = await d.client.query<PlaceMode | null>({
        type: "place.mode",
        args: { ref, mode: next },
      });
      if (town === ref && kept) ran(kept);
    },
    get watching() {
      return watch.now;
    },
    get captioned() {
      return hud.captioned;
    },
    watchStay: (on) => watch.stay(on),
    watchNext: () => watch.next(),
  };
  return flow;
}
