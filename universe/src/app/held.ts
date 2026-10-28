// A soldier or a beast possessed (Phase 61), the page's part, as one of a town's people is (app/
// possess.ts): taken from the god's palette — Possess, then a touch on one of the men of the battle
// fought before the town, or on one of the beasts about it — or by the look tools. The world's clock
// is held and the possession runs on a clock of its own, at the world's pace, slowed, or held. Each
// step a bid is sampled from the stick, the eye and the acts pressed; a second's bids go to the host
// at a time (`possess.held`) — a soldier's with the world carried on a minute, as the battle before
// the town is fought a second of its own to a minute of the world's — and the small world is asked of
// as each step is bid (`held.live`) and drawn: a soldier's fight over the battle as drawn when he was
// taken (the rest of the field holding, or in flight once a side breaks), the battle's tally under the
// strip; a beast's small world over the beasts about the town. Letting go, or the body struck down,
// fled, or the battle over, writes back what was done: the battle as the hand fought it, laid again
// and drawn from then on from its fight fought out (`held.fought`), its fallen lying until they are
// borne in; a beast's flock without the one it lost. Leaving the town (or the battle laid again)
// lets go; a body found held with none taken here is let go at once.
import { softenBodies } from "./held-motion.ts";
import type {
  FoughtNow,
  HeldBeastNow,
  HeldBody,
  HeldLive,
  HeldNow,
  HeldSoldierNow,
  HostClient,
  BattleNear,
  BattleRoll,
  RollEntry,
  VillagePlan,
} from "../bridge/index.ts";
import {
  BEAST_EYE,
  PossessEye,
  SOLDIER_EYE,
  VILLAGE_METRE,
  type OrbitRig,
  type Stage,
  type VillageScene,
} from "../render/index.ts";
import { PossessHud, type GodPalette, type TimeBar } from "../ui/index.ts";
import {
  BATTLE_DAY,
  BATTLE_LENGTH,
  STEPS_PER_SECOND,
  STILL_BID,
  battleSecond,
  battleStage,
  beastTakeOf,
  bidOf,
  borneShare,
  drawnHeight,
  fieldBid,
  fightStepOf,
  foughtBorne,
  foughtLying,
  frameYaw,
  heldBeastsOver,
  heldFightNow,
  goreAt,
  lettersOf,
  placedPoint,
  soldierTakeOf,
  villageSolids,
  type BattleField,
  type Gore,
  type BattleNow,
  type HandBid,
  type PlacedFrame,
} from "../view/index.ts";
import type { Possession } from "./possess.ts";

/** The battle before the town as app/main.ts laid it (its `placed`). */
export type HeldPlaced = {
  /** `<town>|<event>`; the turn it is fought at; the figures a side it was laid at. */
  readonly key: string;
  readonly turn: number;
  readonly most: number;
  readonly info: BattleNear;
  readonly field: BattleField;
  readonly frame: PlacedFrame;
  readonly roll: BattleRoll;
  readonly names: readonly (RollEntry | null)[];
  /** As drawn now (null: not drawn). */
  readonly now: BattleNow | null;
};

/**
 * A battle's close field watched (Phase 37's), where the god fought in it: `field|<event>|<figures>`,
 * the figures a side it was laid at (those he was taken at), its words, its field, and the battle as
 * history drew it at a second of its own.
 */
export type HeldField = {
  readonly key: string;
  readonly most: number;
  readonly info: BattleNear;
  readonly field: BattleField;
  readonly drawn: (s: number) => BattleNow;
};

export type HeldDeps = {
  readonly stage: Stage;
  readonly canvas: HTMLCanvasElement;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly palette: GodPalette;
  /** One of the town's people possessed (app/possess.ts): one possession at a time. */
  readonly person: Possession;
  /** The town shown (null: none), and the scale shown. */
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  /** The battle before the town as laid (null: none). */
  readonly placed: () => HeldPlaced | null;
  /** The battle before the town as history draws it at a battle second, its blows on it (null: none laid). */
  readonly drawnAt: (s: number) => BattleNow | null;
  /** The battle before the town laid again (a soldier let go: it is told and drawn as he fought it). */
  readonly relay: () => void;
  /** The town's plan read again (a beast let go: its flock as it was left). */
  readonly reload: (ref: string) => Promise<void>;
  /** Free roam put away: the eye is the possession's. */
  readonly toOrbit: () => void;
  readonly gore: () => Gore;
};

