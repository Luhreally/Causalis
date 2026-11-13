// A fight among the stars watched (Phase 67, asked for 2026-11-03: "i wanna see the star wars and
// landing in planets and colonization and all that stuff"): a fleet fight over a world, played again
// as a film from what history holds of it. The attackers come down from deep space and the defenders
// rise from the world's limb; beams or missiles pass between them, ships break in two, and the loser
// runs. Where the record carries a raid to the ground, the film goes on to that town: four landers come
// down on it, their raiders come out and meet its guard in the streets, homes catch fire, and the
// raiders lift off. Everything drawn is a pure function of the plan and the film's time, so pausing and
// scrubbing are exact. The world's clock is held all the while, and nothing here writes to history.
import "./film.css";
import "./fleet.css";
import { sound } from "./sound.ts";
import type {
  FightRgb,
  HostClient,
  ShipCrew,
  StarFightPlan,
  VillagePlan,
} from "../bridge/index.ts";
import {
  FleetLayer,
  InvasionLayer,
  VILLAGE_METRE,
  type OrbitRig,
  type Stage,
  type VillageScene,
} from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  INV,
  fightWay,
  fleetAt,
  fleetEye,
  fleetFrame,
  fleetScript,
  fleetTally,
  fleetWords,
  invasionAt,
  burningWay,
  invasionEye,
  invasionKeep,
  invasionScript,
  invasionSite,
  invasionWords,
  raidersAt,
  rideEye,
  shipName,
  shipRef,
  toWorld,
  type FleetFrame,
  type FleetNow,
  type FleetScript,
  type InvasionNow,
  type InvasionScript,
  type TownWar,
} from "../view/index.ts";

export type FleetFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  /** Put every scale away and show the home world whole; its GlobeScene. */
  readonly toHomeWorld: () => Promise<{ wayOf(cell: number): { x: number; y: number; z: number } }>;
  /** Put every scale away and show a world of another star whole. */
  readonly toForeignWorld: (star: string, planet: number) => Promise<void>;
  /** Put every scale away, with nothing but the dark to see. */
  readonly toDark: () => void;
  readonly toTown: (cell: number, ref: string) => Promise<void>;
  /** A cut from one scale to another, its readying told. */
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  readonly plan: () => VillagePlan | null;
  /** The eye taken from free roam, any war being watched left. */
  readonly toOrbit: () => void;
  readonly openPage: (ref: string) => void;
  readonly pageOpen: () => boolean;
  /** Whether another film is playing. */
  readonly busy: () => boolean;
  /** War marks on the home globe off during the film, and back on. */
  readonly overlays: (on: boolean) => void;
  /** A word for after the film. */
  /** Puts away any words still showing. */
  readonly hush: () => void;
  readonly say: (words: string) => void;
};

export type FilmState = {
  id: string | null;
  act: "orbit" | "town" | null;
  stage: string | null;
  /** Seconds into the act, and the act's length in seconds. */
  /** A cut to another scale is under way: the film holds where it is. */
  cutting: boolean;
  t: number;
  end: number;
  /** The share of the act's time, from 0 to 1. */
  k: number;
  paused: boolean;
  speed: number;
  year: number;
  words: string;
  tally: string;
  won: boolean | null;
  /** Who is still afloat, the attacker then the defender. */
  left: readonly [number, number];
  counts: readonly [number, number];
  town: string | null;
  /** Whether the town shown is held by the film (its war, hour and people). */
  townHeld: boolean;
};

export type FleetFilm = {
  play(id: string): Promise<boolean>;
  skip(): void;
  pause(on: boolean): void;
  /** A share (0 … 1) of the act showing. */
  scrub(k: number): void;
  toAct(i: 0 | 1): Promise<void>;
  setSpeed(x: 1 | 2): void;
  readonly playing: boolean;
  /** Whether the town shown is the film's: its war, hour and people are held by it. */
  readonly townHeld: boolean;
  /** The hour shown in the town, as a share of the day. */
  readonly hour: number;
  state(): FilmState;
  /** The drawn state now, as plain numbers (a gate compares it across a scrub). */
  sample(): unknown;
  shipOnScreen(cls?: 0 | 1 | 2): { x: number; y: number; ref: string } | null;
  /** Aboard a ship (Phase 73): where it stands now, whom with, and how it has gone; null: no one is riding. */
  riding(): {
    ship: string;
    id: number;
    alive: boolean;
    broke: boolean;
    crew: string | null;
    crewRef: string | null;
    onScreen: { x: number; y: number } | null;
  } | null;
  /** Go aboard a ship by its place in the fight (false: no such ship still afloat). */
  ride(id: number | null): boolean;
  /** A ship still afloat that will break up in this fight, and when (a gate rides her). */
  doomed(): { id: number; at: number } | null;
  raiderOnScreen(): { x: number; y: number; ref: string } | null;
  defenderOnScreen(): { x: number; y: number; ref: string } | null;
  shown(): Record<string, number>;
};

