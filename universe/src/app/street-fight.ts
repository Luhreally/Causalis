// A fight of the underworld watched in its town (asked for 2026-11-16: "why cant I click to watch gang wars yet either? like they
// recorded but i cant watch?"). Its words asked of the host (host/inspect/streetfight.ts), the town gone down to, its sides armed
// as the town's war arms its hosts (in their colours, with what they carry), and its scene drawn by view/streetfight.ts on a clock
// of its own: the world's clock held, the town's hour at night or dusk, those at their ease going in as it begins, a crowd come to
// the fallen after. The eye on one clash at a time: first all of it, fitted to the screen left free, then nearer, and over to the
// next only once this one is decided (view/street-shots.ts; 2026-11-19: "the gang war camreas i guess move too fast between
// battles like i cant see the whole scene"). The hand is the watcher's: a tap or Space holds it, ⏮ and ⏭ go to the clash before
// and the next. Its sound low and tense; its colours graded cold. Nothing here writes to history.
import "./street-fight.css";
import { sound } from "./sound.ts";
import type { HostClient, StreetFight, VillagePlan } from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type Stage, type VillageScene } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  BATTLE_SPEEDS,
  DUSK,
  battleSounds,
  blowsAt,
  figureOf,
  streetBattle,
  streetBattleNow,
  type BattleNow,
  type BattleSound,
  type StreetBattle,
  SPOT_WORDS,
  castAt,
  funeralsOf,
  streetCast,
  streetView,
  type Funeral,
  type StreetCast,
  isGun,
  fallenBy,
  streetAt,
  streetEye,
  streetScript,
  type StreetScript,
  NEARER,
  clashBounds,
  clashFacing,
  fitEye,
  shotStarts,
  shotStep,
  travelSeconds,
  type EyeFrame,
  type TownWar,
  type TownWarScene,
} from "../view/index.ts";

export type StreetFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  /** Down into a town of a land (a cut, its readying told). */
  readonly toTown: (cell: number, town: string) => Promise<void>;
  readonly plan: () => VillagePlan | null;
  readonly openPage: (ref: string) => void;
  /** The world's moment (seconds). */
  readonly now: () => number;
};

