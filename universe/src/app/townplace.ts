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
  type BarRead,
  type HostClient,
  type PlaceDangersSheet,
  type PlaceFrame,
  type PlaceLogSheet,
  type PlaceMode,
  type PlaceNotice,
  type PlaceInspect,
  type PlaceOverlay,
  type PlaceWatch,
  type PlacePeopleSheet,
  type PlaceStocksSheet,
  type PlaceWorkSheet,
  type TownOffers,
  type VillagePlan,
} from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type VillageScene } from "../render/index.ts";
import type { OrbitView } from "../view/zoom.ts";
import type { PageWindow, PlaceTab, PlaceWeather, VillagePanel } from "../ui/index.ts";
// (The mode's own, read from their modules, not the barrels the god game reads: so they come in this chunk alone, fetched
// when a town is first entered: app/townlazy.ts.)
import { PlaceHud, seasonWord } from "../ui/place-hud.ts";
import { barPins } from "../ui/people-bar.ts";
import { PlaceInspector } from "../ui/place-inspect.ts";
import type { PlaceLoading } from "../ui/place-loading.ts";
import type { TownThing } from "../view/index.ts";
import { PlaceBodies } from "../view/placefolk.ts";
import { installWatch, type WatchFlow } from "./townwatch.ts";
import { OVERLAY_SHADES, PlaceOverlayLayer, overlayColour, shadeOf } from "./townoverlay.ts";

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
  /** The screen that stands while a town is entered (O1; app/townlazy.ts shows it before this chunk is fetched). */
  readonly loading?: PlaceLoading;
  /** What befell the town while it was run, told once it is left (O1: "While you ran…"; ui/ran.ts). */
  readonly ranTown?: (title: string, lines: readonly string[]) => void;
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
  /** The inspector's Back key pressed, and whether the eye is kept with anyone (the look tools). */
  back(): void;
  ahead(): void;
  readonly following: boolean;
  /** What is drawn over heads near the eye now (Q1; the look tools): how many signs, and of them marks between two talking. */
  readonly bubbles: { signs: number; talks: number; near: number };
  readonly inspected: {
    ref: string | null;
    height: string;
    name: string;
    chosen: number | null;
    /** How long its first answer took to come, from the asking (ms; null: not yet). */
    answered: number | null;
  };
  inspectHeight(h: "peek" | "half" | "full"): void;
  /** How tall its people stand on the screen now, the middle of those drawn (px; the look tools). */
  figurePx(): number;
  /** The eye put again as on entering, at the next frame (the look tools: the entry's framing by day). */
  reframe(): void;
  /** What the mode's own chrome has cost the page's frames since last asked: its ms all told, and the frames (the look tools). */
  uiCost(): { ms: number; frames: number; loaded: number };
  /** The overlay as laid on the ground (the look tools): its lots laid, and where those on the screen stand. */
  overlaid(): { lots: number; spots: { i: number; x: number; y: number; shade: number }[] };
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
  /** How far back the eye is drawn when an overlay is turned on (as EYE_NEAR): the town's middle and its lots about. */
  EYE_OVERLAY = 2.6,
  /** How often what the inspector shows is read again (ms). */
  INSPECT_EVERY = 500,
  /** A body's height for the name over one chosen (metres). */
  TAG_HIGH = 2.1,
  /** Q1's signs over heads: how many at most, how high over the ground (metres), how tall one must be drawn to have one
   * (px: those near the eye only), and their size (px). */
  BUBBLES = 24,
  BUBBLE_HIGH = 2.3,
  BUBBLE_TALL = 22,
  BUBBLE_W = 26,
  /** How often the signs over heads are chosen anew (ms); between, those chosen are only kept over their heads. */
  BUBBLE_EVERY = 120;

