// A town entered (town mode), the page's part: 🏘️ on a town's bar. The town's own scene stays, the eye goes near; its
// people are the place's (host/place.ts), kept one by one and found again whenever the town is come back to, drawn where
// the place has them; the chrome is the mode's own (ui/place-hud.ts): its clock and paces, a notice line, and six
// sheets, its people, its stocks, its work, what it can raise, what threatens it, and its log. A tap on one of its people, or on a building, opens
// the place's page of it. Orders are commands (sim/town/managed.ts); what the town did by them is told to its land at
// each month's turn while it is watched, and on leaving. The place runs on the world's own clock, set on entering to a
// pace a day can be watched at; leaving puts the clock and the god game's chrome back, and the town's usual people.
// How it is run (by hand, watched, or by its own head: bridge/placemodes.ts) is the place's own to keep, asked on
// entering; a town watched is given no order from here, and the eye is led over it (app/townwatch.ts); a town stewarded
// is asked every second what its head has decided, and each order is given here as a player's is (host/steward.ts).
import "./townplace.css";
import {
  PLACE_AT,
  askedGrown,
  placeLotRef,
  placePersonRef,
  placedId,
  type HostClient,
  type PlaceDangersSheet,
  type PlaceFrame,
  type PlaceLogSheet,
  type PlaceMode,
  type PlaceNotice,
  type PlaceInspect,
  type PlaceWatch,
  type PlacePeopleSheet,
  type PlaceStocksSheet,
  type PlaceWorkSheet,
  type TownOffers,
  type VillagePlan,
} from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type VillageScene } from "../render/index.ts";
import {
  PlaceHud,
  PlaceInspector,
  type PageWindow,
  type PlaceTab,
  type PlaceWeather,
  type VillagePanel,
} from "../ui/index.ts";
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
  /** The weather over the town now, as the god game's bar has it (null: none told). */
  readonly weather: () => PlaceWeather | null;
  /** The game's sound, for the mode's menu (null: none to be had). */
  readonly sound: { on(): boolean; set(on: boolean): void } | null;
  /** Light with no side to it, over the hour's own (render/stage.ts fill): the mode's floor at night. */
  readonly fill: (x: number) => void;
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
  /** The mode's inspector opened on a ref (null: closed), what it shows, and its height (the look tools). */
  inspect(ref: string | null): void;
  readonly inspected: { ref: string | null; height: string; name: string; chosen: number | null };
  inspectHeight(h: "peek" | "half" | "full"): void;
  /** How tall its people stand on the screen now, the middle of those drawn (px; the look tools). */
  figurePx(): number;
  /** The eye put again as on entering, at the next frame (the look tools: the entry's framing by day). */
  reframe(): void;
  /** What the mode's own chrome has cost the page's frames since last asked: its ms all told, and the frames (the look tools). */
  uiCost(): { ms: number; frames: number };
};

/** The eye over a town entered (world units; as a life's: app/life.ts): a few homes across. */
const EYE_NEAR = 9,
  EYE_PITCH = -48,
  /** How near a finger must come to one of its people (px): a fingertip's breadth. */
  TAP_REACH = 44,
  /** How often an open sheet is read again (ms). */
  SHEET_EVERY = 1000,
  /**
   * The light with no side to it laid over a town entered at night (render/stage.ts fill): enough that its people and
   * what they wear are told apart in the dark, as a colony sim's night is; none by day.
   */
  NIGHT_FILL = 0.16,
  /**
   * The eye on entering, over where most of its people are out of doors (world units, as EYE_NEAR), for each pixel of the
   * screen's height: a figure stands about 0.138 × the screen's height ÷ the eye's distance pixels tall (measured: 24.7
   * px at 5.2 on a phone's 932, 21.3 at 5.2 on a desk's 800), so this puts one at some 26 px, a finger's breadth, on any.
   */
  EYE_ENTRY_PER_PX = 0.138 / 26,
  /** How often what the inspector shows is read again (ms). */
  INSPECT_EVERY = 500,
  /** A body's height for the name over one chosen (metres). */
  TAG_HIGH = 2.1;