export type StreetFilm = {
  /** (`plain`: drawn as the town's war draws its hosts, as where no figure is known for its people.) */
  play(event: string, plain?: boolean): Promise<boolean>;
  stop(): void;
  /** Whether the town shown is the film's: its war, hour and people are held by it. */
  readonly holds: boolean;
  /** The world's moment the town is drawn at, given the world's own. */
  seen(t: number): number;
  /** Space and the numbers work its own clock, as a battle's. (A tap on the scene holds it and lets it go, as Space does.) */
  readonly keys: { toggle(): void; pick(i: number): boolean };
  /** To the next clash of it, or the one before (a few seconds into one: that one from its beginning). */
  go(dir: 1 | -1): void;
  /** Its fill of light on or off (the look tools: to measure what it does). */
  light(on: boolean): void;
  /** To a second of it (the look tools). */
  seek(s: number): void;
  /** Each clash's place and the eye's stand on it: its turn, how steeply it looks down, whether no block stands between. */
  views(): { why: string; from: number; yaw: number; pitch: number; clear: boolean }[];
  /** Whether those at their ease are indoors now (a clash begun). */
  readonly indoors: boolean;
  /**
   * What of it the eye has now (the look tools): the clash it is on, and for each clash those of both sides by it now and how
   * many of them stand whole (feet and head) in the screen left free above its caption.
   */
  frame(): {
    on: number;
    wide: boolean;
    flying: boolean;
    fits: boolean;
    clashes: { from: number; to: number; there: number; inside: number }[];
  };
  /** The film as it stands, as plain numbers (a gate or a test reads it). */
  state(): {
    event: string | null;
    kind: string | null;
    s: number;
    end: number;
    speed: number;
    fightEnd: number;
    burying: boolean;
    bier: { x: number; z: number; borne: boolean } | null;
    caught: number;
    cars: number;
    under: number;
    acts: Record<string, number>;
    plain: boolean;
    wounds: number;
    blood: number;
    limbs: number;
    lying: number;
    lamps: number;
    paused: boolean;
    drawn: readonly number[];
    fallen: readonly number[];
    told: readonly number[];
    won: number | null;
    figures: number;
    standing: number;
    posts: number;
    crowd: number;
    words: string;
  };
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const setText = (node: HTMLElement, text: string) => {
  if (node.textContent !== text) node.textContent = text;
};

const SPEED_WORDS = ["❚❚", "½×", "1×", "2×", "4×"] as const;
/** The fill of light a fight in the streets is seen by: what stands in a street's shade keeps its colours. */
const FILL = 0.3;
/** How far off the eye follows a squad on its way (the rig's units), and how long each step of following takes (s). */
const EYE_DISTANCE = 7.8,
  EYE_GOES = 1.3;
/**
 * A clash fitted to the screen: how tall one of its men is drawn (metres: larger than life, as the town draws its people), how
 * high the eye's mark is, the nearest the eye stands on all of it and on those fighting, and how much of the free screen each
 * takes (the street they hold is seen about them at first).
 */
const MAN_HIGH = 6.5,
  MAN_ABOUT = 3.5,
  EYE_LEVEL = 1.2,
  WHOLE = { min: 58, side: 0.78, pad: 0.1 },
  NEAR = { min: 44, side: 0.94, pad: 0.04 };
/** The burying after: how long it is watched (s), the world's seconds a second of it, how far off the eye stands. */
const BURY_LASTS = 26,
  BURY_PACE = 18,
  BURY_EYE = 7,
  DAY = 86_400;

export function installStreetFilm(d: StreetFilmDeps): StreetFilm {
  const { hud, client, time, rig, village } = d;
  // Its chrome: a caption low down where a thumb does not rest — what, where, who has fallen — and its buttons.
  const ui = el("div", "street-film"),
    title = el("div", "street-title"),
    where = el("div", "street-where"),
    tally = el("div", "street-tally"),
    bar = el("div", "street-bar"),
    // (The battle's own speeds, in its own words: held, half, its pace, twice, four times.)
    speeds = el("div", "street-speeds"),
    speedButtons = BATTLE_SPEEDS.map((_, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.title = i === 0 ? "Hold it still" : `At ${SPEED_WORDS[i]} its pace`;
      b.onclick = () => setSpeed(i);
      return b;
    }),
    course = el("div", "street-course"),
    fill = el("div", "street-course-fill"),
    again = el("button", "street-again", "↺"),
    // (Plain marks: a phone draws ⏮ and ⏭ as coloured pictures.)
    before = el("button", "street-before", "«"),
    next = el("button", "street-next", "»"),
    track = el("div", "street-track"),
    page = el("button", "street-page", "Its page ›"),
    done = el("button", "street-done", "✕");
  again.title = "From its beginning";
  page.title = "Its page: who, what it cost, and what came of it";
  done.title = "Back to the town as it stands";
  before.title = "The clash before (a few seconds into one: that one again). [";
  before.setAttribute("aria-label", "The clash before");
  next.title = "The next clash. ]";
  next.setAttribute("aria-label", "The next clash");
  void speeds;
  track.append(fill);
  course.append(track);
  course.setAttribute("role", "slider");
  course.setAttribute("aria-label", "Its course");
  course.title = "Draw it back and forth: any moment of it";
  // (One row: again, its speeds, its page, away. Its words above, two lines of them until they are tapped.)
  const words = el("button", "street-words");
  words.title = "All of what is told of it, or two lines";
  words.onclick = () => ui.classList.toggle("open");
  words.append(title, where, tally);
  setText(page, "›");
  page.setAttribute("aria-label", "Its page");
  // (Its course between ⏮ and ⏭ on a phone held upright, a row of its own; where there is width, over one row of them all.)
  bar.append(before, course, next, again, ...speedButtons, page, done);
  ui.append(words, bar);
  // (A small flag over each side where the eye is, in its colour and the caption's chip's.)
  const flags = [0, 1].map(() => {
    const flag = el("div", "street-flag");
    flag.hidden = true;
    hud.append(flag);
    return flag;
  });
  const rgb = (c: readonly number[]) =>
    `rgb(${c.map((x) => Math.round(Math.min(1, x * 1.25) * 255)).join(",")})`;
  ui.hidden = true;
  hud.append(ui);

  let fight: StreetFight | null = null,
    script: StreetScript | null = null,
    slots = 0,
    s = 0,
    speed = 2,
    was = 2,
    scene: TownWarScene | null = null,
    eyeKey = "",
    // (The eye set where it stands at once, not flown: as the film begins. The clash it is on, and its turn and tilt there.)
    eyeCut = false,
    stood: { clash: number; yaw: number; pitch: number } | null = null,
    eyeFits = true,
    heard: readonly number[] = [0, 0],
    crowd = 0,
    caught = 0,
    blowAt = 0,
    battle: StreetBattle | null = null,
    drawn: BattleNow | null = null,
    shown: TownWarScene | null = null,
    cast: StreetCast | null = null,
    burying: Funeral | null = null,
    playing = false,
    session = 0;

  const stop = () => {
    if (!playing) return;
    playing = false;
    session++;
    village.warSceneOverride = null;
    village.gunsOf = null;
    village.war(null);
    village.battleAt(null);
    village.placeBattle(null);
    battle = null;
    drawn = null;
    village.streetDowned = null;
    cast = null;
    burying = null;
    time.release("street fight");
    d.stage.fill = 0;
    document.body.classList.remove("filming", "street-filming");
    ui.hidden = true;
    for (const flag of flags) flag.hidden = true;
    delete tally.dataset.said;
    delete document.body.dataset.street;
    fight = null;
    script = null;
    scene = null;
    rig.halt();
  };

  const play = async (event: string, plain = false): Promise<boolean> => {
    const f = await client
      .query<StreetFight | null>({ type: "underworld.fight", args: { event } })
      .catch(() => null);
    if (!f) return false;
    stop();
    const my = ++session;
    await d.toTown(f.cell, f.town);
    const p = d.plan();
    if (my !== session || !p || p.ref !== f.town) return false;
    // Its two sides armed as the town's war arms its hosts.
    const war: TownWar = {
      ref: f.event,
      sides: [0, 1].map((i) => {
        const x = f.sides[i]!;
        return {
          ref: x.ref,
          name: x.name,
          color: x.color,
          fields: x.men,
          arms: x.arms,
          host: x.host,
          band: true,
        };
      }) as unknown as TownWar["sides"],
      hosts: [],
      fight: null,
      fought: null,
      placed: null,
      eve: false,
      siege: false,
      burning: 0,
      words: "",
    };
    village.war(war);
    slots = 2 * village.warEach;
    fight = f;
    script = streetScript(f, p, slots);
    s = 0;
    setSpeed(2);
    eyeKey = "";
    eyeCut = true;
    stood = null;
    heard = [0, 0];
    blowAt = 0;
    crowd = 0;
    caught = 0;
    cast = null;
    // (The burying after: the town's next of this year, else its last; none where it has no graveyard or no dead.)
    const funerals = village.graveyardShown() ? funeralsOf(p) : [];
    burying = funerals.find((x) => x.leaves >= d.now()) ?? funerals[funerals.length - 1] ?? null;
    scene = streetAt(script, slots, 0);
    shown = scene;
    village.warSceneOverride = () => shown;
    battle = plain ? null : streetBattle(f, script);
    if (battle)
      village.placeBattle({
        field: battle.field,
        frame: battle.frame,
        figure: f.figure ? figureOf(f.figure, d.stage.quality.detail) : null,
        body: f.figure ?? null,
      });
    time.hold("street fight");
    d.stage.fill = FILL;
    document.body.classList.add("filming", "street-filming");
    ui.hidden = false;
    document.body.dataset.street = f.kind;
    setText(title, f.title);
    playing = true;
    return true;
  };

  /** Its clock at a speed of the battle's (0 holds it); run on from its end, it begins again. */
  const setSpeed = (i: number) => {
    const next = Math.max(0, Math.min(BATTLE_SPEEDS.length - 1, i));
    if (next === 0 && speed > 0) was = speed;
    speed = next;
    if (speed > 0 && script && s >= whole()) seek(0);
    speedButtons.forEach((b, n) => b.classList.toggle("active", n === speed));
  };
  const whole = () => (script ? script.end + (burying ? BURY_LASTS : 0) : 0);
  const seek = (to: number) => {
    s = Math.max(0, Math.min(whole(), to));
    heard = script ? fallenBy(script, s) : [0, 0];
    eyeKey = "";
    blowAt = s;
  };
  // (Its course drawn back and forth, as a battle's is.)
  const scrub = (e: PointerEvent) => {
    const r = course.getBoundingClientRect();
    seek(((e.clientX - r.left) / Math.max(1, r.width)) * whole());
  };
  course.onpointerdown = (e) => {
    course.setPointerCapture(e.pointerId);
    scrub(e);
  };
  course.onpointermove = (e) => {
    if (course.hasPointerCapture(e.pointerId)) scrub(e);
  };
  again.onclick = () => {
    cast = null;
    seek(0);
    if (speed === 0) setSpeed(was);
  };
  page.onclick = () => {
    if (fight) d.openPage(fight.page);
  };
  done.onclick = () => stop();
  /**
   * To the next clash or the one before: the eye goes over, eased, held or not. (Held, to where its men have come and stand
   * off, so what is held is the clash and not the street before anyone is in it.)
   */
  const go = (dir: 1 | -1) => {
    if (!playing || !script) return;
    const starts = shotStarts(script),
      to =
        s > script.end
          ? dir < 0
            ? (starts[starts.length - 1] ?? 0)
            : null
          : shotStep(script, s, dir, speed === 0);
    if (to !== null) seek(to);
  };
  before.onclick = () => go(-1);
  next.onclick = () => go(1);
  addEventListener("keydown", (e) => {
    if (!playing || e.ctrlKey || e.metaKey || e.altKey) return;
    const on = e.target as HTMLElement | null;
    if (on && (on.tagName === "INPUT" || on.tagName === "TEXTAREA" || on.isContentEditable)) return;
    if (e.key === "[") go(-1);
    else if (e.key === "]") go(1);
  });

  /** The eye's field at a turn and tilt, and the screen left free to it: above the caption, under the corner's button. */
  const eyeFrame = (yaw: number, pitch: number, wide: boolean): EyeFrame => {
    const cam = d.stage.camera.camera,
      h = Math.max(1, innerHeight),
      top = ui.getBoundingClientRect().top,
      how = wide ? WHOLE : NEAR;
    return {
      yaw,
      pitch,
      tan: Math.tan((((cam?.fov ?? 45) * Math.PI) / 180) * 0.5),
      aspect: innerWidth / h,
      lo: Math.min(0.2, -1 + (2 * (h - top)) / h + how.pad),
      hi: Math.max(0.4, 1 - (2 * 52) / h - how.pad),
      side: how.side,
      high: MAN_HIGH,
      about: MAN_ABOUT,
      level: EYE_LEVEL,
      // (On a short screen, a phone on its side, as near again as it is shorter: its men no smaller than on a tall one.)
      min: how.min * Math.max(0.5, Math.min(1, h / 900)),
      max: rig.limits.max / VILLAGE_METRE,
    };
  };
  /**
   * Where the eye stands on a clash: all of it (or all of those fighting, nearer) fitted to the screen left free. Its turn and
   * tilt chosen once for a clash — across the way its sides face, with no block before the place or the furthest of its men —
   * and kept as it goes nearer.
   */
  const standOn = (p: VillagePlan, sc: StreetScript, clash: number, wide: boolean) => {
    const pts = clashBounds(sc, clash, wide);
    if (!stood || stood.clash !== clash) {
      const all = clashBounds(sc, clash, true),
        mid = { x: 0, z: 0 };
      for (const q of all) {
        mid.x += q.x / all.length;
        mid.z += q.z / all.length;
      }
      // (The furthest of them each way.)
      const ends = [
          all.reduce((a, q) => (q.x < a.x ? q : a)),
          all.reduce((a, q) => (q.x > a.x ? q : a)),
          all.reduce((a, q) => (q.z < a.z ? q : a)),
          all.reduce((a, q) => (q.z > a.z ? q : a)),
        ],
        across = clashFacing(sc, clash);
      let v = streetView(p, mid, EYE_DISTANCE / VILLAGE_METRE, across, ends);
      // (Its stand chosen again at how far off it truly is: the line from there is the clear one.)
      for (let turn = 0; turn < 2; turn++)
        v = streetView(p, mid, fitEye(all, eyeFrame(v.yaw, v.pitch, true)).distance, across, ends);
      stood = { clash, yaw: v.yaw, pitch: v.pitch };
    }
    const fit = fitEye(pts, eyeFrame(stood.yaw, stood.pitch, wide));
    eyeFits = fit.fits;
    return {
      target: { x: fit.target.x * VILLAGE_METRE, y: 0.12, z: fit.target.z * VILLAGE_METRE },
      distance: fit.distance * VILLAGE_METRE,
      pitch: stood.pitch,
      yaw: stood.yaw,
    };
  };
  /** Where the eye stands by a squad on its way: near, its place brought up into the screen left free above the caption. */
  const standBy = (p: VillagePlan, at: { x: number; z: number }) => {
    // The eye's mark so much nearer itself as half the caption's share of the eye's field, at this height. The eye then stands
    // that much further from the place: its stand is chosen again with that, so the line from where it truly stands is the clear one.
    const cam = d.stage.camera.camera,
      fov = ((cam?.fov ?? 45) * Math.PI) / 180,
      covered = ui.getBoundingClientRect().height / Math.max(1, innerHeight),
      far = EYE_DISTANCE / VILLAGE_METRE,
      nearAt = (pitch: number) =>
        (far * Math.tan((fov * covered) / 2)) / Math.max(0.3, Math.sin((-pitch * Math.PI) / 180));
    let v = streetView(p, at, far),
      near = nearAt(v.pitch);
    for (let turn = 0; turn < 2; turn++) {
      v = streetView(p, at, far + near / Math.max(0.2, Math.cos((v.pitch * Math.PI) / 180)));
      near = nearAt(v.pitch);
    }
    return {
      target: {
        x: (at.x + Math.sin((v.yaw * Math.PI) / 180) * near) * VILLAGE_METRE,
        y: 0.12,
        z: (at.z + Math.cos((v.yaw * Math.PI) / 180) * near) * VILLAGE_METRE,
      },
      distance: EYE_DISTANCE,
      pitch: v.pitch,
      yaw: v.yaw,
    };
  };

  /** History's dead of a side, as many of its fallen figures have fallen by now. */
  const told = (f: StreetFight, sc: StreetScript, by: readonly number[]): number[] =>
    [0, 1].map((i) =>
      sc.falls[i]! > 0 ? Math.round((f.sides[i]!.fallen * by[i]!) / sc.falls[i]!) : 0,
    );

  /** The world's moment the town is drawn at: its day's dusk; after, the morning of the burying. */
  const seenAt = (t: number): number =>
    script && burying && s > script.end
      ? burying.leaves - 90 + (s - script.end) * BURY_PACE
      : Math.floor(t / DAY) * DAY + (script?.hour ?? DUSK) * DAY;
  const NONE = new Set<number>(),
    NO_ONE: TownWarScene["soldiers"] = [],
    SIDES: [object, object] = [{}, {}],
    struck: BattleSound[] = [],
    /** The blows heard this frame, in slots kept from frame to frame. */
    blowSlots: {
      kind: BattleSound["kind"];
      v: BattleSound["v"];
      in: number;
      far: number;
      pan: number;
    }[] = [],
    blowsHeard: typeof blowSlots = [];

  d.stage.onUpdate((dt) => {
    if (!playing || !fight || !script) return;
    const p = d.plan();
    // (Gone from the town: the film is over.)
    if (!p || p.ref !== fight.town) return stop();
    const pace = BATTLE_SPEEDS[speed] ?? 0;
    dt *= pace;
    s = Math.min(whole(), s + dt);
    fill.style.width = `${((s / Math.max(1, whole())) * 100).toFixed(1)}%`;
    // After it: the town's burying, by its own road to its graveyard (Phase 43), where it has one.
    if (s > script.end && burying) {
      next.disabled = true;
      scene = streetAt(script, slots, -100);
      shown = scene;
      for (const flag of flags) flag.hidden = true;
      village.battleAt(null);
      village.streetDowned = null;
      village.gunsOf = null;
      document.body.dataset.street = "after";
      // (The eye kept on the bier as it goes: set, not flown, so it neither lags nor swings out.)
      const bier = village.graveyardShown()?.bier;
      if (bier && !rig.steering) {
        if (eyeKey !== "bier") {
          eyeKey = "bier";
          rig.halt();
          rig.yaw = streetView(p, bier, 40).yaw;
          rig.pitch = -44;
          rig.distance = BURY_EYE;
          rig.target.set(bier.x * VILLAGE_METRE, 0.12, bier.z * VILLAGE_METRE);
        } else {
          const k = Math.min(1, dt * 4);
          rig.target.set(
            rig.target.x + (bier.x * VILLAGE_METRE - rig.target.x) * k,
            0.12,
            rig.target.z + (bier.z * VILLAGE_METRE - rig.target.z) * k,
          );
        }
        rig.userZoomed = true;
      }
      setText(
        where,
        `After, a morning in ${fight.townName}: its dead borne from their door to its graveyard`,
      );
      return;
    }
    document.body.dataset.street = fight.kind;
    scene = streetAt(script, slots, s, p);
    // The eye: on one clash until it is decided and a breath more (view/street-shots.ts). First all of it, fitted to the screen
    // left free; then nearer, still all of those in it; then over to the next, eased, as long on its way at any speed as can be
    // followed. (A squad on its way is followed near, step by step.)
    const eye = streetEye(script, s),
      key = !eye
        ? ""
        : eye.clash !== undefined
          ? `c${eye.clash}${eye.wide ? "w" : "n"}`
          : `p${Math.round(eye.at.x / 4)}:${Math.round(eye.at.z / 4)}`;
    if (eye && key !== eyeKey && !rig.steering) {
      const same = eye.clash !== undefined && stood?.clash === eye.clash,
        to =
          eye.clash !== undefined
            ? standOn(p, script, eye.clash, eye.wide === true)
            : standBy(p, eye.at);
      if (eye.clash === undefined) stood = null;
      eyeKey = key;
      if (eyeCut) {
        eyeCut = false;
        rig.halt();
        rig.yaw = to.yaw;
        rig.pitch = to.pitch;
        rig.distance = to.distance;
        rig.target.set(to.target.x, to.target.y, to.target.z);
        rig.userZoomed = true;
      } else
        rig.flyTo(to, eye.clash === undefined ? EYE_GOES : same ? NEARER : travelSeconds(pace));
    }
    next.disabled = shotStep(script, s, 1) === null;
    // Its sound: a man down, low and near; iron or a shot where a clash begins.
    const by = fallenBy(script, s);
    // (Where they are drawn as a battle's men, each blow that fells one is heard as a battle's is, below.)
    if (!battle)
      for (const side of [0, 1])
        if (by[side]! > heard[side]!)
          sound.cue("thud", 0.55, undefined, { far: 14, pan: side ? 0.3 : -0.3 });
    // (Its guns are heard each as it fires, where its flash is drawn: app/ears.ts, off render/village.ts shotsBetween.)
    const begun = script.clashes.find((c) => c.from <= s && c.from > s - dt);
    if (begun && !battle && !fight.sides.some((x) => isGun(x.host?.arm)))
      sound.cue("clash", 0.45, undefined, { far: 20, pan: 0 });
    heard = by;
    // (Blows as they land, where men fight hand to hand: a few a second at the most, by the arm that lands them; nothing while it
    // is held or drawn back. Drawn as a battle's men, their blows are a battle's, below.)
    if (dt > 0 && s >= blowAt && !battle) {
      let n = 0;
      for (const q of scene.soldiers) if (q.doing === "fight" && q.size > 0.5) n++;
      let k = n ? Math.floor(s * 7.3) % n : -1;
      for (const q of scene.soldiers) {
        if (q.doing !== "fight" || q.size <= 0.5 || k-- !== 0) continue;
        const arm = fight.sides[q.side]!.host?.arm;
        if (!isGun(arm))
          sound.cue(arm === "club" ? "thud" : "clash", 0.3, undefined, {
            far: 16,
            pan: q.side ? 0.25 : -0.25,
          });
        break;
      }
      blowAt = s + 0.45 + ((s * 3.1) % 0.5);
    }
    // Those of the town in it: who is caught between and falls, the watch come after, the crowd about the fallen.
    cast ??= streetCast(p, script, d.now());
    const there = castAt(cast, s, p);
    // Its men drawn, struck and bleeding as a battle's are (view/blows.ts), as the blood setting shows; the town's war left its
    // fires, posts and carriers.
    if (battle) {
      drawn = blowsAt(
        battle.field,
        battle.blows,
        streetBattleNow(battle, script, scene, slots, s),
        village.gore,
      );
      village.battleAt(drawn, there.folk);
      shown = { ...scene, soldiers: NO_ONE };
      // (Its shooters' flashes and smoke drawn at their muzzles by the town, as its war's are, and so heard.)
      village.gunsOf = scene.soldiers;
      const layer = village.placedBattle;
      if (dt > 0 && layer) {
        battleSounds(battle.field, battle.blows, s - dt, s, drawn, SIDES, struck);
        blowsHeard.length = 0;
        for (const e of struck) {
          if (blowsHeard.length >= 24) break;
          const h =
            blowSlots[blowsHeard.length] ??
            (blowSlots[blowsHeard.length] = { kind: e.kind, v: e.v, in: 0, far: 0, pan: 0 });
          layer.heardFrom(e.x, e.z, h);
          h.kind = e.kind;
          h.v = e.v;
          h.in = (e.t - s) / pace;
          blowsHeard.push(h);
        }
        if (blowsHeard.length) sound.heard(blowsHeard, pace);
      }
    } else {
      drawn = null;
      shown = scene;
      village.gunsOf = null;
      village.battleAt(null, there.folk);
    }
    village.streetDowned = there.downed.size ? there.downed : NONE;
    crowd = there.folk.length;
    caught = there.downed.size;
    // Its words: what and where now; who has fallen, as history counts them; after, what it cost and what came of it.
    const n = told(fight, script, by),
      a = fight.sides[0],
      b = fight.sides[1],
      between = script.bystanders.length
        ? Math.round((fight.others * caught) / script.bystanders.length)
        : 0;
    setText(
      where,
      s >= script.quiet
        ? `${fight.words.cost}. ${fight.words.effect}.`
        : eye
          ? eye.why === "post"
            ? `Year ${fight.year}, late in the day in ${fight.townName}: soldiers going into its quarter, street by street`
            : // (Which of its clashes this is comes first: on a phone its words are two lines until they are tapped.)
              `${script.clashes.length > 1 ? `Clash ${(eye.clash ?? 0) + 1} of ${script.clashes.length}, ` : ""}${SPOT_WORDS[eye.why]} in ${fight.townName}, late in the day, year ${fight.year}`
          : `Year ${fight.year}, late in the day in ${fight.townName}. ${fight.words.what}.`,
    );
    const hurt = drawn?.hurt ? drawn.hurt[0] + drawn.hurt[1] : 0,
      said = `${a.name}: ${n[0]} fallen|${b.name}: ${n[1]} fallen${fight.others ? `  ·  ${between} caught between` : ""}${hurt ? "  ·  the wounded are shown, not told" : ""}`;
    if (tally.dataset.said !== said) {
      tally.dataset.said = said;
      const [first, second] = said.split("|"),
        chip = (c: readonly number[]) => {
          const x = el("span", "street-chip");
          x.style.background = rgb(c);
          return x;
        };
      tally.replaceChildren(chip(a.color), ` ${first}  ·  `, chip(b.color), ` ${second}`);
    }
    // Its flags: over each side's men at the place the eye is on, while they stand there.
    const box = ui.getBoundingClientRect();
    let first: { x: number; y: number } | null = null;
    flags.forEach((flag, side) => {
      let x = 0,
        z = 0,
        m = 0;
      if (eye && scene && s < script!.quiet)
        for (const q of scene.soldiers)
          if (
            q.side === side &&
            q.size > 0.5 &&
            q.doing !== "fallen" &&
            Math.hypot(q.x - eye.at.x, q.z - eye.at.z) < 16
          ) {
            x += q.x;
            z += q.z;
            m++;
          }
      const at = m ? village.screenOf(x / m, z / m, 3.4) : null;
      if (!at || at.y > box.top - 30 || at.y < 8) {
        flag.hidden = true;
        return;
      }
      flag.hidden = false;
      flag.style.background = rgb(fight!.sides[side]!.color);
      // (Never one flag by the other: where they would meet, each stood off to its own hand.)
      const y = at.y - 34;
      let fx = at.x;
      if (side === 1 && first && Math.abs(first.x - fx) < 44 && Math.abs(first.y - y) < 28) {
        const hand = fx >= first.x ? 1 : -1,
          mid = (first.x + fx) / 2;
        fx = mid + hand * 24;
        flags[0]!.style.transform = `translate(${Math.round(mid - hand * 24 - 9)}px, ${Math.round(first.y)}px)`;
      }
      if (side === 0) first = { x: fx, y };
      flag.style.transform = `translate(${Math.round(fx - 9)}px, ${Math.round(y)}px)`;
    });
  });

  return {
    play,
    stop,
    get holds() {
      return playing;
    },
    seen: seenAt,
    light(on: boolean) {
      d.stage.fill = on ? FILL : 0;
    },
    seek,
    go,
    keys: {
      toggle: () => setSpeed(speed === 0 ? was : 0),
      pick: (i: number) => {
        if (i < 1 || i >= BATTLE_SPEEDS.length) return false;
        setSpeed(i);
        return true;
      },
    },
    views() {
      const p = d.plan();
      return script && p
        ? script.clashes.map((c) => ({
            why: c.spot.why,
            from: c.from,
            ...streetView(p, c.spot, EYE_DISTANCE / VILLAGE_METRE),
          }))
        : [];
    },
    get indoors() {
      return playing && !!script && s <= script.end && script.clashes.some((c) => c.from - 2 <= s);
    },
    frame() {
      const eye = script ? streetEye(script, s) : null,
        top = ui.getBoundingClientRect().top,
        seen = (q: { x: number; z: number }) =>
          [0, MAN_HIGH].every((high) => {
            const at = village.screenOf(q.x, q.z, high);
            return !!at && at.x >= 0 && at.x <= innerWidth && at.y >= 0 && at.y <= top;
          });
      return {
        on: eye?.clash ?? -1,
        wide: eye?.wide === true,
        flying: rig.flying,
        fits: eyeFits,
        clashes: (script?.clashes ?? []).map((c, k) => {
          const there = (script?.figures ?? [])
            .filter((g) => g.clash === k && g.slot < slots)
            .map((g) => scene?.soldiers[g.side * slots + g.slot])
            .filter((q): q is NonNullable<typeof q> => !!q && q.size > 0.5);
          return { from: c.from, to: c.to, there: there.length, inside: there.filter(seen).length };
        }),
      };
    },
    state() {
      const sc = script,
        f = fight,
        by = sc ? fallenBy(sc, s) : [0, 0],
        live = scene?.soldiers.filter((q) => q.size > 0.5 && q.doing !== "fallen").length ?? 0;
      return {
        event: f?.event ?? null,
        kind: f?.kind ?? null,
        s,
        end: (sc?.end ?? 0) + (burying ? BURY_LASTS : 0),
        fightEnd: sc?.end ?? 0,
        burying: !!burying,
        bier: village.graveyardShown()?.bier ?? null,
        caught,
        cars: scene?.carriers?.length ?? 0,
        under: (() => {
          const eye = script ? streetEye(script, s) : null,
            top = ui.getBoundingClientRect().top;
          if (!eye || !scene) return 0;
          let n = 0;
          for (const q of scene.soldiers) {
            if (q.size < 0.5 || Math.hypot(q.x - eye.at.x, q.z - eye.at.z) > 9) continue;
            const at = village.screenOf(q.x, q.z, 0);
            if (at && at.y > top) n++;
          }
          return n;
        })(),
        acts: (() => {
          const o: Record<string, number> = {};
          for (const t of drawn?.troopers ?? [])
            if (t.size > 0.5 && t.hit !== undefined) {
              const key = t.crawl ? "crawl" : t.act;
              o[key] = (o[key] ?? 0) + 1;
            }
          return o;
        })(),
        plain: !battle,
        wounds: drawn?.wounds?.length ?? 0,
        blood: drawn?.blood.length ?? 0,
        limbs: drawn?.limbs?.length ?? 0,
        lying:
          drawn?.troopers.filter(
            (t) =>
              t.act === "fall" && t.size > 0.5 && !battle?.blows.hits[battle.blows.of[t.id]!]?.back,
          ).length ?? 0,
        lamps: scene?.camp.length ?? 0,
        paused: speed === 0,
        speed: BATTLE_SPEEDS[speed] ?? 0,
        drawn: sc?.drawn ?? [0, 0],
        fallen: by,
        told: f && sc ? told(f, sc, by) : [0, 0],
        won: f?.won ?? null,
        figures: sc?.figures.length ?? 0,
        standing: live,
        posts: scene?.tents.length ?? 0,
        crowd,
        words: `${where.textContent ?? ""} | ${tally.textContent ?? ""}`,
      };
    },
  };
}
