// A life lived by the god's hand (Lives L3), the page's part: Live here (the hand laid, the sheet of lives),
// the day pace (the town as ever, the clock running their day, the strip and the tray), the Walk down to the
// hand pace and back up, months let go by on a habit, windows that wait, going on as an heir, letting go.
import "./life.css";
import type { HostClient, LifeCard, LifeNow, VillagePlan } from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type Stage, type VillageScene } from "../render/index.ts";
import { LifeHud, LifePicker, type PageWindow, type TimeBar } from "../ui/index.ts";
import { LivedBody, agentOf, homesRiseTo, livedSpeed } from "../view/index.ts";
import type { Possession } from "./possess.ts";

export type LifeDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly pages: PageWindow;
  readonly possession: Possession;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly reload: (ref: string) => Promise<void>;
  readonly toOrbit: () => void;
};
export type LifeFlow = {
  /** Live here pressed in the town shown. */
  liveHere(): Promise<void>;
  /** A body already possessed, lived on from: Live their day. */
  liveAgent(agent: number): Promise<string | null>;
  /** A tap in the town: taken while the sheet of lives is up. */
  tapped(x: number, y: number): boolean;
  readonly on: boolean;
  /** 👑 Rule pressed in a life lived as a realm's ruler: the life let go, and this told (Lives L4). */
  onRule: (realm: string) => void;
  /** 🏠 Go in pressed: the home of the one lived, by their town and their ref (Lives L6). */
  onGoIn: (town: string, person: string) => void;
};

const DAY = 86_400,
  MONTH = 30 * DAY,
  /** The eye over one lived (world units): far enough to see them in their street, over its roofs. */
  EYE_NEAREST = 8,
  EYE_PITCH = -50;