type Point = { readonly x: number; readonly y: number; readonly z: number };
type Keep = ReturnType<typeof invasionKeep>;
type FilmSample = {
  act: "orbit" | "town" | null;
  t: number;
  beams: number;
  missiles: number;
  wrecks: number;
  ships: (readonly number[])[];
  landers: { high: number }[];
  raiders: { i: number; x: number; z: number; size: number }[];
  fires: number;
  /** How many of the fires stand on the screen now. */
  firesSeen: number;
  /** Each fire's ground, height and place on the screen (null: behind the eye), for a gate to say. */
  fireSpots: (readonly (number | null)[])[];
};

/** The camera's near plane while the film plays: nearer than the rig's, so the close ships are not cut. */
const NEAR_FILM = 0.05;
/** How long the eye stays where a ship ridden has gone, before it goes back to the whole fight (seconds of the film); how far a drag turns it. */
const RIDE_AFTER = 3.5,
  RIDE_TURN = 0.008,
  /** The eye's rise over a ship ridden, at the first. */
  RIDE_PITCH = 0.62,
  /** How long the word to press a ship stands, in the sky's act (seconds of the film). */
  RIDE_HINT = 16;
/** The town's hour in the film: late afternoon, the fires showing. */
const HOUR = 0.72;
/** The length of the town act, in seconds. */
const TOWN_END = INV.end;
const noKeep: Keep = () => {};

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
};
/** Sets a node's text only when it changes, so a frame writes no DOM it does not need to. */
const setText = (node: HTMLElement, text: string) => {
  if (node.textContent !== text) node.textContent = text;
};
const rgbCss = (c: FightRgb) => `rgb(${c.map((v) => Math.round(v * 255)).join(", ")})`;

