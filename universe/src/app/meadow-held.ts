// A beast of an age's living world possessed (Phase 61), the page's part: taken from the ages' acts
// (Walk in one, then a touch on one of its beasts; or the one followed), the deep clock held so its
// age stays, and the living world stepped at the possession's own pace — the world's, slowed, or held.
// Each step the stick, as the eye looks, steers it at its lineage's own walk and run, and the act
// first pressed is done if its way of life allows: eat where it stands, spring on prey, court one of
// its kind, bolt, call its own. The same controls as one of a town's people (ui/possess-hud.ts), the
// eye behind it (render/possess.ts). Its life under the hand is the land touched: what fared best,
// against the land left alone, is laid on the world as the age ends (view/meadow.ts
// meadowProspered), and the ages after run the more to its kind. Let go by hand, or as it dies.
// (Its look is app/possess.css, which the page has from app/possess.ts.)
import type { BeastPlan } from "../bridge/index.ts";
import { BEAST_EYE, FLIER_UP, PossessEye, type OrbitRig, type Stage } from "../render/index.ts";
import { PossessHud } from "../ui/index.ts";
import {
  beastPose,
  holdMeadow,
  letGoMeadow,
  meadowHeld,
  meadowOffers,
  meadowStrip,
  type MeadowState,
} from "../view/index.ts";

/** How much farther the eye stands off a winged one on a phone held upright (BEAST_EYE's stand-offs). */
const UPRIGHT_WINGS = 1.6;

export type MeadowHeldDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly rig: OrbitRig;
  /** The deep clock held (true) while a beast is walked in, and let go. */
  readonly hold: (held: boolean) => void;
  /** The living world shown now (null: none). */
  readonly meadow: () => MeadowState | null;
  /** The living world touched by the hand: what fares best under it is laid on the world. */
  readonly touched: () => void;
  /** A line told in the beginning's own words. */
  readonly tell: (words: string) => void;
  /** How large a lineage's beast is drawn (m; null: not drawn), for the eye's stand-off. */
  readonly sizeOf: (ref: string) => number | null;
  /** A lineage's body plan, by its index among the plan's lineages (null: none known). */
  readonly bodyOf: (lineage: number) => BeastPlan | null;
};

export type MeadowHeld = {
  /** One of the living world's beasts taken (its id): why not (null: taken). */
  take(id: number): string | null;
  letGo(): void;
  readonly on: boolean;
  /** The pace the living world is stepped at while one is held (1, ½, 0). */
  readonly pace: number;
  /** Before each step of the living world: the stick and the act first pressed set on the one held. */
  beforeStep(): void;
  /** Each frame after its steps: the controls, the eye behind it, its end. */
  update(dt: number): void;
  /** The one held, for the look tools (null: none). */
  state(): {
    id: number;
    kind: string;
    x: number;
    z: number;
    energy: number;
    doing: string;
    told: string | null;
    offers: { label: string; can: boolean; words: string }[];
    killed: number;
    young: number;
    ate: number;
    /** The way the eye looks (the stick's ahead). */
    yaw: number;
  } | null;
};