export function installLife(d: LifeDeps): LifeFlow {
  const hud = new LifeHud(d.hud),
    picker = new LifePicker(d.hud);
  let now: LifeNow | null = null,
    body: LivedBody | null = null,
    /** The town this flow laid the hand on while the sheet is up (lifted if no one is chosen). */
    laid: string | null = null,
    pace: "stop" | "slow" | "quick" = "slow",
    /** Time let go by: until when, on a month a second. */
    until: number | null = null,
    asking = false,
    askedAt = 0,
    /** The clock as it was asked for before the life (put back after). */
    was: number | null = null,
    drawnFor: VillagePlan | null = null,
    sent = 0,
    /** Hand pace under way. */
    walking = false;

  const clockNow = (): number => d.client.status?.t ?? 0;

  const refresh = async (): Promise<void> => {
    if (asking) return;
    asking = true;
    try {
      const l = await d.client.query<LifeNow | null>({ type: "life.now" });
      now = l;
      if (!l) return;
      if (!hud.open && !walking) enter();
      hud.set(l, clockNow());
      if (body) {
        body.doing = l.doing;
        body.household = l.kin
          .filter((k) => ["wife", "husband", "son", "daughter", "mother", "father"].includes(k.is))
          .map((k) => k.id);
      }
      // (Someone of theirs not among those drawn: the town read again.)
      const plan = d.plan();
      if (plan && l.town === plan.ref) {
        const ids = new Set(plan.people.map((p) => agentOf(p)));
        if (l.about.some((id) => !ids.has(id)) && d.scale() === "village" && !walking) {
          await d.reload(plan.ref);
        }
      }
    } finally {
      asking = false;
    }
  };

  /** Their home in the plan drawn. */
  const homeOf = (): { x: number; z: number } | null => {
    const plan = d.plan(),
      p = plan && now ? plan.people.find((q) => agentOf(q) === now!.agent) : null;
    return p ? (plan!.homes[p.home] ?? null) : null;
  };

  /** The day pace taken up: the strip and the tray over the town, the eye after them. */
  const enter = (): void => {
    const plan = d.plan(),
      l = now;
    if (!plan || !l) return;
    const index = plan.people.findIndex((p) => agentOf(p) === l.agent);
    if (index < 0) return;
    was ??= d.time.speed;
    body = new LivedBody(plan, index, d.possession.lastAt ?? undefined);
    d.village.posed = body;
    drawnFor = plan;
    d.village.mark(index);
    hud.show();
    d.pages.close();
    d.toOrbit();
    d.rig.follow = () => {
      const p = until !== null ? homeOf() : body?.where;
      return p ? { x: p.x * VILLAGE_METRE, y: 0, z: p.z * VILLAGE_METRE } : null;
    };
    const rise = plan.town ? homesRiseTo(plan.town) : 0;
    d.rig.flyTo({ distance: Math.max(EYE_NEAREST, (rise + 8) * 0.16), pitch: EYE_PITCH }, 0.9);
  };

  /** Back out to the town as it was. */
  const leave = (words: string): void => {
    hud.hide();
    picker.hide();
    d.village.posed = null;
    d.village.mark(null);
    body = null;
    drawnFor = null;
    d.rig.follow = null;
    until = null;
    d.time.release("life");
    if (was !== null) d.client.setSpeed(was);
    was = null;
    if (words) hud.toast(words);
    sent = 0;
  };

  const begin = async (agent: number): Promise<string | null> => {
    const plan = d.plan();
    if (!plan) return "go down into a town first";
    try {
      const i = plan.people.findIndex((p) => agentOf(p) === agent);
      await d.client.command("life.begin", { agent, home: i >= 0 ? plan.people[i]!.home : 0 });
      await d.reload(plan.ref);
      laid = null;
      picker.hide();
      d.time.release("life-pick");
      pace = "slow";
      await refresh();
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };

  const closePicker = async (): Promise<void> => {
    picker.hide();
    d.time.release("life-pick");
    if (laid) {
      const town = laid;
      laid = null;
      await d.client.command("hand.lift", {}).catch(() => undefined);
      if (d.scale() === "village" && d.plan()?.ref === town) await d.reload(town);
    }
  };

  const liveHere = async (): Promise<void> => {
    const plan = d.plan();
    if (!plan || d.scale() !== "village" || hud.open || picker.open) return;
    d.time.hold("life-pick");
    const hand = await d.client.query<{ village: string; name: string } | null>({ type: "hand" });
    let note = `Your hand rests on ${plan.name}: every one of them is someone. Choose one, or tap anyone in the town.`;
    if (hand?.village !== plan.ref) {
      note = `${hand ? `Your hand has lifted from ${hand.name}. ` : ""}Your hand now rests on ${plan.name}: every one of them is someone, born and dying one by one. Choose one, or tap anyone in the town.`;
      if (hand) await d.client.command("hand.lift", {});
      await d.client.command("hand.lay", { village: plan.ref });
      laid = plan.ref;
      await d.reload(plan.ref);
    }
    picker.show(await d.client.query<LifeCard[]>({ type: "life.pick" }), note);
  };

  picker.onLive = (id) => void begin(id);
  picker.onClose = () => void closePicker();
  picker.onPage = (ref) => void d.pages.open(ref);

  hud.onDo = (what, target) => {
    until = null;
    void d.client
      .command("life.do", { what, ...(target >= 0 ? { target } : {}) })
      .then(refresh)
      .catch((e: Error) => hud.say(e.message));
  };
  hud.onBuy = (good) =>
    void d.client
      .command("life.buy", { good })
      .then(refresh)
      .catch((e: Error) => hud.say(e.message));
  hud.onAnswer = (key, choice) => {
    const l = now,
      w = l?.windows.find((x) => x.key === key);
    if (w?.kind === "want") {
      const label = w.choices.find((c) => c.choice === choice)?.label ?? "",
        want = WANT_OF.find(([, words]) => label.includes(words))?.[0];
      void (
        want
          ? d.client.command("life.want", { want })
          : d.client.command("life.answer", { key, choice })
      )
        .then(refresh)
        .catch((e: Error) => hud.say(e.message));
      return;
    }
    void d.client
      .command("life.answer", { key, choice })
      .then(refresh)
      .catch((e: Error) => hud.say(e.message));
  };
  hud.onHeir = (agent) =>
    void d.client
      .command("life.heir", { agent })
      .then(async () => {
        const plan = d.plan();
        if (plan) await d.reload(plan.ref);
        hud.hide();
        body = null;
        await refresh();
      })
      .catch((e: Error) => hud.say(e.message));
  const letGo = (then?: () => void) =>
    void d.client
      .command("life.end", {})
      .then(async () => {
        const plan = d.plan();
        leave(plan ? `Your hand still rests on ${plan.name}.` : "");
        now = null;
        if (plan) await d.reload(plan.ref);
        then?.();
      })
      .catch((e: Error) => hud.say(e.message));
  hud.onLetGo = () => letGo();
  let onRule: (realm: string) => void = () => {};
  hud.onRule = (realm) => letGo(() => onRule(realm));
  hud.onPage = (ref) => void d.pages.open(ref);
  let onGoIn: (town: string, person: string) => void = () => {};
  hud.onGoIn = () => {
    const plan = d.plan(),
      p = plan && now ? plan.people.find((q) => agentOf(q) === now!.agent) : null;
    if (plan && p) onGoIn(plan.ref, p.ref);
  };
  hud.onPace = (p) => {
    pace = p;
    until = null;
  };
  hud.onPass = (habit, days) =>
    void d.client.command("life.habit", { habit }).then(() => {
      until = clockNow() + days * DAY;
    });
  hud.onWalk = () => {
    const plan = d.plan(),
      l = now;
    if (!plan || !l) return;
    const index = plan.people.findIndex((p) => agentOf(p) === l.agent);
    if (index < 0) return;
    walking = true;
    until = null;
    hud.hide();
    document.body.classList.add("living-walk");
    void d.possession.take(index, body?.where ?? undefined).then((why) => {
      if (why) {
        walking = false;
        document.body.classList.remove("living-walk");
        hud.show();
        hud.say(why);
      }
    });
  };

  // Back from the hand pace: the day goes on from where they stand.
  const wasEnded = d.possession.onEnded;
  d.possession.onEnded = (town) => {
    wasEnded(town);
    if (!walking) return;
    walking = false;
    document.body.classList.remove("living-walk");
    void refresh();
  };

  d.stage.onUpdate(() => {
    const plan = d.plan();
    // The body drawn afresh when the town is read again (the year turned).
    if (body && plan && plan !== drawnFor && !walking) {
      const index = now ? plan.people.findIndex((p) => agentOf(p) === now!.agent) : -1;
      if (index >= 0) {
        const from = body.where;
        body = new LivedBody(plan, index, from ?? undefined);
        body.doing = now!.doing;
        d.village.posed = body;
        d.village.mark(index);
        drawnFor = plan;
      }
    }
    if (d.scale() !== "village" || !plan) {
      if (hud.open) {
        hud.hide();
        d.village.posed = null;
        d.rig.follow = null;
        body = null;
      }
      return;
    }
    const at = performance.now();
    if (at - askedAt > 250 && (hud.open || !walking)) {
      askedAt = at;
      void refresh();
    }
    if (!hud.open || walking) return;
    // The clock: held by a window or a sheet, a month a second while time is let go by, else as they are at.
    if (until !== null && clockNow() >= until) {
      until = null;
      pace = "slow";
    }
    if (hud.waiting || pace === "stop" || !d.pages.element.hidden) d.time.hold("life");
    else {
      d.time.release("life");
      const speed =
        until !== null ? MONTH : livedSpeed(!!body?.walking, !!body?.asleep, pace === "quick");
      if (sent !== speed) {
        sent = speed;
        d.client.setSpeed(speed);
      }
    }
  });

  /** A want by the words its window offers it with. */
  const WANT_OF: readonly (readonly [string, string])[] = [
    ["home", "A home of your own"],
    ["wed", "Someone to share it with"],
    ["child", "A child of your own"],
    ["teach", "A child who knows your trade"],
    ["master", "Master your work"],
    ["name", "A name in the town"],
    ["fortune", "A fortune"],
    ["best", "Get ahead of your rival"],
    ["learn", "Learn all you can"],
  ];

  const tapped = (x: number, y: number): boolean => {
    if (!picker.open) return false;
    const i = d.village.pick(x, y),
      plan = d.plan(),
      p = i !== null && plan ? plan.people[i] : null,
      id = p ? agentOf(p) : null;
    if (p && id !== null)
      picker.top({
        id,
        ref: p.ref,
        name: p.name.replace(/ of .*$/, ""),
        age: p.age,
        what: p.child ? "a child" : (p.role ?? "one of the town"),
        hook: "You touched them in the town.",
        kind: "tapped",
      });
    return true;
  };

  Object.assign((globalThis as unknown as { causalis: object }).causalis, {
    life: {
      liveHere,
      state: () => now,
      pace: () => pace,
      until: () => until,
      home: homeOf,
      where: () => body?.where ?? null,
      walkingNow: () => !!body?.walking,
      inHand: () => walking,
      pickerOpen: () => picker.open,
    },
  });

  return {
    liveHere,
    liveAgent: async (agent) => {
      if (d.possession.on) await d.possession.letGo();
      const why = await begin(agent);
      if (why) hud.toast(why);
      return why;
    },
    tapped,
    get on() {
      return hud.open;
    },
    get onRule() {
      return onRule;
    },
    set onRule(f: (realm: string) => void) {
      onRule = f;
    },
    get onGoIn() {
      return onGoIn;
    },
    set onGoIn(f: (town: string, person: string) => void) {
      onGoIn = f;
    },
  };
}