/** A possession's clock, as app/possess.ts keeps one's. */
type Clock = {
  /** Steps sent, a second at a time; the bids of the second being filled. */
  sent: number;
  bids: HandBid[];
  /** The possession's clock (steps since the taking) and its pace (1, ½, 0 held). */
  clock: number;
  pace: number;
  /** Seconds sent not yet answered (of this run of sending: `run` counts the runs). */
  owed: number;
  run: number;
  asking: boolean;
  again: boolean;
  /** Why it is ending ("release": let go; else as the host told it); null: it goes on. */
  ending: string | null;
  /** The small world as last answered. */
  live: HeldLive | null;
};
type OnSoldier = Clock & {
  readonly kind: "soldier";
  readonly now: HeldSoldierNow;
  /** The battle laid (`placed.key`), its field and frame, and as drawn when he was taken. */
  readonly key: string;
  readonly field: BattleField;
  readonly frame: PlacedFrame;
  readonly base: BattleNow;
};
type OnBeast = Clock & {
  readonly kind: "beast";
  readonly now: HeldBeastNow;
};
type On = OnSoldier | OnBeast;

/** A battle the god fought, as drawn before its town. */
type Fought = {
  /** Its end, and the step of its fight last asked for (null: not yet answered). */
  end: FoughtNow | null;
  shown: FoughtNow | null;
  asking: boolean;
  /** Not one the host has (another world's): drawn as history has it. */
  none: boolean;
  /** The battle laid it was drawn over (`placed.key`, at its figures): as drawn when he was taken, and once over. */
  key: string;
  base: BattleNow | null;
  lying: BattleNow | null;
};

/** Seconds sent unanswered before the possession's clock waits for the host. */
const OWED_MOST = 2;
/** At most this far (s) a body is drawn on along its way between the host's answers. */
const AHEAD_MOST = 0.25;
/**
 * The orbit handed back over where the body stood (as app/possess.ts hands it back): at least so far
 * off (scene units), looking down so steeply (degrees), further off on a narrower screen.
 */
const HANDED_NEAREST = 4,
  HANDED_PITCH = -38,
  HANDED_ASPECT = 1.6;

/** Bodies drawn `dt` seconds on along their way (the struck down and the gone where they are). */
function onward(bodies: readonly HeldBody[], dt: number): readonly HeldBody[] {
  if (!dt) return bodies;
  return bodies.map((b) =>
    b.doing === "dead" || b.doing === "down" || b.doing === "gone"
      ? b
      : { ...b, x: b.x + b.vx * dt, z: b.z + b.vz * dt },
  );
}

export type Held = {
  /** One of the battle's figures taken (its id): why not (null: taken). */
  takeSoldier(figure: number): Promise<string | null>;
  /** One of the beasts about the town taken (its index as laid out): why not (null: taken). */
  takeBeast(index: number): Promise<string | null>;
  letGo(): Promise<void>;
  readonly on: boolean;
  /** The battle before the town as the hand has it at a moment (null: history's). */
  battleShown(placed: HeldPlaced, seen: number): BattleNow | null;
  /** Whether a soldier of this battle is held (it is not laid again meanwhile). */
  holds(event: string): boolean;
  /** How one of a battle the god fought came out of it, as his fight left him (null: as history has it). */
  fateOf(placed: Fielded, figure: number): "fell" | "wounded" | "stood" | null;
  /**
   * A battle's close field at a second of its own, where the god fought in it: as history drew it
   * until the second he was taken, as his fight went from then on (null: history's alone, or before).
   */
  fieldShown(field: HeldField, s: number): BattleNow | null;
};
/** A battle laid where the hand's fight is drawn over it: before its town, or on its close field. */
type Fielded = Pick<HeldPlaced, "key" | "info">;

