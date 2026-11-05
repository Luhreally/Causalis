// A realm's key figures in the town view (Lives L1): their home flown to and marked, a chip to take them
// from, and the god's hand laid on their town for as long as they are walked in. Reading all this changes
// nothing; history moves only when Possess is pressed.
import "./leaders.css";
import type { HostClient, Leader, VillagePlan } from "../bridge/index.ts";
import { homeOfFigure } from "../bridge/index.ts";
import {
  HomeMark,
  VILLAGE_METRE,
  type OrbitRig,
  type Stage,
  type VillageScene,
} from "../render/index.ts";
import { HomePin, LeaderChip, type PageWindow } from "../ui/index.ts";
import { figureEye } from "../view/index.ts";
import type { Possession } from "./possess.ts";

export type LeadersDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly pages: PageWindow;
  readonly possession: Possession;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly goTown: (town: string) => Promise<void>;
  readonly reload: (ref: string) => Promise<void>;
  readonly toOrbit: () => void;
};
export type Leaders = {
  /** The chip's 👑 Rule pressed (Lives L4). */
  onRule: ((l: Leader) => void) | null;
  home(l: Leader): Promise<void>;
  possess(): Promise<string | null>;
  clear(): void;
};

export function installLeaders(d: LeadersDeps): Leaders {
  const mark = new HomeMark(d.stage),
    chip = new LeaderChip(d.hud),
    pin = new HomePin(d.hud);
  let shown: Leader | null = null,
    // (The town this flow laid the hand on: it lifts again when they are let go.)
    laid: string | null = null,
    drawn: VillagePlan | null = null,
    homeAt: { x: number; z: number } | null = null,
    // (On the way down to their town: not yet there is not gone away.)
    going = false,
    // (Being taken: the town is drawn again under the hand, and no mark is to come back over it.)
    taking = false;

  /** The mark on their home in the plan drawn, the figure ringed; the eye over it if asked. */
  const aim = (fly: boolean): void => {
    const plan = d.plan();
    if (!shown || !plan || plan.ref !== shown.town) return;
    const f = plan.figures?.find((x) => x.ref === shown!.ref),
      home = f?.home ?? homeOfFigure(shown.ref, plan.homes.length),
      eye = figureEye(plan, home);
    mark.set(eye.x, eye.z, eye.top);
    homeAt = { x: eye.x, z: eye.z };
    const i = plan.people.findIndex((p) => p.figure === shown!.ref);
    if (i >= 0) d.village.mark(i);
    if (fly)
      d.rig.flyTo({
        target: { x: eye.x * VILLAGE_METRE, y: 0, z: eye.z * VILLAGE_METRE },
        distance: eye.distance,
        pitch: eye.pitch,
      });
    drawn = plan;
  };

  /** What pressing Possess would do to the hand, said before it is pressed. */
  const noteFor = async (l: Leader): Promise<string> => {
    const hand = await d.client.query<{ village: string; name: string } | null>({ type: "hand" });
    if (hand && hand.village !== l.town)
      return `Your hand will lift from ${hand.name} and rest on ${l.townName} while you walk in them. What you do there is history's.`;
    if (hand) return "What you do in their body is history's.";
    return `Your hand will rest on ${l.townName} while you walk in them, and lift when you let go. What you do there is history's.`;
  };

  const clear = (): void => {
    shown = null;
    drawn = null;
    homeAt = null;
    mark.clear();
    pin.place(null, "");
    chip.hide();
    d.village.mark(null);
  };

  const home = async (l: Leader): Promise<void> => {
    if (!l.town) return;
    clear();
    shown = l;
    d.pages.close();
    d.toOrbit();
    going = true;
    try {
      await d.goTown(l.town);
    } finally {
      going = false;
    }
    if (shown !== l || d.scale() !== "village" || d.plan()?.ref !== l.town) return;
    aim(true);
    chip.show(l, await noteFor(l));
  };

  const possess = async (): Promise<string | null> => {
    const l = shown;
    if (!l?.as || !l.town) return "no one to possess";
    if (l.cannot) {
      chip.say(l.cannot);
      return l.cannot;
    }
    if (d.possession.on) return "your hand is in one already: let them go first";
    chip.busy(`Laying your hand on ${l.townName}…`);
    taking = true;
    try {
      const hand = await d.client.query<{ village: string } | null>({ type: "hand" }),
        named = () => d.client.query<number | null>({ type: "hand.named", args: { name: l.name } });
      let id = hand?.village === l.town ? await named() : null;
      if (id === null) {
        if (hand) await d.client.command("hand.lift", {});
        await d.client.command("hand.lay", { village: l.town, as: l.as });
        laid = l.town;
        id = await named();
      }
      if (id === null) throw new Error(`${l.name} could not be found under your hand`);
      await d.reload(l.town);
      const index = d.plan()?.people.findIndex((p) => p.ref === `agent:${id}`) ?? -1;
      if (index < 0) throw new Error(`${l.name} is not among those drawn`);
      mark.clear();
      pin.place(null, "");
      const why = await d.possession.take(index);
      if (why) throw new Error(why);
      chip.busy(null);
      return null;
    } catch (error) {
      const words = (error as Error).message;
      chip.busy(null);
      chip.say(words);
      taking = false;
      aim(false);
      return words;
    } finally {
      taking = false;
    }
  };

  /** A possession over: the hand lifted if this flow laid it, and the chip back while they are still here. */
  const ended = async (town: string): Promise<void> => {
    if (laid === town) {
      laid = null;
      await d.client.command("hand.lift", {}).catch(() => undefined);
      if (d.scale() === "village" && d.plan()?.ref === town) await d.reload(town);
    }
    if (shown?.town === town && d.scale() === "village" && d.plan()?.ref === town) {
      aim(false);
      chip.show(shown, await noteFor(shown));
    }
  };
  d.possession.onEnded = (town) => void ended(town);

  chip.onPossess = () => void possess();
  chip.onPage = (ref) => void d.pages.open(ref);
  chip.onClose = clear;
  pin.onTap = () => {
    if (shown) void d.pages.open(shown.ref);
  };

  d.stage.onUpdate(() => {
    if (!shown || going || taking) return;
    const plan = d.plan();
    if (d.scale() !== "village" || plan?.ref !== shown.town) {
      if (!d.possession.on) clear();
      return;
    }
    if (d.possession.on) return;
    if (plan !== drawn) aim(false);
    pin.place(mark.screen(), shown.name);
  });

  Object.assign((globalThis as unknown as { causalis: object }).causalis, {
    leaders: {
      home,
      possess,
      clear,
      state: () =>
        shown && {
          ref: shown.ref,
          name: shown.name,
          town: shown.town,
          laid,
          chip: chip.shown,
          pin: mark.screen(),
          home: homeAt,
        },
    },
  });

  return {
    home,
    possess,
    clear,
    get onRule() {
      return chip.onRule;
    },
    set onRule(f: ((l: Leader) => void) | null) {
      chip.onRule = f;
    },
  };
}