export function installMeadowHeld(d: MeadowHeldDeps): MeadowHeld {
  const hud = new PossessHud(d.hud),
    eye = new PossessEye(d.stage),
    presses: number[] = [];
  let on: { meadow: MeadowState; pace: number } | null = null,
    /** How high the eye has risen with a flier (m), eased. */
    lift = 0;
  // (Its controls on the page only while one is walked in.)
  hud.element.remove();
  hud.onLook = (dx, dy) => eye.look(dx, dy);
  hud.onZoom = (f) => eye.zoom(f);
  hud.onBehind = () => {
    const held = on ? meadowHeld(on.meadow) : null;
    if (held) eye.behind(held.b.heading);
  };
  hud.onPace = (pace) => {
    if (on) on.pace = pace;
  };
  hud.onLetGo = () => letGo();

  /** The controls as the one held stands: its strip, its four acts, what the last came to. */
  const shown = (m: MeadowState) => {
    const held = meadowHeld(m),
      strip = held && meadowStrip(m, d.bodyOf(held.k.lineage));
    if (!strip || !held) return;
    const t = held.h.told;
    hud.set({
      strip,
      offers: meadowOffers(m).map((o, i) => ({
        act: i + 1,
        icon: o.icon,
        label: o.label,
        can: o.can,
        words: o.words,
      })),
      told: t ? { words: t.words, step: Math.round(t.t * 20), good: t.good } : null,
    });
  };

  const take = (id: number): string | null => {
    const m = d.meadow();
    if (!m) return "go down to an age's living world to walk in one of its beasts";
    if (on) return "your hand is in one of them already: let it go first";
    const h = holdMeadow(m, id),
      held = h ? meadowHeld(m) : null;
    if (!h || !held) return "that one is not to be had: touch one of the beasts on the land";
    on = { meadow: m, pace: 1 };
    presses.length = 0;
    d.hold(true);
    d.rig.enabled = false;
    d.touched();
    hud.carriesIcon = "🐾";
    d.hud.append(hud.element);
    hud.show();
    hud.setPace(1);
    // (Its strip first, so what is told is laid under it.)
    shown(m);
    hud.say(`You walk as ${meadowStrip(m)?.name.toLowerCase() ?? "one of them"}`);
    eye.height = Math.max(0.6, d.sizeOf(held.k.ref) ?? held.k.length * 0.6);
    lift = 0;
    eye.pitch = BEAST_EYE.pitch;
    // (Wings span wider than the body stands tall: on a phone held upright, whose eye sees narrow,
    // the eye stands off the farther, so they are seen whole with the land about them.)
    const winged = held.k.flies || (d.bodyOf(held.k.lineage)?.wings ?? 0) > 0;
    eye.distance = BEAST_EYE.distance * (winged && innerHeight > innerWidth ? UPRIGHT_WINGS : 1);
    eye.behind(held.b.heading, true);
    return null;
  };

  const finish = (words: string) => {
    if (!on) return;
    on = null;
    hud.hide();
    hud.element.remove();
    presses.length = 0;
    eye.release();
    d.rig.enabled = true;
    d.hold(false);
    if (words) d.tell(words);
  };

  const letGo = () => {
    if (on) finish(letGoMeadow(on.meadow));
  };

  return {
    take,
    letGo,
    get on() {
      return on !== null;
    },
    get pace() {
      return on?.pace ?? 0;
    },
    beforeStep() {
      const h = on?.meadow.hand;
      if (!on || !h) return;
      presses.push(...hud.takePressed());
      const slot = presses.shift();
      if (slot !== undefined) h.act = meadowOffers(on.meadow)[slot]?.act ?? null;
      // (The stick's frame: ahead is where the eye looks, its right the eye's right, as view/possess.ts bidOf.)
      const s = hud.stick(),
        yaw = eye.looking;
      h.mx = s.y * Math.sin(yaw) - s.x * Math.cos(yaw);
      h.mz = s.y * Math.cos(yaw) + s.x * Math.sin(yaw);
      h.run = s.run;
    },
    update(dt) {
      if (!on) return;
      const m = d.meadow();
      // (Another age's living world, or none: let go.)
      if (m !== on.meadow) return void letGo();
      const held = meadowHeld(m);
      if (!held || held.h.ended) return void finish(letGoMeadow(m));
      shown(m);
      // (A flier drawn up as it goes: the eye rises with it, and down again as it lands.)
      const up = held.k.flies && beastPose(m, held.b).gait > 0 ? FLIER_UP : 0;
      lift += (up - lift) * (1 - Math.exp(-Math.min(0.1, dt) / 0.3));
      eye.update(held.b.x, held.b.z, null, dt, lift);
    },
    state() {
      const held = on ? meadowHeld(on.meadow) : null;
      if (!on || !held) return null;
      return {
        id: held.b.id,
        kind: held.k.name,
        x: held.b.x,
        z: held.b.z,
        energy: held.b.energy,
        doing: held.b.doing,
        told: held.h.told?.words ?? null,
        offers: meadowOffers(on.meadow).map((o) => ({
          label: o.label,
          can: o.can,
          words: o.words,
        })),
        killed: held.h.killed,
        young: held.h.young,
        ate: held.h.ate,
        yaw: eye.looking,
      };
    },
  };
}