export function installPlace(d: PlaceDeps): PlaceFlow {
  // (What the mode's chrome costs the page: its alerts, clock and sky as a frame is told, its ring and name each frame.)
  let uiMs = 0,
    uiFrames = 0;
  const timed = (f: () => unknown): void => {
    const t0 = performance.now();
    f();
    uiMs += performance.now() - t0;
  };
  const hud = new PlaceHud(d.hud);
  hud.sound = d.sound;
  const inspector = new PlaceInspector(hud.element),
    marks = document.createElement("div"),
    ring = document.createElement("div"),
    tag = document.createElement("div");
  // (The ring at the feet of the one chosen and their name over them: labels on the scene, no window of the HUD.)
  marks.className = "labels place-marks";
  ring.className = "place-ring";
  tag.className = "place-tag";
  ring.hidden = tag.hidden = true;
  marks.append(ring, tag);
  hud.element.prepend(marks);
  /** Who is chosen (their number in the place; null: no one), and the inspector's reading of what it shows. */
  let chosen: number | null = null,
    stopInspect: (() => void) | null = null,
    framed = false;
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
  /** A town stewarded: the last of its head's orders given, and the next asking. */
  let headGave = 0,
    headTimer: ReturnType<typeof setTimeout> | null = null;
  const stewardAsk = async (): Promise<void> => {
    headTimer = null;
    const ref = town;
    if (!ref || mode !== "steward") return;
    try {
      const w = await d.client.query<PlaceWatch | null>({
        type: "place.watch",
        args: { ref, since: told?.t ?? 0, after: headGave },
      });
      if (w && town === ref && mode === "steward") {
        hud.head(w.head);
        // (Each given once, in the order decided, as a player's order is: sim/town/managed.ts.)
        for (const o of w.orders) {
          if (town !== ref || mode !== "steward") break;
          headGave = Math.max(headGave, o.n);
          await order(o.type, o.args);
        }
      }
    } catch {
      // (Asked again in a moment.)
    }
    if (town === ref && mode === "steward") headTimer = setTimeout(() => void stewardAsk(), 1000);
  };
  /** The way it is run taken up: its chrome, the eye led where it is watched, its head asked where it is stewarded. */
  const ran = (next: PlaceMode): void => {
    mode = next;
    hud.mode(next);
    if (next === "watch" && town) watch.start(town);
    else watch.stop();
    if (headTimer) clearTimeout(headTimer);
    headTimer = null;
    headGave = 0;
    if (next === "steward" && town) void stewardAsk();
    else hud.head(null);
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
        const t0 = performance.now();
        hud.time(f.t, pace, f.season);
        hud.sky(d.weather(), f.warmth);
        hud.alerts(f.notices);
        night(f.t);
        uiMs += performance.now() - t0;
        if (!framed) frameEntry(f.t);
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

  /** The floor of light at night: by the hour of its clock, eased over dusk and dawn. */
  let filled = -1;
  const night = (t: number): void => {
    const hour = (((t % 86_400) + 86_400) % 86_400) / 3600,
      dark =
        hour < 5 || hour >= 21 ? 1 : hour < 7 ? (7 - hour) / 2 : hour >= 19 ? (hour - 19) / 2 : 0,
      fill = Math.round(NIGHT_FILL * dark * 100) / 100;
    if (fill === filled) return;
    filled = fill;
    d.fill(fill);
  };

  /** Where a lot of the town is (metres from its square), the fields and the square too. */
  const lotPoint = (lot: number): { x: number; z: number } | null => {
    if (lot === PLACE_AT.square || lot === PLACE_AT.none) return { x: 0, z: 0 };
    if (lot === PLACE_AT.fields) return d.plan()?.pasture ?? null;
    if (lot === PLACE_AT.walls) return flow.wallsAt();
    return d.village.townLot(lot);
  };
  /** Where one of its people is drawn now (metres from its square; null: not drawn). */
  const personPoint = (id: number): { x: number; z: number } | null => {
    const k = body?.ids.indexOf(id) ?? -1,
      person = k >= 0 ? d.plan()?.people[k] : undefined;
    return person ? d.village.personAt(person.ref) : null;
  };
  /** The eye flown to a point of the town (metres from its square). */
  const lookAt = (at: { x: number; z: number }): void => {
    d.rig.follow = null;
    d.rig.flyTo(
      {
        target: { x: at.x * VILLAGE_METRE, y: 0, z: at.z * VILLAGE_METRE },
        distance: EYE_NEAR * 0.8,
        pitch: EYE_PITCH,
      },
      0.8,
    );
  };
  /** An alert tapped: the eye goes to where it is, or to whom it is of; and what it is of is opened. */
  const alerted = (n: PlaceNotice): void => {
    const at =
      (n.id !== null ? personPoint(n.id) : null) ?? (n.lot !== null ? lotPoint(n.lot) : null);
    if (at) lookAt(at);
    const ref = n.id !== null && town ? placePersonRef(town, n.id) : n.ref;
    if (ref) inspect(ref);
  };

  /** What the inspector shows, as the hud lays it out: its height, and whether it is open. */
  const laid = (): void => {
    const open = inspector.shown,
      tall = open && inspector.height !== "peek";
    hud.element.classList.toggle("insp-open", open);
    hud.element.classList.toggle("insp-tall", tall);
  };
  /**
   * The inspector opened on what a ref names (one of its people, a lot; null: closed), and read every half second while
   * it stays open. What the place has no inspector for (a realm's page, a sickness) is the god game's page.
   */
  const inspect = (ref: string | null): void => {
    stopInspect?.();
    stopInspect = null;
    if (ref && !/^(plc|plcl|folk|person):/.test(ref)) {
      void d.pages.open(ref);
      return;
    }
    d.pages.close();
    inspector.orders = mode !== "watch";
    inspector.open(ref);
    if (!ref || !town) {
      choose(null);
      laid();
      return;
    }
    const id = placedId(ref);
    if (ref.startsWith("plcl:")) choose(null);
    else if (id !== null) choose(id);
    // (A sheet open under it is kept where the inspector is only peeked; a taller one takes the sheet's place.)
    if (inspector.height !== "peek" && hud.tab) hud.open(null);
    laid();
    const asked = ref,
      at = town;
    const query = { type: "place.inspect", args: { ref: at, of: asked } } as const,
      told = (x: PlaceInspect | null): void => {
        if (inspector.ref !== asked) return;
        // (An asking the host could not answer comes as its error: said, not shown as nothing.)
        if (x && "error" in x) {
          console.warn(`place.inspect ${asked}: ${(x as { error: string }).error}`);
          return;
        }
        // (One the god game names and the place does not keep: their page is the god game's.)
        if (!x && !asked.startsWith("plc")) {
          inspect(null);
          void d.pages.open(asked);
          return;
        }
        if (x?.kind === "person" && chosen !== x.id) choose(x.id);
        timed(() => inspector.show(x));
      };
    // (Asked at once, then kept: a subscription's first answer waits on the host's round of them.)
    void d.client.query<PlaceInspect | null>(query).then(told, () => undefined);
    stopInspect = d.client.subscribe<PlaceInspect | null>(query, INSPECT_EVERY, told);
  };
  /** One of its people chosen (their number in the place; null: no one): a ring at their feet, their name over them. */
  const choose = (id: number | null): void => {
    if (id === chosen) return;
    chosen = id;
    if (id === null) {
      ring.hidden = tag.hidden = true;
      if (inspector.following) follow(false);
    }
  };
  /** The eye kept with the one chosen, or let go. */
  const follow = (on: boolean): void => {
    inspector.following = on && chosen !== null;
    const id = chosen;
    if (inspector.following && id !== null) {
      const at = { x: 0, z: 0 },
        keep = () => {
          const p = personPoint(id);
          if (p) {
            at.x = p.x;
            at.z = p.z;
          }
          return { x: at.x * VILLAGE_METRE, y: 0, z: at.z * VILLAGE_METRE };
        };
      d.rig.follow = keep;
    } else if (d.rig.follow) d.rig.follow = null;
    if (inspector.now) inspector.show(inspector.now);
  };
  /** The ring and the name over the one chosen, where they are drawn now (each frame; nothing where no one is chosen). */
  const marked = (): void => {
    if (chosen === null) return;
    const p = personPoint(chosen),
      foot = p ? d.village.screenOf(p.x, p.z, 0) : null,
      head = p ? d.village.screenOf(p.x, p.z, TAG_HIGH) : null;
    if (!foot || !head) {
      if (!ring.hidden) ring.hidden = tag.hidden = true;
      return;
    }
    const tall = Math.max(8, foot.y - head.y),
      wide = Math.max(1, Math.min(3, tall / 30));
    ring.hidden = tag.hidden = false;
    ring.style.transform = `translate(${foot.x.toFixed(1)}px, ${foot.y.toFixed(1)}px) scale(${wide.toFixed(2)})`;
    tag.style.transform = `translate(calc(${head.x.toFixed(1)}px - 50%), calc(${head.y.toFixed(1)}px - 100%))`;
    const name = inspector.now?.kind === "person" ? inspector.now.name : "";
    if (tag.textContent !== name) tag.textContent = name;
  };
  /**
   * The eye on entering, over where most of its people are out of doors, near enough to tell them apart: once its people
   * are drawn where the place has them (a 15 m grid's fullest square; the square itself where none is about).
   */
  const frameEntry = (t: number): void => {
    const plan = d.plan();
    if (!plan || !body) return;
    const cells = new Map<string, { n: number; x: number; z: number }>();
    let drawn = 0;
    for (const q of plan.people) {
      const at = d.village.personAt(q.ref);
      if (!at) continue;
      drawn++;
      const key = `${Math.floor(at.x / 15)},${Math.floor(at.z / 15)}`,
        c = cells.get(key) ?? { n: 0, x: 0, z: 0 };
      c.n++;
      c.x += at.x;
      c.z += at.z;
      cells.set(key, c);
    }
    // (At night all are within: the square, as it would be framed by day. By day, none yet drawn: wait a frame.)
    const hour = (((t % 86_400) + 86_400) % 86_400) / 3600;
    if (!drawn && hour >= 6 && hour < 21) return;
    framed = true;
    let best = { n: 0, x: 0, z: 0 };
    for (const c of cells.values()) if (c.n > best.n) best = c;
    const x = best.n ? best.x / best.n : 0,
      z = best.n ? best.z / best.n : 0;
    d.rig.flyTo(
      {
        target: { x: x * VILLAGE_METRE, y: 0, z: z * VILLAGE_METRE },
        distance: EYE_ENTRY_PER_PX * Math.max(480, innerHeight),
        pitch: EYE_PITCH,
      },
      0.9,
    );
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
        (s) => timed(() => s && hud.people(s)),
      );
    else if (tab === "stocks")
      stopSheet = d.client.subscribe<PlaceStocksSheet | null>(
        { type: "place.stocks", args: { ref } },
        SHEET_EVERY,
        (s) => timed(() => s && hud.stocks(s)),
      );
    else if (tab === "work")
      stopSheet = d.client.subscribe<PlaceWorkSheet | null>(
        { type: "place.work", args: { ref, occ: hud.gridOcc } },
        SHEET_EVERY,
        (s) => timed(() => s && hud.work(s)),
      );
    else if (tab === "dangers")
      stopSheet = d.client.subscribe<PlaceDangersSheet | null>(
        { type: "place.dangers", args: { ref } },
        SHEET_EVERY,
        (s) => timed(() => s && hud.dangers(s)),
      );
    else if (tab === "log")
      stopSheet = d.client.subscribe<PlaceLogSheet | null>(
        { type: "place.log", args: { ref } },
        SHEET_EVERY,
        (s) => timed(() => s && hud.log(s)),
      );
    else
      stopSheet = d.client.subscribe<TownOffers | null>(
        { type: "town.offers", args: { ref, all: true } },
        SHEET_EVERY,
        (s) => timed(() => hud.build(s)),
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
    inspect(null);
    framed = false;
    stop?.();
    stopSheet?.();
    stop = stopSheet = null;
    if (body && d.village.posed === body) d.village.posed = null;
    body = null;
    told = null;
    settled = -1;
    if (was !== null) d.client.setSpeed(was);
    was = null;
    filled = -1;
    d.fill(0);
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
    framed = false;
    hud.show(plan.name);
    hud.time(d.client.status?.t ?? 0, pace);
    // (How it is to be run, asked as it is entered: the way it was run when last left is lit.)
    hud.choosing(true, true);
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
  hud.onOpen = (ref) => inspect(ref);
  hud.onAlert = (n) => alerted(n);
  hud.onEscape = () => {
    d.pages.close();
    inspect(null);
  };
  hud.onFollow = () => {
    if (chosen === null) return false;
    follow(!inspector.following);
    return true;
  };
  hud.onSheet = (tab) => {
    // (A sheet opened under a tall inspector: the inspector goes down to a peek, above it.)
    if (tab && inspector.shown && inspector.height !== "peek") inspector.setHeight("peek");
    laid();
  };
  inspector.onClose = () => inspect(null);
  inspector.onInspect = (ref) => inspect(ref);
  inspector.onPage = (ref) => void d.pages.open(ref);
  inspector.onFollow = (on) => follow(on);
  inspector.onOrder = (type, args) =>
    void order(type, args).then(() => {
      if (inspector.ref) inspect(inspector.ref);
    });
  inspector.onHeight = (h) => {
    if (h !== "peek" && hud.tab && !hud.desk) hud.open(null);
    laid();
  };
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
        // (Chosen: a ring at their feet, their name over them, their inspector open. In a town watched the eye goes with
        // them too, and stays.)
        const id = body.ids[plan.people.indexOf(person)];
        if (id !== null && id !== undefined) {
          if (mode === "watch") watch.goWith(id);
          inspect(placePersonRef(town, id));
        } else void d.pages.open(person.page ?? person.ref);
        return true;
      }
      const thing = d.townThing(x, y);
      if (thing?.kind === "civic" || thing?.kind === "lot")
        inspect(placeLotRef(town, thing.kind === "civic" ? thing.at : thing.lot));
      // (A tap on the bare ground lets go of whom or what was chosen.)
      else inspect(null);
      return true;
    },
    frame: () => {
      if (!town) return;
      // (Gone from the town, or another has taken its people up, a life lived or a body possessed: left.)
      if (d.scale() !== "village" || (body && d.village.posed !== body)) return void leave();
      watch.frame();
      const t0 = performance.now();
      marked();
      // (The view steered by hand lets go of whom it was kept with.)
      if (inspector.following && !d.rig.follow) follow(false);
      uiMs += performance.now() - t0;
      uiFrames++;
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
    inspect: (ref) => inspect(ref),
    get inspected() {
      const x = inspector.now;
      return {
        ref: inspector.ref,
        height: inspector.height,
        name: x ? (x.kind === "person" ? x.name : x.name) : "",
        chosen,
      };
    },
    inspectHeight: (h) => inspector.setHeight(h),
    uiCost: () => {
      const out = { ms: uiMs, frames: uiFrames };
      uiMs = uiFrames = 0;
      return out;
    },
    reframe: () => {
      framed = false;
    },
    figurePx: () => {
      const tall: number[] = [];
      for (const q of d.plan()?.people ?? []) {
        const at = d.village.personAt(q.ref),
          foot = at ? d.village.screenOf(at.x, at.z, 0) : null,
          head = at ? d.village.screenOf(at.x, at.z, 1.7) : null;
        if (foot && head && foot.x > 0 && foot.x < innerWidth && foot.y > 0 && foot.y < innerHeight)
          tall.push(foot.y - head.y);
      }
      tall.sort((a, b) => a - b);
      return tall.length ? tall[tall.length >> 1]! : 0;
    },
  };
  return flow;
}
