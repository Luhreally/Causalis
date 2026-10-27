// One of a town's people possessed (Phase 60), the page's part. A body is taken from the god's palette
// (Possess, then a touch on one of the town's people) or from a person's card, in the town the hand
// rests on; the world's clock is held, and the possession runs on a clock of its own — at the world's
// pace, slowed, or held. Each step a bid is sampled from the stick, the eye and the acts pressed; a
// second's bids go to the host at a time with those coming near (`possess.input`), and the small world
// is asked of it as each step is bid (`possess.live`, stepped on by the bids not yet sent) and drawn:
// its bodies where it has them, the rest of the town at the possession's clock, the eye behind the
// body. Letting go (or the body struck down) writes back what was done, and the town is drawn from
// history again. The page leaving the town lets go; a body found held with none walked in here (a
// world loaded so) is let go at once, so the world never runs on with a body held unseen.
import "./possess.css";
import type {
  HostClient,
  PossessJoin,
  PossessLive,
  PossessNow,
  PossessTakeArgs,
  VillagePlan,
} from "../bridge/index.ts";
import {
  PossessEye,
  VILLAGE_METRE,
  type OrbitRig,
  type Stage,
  type VillageScene,
} from "../render/index.ts";
import { PossessHud, type GodPalette, type PageWindow, type TimeBar } from "../ui/index.ts";
import {
  PosedBodies,
  STEPS_PER_SECOND,
  STILL_BID,
  agentOf,
  bidOf,
  drawnHeight,
  joinsAt,
  lettersOf,
  takeOf,
  tradeOf,
  villageSolids,
  workOf,
  type HandBid,
} from "../view/index.ts";

export type PossessionDeps = {
  readonly stage: Stage;
  readonly canvas: HTMLCanvasElement;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly palette: GodPalette;
  readonly pages: PageWindow;
  /** The town shown (null: none), and the scale shown. */
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  /** The town's plan read again (after letting go: drawn from history, which holds what was done). */
  readonly reload: (ref: string) => Promise<void>;
  /** Free roam put away: the eye is the possession's. */
  readonly toOrbit: () => void;
};

/** A possession under way. */
type On = {
  readonly now: PossessNow;
  /** The town as drawn (read again as the years turn: the bodies posed over the new one). */
  plan: VillagePlan;
  posed: PosedBodies;
  /** Steps sent, a second at a time (the host keeps them before it answers anything asked after). */
  sent: number;
  /** The bids of the second being filled (from `sent`), and those joining it. */
  bids: HandBid[];
  joins: PossessJoin[];
  /** For each body of the small world, the step its way given runs to. */
  readonly ways: Map<number, number>;
  /** The possession's clock (steps since the taking), and its pace (1, ½, 0 held). */
  clock: number;
  pace: number;
  /** Seconds sent not yet answered (of this run of sending: `run` counts the runs). */
  owed: number;
  run: number;
  /** Whether the small world is being asked, and is to be asked again when it answers. */
  asking: boolean;
  again: boolean;
  /** Why it is ending ("release": let go; else as the host told it); null: it goes on. */
  ending: string | null;
};

/** Seconds sent unanswered before the possession's clock waits for the host. */
const OWED_MOST = 2;
/**
 * The orbit handed back over where he stood, at least so far off (scene units) and looking down so
 * steeply (degrees), as the town is first looked down on: over its roofs, never in one. On a screen
 * narrower than a desk's (its width to its height), as much further off as it is narrower, so as
 * much of the town shows across it: a phone held upright was handed back a single roof.
 */
const HANDED_NEAREST = 4,
  HANDED_PITCH = -38,
  HANDED_ASPECT = 1.6;

export type Possession = {
  /** One of those drawn taken (their index in the plan): why not (null: taken). */
  take(index: number): Promise<string | null>;
  letGo(): Promise<void>;
  readonly on: boolean;
};