export function installPlace(d: PlaceDeps): PlaceFlow {
  // (What the mode's chrome costs the page: its alerts, clock and sky as a frame is told, its ring and name each frame.)
  let uiMs = 0,
    uiFrames = 0,
    /** How long the loading screen stood when the town was last entered (ms; 0: none yet). */
    entered = 0,
    /** The place's clock when it was entered (its first frame told; null: not entered). */
    enteredAt: number | null = null;
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
  // (Over heads near the eye, what bears most on them or what they are at, and a mark between two talking: Q1. Pooled.)
  const bubbles: HTMLSpanElement[] = [];
  for (let k = 0; k < BUBBLES; k++) {
    const b = document.createElement("span");
    b.className = "place-bubble off";
    bubbles.push(b);
  }
  // (Its overlay on the lots' ground in the scene, read again each second while it is shown; its words by the pointer.)
  const overlay = new PlaceOverlayLayer(d.village);
  let stopOverlay: (() => void) | null = null;
  marks.append(overlay.tip, ...bubbles, ring, tag);
  addEventListener(
    "pointermove",
    (e) => {
      if (!overlay.on || e.pointerType !== "mouse") return;
      overlay.hover(e.target instanceof HTMLCanvasElement ? { x: e.clientX, y: e.clientY } : null);
    },
    { passive: true },
  );
  hud.element.prepend(marks);
  /** Who is chosen (their number in the place; null: no one), and the inspector's reading of what it shows. */
  let answered: number | null = null;
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
        // (Entered: where each of them is, told. Its season said, and the loading screen let go.)
        // (Its people pinned on the people bar followed in full from the first frame: pins.)
        if (enteredAt === null) pinsKept();
        enteredAt ??= f.t;
        if (d.loading?.shown) {
          const sky = d.weather();
          d.loading.seasonIs(
            seasonWord(f.season),
            sky && sky.celsius !== null
              ? `${Math.round(sky.celsius)}° ${sky.words}`
              : (sky?.words ?? null),
          );
          d.loading.step(2, true);
          entered = d.loading.hide();
        }
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
  /**
   * Whom and what was inspected before (asked 2026-11-26: "it doesnt let me click back"): each with where the eye was when
   * it was left for the next; and where the eye was before it went with the first one. Back goes one step; from the
   * first it closes the inspector and the eye goes back to where it was.
   */
  const before: { ref: string; eye: OrbitView }[] = [],
    ahead: { ref: string; eye: OrbitView }[] = [];
  let eyeFirst: OrbitView | null = null,
    eyeMoved = false;
  /** The eye let go of whom it is kept with: the one followed (🎯), or one a town watched goes with. */
  const letGo = (): void => {
    if (inspector.following) follow(false);
    if (mode === "watch") watch.letGo();
    if (d.rig.follow) d.rig.follow = null;
  };
  /**
   * One step back, as a browser's: the one inspected before, the eye where it was; from the first, closed, the eye where
   * it began. What was left is kept to go forward to again, till another is opened.
   */
  const goBack = (): void => {
    letGo();
    if (inspector.ref) {
      if (inspector.now) backNames.set(inspector.ref, inspector.now.name);
      ahead.push({ ref: inspector.ref, eye: d.rig.view });
    }
    const prev = before.pop();
    if (prev) {
      inspect(prev.ref, false);
      d.rig.flyTo(prev.eye, 0.6);
      return;
    }
    const eye = eyeMoved ? eyeFirst : null;
    inspect(null, false);
    if (eye) d.rig.flyTo(eye, 0.6);
  };
  /** One step forward again: the one gone back from, the eye where it was then. */
  const goAhead = (): void => {
    const next = ahead.pop();
    if (!next) return;
    letGo();
    if (inspector.ref) {
      if (inspector.now) backNames.set(inspector.ref, inspector.now.name);
      before.push({ ref: inspector.ref, eye: d.rig.view });
    }
    inspect(next.ref, false);
    d.rig.flyTo(next.eye, 0.6);
  };
  /** Its Back and Forward keys' words: whom or what each goes to. */
  const backWords = (): void => {
    const prev = before.at(-1),
      next = ahead.at(-1);
    inspector.setBack(
      prev ? (backNames.get(prev.ref) ?? null) : null,
      before.length > 0,
      next ? (backNames.get(next.ref) ?? null) : false,
    );
  };
  const backNames = new Map<string, string>();
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
  const inspect = (ref: string | null, step = true): void => {
    stopInspect?.();
    stopInspect = null;
    if (
      ref &&
      !/^(plc|plcl|plci|plcg|plcb|plcw|plcy|plca|plcf|plcc|plcm|plcs|plcv|plcd|plcr|folk|person):/.test(
        ref,
      )
    ) {
      void d.pages.open(ref);
      return;
    }
    d.pages.close();
    // (Back: another opened over one shown is a step to go back by; the first opened keeps where the eye began; closed,
    // none is kept.)
    // (Opened anew by any way, the map, a sheet's row, a thought's source, a name, an alert: nothing ahead to go
    // forward to. Back and Forward themselves keep what is ahead.)
    if (step) ahead.length = 0;
    if (!ref) {
      if (step) before.length = 0;
      eyeFirst = null;
      eyeMoved = false;
    } else if (!inspector.ref) {
      if (step) before.length = 0;
      eyeFirst = d.rig.view;
      eyeMoved = false;
    } else if (step && ref !== inspector.ref) {
      // (The eye kept with the one before is let go of: 🎯 is of whom the inspector shows.)
      if (inspector.following) follow(false);
      if (inspector.now) backNames.set(inspector.ref, inspector.now.name);
      before.push({ ref: inspector.ref, eye: d.rig.view });
      if (before.length > 24) before.shift();
    }
    inspector.orders = mode !== "watch";
    inspector.open(ref);
    backWords();
    if (!ref || !town) {
      choose(null);
      laid();
      return;
    }
    const id = placedId(ref);
    if (/^plc[ligbwyafcmsvdr]:/.test(ref)) choose(null);
    else if (id !== null) choose(id);
    // (A sheet open under it is kept where the inspector is only peeked; a taller one takes the sheet's place.)
    if (inspector.height !== "peek" && hud.tab) hud.open(null);
    laid();
    const asked = ref,
      at = town;
    const askedAt = performance.now();
    answered = null;
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
        if (answered === null && x) answered = Math.round(performance.now() - askedAt);
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
    // (One looked at is followed in full for a day from it, as near as their next turn: tiers.)
    if (id !== null && town)
      void d.client
        .query({ type: "place.pin", args: { ref: town, id, soft: true } })
        .catch(() => {});
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
      eyeMoved = true;
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
  /** Each of those asked by their place in the plan (for where they are drawn), read once a body. */
  let planOf: { of: PlaceBodies | null; at: number[] } = { of: null, at: [] };
  /** What is over heads near the eye now (the look tools): how many signs, and of them marks between two talking. */
  let bubbled = { signs: 0, talks: 0, near: 0 };
  /** What the signs have cost (the look tools): ms choosing them and how often, ms placing them and over how many frames. */
  const signMs = { choose: 0, chosen: 0, place: 0, frames: 0 };
  /** The signs chosen: whose (their place among those asked; the other of two talking), what, and when chosen. */
  let shown: { k: number; o: number; sign: string; talk: boolean }[] = [],
    shownAt = -Infinity;
  const bubbled_ = (): void => {
    const now = performance.now();
    if (planOf.of !== body || now - shownAt >= BUBBLE_EVERY) {
      shownAt = now;
      chooseSigns();
      signMs.choose += performance.now() - now;
      signMs.chosen++;
    }
    const t1 = performance.now();
    // (Over their heads where they are drawn now, none over another.)
    let used = 0,
      talks = 0;
    const W = innerWidth,
      H = innerHeight,
      placed: { x: number; y: number; n: (typeof shown)[number] }[] = [];
    if (body)
      for (const n of shown) {
        const h = d.village.personHeadOnScreen(planOf.at[n.k]!, BUBBLE_HIGH);
        if (!h) continue;
        let x = h.x,
          y = h.y;
        if (n.o >= 0) {
          const o = d.village.personHeadOnScreen(planOf.at[n.o]!, BUBBLE_HIGH);
          if (!o) continue;
          x = (x + o.x) / 2;
          y = Math.min(y, o.y);
        }
        if (x < 0 || x > W || y < 0 || y > H) continue;
        if (
          placed.some((q) => Math.abs(q.x - x) < BUBBLE_W + 2 && Math.abs(q.y - y) < BUBBLE_W + 2)
        )
          continue;
        placed.push({ x, y, n });
      }
    for (const { x, y, n } of placed) {
      const b = bubbles[used++]!;
      if (b.textContent !== n.sign) b.textContent = n.sign;
      if (b.classList.contains("talk") !== n.talk) b.classList.toggle("talk", n.talk);
      b.style.transform = `translate(${(x - BUBBLE_W / 2).toFixed(1)}px, ${(y - BUBBLE_W).toFixed(1)}px)`;
      if (b.classList.contains("off")) b.classList.remove("off");
      if (n.talk) talks++;
    }
    for (let k = used; k < BUBBLES; k++)
      if (!bubbles[k]!.classList.contains("off")) bubbles[k]!.classList.add("off");
    bubbled = { signs: used, talks, near: bubbled.near };
    signMs.place += performance.now() - t1;
    signMs.frames++;
  };
  const chooseSigns = (): void => {
    const f = told;
    let seen = 0;
    shown = [];
    if (f && body && f.bubble) {
      if (planOf.of !== body) {
        const at: number[] = [];
        body.ids.forEach((id, k) => {
          if (id !== null) at.push(k);
        });
        planOf = { of: body, at };
      }
      const W = innerWidth,
        H = innerHeight,
        near: { k: number; x: number; y: number; d: number; sign: string; talk: boolean }[] = [];
      for (let k = 0; k < f.bubble.length; k++) {
        const t = f.talk[k]!,
          talking = t > k,
          sign = talking ? (f.warm[k] ? "💬" : "💢") : t >= 0 ? "" : f.bubble[k]!;
        if (!sign) continue;
        const id = body.ids[planOf.at[k]!];
        if (id === chosen) continue;
        if (!d.village.personMayStand(planOf.at[k]!, BUBBLE_HIGH, BUBBLE_TALL)) continue;
        const h = d.village.personHeadOnScreen(planOf.at[k]!, BUBBLE_HIGH);
        // (Only those near the eye: drawn at least so tall.)
        if (!h || h.foot - h.y < BUBBLE_TALL || h.x < 0 || h.x > W || h.y < 0 || h.y > H) continue;
        let x = h.x,
          y = h.y;
        if (talking) {
          const o = d.village.personHeadOnScreen(planOf.at[t]!, BUBBLE_HIGH);
          if (!o) continue;
          x = (x + o.x) / 2;
          y = Math.min(y, o.y);
        }
        near.push({ k, x, y, d: Math.hypot(x - W / 2, y - H / 2), sign, talk: talking });
      }
      near.sort((a, b) => a.d - b.d || a.k - b.k);
      // (Those nearest the middle of the screen, as many as there are signs, none over another as chosen.)
      const placed: { x: number; y: number }[] = [];
      for (const n of near) {
        if (shown.length >= BUBBLES) break;
        if (
          placed.some(
            (q) => Math.abs(q.x - n.x) < BUBBLE_W + 2 && Math.abs(q.y - n.y) < BUBBLE_W + 2,
          )
        )
          continue;
        placed.push(n);
        shown.push({ k: n.k, o: n.talk ? f.talk[n.k]! : -1, sign: n.sign, talk: n.talk });
      }
      seen = near.length;
    }
    bubbled = { ...bubbled, near: seen };
  };
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

  /**
   * The people bar's pins kept by the town too (asked 2026-11-26: "people i have pinned from that town should be in the
   * people tab"): each of its people pinned there followed in full by word on entering and whenever the pins change, and
   * one taken off the bar let go of; and the other way, one followed by word in the town pinned on the bar where they are
   * someone the god game knows (their page is not the place's own).
   */
  let pinsWere: string[] = [];
  const pinsKept = (): void => {
    if (!town) return;
    const now = barPins.all.map((x) => x.ref);
    void d.client
      .query({ type: "place.pins", args: { ref: town, pins: now, was: pinsWere } })
      .then(() => {
        if (inspector.ref) inspect(inspector.ref, false);
      })
      .catch(() => {});
    pinsWere = now;
    if (hud.tab === "people") sheet("people");
  };
  barPins.onChange(pinsKept);
  /** The People sheet drawn, with the pinned who are not here read as the people bar reads them (where, or gone). */
  let awayRead = "";
  const pinsAway = (s: PlacePeopleSheet): void => {
    const here = new Set(s.pinsHere),
      away = barPins.all.filter((x) => !here.has(x.ref)),
      key = away.map((x) => x.ref).join("|");
    if (key !== awayRead) {
      awayRead = key;
      // (None left elsewhere: drawn again without them at once.)
      if (!away.length) {
        hud.away = [];
        return void hud.people(s, true);
      } else
        void d.client
          .query<BarRead>({
            type: "people.bar",
            args: { cell: null, town: null, pins: away, followed: [] },
          })
          .then((r) => {
            // (The pins alone: the bar reads besides whom the place it is asked of puts on it.)
            hud.away = r.people
              .filter((x) => x.kind === "pin")
              .map((x) => {
                const pin = away.find((y) => y.ref === x.ref || x.key.startsWith(`${y.ref}|`));
                return {
                  ref: pin?.ref ?? x.ref,
                  name: x.gone || !pin ? (pin?.name ?? x.name) : x.name,
                  words: x.gone
                    ? x.died
                      ? `Died: ${x.died}`
                      : "History tells of them no more"
                    : x.readings.doing.words,
                };
              });
            hud.people(s, true);
          })
          .catch(() => undefined);
    }
    hud.people(s);
  };
  /** The sheet open read, and read again while it stays open. */
  const sheet = (tab: PlaceTab | null): void => {
    stopSheet?.();
    stopSheet = null;
    if (!town || !tab) return;
    const ref = town;
    if (tab === "people")
      stopSheet = d.client.subscribe<PlacePeopleSheet | null>(
        { type: "place.people", args: { ref, occ: hud.occ, pins: barPins.all.map((x) => x.ref) } },
        SHEET_EVERY,
        (s) => timed(() => s && pinsAway(s)),
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
      // (The sheet read again at once: an order shows as soon as it is given; and the one inspected, on whose page a key
      // may have given it.)
      sheet(hud.tab);
      const of = inspector.ref;
      if (of)
        void d.client
          .query<PlaceInspect | null>({ type: "place.inspect", args: { ref: town, of } })
          .then(
            (x) => {
              if (x && !("error" in x) && inspector.ref === of) timed(() => inspector.show(x));
            },
            () => undefined,
          );
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };

  const leave = async (): Promise<void> => {
    d.loading?.hide();
    if (!town) return;
    const left = town;
    // (What it did by its orders told to its land before it is left.)
    if (told?.managed && (told.unsettled > 0 || told.sites.length > 0)) await settle();
    // (And what befell it while it was run, told once the god game's chrome is back.)
    const since = enteredAt,
      name = d.plan()?.name ?? "the town";
    if (since !== null && d.ranTown)
      void d.client
        .query<{ days: number; lines: readonly string[] } | null>({
          type: "place.since",
          args: { ref: left, since },
        })
        .then((x) => {
          if (x && x.lines.length && x.days >= 1)
            d.ranTown!(
              `While you ran ${name}, ${x.days} ${x.days === 1 ? "day" : "days"}`,
              x.lines,
            );
        })
        .catch(() => {});
    enteredAt = null;
    town = null;
    d.rig.dragLetsGo = false;
    sited = "";
    ran("hand");
    inspect(null);
    framed = false;
    stop?.();
    stopSheet?.();
    stop = stopSheet = null;
    if (hud.lens) hud.setLens(null);
    if (body && d.village.posed === body) d.village.posed = null;
    body = null;
    told = null;
    pinsWere = [];
    awayRead = "";
    hud.away = [];
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
    // (A drag over the town lets go of one the eye is kept with, and takes the ground.)
    d.rig.dragLetsGo = true;
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
    // (Its people read one by one: the place made, or brought to the moment, as the plan is asked; then where each is.)
    d.loading?.step(1, false);
    await d.reload(ref);
    if (town !== ref) return;
    d.loading?.step(1, true);
    d.loading?.step(2, false);
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
  hud.onLens = (lens) => {
    const was = overlay.on;
    stopOverlay?.();
    stopOverlay = null;
    if (!lens || !town) return overlay.set(null);
    // (Turned on: the eye drawn back over the town, its lots to be seen together.)
    if (!was) {
      d.rig.follow = null;
      d.rig.flyTo(
        { target: { x: 0, y: 0, z: 0 }, distance: EYE_NEAR * EYE_OVERLAY, pitch: EYE_PITCH },
        0.8,
      );
    }
    stopOverlay = d.client.subscribe<PlaceOverlay | null>(
      { type: "place.overlay", args: { ref: town, of: lens } },
      1000,
      (o) =>
        timed(() => {
          if (hud.lens !== lens) return;
          const x = o && !("error" in o) ? o : null;
          overlay.set(x);
          // (Its ramp in the shades the ground is laid in.)
          if (x) hud.legend(x, (v) => overlayColour((shadeOf(v) + 0.5) / OVERLAY_SHADES, x.good));
        }),
    );
  };
  // (Escape: a page shut, else the inspector closed and the eye let go of whom it was kept with.)
  hud.onEscape = () => {
    if (!d.pages.element.hidden) return void d.pages.close();
    letGo();
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
  inspector.onClose = () => {
    letGo();
    inspect(null);
  };
  inspector.onBack = () => goBack();
  inspector.onAhead = () => goAhead();
  inspector.onInspect = (ref) => inspect(ref);
  inspector.plan = d.plan;
  inspector.onPage = (ref) => void d.pages.open(ref);
  inspector.onFollow = (on) => follow(on);
  inspector.onOrder = (type, args) =>
    void order(type, args).then(() => {
      if (inspector.ref) inspect(inspector.ref);
    });
  // (Followed in full by word, or let be: the town's own reading, given in any way it is run. Tiers.)
  inspector.onPin = (id, on) => {
    if (!town) return;
    // (On the people bar too, where the god game knows them: the same pin.)
    const x = inspector.now,
      page = x?.kind === "person" && x.id === id ? x.page : null;
    void d.client
      .query({ type: "place.pin", args: { ref: town, id, on } })
      .then(() => {
        if (page && !page.startsWith("plc:")) {
          if (on && !barPins.has(page)) barPins.toggle(page, x!.name);
          else if (!on && barPins.has(page)) barPins.off(page);
        }
        if (inspector.ref) inspect(inspector.ref);
      })
      .catch(() => {});
  };
  hud.onUnpin = (ref, id) => {
    if (barPins.has(ref)) barPins.off(ref);
    if (town && id !== null)
      void d.client
        .query({ type: "place.pin", args: { ref: town, id, on: false } })
        .then(() => hud.tab === "people" && sheet("people"))
        .catch(() => {});
  };
  hud.onPage = (ref) => void d.pages.open(ref);
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
          if (mode === "watch") {
            if (!inspector.ref) eyeFirst = d.rig.view;
            watch.goWith(id);
          }
          inspect(placePersonRef(town, id));
          if (mode === "watch") eyeMoved = true;
        } else void d.pages.open(person.page ?? person.ref);
        return true;
      }
      const thing = d.townThing(x, y);
      if (thing?.kind === "civic" || thing?.kind === "lot")
        inspect(placeLotRef(town, thing.kind === "civic" ? thing.at : thing.lot));
      // (A tap on the bare ground lets go of whom or what was chosen, and of the eye kept with them.)
      else {
        letGo();
        inspect(null);
      }
      return true;
    },
    frame: () => {
      if (!town) return;
      // (Gone from the town, or another has taken its people up, a life lived or a body possessed: left.)
      if (d.scale() !== "village" || (body && d.village.posed !== body)) return void leave();
      watch.frame();
      const t0 = performance.now();
      marked();
      bubbled_();
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
    back: () => goBack(),
    ahead: () => goAhead(),
    get following() {
      return d.rig.follow !== null;
    },
    get bubbles() {
      return { ...bubbled, ms: { ...signMs } };
    },
    get inspected() {
      const x = inspector.now;
      return {
        ref: inspector.ref,
        height: inspector.height,
        name: x ? (x.kind === "person" ? x.name : x.name) : "",
        chosen,
        answered,
      };
    },
    inspectHeight: (h) => inspector.setHeight(h),
    overlaid: () => ({ lots: d.village.tintCount, spots: d.village.tintSpots() }),
    uiCost: () => {
      const out = { ms: uiMs, frames: uiFrames, loaded: entered, signs: { ...signMs } };
      uiMs = uiFrames = 0;
      signMs.choose = signMs.chosen = signMs.place = signMs.frames = 0;
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