export function installFleetFilm(d: FleetFilmDeps): FleetFilm {
  const { stage, rig, village, client, time, canvas } = d;
  const fleet = new FleetLayer(stage),
    invasion = new InvasionLayer(stage);

  // The film's chrome, inside the HUD (its look is in fleet.css and film.css).
  const ui = el("div", "fleet-film"),
    yearBox = el("div", "film-year"),
    leftBox = el("div", "fleet-left"),
    leftAttacker = el("span"),
    leftDefender = el("span"),
    skipButton = el("button", "film-skip"),
    wordsBox = el("div", "film-words"),
    tallyBox = el("div", "fleet-tally"),
    acts = el("div", "fleet-acts"),
    actOver = el("button", "fleet-act"),
    actTown = el("button", "fleet-act"),
    rideHint = el("div", "fleet-ride-hint"),
    rideHud = el("div", "ride-hud"),
    rideNote = el("div", "ride-note"),
    rideActs = el("div", "ride-acts"),
    rideWho = el("button", "ride-who"),
    rideShip = el("button", "ride-round ride-ship"),
    rideNext = el("button", "ride-round ride-next"),
    rideOut = el("button", "ride-round ride-out"),
    bar = el("div", "fleet-bar"),
    pauseButton = el("button", "fleet-pause"),
    course = el("div", "fleet-course"),
    fill = el("div", "fleet-fill"),
    speedButton = el("button", "fleet-speed");
  ui.hidden = true;
  leftBox.append(leftAttacker, "  ", leftDefender);
  skipButton.textContent = "Skip ›";
  skipButton.setAttribute("aria-label", "Skip to the end of the film");
  actOver.textContent = "🌍 Over the world";
  pauseButton.textContent = "⏸";
  pauseButton.setAttribute("aria-label", "Pause");
  speedButton.textContent = "1×";
  course.setAttribute("role", "slider");
  course.setAttribute("aria-label", "The film's course");
  course.tabIndex = 0;
  course.append(fill);
  acts.append(actOver, actTown);
  bar.append(pauseButton, course, speedButton);
  rideHint.textContent = "👆 Press a ship to ride aboard";
  rideHint.hidden = true;
  rideHud.hidden = true;
  rideShip.textContent = "The ship";
  rideNext.textContent = "Next ship";
  rideOut.textContent = "Leave";
  rideActs.append(rideWho, rideShip, rideNext, rideOut);
  rideHud.append(rideNote, rideActs);
  ui.append(yearBox, leftBox, skipButton, wordsBox, tallyBox, rideHint, rideHud, acts, bar);
  d.hud.append(ui);

  let playing = false,
    /** The town is held by the film: its war, its hour and its people. */
    holdingTown = false,
    /** On to its end (a cut is taking it there): no more steps. */
    ending = false,
    /** A cut is under way: nothing advances, and a skip asked is taken once it is done. */
    cutting = false,
    skipWanted = false,
    paused = false,
    speed: 1 | 2 = 1,
    /** Counts up with each film and each start, so a step begun by an earlier one does nothing. */
    session = 0,
    plan: StarFightPlan | null = null,
    script: FleetScript | null = null,
    tallyText = "",
    frame: FleetFrame | null = null,
    act: "orbit" | "town" | null = null,
    /** Seconds into the act. */
    t = 0,
    lastFleet: FleetNow | null = null,
    leftNow: readonly [number, number] = [0, 0],
    inv: InvasionScript | null = null,
    townNow: InvasionNow | null = null,
    keep: Keep = noKeep,
    caption = "",
    nearWas = 0.1,
    /** How near the camera sees, this frame. */
    near = NEAR_FILM,
    press: { x: number; y: number; at: number; moved: boolean } | null = null,
    done: ((ok: boolean) => void) | null = null,
    /** The ship ridden (Phase 73): its place in the fight; where the eye stands about it; the last seen of it; who is with us. */
    ridingId: number | null = null,
    rideYaw = 0,
    ridePitch = RIDE_PITCH,
    rideLast: FleetNow["ships"][number] | null = null,
    rideCrew: ShipCrew | null = null,
    /** Asked for each going aboard, so a late answer is dropped. */
    rideAsk = 0;

  const actEnd = (): number =>
    act === "town" ? TOWN_END : act === "orbit" && script ? script.end : 0;

  const showPaused = () => {
    setText(pauseButton, paused ? "▶" : "⏸");
    pauseButton.setAttribute("aria-label", paused ? "Play" : "Pause");
  };

  const paint = (): void => {
    const p = plan;
    if (!p) return;
    const end = actEnd();
    setText(yearBox, `YEAR ${p.year}`);
    setText(wordsBox, caption);
    setText(tallyBox, act === "orbit" ? tallyText : "");
    leftBox.hidden = act !== "orbit";
    if (act === "orbit" && script) {
      setText(leftAttacker, `▲ ${leftNow[0]}/${script.counts[0]}`);
      setText(leftDefender, `▼ ${leftNow[1]}/${script.counts[1]}`);
    }
    fill.style.width = `${(end > 0 ? clamp01(t / end) : 0) * 100}%`;
    actOver.classList.toggle("on", act === "orbit");
    actTown.classList.toggle("on", act === "town");
  };

  /** The drawn state of the act at t: the layers, the eye and the caption. A pure function of t. */
  const draw = (): void => {
    const p = plan,
      s = script;
    if (!p || !s) return;
    if (act === "orbit" && frame) {
      const now = fleetAt(s, t);
      lastFleet = now;
      sound.fleet(now.beams.length, now.missiles.length, now.wrecks.length);
      leftNow = now.left;
      fleet.update(now);
      rideHint.hidden = ridingId !== null || t > RIDE_HINT || paused;
      // (Aboard, where there is still a ship to be aboard, or where it was for a moment after.)
      const me = ridingId === null ? null : (now.ships.find((x) => x.id === ridingId) ?? null);
      if (me) rideLast = me;
      const ship = ridingId === null ? undefined : s.ships[ridingId],
        ended = ship ? rideEnd(ship, t) : null,
        at0 = me ?? (ended !== null && t < ended + RIDE_AFTER ? rideLast : null);
      if (ridingId !== null && !at0) leaveRide();
      if (at0 && ship) {
        const eye = rideEye(at0, rideYaw, ridePitch),
          e = toWorld(frame, eye.e),
          at = toWorld(frame, eye.at),
          u = {
            x: frame.x.x * eye.up.x + frame.y.x * eye.up.y + frame.z.x * eye.up.z,
            y: frame.x.y * eye.up.x + frame.y.y * eye.up.y + frame.z.y * eye.up.z,
            z: frame.x.z * eye.up.x + frame.y.z * eye.up.y + frame.z.z * eye.up.z,
          };
        stage.camera.setPosition(e.x, e.y, e.z);
        stage.camera.lookAt(at.x, at.y, at.z, u.x, u.y, u.z);
        near = Math.min(NEAR_FILM, at0.length * 0.3);
        tellRide(p, ship, me !== null, t);
      } else {
        const eye = fleetEye(s, t),
          e = toWorld(frame, eye.e),
          at = toWorld(frame, eye.at);
        stage.camera.setPosition(e.x, e.y, e.z);
        stage.camera.lookAt(at.x, at.y, at.z, frame.y.x, frame.y.y, frame.y.z);
        near = NEAR_FILM;
      }
      caption = fleetWords(p, s, t);
    } else if (act === "town" && inv) {
      if (ridingId !== null) leaveRide();
      rideHint.hidden = true;
      const now = invasionAt(inv, t, keep);
      townNow = now;
      invasion.update(now, t);
      const eye = invasionEye(inv, t),
        M = VILLAGE_METRE;
      stage.camera.setPosition(eye.e.x * M, eye.e.y * M, eye.e.z * M);
      stage.camera.lookAt(eye.at.x * M, eye.at.y * M, eye.at.z * M);
      // In a town of spires what stands between the eye and the fight is cut away, as the rig does it:
      // the near plane held just short of where the ground meets the foot of the screen.
      if (rig.spires) {
        const dx = (eye.e.x - eye.at.x) * M,
          dy = (eye.e.y - eye.at.y) * M,
          dz = (eye.e.z - eye.at.z) * M,
          far = Math.hypot(dx, dy, dz),
          a = Math.asin(Math.max(0.2, dy / far)),
          half = (22.5 * Math.PI) / 180;
        near = Math.max(
          NEAR_FILM,
          (0.85 * far * Math.sin(a) * Math.cos(half)) / Math.sin(a + half),
        );
      } else near = NEAR_FILM;
      caption = invasionWords(p, t);
    }
    paint();
  };

  /** When a ship ridden stopped being there to ride: broke, or got clear; null: it is there to the end. */
  const rideEnd = (ship: FleetScript["ships"][number], at: number): number | null => {
    if (ship.breakAt !== null && at >= ship.breakAt) return ship.breakAt;
    if (ship.fleeAt !== null && at >= ship.fleeAt) return ship.fleeAt;
    return null;
  };

  /** What the ride's chrome says, as the ship stands. Written only where it changes. */
  const tellRide = (
    p: StarFightPlan,
    ship: FleetScript["ships"][number],
    afloat: boolean,
    at: number,
  ): void => {
    const name = shipName(p.id, ship.side, ship.index),
      side = ship.side === 0 ? p.attacker : p.defender,
      broke = ship.breakAt !== null && at >= ship.breakAt;
    setText(
      rideNote,
      afloat
        ? `Aboard the ${name}, of ${side.name}. You only ride along: this changes nothing in history.`
        : broke
          ? `The ${name} has broken up, with all aboard. The fight goes on without her.`
          : `The ${name} has got clear, and is gone from the fight.`,
    );
  };

  /** Off the ship, and back to the whole fight. */
  const leaveRide = (): void => {
    ridingId = null;
    rideAsk++;
    rideLast = null;
    rideCrew = null;
    rideHud.hidden = true;
    ui.classList.remove("riding");
  };

  /** Aboard a ship by its place in the fight. */
  const boardShip = (id: number): boolean => {
    const p = plan,
      s = script,
      ship = s?.ships[id];
    if (!p || !s || !ship || act !== "orbit" || rideEnd(ship, t) !== null) return false;
    ridingId = id;
    rideYaw = 0;
    ridePitch = RIDE_PITCH;
    rideLast = null;
    rideCrew = null;
    rideHud.hidden = false;
    ui.classList.add("riding");
    setText(rideWho, "…");
    rideWho.disabled = true;
    const ask = ++rideAsk;
    void client
      .query<ShipCrew | null>({
        type: "star.crew",
        args: { id: p.id, side: ship.side, index: ship.index },
      })
      .catch(() => null)
      .then((c) => {
        if (ask !== rideAsk) return;
        rideCrew = c;
        rideWho.disabled = !c;
        rideWho.replaceChildren(
          c ? c.name : "History names no one aboard",
          ...(c
            ? [
                Object.assign(document.createElement("small"), {
                  textContent: `${c.words ? `${c.words}. ` : ""}Their page ›`,
                }),
              ]
            : []),
        );
      });
    draw();
    return true;
  };

  /** The next ship of the same side still afloat; else any. */
  const nextShip = (): void => {
    const s = script,
      now = lastFleet;
    if (!s || !now || ridingId === null) return;
    const me = s.ships[ridingId],
      afloat = now.ships.filter((x) => !x.lander && rideEnd(s.ships[x.id]!, t) === null),
      ours = afloat.filter((x) => x.side === me?.side).sort((a, b) => a.id - b.id),
      list = ours.length > 1 ? ours : [...afloat].sort((a, b) => a.id - b.id),
      after = list.find((x) => x.id > ridingId!) ?? list[0];
    if (after) boardShip(after.id);
  };

  const clearTown = (): void => {
    invasion.clear();
    village.warSceneOverride = null;
    village.blazeOverride = null;
    village.war(null);
    holdingTown = false;
    inv = null;
    townNow = null;
  };

  /**
   * The film over, by its end or a skip: the layers cleared, the town's war given back, the eye
   * given back to the rig (to the town's pad, when it ends in the town), the clock released.
   */
  const finish = (): void => {
    if (!playing) return;
    const p = plan,
      L = p?.landing ?? null,
      townPlan = L ? d.plan() : null,
      endedIn = !!L && townPlan?.ref === L.town,
      pad = p && townPlan && endedIn ? invasionSite(townPlan, p.id).pads[0] : undefined;
    session++;
    playing = false;
    cutting = false;
    ending = false;
    skipWanted = false;
    press = null;
    leaveRide();
    rideHint.hidden = true;
    fleet.clear();
    invasion.clear();
    village.warSceneOverride = null;
    village.blazeOverride = null;
    village.war(null);
    holdingTown = false;
    const cam = stage.camera.camera;
    if (cam) cam.nearClip = nearWas;
    d.overlays(true);
    rig.enabled = true;
    rig.halt();
    time.release("film");
    ui.hidden = true;
    document.body.classList.remove("fleet-filming");
    sound.fleet(0, 0, 0);
    plan = null;
    script = null;
    frame = null;
    act = null;
    inv = null;
    townNow = null;
    lastFleet = null;
    keep = noKeep;
    caption = "";
    tallyText = "";
    leftNow = [0, 0];
    t = 0;
    if (pad)
      rig.flyTo({
        target: { x: pad.x * VILLAGE_METRE, y: 0.6, z: pad.z * VILLAGE_METRE },
        distance: 18,
        pitch: -28,
      });
    if (L && endedIn)
      d.say(
        `${L.townName} as it stands now. Tap anyone to read them, or take one up. ⚔️ lists the other wars among the stars.`,
      );
    const resolve = done;
    done = null;
    resolve?.(true);
  };

  /** The sky over the world: the fight built on the eye's frame, the act begun at 0. */
  const enterOrbit = async (): Promise<void> => {
    const my = session,
      p = plan,
      s = script;
    if (!p || !s) {
      finish();
      return;
    }
    let way: Point;
    if (p.place.kind === "home") {
      const globe = await d.toHomeWorld();
      if (my !== session) return;
      way = globe.wayOf(p.place.spot);
    } else {
      try {
        await d.toForeignWorld(p.place.star, p.place.planet);
      } catch {
        d.toDark();
      }
      if (my !== session) return;
      way = fightWay(p.id);
    }
    frame = fleetFrame(way);
    inv = null;
    townNow = null;
    holdingTown = false;
    fleet.build(p, s, frame);
    act = "orbit";
    t = 0;
    draw();
  };

  /** The raid's town: its war put on the village, and the raid's landers and raiders built on its ground. */
  const enterTown = async (): Promise<void> => {
    const my = session,
      p0 = plan,
      L = p0?.landing ?? null;
    if (!p0 || !L) {
      finish();
      return;
    }
    fleet.clear();
    lastFleet = null;
    await d.toTown(L.cell, L.town);
    if (my !== session) return;
    const p = d.plan();
    if (!p) {
      finish();
      return;
    }
    const site = invasionSite(p, p0.id);
    keep = invasionKeep(p);
    const townWar: TownWar = {
      ref: p0.event,
      sides: [
        {
          ref: L.raiders.ref,
          name: L.raiders.name,
          color: L.raiders.color,
          fields: 0,
          arms: null,
          host: null,
        },
        {
          ref: L.defenders.ref,
          name: L.defenders.name,
          color: L.defenders.color,
          fields: 0,
          arms: null,
          host: L.defenders.host,
        },
      ],
      hosts: [],
      fight: null,
      fought: null,
      placed: null,
      eve: false,
      siege: false,
      burning: 0,
      words: "",
    };
    village.war(townWar);
    inv = invasionScript(
      p0,
      site,
      village.warEach,
      raidersAt(stage.quality.detail),
      // (Where the eye looks by then, so what burns is seen burning.)
      village.homesAlong(d.client.status?.t ?? 0, burningWay(site), 16),
    );
    invasion.build(p0, stage.quality.detail);
    holdingTown = true;
    village.warSceneOverride = () => townNow?.scene ?? null;
    village.blazeOverride = () => townNow?.blaze ?? null;
    act = "town";
    sound.cue("landing");
    t = 0;
    draw();
  };

  /** A cut to another scale or act. A skip asked during it is taken once it is done. */
  const cutTo = async (what: string, work: () => Promise<void>): Promise<void> => {
    const my = session;
    cutting = true;
    try {
      await d.cut(what, work);
    } catch {
      if (my === session) finish();
      return;
    }
    if (my !== session) return;
    cutting = false;
    if (skipWanted) {
      skipWanted = false;
      await skipNow();
    }
  };

  /** On to the end: a landing's town as it stands (no raid played there), else the film over. */
  const skipNow = async (): Promise<void> => {
    if (!playing || ending) return;
    const my = session,
      L = plan?.landing ?? null;
    if (L && act === "orbit") {
      ending = true;
      await cutTo(L.townName, () => d.toTown(L.cell, L.town));
      if (my === session) finish();
      return;
    }
    finish();
  };

  /** A film's start: the chrome up, the clock held, the eye taken, then the sky over the world. */
  const run = async (my: number): Promise<void> => {
    try {
      const p = plan;
      if (!p) throw new Error("fleet film: no plan");
      const L = p.landing,
        s = fleetScript(p),
        cam = stage.camera.camera;
      script = s;
      tallyText = fleetTally(p, s);
      nearWas = cam ? cam.nearClip : 0.1;
      leftAttacker.style.color = rgbCss(p.attacker.color);
      leftDefender.style.color = rgbCss(p.defender.color);
      acts.hidden = !L;
      setText(actTown, L ? `🏘️ In ${L.townName}` : "");
      setText(speedButton, "1×");
      showPaused();
      d.hush();
      d.toOrbit();
      d.overlays(false);
      time.hold("film");
      rig.enabled = false;
      document.body.classList.add("fleet-filming");
      ui.hidden = false;
      if (cam) cam.nearClip = NEAR_FILM;
      await cutTo("the sky over that world", enterOrbit);
    } catch {
      if (my === session) finish();
    }
  };

  /** A tap on a ship: aboard her. On a wreck, a raider, a lander or a defender: the page of what was tapped. */
  const tap = (x: number, y: number): void => {
    const p = plan,
      s = script;
    if (!p || !s) return;
    if (act === "orbit" && lastFleet) {
      const hit = fleet.pick(x, y, lastFleet),
        ship = hit ? s.ships[hit.id] : undefined;
      if (ship && hit && !hit.wreck && boardShip(ship.id)) return;
      if (ship)
        d.openPage(
          shipRef(
            p.id,
            ship.side,
            ship.index,
            ship.cls,
            ship.breakAt !== null && t >= ship.breakAt,
          ),
        );
      return;
    }
    if (act === "town" && townNow && p.landing) {
      // (The nearer of a raider and one of the town's guard takes the tap: in the streets they fight within a finger of
      // each other, and a raider only near it took a tap right on a defender. 2026-11-13.)
      const hit = invasion.pick(x, y, townNow),
        guard = village.pickSoldier(x, y);
      if (hit && "raider" in hit && (!guard || hit.d <= guard.d)) d.openPage(p.landing.raiders.ref);
      else if (guard || (hit && "lander" in hit)) d.openPage(p.event);
    }
  };

  // The film takes its own taps: the game's handling of the canvas does not see them while it plays.
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!playing) return;
      e.stopImmediatePropagation();
      // (The touch's own time: a slow frame holds its handler back, and the finger has not stayed.)
      press = { x: e.clientX, y: e.clientY, at: e.timeStamp, moved: false };
    },
    true,
  );
  // (Aboard, a drag turns the eye about her.)
  let lookedX = 0,
    lookedY = 0;
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!playing || !press || ridingId === null) return;
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 12) {
        press.moved = true;
        lookedX = e.clientX;
        lookedY = e.clientY;
      }
      if (!press.moved) return;
      e.stopImmediatePropagation();
      rideYaw -= (e.clientX - lookedX) * RIDE_TURN;
      ridePitch = Math.max(-0.9, Math.min(1.2, ridePitch + (e.clientY - lookedY) * RIDE_TURN));
      lookedX = e.clientX;
      lookedY = e.clientY;
    },
    true,
  );
  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (!playing) return;
      e.stopImmediatePropagation();
      const was = press;
      press = null;
      if (
        was &&
        !was.moved &&
        !cutting &&
        Math.hypot(e.clientX - was.x, e.clientY - was.y) < 12 &&
        e.timeStamp - was.at < 1200
      )
        tap(e.clientX, e.clientY);
    },
    true,
  );
  canvas.addEventListener(
    "pointercancel",
    () => {
      press = null;
    },
    true,
  );

  // The clock of the film: nothing advances while a cut runs, a page is open, or it is paused.
  stage.onUpdate((dt) => {
    const p = plan;
    if (!playing || cutting || !p || !script) return;
    // (The rig sets its own near plane each frame before this, so this one is the last word.)
    const cam = stage.camera.camera;
    if (!d.pageOpen() && !paused) t += dt * speed;
    draw();
    if (cam && cam.nearClip !== near) cam.nearClip = near;
    if (paused || d.pageOpen() || t < actEnd()) return;
    if (act === "orbit" && p.landing) void cutTo(p.landing.townName, enterTown);
    else finish();
  });

  const scrubAt = (clientX: number): void => {
    const r = course.getBoundingClientRect();
    if (r.width > 0) film.scrub((clientX - r.left) / r.width);
  };
  course.addEventListener("pointerdown", (e) => {
    if (!playing) return;
    course.setPointerCapture(e.pointerId);
    scrubAt(e.clientX);
  });
  course.addEventListener("pointermove", (e) => {
    if (course.hasPointerCapture(e.pointerId)) scrubAt(e.clientX);
  });
  const letGo = (e: PointerEvent) => {
    if (course.hasPointerCapture(e.pointerId)) course.releasePointerCapture(e.pointerId);
  };
  course.addEventListener("pointerup", letGo);
  course.addEventListener("pointercancel", letGo);
  course.addEventListener("keydown", (e) => {
    const end = actEnd();
    if (!playing || end <= 0) return;
    if (e.key === "ArrowLeft") film.scrub(t / end - 0.05);
    else if (e.key === "ArrowRight") film.scrub(t / end + 0.05);
  });
  skipButton.onclick = () => film.skip();
  rideOut.onclick = () => {
    leaveRide();
    draw();
  };
  rideNext.onclick = () => nextShip();
  rideWho.onclick = () => {
    if (rideCrew) d.openPage(rideCrew.ref);
  };
  rideShip.onclick = () => {
    const p = plan,
      ship = ridingId === null ? undefined : script?.ships[ridingId];
    if (p && ship)
      d.openPage(
        shipRef(p.id, ship.side, ship.index, ship.cls, ship.breakAt !== null && t >= ship.breakAt),
      );
  };
  actOver.onclick = () => void film.toAct(0);
  actTown.onclick = () => void film.toAct(1);
  pauseButton.onclick = () => film.pause(!paused);
  speedButton.onclick = () => film.setSpeed(speed === 1 ? 2 : 1);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") film.skip();
  });

  const film: FleetFilm = {
    get playing() {
      return playing;
    },
    get townHeld() {
      return holdingTown;
    },
    get hour() {
      return HOUR;
    },
    state(): FilmState {
      const p = plan,
        end = actEnd();
      return {
        id: playing && p ? p.id : null,
        act,
        cutting,
        stage:
          act === "orbit" && lastFleet
            ? lastFleet.stage
            : act === "town" && townNow
              ? townNow.stage
              : null,
        t,
        end,
        k: end > 0 ? clamp01(t / end) : 0,
        paused,
        speed,
        year: p?.year ?? 0,
        words: caption,
        tally: act === "orbit" ? tallyText : "",
        won: p ? p.won : null,
        left: leftNow,
        counts: script ? script.counts : [0, 0],
        town: p?.landing ? p.landing.town : null,
        townHeld: holdingTown,
      };
    },
    sample(): unknown {
      const out: FilmSample = {
        act,
        t,
        beams: 0,
        missiles: 0,
        wrecks: 0,
        ships: [],
        landers: [],
        raiders: [],
        fires: 0,
        firesSeen: 0,
        fireSpots: [],
      };
      if (act === "orbit" && script) {
        const now = fleetAt(script, t);
        out.beams = now.beams.length;
        out.missiles = now.missiles.length;
        out.wrecks = now.wrecks.length;
        out.ships = now.ships.map((s) => [s.id, s.p.x, s.p.y, s.p.z]);
      } else if (act === "town" && inv) {
        const now = invasionAt(inv, t, keep);
        out.landers = now.landers.map((l) => ({ high: l.high }));
        out.raiders = now.raiders.map((r) => ({ i: r.i, x: r.x, z: r.z, size: r.size }));
        const fires = [
          ...now.scene.fires.map((f) => ({ x: f.x, z: f.z, high: 0 })),
          ...now.blaze.fires,
        ];
        out.fires = fires.length;
        const room = stage.app.graphicsDevice.clientRect;
        out.firesSeen = fires.filter((f) => {
          const on = village.screenOf(f.x, f.z, f.high);
          out.fireSpots.push([f.x, f.z, f.high, on?.x ?? null, on?.y ?? null]);
          return !!on && on.x >= 0 && on.x <= room.width && on.y >= 0 && on.y <= room.height;
        }).length;
      }
      return out;
    },
    shipOnScreen(cls = 0) {
      const p = plan,
        s = script;
      if (!p || !s || act !== "orbit" || !lastFleet) return null;
      const hit = fleet.shipOnScreen(lastFleet, cls),
        ship = hit ? s.ships[hit.id] : undefined;
      if (!hit || !ship) return null;
      return {
        x: hit.x,
        y: hit.y,
        ref: shipRef(
          p.id,
          ship.side,
          ship.index,
          ship.cls,
          ship.breakAt !== null && t >= ship.breakAt,
        ),
      };
    },
    riding() {
      const p = plan,
        s = script;
      if (!p || !s || ridingId === null || !lastFleet) return null;
      const me = lastFleet.ships.find((x) => x.id === ridingId),
        ship = s.ships[ridingId]!,
        at = me ? fleet.screenOf(me.p) : null;
      return {
        ship: shipName(p.id, ship.side, ship.index),
        id: ridingId,
        alive: !!me,
        broke: ship.breakAt !== null && t >= ship.breakAt,
        crew: rideCrew?.name ?? null,
        crewRef: rideCrew?.ref ?? null,
        onScreen: at,
      };
    },
    doomed() {
      const ship = script?.ships.find(
        (x) =>
          x.breakAt !== null && x.breakAt > t + 1 && (x.fleeAt === null || x.fleeAt > x.breakAt),
      );
      return ship ? { id: ship.id, at: ship.breakAt! } : null;
    },
    ride(id) {
      if (id === null) {
        leaveRide();
        return true;
      }
      return boardShip(id);
    },
    raiderOnScreen() {
      const p = plan;
      if (!p?.landing || act !== "town" || !townNow) return null;
      const hit = invasion.raiderOnScreen(townNow);
      return hit ? { x: hit.x, y: hit.y, ref: p.landing.raiders.ref } : null;
    },
    defenderOnScreen() {
      const p = plan;
      if (!p || act !== "town") return null;
      const W = innerWidth,
        H = innerHeight,
        hit = village
          .soldiersOnScreen()
          .find((q) => !q.fallen && q.x >= 0 && q.x <= W && q.y >= 80 && q.y <= H - 200);
      return hit ? { x: hit.x, y: hit.y, ref: p.event } : null;
    },
    shown() {
      if (act === "orbit") return { ...fleet.shown };
      if (act === "town") return { ...invasion.shown };
      return {};
    },
    async play(id) {
      if (playing || d.busy()) return false;
      const p = await client.query<StarFightPlan | null>({ type: "star.fight", args: { id } });
      if (!p || playing || d.busy()) return false;
      session++;
      const my = session;
      plan = p;
      playing = true;
      cutting = true;
      ending = false;
      skipWanted = false;
      paused = false;
      speed = 1;
      return new Promise<boolean>((resolve) => {
        done = resolve;
        void run(my);
      });
    },
    skip() {
      if (!playing) return;
      if (cutting) {
        skipWanted = true;
        return;
      }
      void skipNow();
    },
    pause(on) {
      paused = on;
      showPaused();
    },
    scrub(k) {
      if (!playing || cutting || !act) return;
      t = clamp01(k) * actEnd();
      draw();
    },
    async toAct(i) {
      const p = plan;
      if (!playing || cutting || !p?.landing) return;
      if (i === 1) {
        if (act !== "town") await cutTo(p.landing.townName, enterTown);
      } else if (act !== "orbit") {
        await cutTo("the sky over that world", async () => {
          clearTown();
          await enterOrbit();
        });
      }
    },
    setSpeed(x) {
      speed = x;
      setText(speedButton, x === 2 ? "2×" : "1×");
    },
  };
  return film;
}