export function installHeld(d: HeldDeps): Held {
  const hud = new PossessHud(d.hud),
    eye = new PossessEye(d.stage),
    /** The acts pressed and not yet bid (one a step, in the order pressed). */
    presses: number[] = [],
    /** The battles the god fought, by `<event>|<moment taken>`. */
    fights = new Map<string, Fought>();
  let on: On | null = null,
    /** The small world as it last stood when the last possession ended (the look tools). */
    lastLive: HeldLive | null = null,
    busy = false,
    /** Where the page was last looked at for a body held unseen. */
    looked: string | null = null,
    /** Where the canvas was last touched (CSS px): whom Possess falls on. */
    touched = { x: -1, y: -1 };
  d.canvas.addEventListener(
    "pointerdown",
    (e) => {
      const r = d.canvas.getBoundingClientRect();
      touched = { x: e.clientX - r.left, y: e.clientY - r.top };
    },
    true,
  );
  // (Its controls on the page only while a soldier or a beast is held: one of the town's people's
  // — Phase 60's — are the only ones there till then.)
  hud.element.remove();
  const showHud = () => {
      d.hud.append(hud.element);
      hud.show();
    },
    hideHud = () => {
      hud.hide();
      hud.element.remove();
    };
  hud.onLook = (dx, dy) => eye.look(dx, dy);
  hud.onZoom = (f) => eye.zoom(f);
  hud.onBehind = () => {
    const me = on ? drawnMe(on) : null;
    if (me) eye.behind(me.yaw);
  };
  hud.onPace = (pace) => {
    if (on) on.pace = pace;
  };
  hud.onLetGo = () => void letGo();

  /** How far the small world is drawn on from its last answer (s of its own). */
  const ahead = (o: On) =>
    o.live
      ? Math.max(-AHEAD_MOST, Math.min(AHEAD_MOST, (o.clock - o.live.step) / STEPS_PER_SECOND))
      : 0;
  /** The body held as drawn now, on the town's ground (m), and which way it faces. */
  let shownFor: On | null = null;
  let shownBodies: readonly HeldBody[] = [];
  const displayed = (o: On) =>
    shownFor === o ? shownBodies : onward(o.live?.bodies ?? [], ahead(o));
  const drawnMe = (o: On): { x: number; z: number; yaw: number } | null => {
    const b = o.live?.bodies[0];
    if (!b) return null;
    const m = displayed(o).find((q) => q.id === b.id)!;
    if (o.kind === "beast") return { x: m!.x, z: m!.z, yaw: m!.yaw };
    const at = placedPoint(o.frame, m!.x, m!.z);
    return { x: at.x, z: at.z, yaw: m!.yaw + frameYaw(o.frame) };
  };
  /** The world's moment a soldier's fight stands at a step: a minute of the world's to a second of the battle's. */
  const worldAt = (o: OnSoldier, step: number) =>
    o.now.from + (step / STEPS_PER_SECOND) * BATTLE_DAY.second;
  /** Whether the host's held one is the one held here. */
  const same = (o: On, now: HeldNow): boolean =>
    now.kind === "soldier"
      ? o.kind === "soldier" && now.battle === o.now.battle && now.figure === o.now.figure
      : o.kind === "beast" && now.from === o.now.from && now.bodies[0] === o.now.bodies[0];

  const whyNot = (): string | null =>
    on || busy || d.person.on ? "your hand is in a body already: let it go first" : null;

  const takeSoldier = async (figure: number): Promise<string | null> => {
    const why = whyNot();
    if (why) return why;
    const P = d.placed();
    if (d.scale() !== "village" || !P)
      return "go down into a town a battle is fought before to take one of its men";
    busy = true;
    try {
      d.toOrbit();
      d.time.hold("held");
      // (As the battle is drawn at the moment the taking takes hold: the next of the clock held.)
      const { t } = await d.client.query<{ t: number }>({ type: "now" }),
        s = battleSecond(t + 1, P.turn),
        base = d.drawnAt(s);
      if (!base) throw new Error("the battle is not laid before the town");
      const args = soldierTakeOf(P.info, P.field, base, P.roll, P.names, figure, s, P.most);
      if (!args) throw new Error("he does not stand to be taken: touch one still in the fight");
      await d.client.command("possess.soldier", args);
      const now = await d.client.query<HeldNow | null>({ type: "held.now" });
      if (!now || now.kind !== "soldier") throw new Error("he could not be taken");
      if (d.placed()?.key !== P.key) throw new Error("the battle was laid again meanwhile");
      startSoldier(P, now, base);
      return null;
    } catch (error) {
      d.time.release("held");
      // (Taken, but the page moved on: let go at once.)
      const held = await d.client.query<HeldNow | null>({ type: "held.now" }).catch(() => null);
      if (held && !on)
        await d.client
          .command("possess.leave", { step: held.step, steps: "" })
          .catch(() => undefined);
      return (error as Error).message;
    } finally {
      busy = false;
    }
  };

  const takeBeast = async (index: number): Promise<string | null> => {
    const why = whyNot();
    if (why) return why;
    const plan = d.plan(),
      laid = d.village.faunaLayer.laidNow();
    if (d.scale() !== "village" || !plan || !laid)
      return "go down into a town to take one of the beasts about it";
    const args = beastTakeOf(plan, laid.fauna, laid.beasts, laid.n, index);
    if (!args)
      return "that one is not to be had: touch one of the town's flock or of the wild about it";
    const me = laid.beasts[index]!,
      body = laid.fauna.species[me.species]!.body;
    busy = true;
    try {
      d.toOrbit();
      d.time.hold("held");
      await d.client.command("possess.beast", args);
      const now = await d.client.query<HeldNow | null>({ type: "held.now" });
      if (!now || now.kind !== "beast") throw new Error("it could not be taken");
      startBeast(now, me.yaw, Math.max(0.5, ((body.leg + body.height) * body.k) / VILLAGE_METRE));
      return null;
    } catch (error) {
      d.time.release("held");
      return (error as Error).message;
    } finally {
      busy = false;
    }
  };

  const clock = (step: number): Clock => ({
    sent: step,
    bids: [],
    clock: step,
    pace: 1,
    owed: 0,
    run: 0,
    asking: false,
    again: false,
    ending: null,
    live: null,
  });

  /** A soldier taken: the eye behind him, the controls up, his figure marked. */
  const startSoldier = (P: HeldPlaced, now: HeldSoldierNow, base: BattleNow) => {
    const o: OnSoldier = {
      ...clock(now.step),
      kind: "soldier",
      now,
      key: P.key,
      field: P.field,
      frame: P.frame,
      base,
    };
    on = o;
    presses.length = 0;
    d.rig.enabled = false;
    hud.carriesIcon = "⚔️";
    showHud();
    hud.setPace(1);
    hud.say(`You fight as ${now.name}${now.town ? ` of ${now.town}` : ""}`);
    const plan = d.plan();
    eye.height = plan ? drawnHeight(plan) : 1.7;
    // (Looking down over the heads of the ranks behind him: at a man's pitch they stand between.)
    eye.pitch = SOLDIER_EYE.pitch;
    eye.distance = SOLDIER_EYE.distance;
    const me = base.troopers.find((t) => t.id === now.figure);
    eye.behind((me?.yaw ?? 0) + frameYaw(P.frame), true);
    d.village.placedBattle?.mark(now.figure);
    void ask(o);
  };

  /** A beast taken: the eye behind it, the controls up, its small world drawn over the beasts about the town. */
  const startBeast = (now: HeldBeastNow, yaw: number, height: number) => {
    const o: OnBeast = { ...clock(now.step), kind: "beast", now },
      layer = d.village.faunaLayer;
    on = o;
    presses.length = 0;
    d.rig.enabled = false;
    layer.hold(now.bodies[0]!);
    layer.over = (out, n) => {
      if (on === o && o.live) heldBeastsOver(out, n, displayed(o));
    };
    hud.carriesIcon = "🐾";
    showHud();
    hud.setPace(1);
    hud.say(`You run as ${now.name}`);
    eye.height = height;
    eye.pitch = BEAST_EYE.pitch;
    eye.distance = BEAST_EYE.distance;
    eye.behind(yaw, true);
    void ask(o);
  };

  /** The small world asked of the host as the bids not yet sent make it (one ask at a time; the latest asked again). */
  const ask = async (o: On): Promise<void> => {
    if (o.asking) {
      o.again = true;
      return;
    }
    o.asking = true;
    const live = await d.client
      .query<HeldLive | null>({ type: "held.live", args: { steps: lettersOf(o.bids) } })
      .catch(() => null);
    o.asking = false;
    if (on !== o) return;
    if (!live) {
      // (None held — let go by its ending — or bids it would not take.)
      const now = await d.client.query<HeldNow | null>({ type: "held.now" }).catch(() => null);
      if (on !== o) return;
      if (!now || !same(o, now)) return void finish(o);
      return resync(o, now.step);
    }
    if (!o.live || live.step >= o.live.step) {
      o.live = live;
      hud.set(live);
      hud.setTally(live.tally);
      if (live.ended && o.ending === null) end(o, live.ended);
    }
    if (o.again) {
      o.again = false;
      void ask(o);
    }
  };

  /** Taken up again from where the host stands (bids refused: out of step with what it keeps). */
  const resync = (o: On, step: number) => {
    o.run++;
    o.owed = 0;
    o.sent = step;
    o.bids = [];
    o.clock = step;
    void ask(o);
  };

  /** A second's bids sent: the host keeps them (a soldier's world carried on to the second's end first). */
  const send = (o: On): Promise<void> => {
    const args = { step: o.sent, steps: lettersOf(o.bids) },
      run = o.run;
    o.sent += STEPS_PER_SECOND;
    o.bids = [];
    o.owed++;
    if (o.kind === "soldier") void d.client.advance(worldAt(o, o.sent) - 1).catch(() => undefined);
    return d.client.command("possess.held", args).then(
      () => {
        if (o.run === run) o.owed--;
      },
      async () => {
        if (o.run !== run || on !== o) return;
        const now = await d.client.query<HeldNow | null>({ type: "held.now" }).catch(() => null);
        if (on !== o || o.run !== run) return;
        if (!now || !same(o, now)) return void finish(o);
        resync(o, now.step);
      },
    );
  };

  /** Ended for the body (struck down, fled, the battle over): the second begun filled with stillness and sent; the host lets go. */
  const end = (o: On, why: string) => {
    o.ending = why;
    while (o.bids.length < STEPS_PER_SECOND) o.bids.push(STILL_BID);
    void send(o).then(() => ask(o));
  };

  const letGo = async (): Promise<void> => {
    const o = on;
    if (!o || o.ending === "release") return;
    const sending = o.ending === null;
    o.ending = "release";
    if (sending) {
      if (o.kind === "soldier")
        await d.client.advance(worldAt(o, o.sent + o.bids.length) - 1).catch(() => undefined);
      await d.client
        .command("possess.leave", { step: o.sent, steps: lettersOf(o.bids) })
        .catch(() => undefined);
    }
    await finish(o);
  };

  /** Ended: the controls put away, the orbit's eye over where the body stood, the clock let go, what was done drawn. */
  const finish = async (o: On): Promise<void> => {
    if (on !== o) return;
    const me = drawnMe(o);
    on = null;
    lastLive = o.live;
    hideHud();
    presses.length = 0;
    eye.release();
    d.rig.enabled = true;
    if (o.kind === "soldier") d.village.placedBattle?.mark(null);
    else {
      d.village.faunaLayer.hold(null);
      d.village.faunaLayer.over = null;
    }
    if (me) {
      // (Handed back to the orbit turning about where the body stood, looking the way the eye looked.)
      const at = eye.stood,
        dx = at.x - me.x,
        dz = at.z - me.z,
        across = Math.hypot(dx, dz),
        l = d.rig.limits,
        narrower = Math.max(
          1,
          HANDED_ASPECT / Math.max(0.3, innerWidth / Math.max(1, innerHeight)),
        );
      d.rig.target.set(me.x * VILLAGE_METRE, 0, me.z * VILLAGE_METRE);
      d.rig.yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      d.rig.pitch = Math.max(
        l.minPitch,
        Math.min(l.maxPitch, HANDED_PITCH, (-Math.atan2(at.y, across) * 180) / Math.PI),
      );
      d.rig.distance = Math.max(
        l.min,
        Math.min(
          l.max,
          Math.max(HANDED_NEAREST * narrower, Math.hypot(across, at.y) * VILLAGE_METRE),
        ),
      );
      d.rig.userZoomed = true;
    }
    d.time.release("held");
    if (o.kind === "soldier") d.relay();
    else if (d.scale() === "village" && d.plan()?.ref === o.now.village)
      await d.reload(o.now.village);
  };

  /** A step's bid: the stick as the eye looks (on a soldier's field, turned onto it), at a run or not, the act first pressed. */
  const sample = (o: On): HandBid => {
    presses.push(...hud.takePressed());
    const slot = presses.shift(),
      act = slot !== undefined ? (o.live?.offers[slot]?.act ?? 0) : 0,
      s = hud.stick(),
      bid = bidOf(s, eye.looking, s.run, act);
    return o.kind === "soldier" ? fieldBid(o.frame, bid) : bid;
  };

  /** A soldier's battle as drawn now: his fight over the battle as it was when he was taken. */
  const soldierShown = (o: OnSoldier): BattleNow => {
    const live = o.live;
    if (!live) return o.base;
    return heldFightNow(
      o.field,
      o.base,
      displayed(o),
      live.tally?.broke ?? -1,
      live.tally?.brokeAt ?? -1,
      o.now.second + o.clock / STEPS_PER_SECOND,
      o.now.blows,
    );
  };

  /** A battle the god fought asked of the host: its end, or a step of its fight (one ask at a time). */
  const askFought = (f: Fought, event: string, step?: number) => {
    if (f.asking) return;
    f.asking = true;
    void d.client
      .query<FoughtNow | null>({
        type: "held.fought",
        args: step === undefined ? { battle: event } : { battle: event, step },
      })
      .then((w) => {
        if (!w) {
          if (step === undefined) f.none = true;
        } else if (step === undefined) f.end = w;
        else if (!f.shown || w.step >= f.shown.step || step < f.shown.step) f.shown = w;
      })
      .catch(() => undefined)
      .finally(() => (f.asking = false));
  };

  /** The fought battle's record kept here (null: history's alone). */
  const foughtOf = (P: Fielded): Fought | null => {
    const hand = P.info.hand;
    if (!hand) return null;
    const key = `${P.info.event}|${hand.from}`;
    let f = fights.get(key);
    if (!f) {
      if (fights.size > 64) fights.clear();
      f = {
        end: null,
        shown: null,
        asking: false,
        none: false,
        key: P.key,
        base: null,
        lying: null,
      };
      fights.set(key, f);
    }
    if (f.none) return null;
    if (!f.end) askFought(f, P.info.event);
    return f;
  };

  const battleShown = (P: HeldPlaced, seen: number): BattleNow | null => {
    const o = on;
    if (o?.kind === "soldier" && o.key === P.key) return soldierShown(o);
    const f = foughtOf(P),
      end = f?.end;
    if (!f || !end) return null;
    const stage = battleStage(seen, P.turn);
    if (stage === null || stage === "eve" || seen < end.from) return null;
    // (Laid again — another detail — the battle as drawn when he was taken drawn afresh over it.)
    if (f.key !== P.key || !f.base) {
      f.key = P.key;
      f.base = d.drawnAt(end.second);
      f.lying = null;
    }
    const base = f.base;
    if (!base) return null;
    const drawn = (w: FoughtNow, s: number, dt = 0) =>
      heldFightNow(P.field, base, onward(w.bodies, dt), w.broke, w.brokeAt, s, w.blows);
    if (stage === "after" || stage === "borne") {
      f.lying ??= foughtLying(drawn(end, BATTLE_LENGTH));
      return stage === "borne" ? foughtBorne(f.lying, borneShare(seen, P.turn)) : f.lying;
    }
    const s = battleSecond(seen, P.turn),
      step = fightStepOf(seen, end.from);
    if (step >= end.last) return drawn(end, s);
    if (!f.shown || f.shown.step !== step) askFought(f, P.info.event, step);
    // (Until the first step asked is answered: as drawn when he was taken.)
    const w = f.shown && f.shown.step <= step ? f.shown : null;
    return w ? drawn(w, s, Math.min(AHEAD_MOST, (step - w.step) / STEPS_PER_SECOND)) : base;
  };

  const fateOf = (P: Fielded, figure: number): "fell" | "wounded" | "stood" | null => {
    const end = foughtOf(P)?.end,
      b = end?.bodies.find((x) => x.id === figure);
    if (!b) return null;
    return b.doing === "dead" ? "fell" : b.doing === "down" || b.hurt > 0 ? "wounded" : "stood";
  };

  const fieldShown = (F: HeldField, s: number): BattleNow | null => {
    const f = foughtOf(F),
      end = f?.end;
    // (Laid at other figures than he was taken at, the fight's bodies are not its figures.)
    if (!f || !end || s < end.second || F.most !== end.most) return null;
    if (f.key !== F.key || !f.base) {
      f.key = F.key;
      f.base = F.drawn(end.second);
      f.lying = null;
    }
    const base = f.base,
      step = Math.min(end.last, Math.floor((s - end.second) * STEPS_PER_SECOND)),
      drawn = (w: FoughtNow, dt = 0) =>
        heldFightNow(F.field, base, onward(w.bodies, dt), w.broke, w.brokeAt, s, w.blows);
    if (step >= end.last) return drawn(end);
    if (!f.shown || f.shown.step !== step) askFought(f, F.info.event, step);
    // (Until the step asked is answered: the nearest before it, drawn on a little; else as taken.)
    const w = f.shown && f.shown.step <= step ? f.shown : null;
    return w ? drawn(w, Math.min(AHEAD_MOST, (step - w.step) / STEPS_PER_SECOND)) : base;
  };

  // The possession's clock, frame by frame.
  d.stage.onUpdate((dt) => {
    const plan = d.plan(),
      where = d.scale() === "village" && plan ? plan.ref : "";
    if (!on) {
      shownFor = null;
      shownBodies = [];
      // A body held with none taken here (a world loaded so): let go at once.
      if (where !== looked && !busy) {
        looked = where;
        void d.client
          .query<HeldNow | null>({ type: "held.now" })
          .then((held) =>
            held && !on && !busy
              ? d.client.command("possess.leave", { step: held.step, steps: "" })
              : null,
          )
          .catch(() => undefined);
      }
      return;
    }
    const o = on;
    // The town left, or the battle laid again (another detail, another battle): let go.
    if (o.kind === "soldier" ? !where || d.placed()?.key !== o.key : where !== o.now.village)
      return void letGo();
    // The possession's clock: on at its pace, waiting while the host is behind, and for good once ending.
    const frozen = o.ending !== null || o.owed >= OWED_MOST;
    o.clock = Math.min(
      frozen ? o.sent + o.bids.length - 0.001 : Infinity,
      o.clock + Math.min(0.25, dt) * STEPS_PER_SECOND * o.pace,
    );
    let sampled = false;
    while (
      o.ending === null &&
      o.owed < OWED_MOST &&
      o.sent + o.bids.length <= Math.floor(o.clock)
    ) {
      o.bids.push(sample(o));
      sampled = true;
      if (o.bids.length === STEPS_PER_SECOND) void send(o);
    }
    if (sampled) void ask(o);
    shownBodies = softenBodies(
      shownFor === o ? shownBodies : [],
      onward(o.live?.bodies ?? [], ahead(o)),
      dt,
    );
    shownFor = o;
    // The eye behind the body as it is drawn.
    const me = drawnMe(o);
    if (me && plan) eye.update(me.x, me.z, villageSolids(plan), dt);
    if (o.kind === "soldier") d.village.placedBattle?.mark(o.now.figure);
  });

  // Possess on one of the battle's men, or on a beast: theirs; on one of the town's people, app/possess.ts's.
  const before = d.palette.onPossess;
  d.palette.onPossess = async (town, place) => {
    const plan = d.plan();
    if (d.scale() === "village" && plan && town === plan.ref) {
      const P = d.placed(),
        layer = d.village.placedBattle;
      if (P?.now && layer) {
        // (One of the fallen lying there, or the beaten in flight: not one to be taken, the touch on to the others.)
        const id = layer.pick(P.now, touched.x, touched.y),
          t = id === null ? undefined : P.now.troopers.find((x) => x.id === id);
        if (id !== null && t && t.act !== "fall" && t.act !== "flee") return takeSoldier(id);
      }
      if (d.village.pick(touched.x, touched.y, 36) === null) {
        const b = d.village.pickBeast(touched.x, touched.y);
        if (b)
          return b.index < 0
            ? "the birds and the fish are not to be had: touch a beast on the ground"
            : takeBeast(b.index);
      }
    }
    return before(town, place);
  };

  // (For the look tools and the gates.)
  const exposed = (globalThis as { causalis?: Record<string, unknown> }).causalis;
  if (exposed)
    exposed.held = {
      takeSoldier,
      takeBeast,
      letGo,
      /** The soldier or beast held, as the page holds it (null: none). */
      state: () =>
        on && {
          kind: on.kind,
          now: on.now,
          sent: on.sent,
          clock: on.clock,
          pace: on.pace,
          owed: on.owed,
          ending: on.ending,
          live: on.live,
          me: drawnMe(on),
          eye: { yaw: eye.looking, pitch: eye.pitch, distance: eye.distance, ...eye.stood },
          // (Those between the eye and the body, not drawn; of a battle, those out of the eye's sight, not posed.)
          cleared:
            on.kind === "soldier"
              ? (d.village.placedBattle?.cleared ?? 0)
              : d.village.faunaLayer.cleared,
          unposed: on.kind === "soldier" ? (d.village.placedBattle?.unposed ?? 0) : 0,
        },
      /** The small world as it last stood when the last possession ended (null: none ended yet). */
      last: () => lastLive,
      /** Where the body held is on the screen (CSS px; null: none, or behind the eye). */
      onScreen: () => {
        const me = on ? drawnMe(on) : null;
        return me ? eye.toScreen(me.x, eye.height * 0.5, me.z) : null;
      },
      /**
       * A body of the small world as drawn now, on the town's ground (m): where, its side (a
       * soldier's fight: 0 the attackers, 1 the defenders; a beast's: -1), what it is doing (null: not in it).
       */
      drawn: (id: number) => {
        const o = on,
          b = o?.live?.bodies.find((x) => x.id === id);
        if (!o || !b) return null;
        const [m] = onward([b], ahead(o)),
          at = o.kind === "soldier" ? placedPoint(o.frame, m!.x, m!.z) : { x: m!.x, z: m!.z },
          side = o.kind === "soldier" ? (o.base.troopers.find((t) => t.id === id)?.side ?? -1) : -1;
        return { x: at.x, z: at.z, side, doing: b.doing };
      },
      /** The nearest foe of a soldier held still in the fight, on the town's ground (m), and how far (field m; null: none). */
      foe: () => {
        const o = on;
        if (o?.kind !== "soldier" || !o.live) return null;
        const me = o.live.bodies[0]!,
          side = new Map(o.base.troopers.map((t) => [t.id, t.side]));
        let best: HeldBody | null = null,
          bd = Infinity;
        for (const b of o.live.bodies) {
          if (b === me || side.get(b.id) === o.now.side) continue;
          if (b.doing === "dead" || b.doing === "down" || b.doing === "gone") continue;
          const far = Math.hypot(b.x - me.x, b.z - me.z);
          if (far < bd) [best, bd] = [b, far];
        }
        if (!best) return null;
        const at = placedPoint(o.frame, best.x, best.z);
        return { id: best.id, x: at.x, z: at.z, far: bd };
      },
      /** The beasts about the town as laid out now: each one's index, id, kind, where it stands and where it is on the screen. */
      beasts: () => {
        const laid = d.village.faunaLayer.laidNow();
        if (!laid) return [];
        return laid.beasts.slice(0, laid.n).map((b, index) => {
          const sp = laid.fauna.species[b.species];
          return {
            index,
            id: b.id,
            kind: sp?.name ?? "",
            flock: b.herd >= 0 && b.id < 900000 && !!laid.fauna.herds[b.herd]?.flock,
            dead: b.dead,
            x: b.x,
            z: b.z,
            at: eye.toScreen(b.x, sp ? (sp.body.leg * sp.body.k) / VILLAGE_METRE : 0.5, b.z),
          };
        });
      },
      /** The battles the god fought drawn here, by `<event>|<moment>`: their end as asked. */
      fought: () => [...fights].map(([key, f]) => ({ key, end: f.end, none: f.none })),
    };

  return {
    takeSoldier,
    takeBeast,
    letGo,
    get on() {
      return on !== null;
    },
    battleShown: (placed, seen) => {
      const now = battleShown(placed, seen);
      return now ? goreAt(now, d.gore()) : null;
    },
    holds: (event) => on?.kind === "soldier" && on.now.battle === event,
    fateOf,
    fieldShown: (field, s) => {
      const now = fieldShown(field, s);
      return now ? goreAt(now, d.gore()) : null;
    },
  };
}