export function installPossession(d: PossessionDeps): Possession {
  const hud = new PossessHud(d.hud),
    eye = new PossessEye(d.stage),
    /** The acts pressed and not yet bid (one a step, in the order pressed). */
    presses: number[] = [];
  let on: On | null = null,
    busy = false,
    /** Where the page was last looked at for a body held unseen ("": not in a town). */
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
  hud.onLook = (dx, dy) => eye.look(dx, dy);
  hud.onZoom = (f) => eye.zoom(f);
  hud.onBehind = () => {
    const m = on?.posed.drawnAt(on.now.agent);
    if (m) eye.behind(m.yaw);
  };
  hud.onPace = (pace) => {
    if (on) on.pace = pace;
  };
  hud.onLetGo = () => void letGo();

  /** Why one cannot be possessed here (null: they can): the hand must rest on the town shown. */
  const whyNot = async (index: number): Promise<string | null> => {
    const plan = d.plan();
    if (d.scale() !== "village" || !plan)
      return "go down into a town to touch one of its people: they are walked in where they are drawn";
    if (on || busy) return "your hand is in one of them already: let them go first";
    const hand = await d.client.query<{ village: string; name: string } | null>({ type: "hand" });
    if (!hand)
      return `your hand rests on no town: lay it on ${plan.name} first (its page: Lay your hand here), then touch one of its people`;
    if (hand.village !== plan.ref)
      return `your hand rests on ${hand.name}, not ${plan.name}: walk in one of its people there, or lift your hand and lay it here`;
    const p = plan.people[index];
    if (!p) return "touch one of the town's people";
    if (agentOf(p) === null) return `${p.name} is not one of those your hand rests on`;
    return null;
  };

  const take = async (index: number): Promise<string | null> => {
    const why = await whyNot(index);
    if (why) return why;
    const plan = d.plan()!;
    busy = true;
    try {
      d.toOrbit();
      d.time.hold("possess");
      // As the town is drawn at the moment the taking takes hold: the next of the clock held.
      const { t } = await d.client.query<{ t: number }>({ type: "now" }),
        args = takeOf(plan, index, t + 1);
      if (!args)
        throw new Error(`${plan.people[index]!.name} is not one of those your hand rests on`);
      await d.client.command("possess.take", args);
      const now = await d.client.query<PossessNow | null>({ type: "possess.now" });
      if (!now) throw new Error("the body could not be taken");
      start(plan, now, args);
      return null;
    } catch (error) {
      d.time.release("possess");
      return (error as Error).message;
    } finally {
      busy = false;
    }
  };

  /** The possession begun: the eye behind him, the controls up, the town posed about him. */
  const start = (plan: VillagePlan, now: PossessNow, args: PossessTakeArgs) => {
    const ways = new Map<number, number>();
    for (const n of args.near) ways.set(n.id, n.ways[n.ways.length - 5] ?? now.step);
    const o: On = {
      now,
      plan,
      posed: new PosedBodies(plan, now.from, now.trade, now.form, now.agent),
      sent: now.step,
      bids: [],
      joins: [],
      ways,
      clock: now.step,
      pace: 1,
      owed: 0,
      run: 0,
      asking: false,
      again: false,
      ending: null,
    };
    on = o;
    presses.length = 0;
    o.posed.step = now.step;
    d.village.posed = o.posed;
    d.rig.enabled = false;
    hud.show();
    hud.setPace(1);
    hud.say(`You walk among them as ${now.name}`);
    eye.height = drawnHeight(plan);
    eye.behind(args.at.yaw, true);
    void ask(o);
  };

  /** The town read again under him (the years turned, an act fell on it): the bodies posed over it. */
  const rebase = (o: On, plan: VillagePlan) => {
    const posed = new PosedBodies(plan, o.now.from, o.now.trade, o.now.form, o.now.agent);
    posed.live = o.posed.live;
    posed.step = o.posed.step;
    o.plan = plan;
    o.posed = posed;
    d.village.posed = posed;
  };

  /** The small world asked of the host as the bids not yet sent make it (one ask at a time; the latest asked again). */
  const ask = async (o: On): Promise<void> => {
    if (o.asking) {
      o.again = true;
      return;
    }
    o.asking = true;
    const live = await d.client
      .query<PossessLive | null>({
        type: "possess.live",
        args: { steps: lettersOf(o.bids), ...(o.joins.length ? { joins: o.joins } : {}) },
      })
      .catch(() => null);
    o.asking = false;
    if (on !== o) return;
    if (!live) {
      // (None held — struck down and let go, dead of his years — or bids it would not take.)
      const now = await d.client
        .query<PossessNow | null>({ type: "possess.now" })
        .catch(() => null);
      if (on !== o) return;
      if (!now || now.agent !== o.now.agent) return void finish(o);
      return resync(o, now);
    }
    if (!o.posed.live || live.step >= o.posed.live.step) {
      o.posed.live = live;
      hud.set(live);
      const here = new Set(live.bodies.map((b) => b.id));
      for (const id of [...o.ways.keys()]) if (!here.has(id)) o.ways.delete(id);
      if (live.ended && o.ending === null) end(o, live.ended);
    }
    if (o.again) {
      o.again = false;
      void ask(o);
    }
  };

  /** Taken up again from where the host stands (bids refused: out of step with what it keeps). */
  const resync = (o: On, now: PossessNow) => {
    o.run++;
    o.owed = 0;
    o.sent = now.step;
    o.bids = [];
    o.joins = [];
    o.clock = now.step;
    o.posed.step = now.step;
    for (const id of o.ways.keys()) o.ways.set(id, now.step);
    void ask(o);
  };

  /** A second's bids sent (and those joining it): the host keeps them. */
  const send = (o: On): Promise<void> => {
    const args = {
        step: o.sent,
        steps: lettersOf(o.bids),
        ...(o.joins.length ? { joins: o.joins } : {}),
      },
      run = o.run;
    o.sent += STEPS_PER_SECOND;
    o.bids = [];
    o.joins = [];
    o.owed++;
    return d.client.command("possess.input", args).then(
      () => {
        if (o.run === run) o.owed--;
      },
      async () => {
        if (o.run !== run || on !== o) return;
        const now = await d.client
          .query<PossessNow | null>({ type: "possess.now" })
          .catch(() => null);
        if (on !== o || o.run !== run) return;
        if (!now || now.agent !== o.now.agent) return void finish(o);
        resync(o, now);
      },
    );
  };

  /** Struck down: the second begun filled with stillness and sent, and the host lets go of him. */
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
    if (sending)
      await d.client
        .command("possess.release", {
          step: o.sent,
          steps: lettersOf(o.bids),
          ...(o.joins.length ? { joins: o.joins } : {}),
        })
        .catch(() => undefined);
    await finish(o);
  };

  /** Ended: the town drawn from history again, the orbit's eye over where he stood, the clock let go. */
  const finish = async (o: On): Promise<void> => {
    if (on !== o) return;
    on = null;
    const me = o.posed.drawnAt(o.now.agent);
    d.village.posed = null;
    hud.hide();
    presses.length = 0;
    eye.release();
    d.rig.enabled = true;
    if (me) {
      // (Handed back to the orbit turning about where he stood, looking the way the eye looked.)
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
    d.time.release("possess");
    if (d.scale() === "village" && d.plan()?.ref === o.now.town) await d.reload(o.now.town);
  };

  /** A step's bid: the stick as the eye looks, at a run or not, the act first pressed (one a step). */
  const sample = (o: On): HandBid => {
    presses.push(...hud.takePressed());
    const slot = presses.shift(),
      act = slot !== undefined ? (o.posed.live?.offers[slot]?.act ?? 0) : 0,
      s = hud.stick();
    return bidOf(s, eye.looking, s.run, act);
  };

  /** Those to join the second begun: near him and not in it, or in it with their way running out. */
  const joining = (o: On): PossessJoin[] => {
    const me = o.posed.drawnAt(o.now.agent) ?? { x: o.now.x, z: o.now.z },
      joins = joinsAt(o.plan, o.now.from, o.sent, me, o.ways);
    for (const j of joins) o.ways.set(j.id, j.ways[j.ways.length - 5] ?? o.sent);
    return joins;
  };

  // The hand's town draws as many of its people as the setting draws of a crowd (host/village.ts):
  // read again when the setting changes, so a phone stepped down draws fewer of them at once.
  let crowd = d.stage.quality.crowdCap;
  d.stage.onQuality((q) => {
    if (q.crowdCap === crowd) return;
    crowd = q.crowdCap;
    const plan = d.plan();
    if (d.scale() === "village" && plan?.hand) void d.reload(plan.ref);
  });

  d.stage.onUpdate((dt) => {
    const plan = d.plan(),
      where = d.scale() === "village" && plan ? plan.ref : "";
    if (!on) {
      // A body held with none walked in here (a world loaded so): let go at once.
      if (where !== looked && !busy) {
        looked = where;
        void d.client
          .query<PossessNow | null>({ type: "possess.now" })
          .then((held) =>
            held && !on && !busy
              ? d.client.command("possess.release", { step: held.step, steps: "" })
              : null,
          )
          .catch(() => undefined);
      }
      return;
    }
    const o = on;
    // The town left (another scale, another town): let go.
    if (where !== o.now.town) return void letGo();
    if (plan && plan !== o.plan) rebase(o, plan);
    // The possession's clock: on at its pace, waiting while the host is behind, and for good once ending.
    const frozen = o.ending !== null || o.owed >= OWED_MOST;
    o.clock = Math.min(
      frozen ? o.sent + o.bids.length - 0.001 : Infinity,
      o.clock + Math.min(0.25, dt) * STEPS_PER_SECOND * o.pace,
    );
    // Each step come to, its bid; a second's, sent.
    let sampled = false;
    while (
      o.ending === null &&
      o.owed < OWED_MOST &&
      o.sent + o.bids.length <= Math.floor(o.clock)
    ) {
      if (!o.bids.length) o.joins = joining(o);
      o.bids.push(sample(o));
      sampled = true;
      if (o.bids.length === STEPS_PER_SECOND) void send(o);
    }
    if (sampled) void ask(o);
    o.posed.step = o.clock;
    // The eye behind him as he is drawn; words over those who say something.
    const me = o.posed.drawnAt(o.now.agent);
    if (me) eye.update(me.x, me.z, villageSolids(o.plan), dt);
    const said: { text: string; x: number; y: number }[] = [];
    for (const b of o.posed.live?.bodies ?? []) {
      if (!b.say) continue;
      const m = o.posed.drawnAt(b.id),
        at = m && !m.hidden ? eye.toScreen(m.x, eye.height * 1.08, m.z) : null;
      if (at) said.push({ text: b.say, x: at.x, y: at.y });
    }
    hud.setBubbles(said);
  });

  d.palette.onPossess = async (town, place) => {
    const plan = d.plan();
    if (d.scale() !== "village" || !plan || town !== plan.ref)
      return "go down into a town to touch one of its people";
    let index = d.village.pick(touched.x, touched.y, 36);
    if (index === null && place) {
      // (Touched on the ground beside one: the nearest within a stride.)
      let best = 2.5;
      for (const p of d.village.peopleNow()) {
        const far = Math.hypot(p.x - place.x, p.z - place.z);
        if (far < best) {
          best = far;
          index = p.index;
        }
      }
    }
    if (index === null) return "touch one of the town's people: no one is there";
    return take(index);
  };
  d.pages.onPossess = async (agent) => {
    const plan = d.plan();
    if (d.scale() !== "village" || !plan)
      return "go down into their town first: they are walked in where they are drawn";
    const index = plan.people.findIndex((p) => p.ref === `agent:${agent}`);
    if (index < 0)
      return "they are not among those drawn in the town shown: possess one of those you see";
    const why = await take(index);
    if (!why) d.pages.close();
    return why;
  };

  // (For the look tools and the gates.)
  const exposed = (globalThis as { causalis?: Record<string, unknown> }).causalis;
  if (exposed)
    exposed.possess = {
      take,
      letGo,
      /** The possession under way, as the page holds it (null: none). */
      state: () =>
        on && {
          agent: on.now.agent,
          name: on.now.name,
          town: on.now.town,
          trade: on.now.trade,
          form: on.now.form,
          from: on.now.from,
          places: on.now.places,
          sent: on.sent,
          clock: on.clock,
          pace: on.pace,
          owed: on.owed,
          ending: on.ending,
          live: on.posed.live,
          eye: { yaw: eye.looking, pitch: eye.pitch, distance: eye.distance, ...eye.stood },
        },
      /** A body of the small world as drawn now (metres; null: not in it). */
      drawn: (id: number) => on?.posed.drawnAt(id) ?? null,
      /** Where a body of the small world is on the screen (CSS px; null: not in it, or behind the eye). */
      onScreen: (id: number) => {
        const m = on?.posed.drawnAt(id);
        return m ? eye.toScreen(m.x, eye.height * 0.5, m.z) : null;
      },
      /** Each of the hand's people drawn: their trade and the day's thing, how far their work stands (m; -1: none near). */
      candidates: async () => {
        const plan = d.plan();
        if (!plan) return [];
        const { t } = await d.client.query<{ t: number }>({ type: "now" });
        return plan.people.flatMap((p, index) =>
          agentOf(p) === null
            ? []
            : [
                {
                  index,
                  ref: p.ref,
                  name: p.name,
                  child: !!p.child,
                  ...workOf(plan, index, t + 1),
                },
              ],
        );
      },
      /** What one of those drawn would be taken as: trade and the day's thing, and the places about him. */
      preview: async (index: number) => {
        const plan = d.plan();
        if (!plan || !plan.people[index]) return null;
        const { t } = await d.client.query<{ t: number }>({ type: "now" }),
          args = takeOf(plan, index, t + 1);
        return args
          ? {
              ...tradeOf(plan, index, t + 1, villageSolids(plan)),
              at: args.at,
              near: args.near.length,
              places: args.places,
            }
          : null;
      },
    };

  return {
    take,
    letGo,
    get on() {
      return on !== null;
    },
  };
}
