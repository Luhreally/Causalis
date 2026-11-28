// A line lived as a beast (Live a Line, S3): one of its age's living world (view/meadow.ts) held by the stick, the land
// and its beasts as the genesis plays them, the line's own lineage among them in the body its genome grows. It does what
// its way of life allows (the meadow's acts: eat, spring, court, bolt, call); when it has young, the player chooses which
// to go on in (the host's youngOf: one keyed change each, through the world's physics); between the generations played the
// line is bred on off the screen (bredOn), and the clock goes on so many years a generation. In the sea's ages before life
// came ashore (S3b), the same, in the shallows: the whole of its ground under water, the sea's own lines about it.
import type { BeastPlan, GenesisPlan, MeadowPlan } from "../bridge/index.ts";
import { BEAST_EYE, FLIER_UP, MeadowScene, PossessEye, type Stage } from "../render/index.ts";
import type { HudOffer } from "../ui/line-hud.ts";
import {
  MEADOW_H,
  MEADOW_STEP,
  MEADOW_W,
  beastPose,
  holdMeadow,
  meadowHeld,
  meadowOffers,
  newMeadow,
  stepMeadow,
  type MeadowState,
} from "../view/index.ts";

/** A body of the line as the host tells it (host/line.ts LineBody). */
export type LineBody = {
  readonly name: string;
  readonly way: string;
  readonly genome: Record<string, unknown> & { readonly mass: number; readonly diet: string };
  readonly body: BeastPlan;
  readonly reasons: readonly string[];
  readonly fit: number;
  readonly better: number | null;
};

/** The meadow's way of feeding a line's way takes (its niche there). */
export function nicheOf(way: string, diet: string): string {
  if (["sea swimmer", "sea crawler", "burrower", "drifter", "swimmer"].includes(way)) return "swimmer";
  if (["grazer", "browser", "great beast", "seed-eater", "hunter", "small hunter", "scavenger"].includes(way)) return way;
  return diet === "flesh" ? "small hunter" : diet === "seeds" ? "seed-eater" : diet === "leaves" ? "browser" : "grazer";
}

/** The age (0 … 15) a moment falls in, millions of years ago (gen/deeptime.ts: sixteen ages of 25 million years). */
export function ageOfMy(my: number): number {
  return Math.max(0, Math.min(15, 15 - Math.floor(my / 25)));
}

/** The most beasts in the shallows (the meadow's own bound is 130). */
const SHALLOWS_MOST = 60;

/** The line's lineage's ref in the meadow. */
export const LINE_REF = "line:held";

export class LineCreature {
  readonly scene: MeadowScene;
  private readonly eye: PossessEye;
  private readonly stage: Stage;
  meadow: MeadowState | null = null;
  private bodies: (BeastPlan | null)[] = [];
  private owed = 0;
  private lift = 0;
  /** Young had under the hand when it was taken (a new one born calls for the choice). */
  private young = 0;
  /** The stick's push, and the act pressed (its place among the four), set before each step. */
  stick = { x: 0, y: 0 };
  pressed: number | null = null;
  /** What the step cost (ms) and how many, for the look tools. */
  stepMs = 0;
  steps = 0;

  constructor(stage: Stage) {
    this.stage = stage;
    this.scene = new MeadowScene(stage);
    this.scene.setDetail(2);
    this.eye = new PossessEye(stage);
  }

  /**
   * The line's beast put into its age's living world: the plan's lineages of that age, the line's own among them. In the
   * sea's ages (`shallows`), the whole ground under water and `sea` the sea's own lines about it.
   */
  begin(plan: GenesisPlan, line: LineBody, my: number, sea: readonly MeadowPlan["lineages"][number][] | null): string | null {
    const age = ageOfMy(my),
      lineage = {
        ref: LINE_REF,
        name: "your line",
        niche: nicheOf(line.way, line.genome.diet),
        arose: age,
        died: null,
        size: line.genome.mass,
        level: 2,
        body: line.body,
        words: line.name,
      },
      // (The line's own first: where the meadow takes only so many lineages of a way, the newest first, it is among them.)
      others = sea ? sea.map((l) => ({ ...l, arose: age, died: null })) : plan.lineages,
      lineages = [lineage, ...others],
      look = plan.lifeLook ? { lifeLook: plan.lifeLook } : {},
      p: MeadowPlan = { seed: plan.seed, ages: plan.ages, lineages, ...look },
      seed = `${plan.seed} line ${Math.round(my * 10)}`;
    this.bodies = lineages.map((l) => l.body);
    const m = newMeadow(sea ? { ...p, lineages: [lineage] } : p, age, seed, !sea);
    if (sea) {
      // (The shallows: the water over the whole of its ground, nothing growing on the land; the sea's own lines about it,
      // each brought in as the meadow brings a lineage, laid into this one.)
      const was = m.pond ?? { x: 0, z: 0 };
      m.pond = { x: 0, z: 0, r: Math.hypot(MEADOW_W, MEADOW_H) / 2 + 4, food: 1 };
      m.grass.fill(0);
      m.shrubs.length = 0;
      const spread = (b: { x: number; z: number }, from: { x: number; z: number }) => {
        b.x = Math.max(-MEADOW_W / 2 + 3, Math.min(MEADOW_W / 2 - 3, (b.x - from.x) * 3));
        b.z = Math.max(-MEADOW_H / 2 + 3, Math.min(MEADOW_H / 2 - 3, (b.z - from.z) * 3));
      };
      for (const b of m.beasts) spread(b, was);
      others.forEach((l, i) => {
        const o = newMeadow({ ...p, lineages: [l] }, age, `${seed} ${i}`, false),
          at = m.kinds.length;
        for (const k of o.kinds) m.kinds.push({ ...k, lineage: 1 + i });
        for (const b of o.beasts) {
          if (m.beasts.length >= SHALLOWS_MOST) break;
          spread(b, o.pond ?? { x: 0, z: 0 });
          m.beasts.push({ ...b, id: m.next++, kind: at + b.kind });
        }
      });
    }
    this.scene.reset();
    this.scene.visible = true;
    this.meadow = m;
    const k = m.kinds.findIndex((x) => x.ref === LINE_REF),
      b = m.beasts.find((x) => x.kind === k && x.doing !== "coming");
    if (k < 0 || !b) return "your line's beast is not to be had in this age's land";
    const h = holdMeadow(m, b.id);
    if (!h) return "your line's beast is not to be had";
    this.young = 0;
    this.owed = 0;
    const held = meadowHeld(m)!;
    this.eye.height = Math.max(0.6, this.scene.sizeOf(LINE_REF) ?? held.k.length * 0.6);
    this.eye.pitch = BEAST_EYE.pitch;
    this.eye.distance = BEAST_EYE.distance;
    this.eye.behind(held.b.heading, true);
    this.lift = 0;
    return null;
  }

  /** A step of the time owed: the stick and the act set on the one held, the world stepped. */
  frame(dt: number, paused: boolean): void {
    const m = this.meadow;
    if (!m) return;
    if (!paused) {
      this.owed += Math.min(0.1, dt);
      let n = 0;
      const t0 = performance.now();
      while (this.owed >= MEADOW_STEP && n < 6) {
        const h = m.hand;
        if (h) {
          if (this.pressed !== null) h.act = meadowOffers(m)[this.pressed]?.act ?? null;
          this.pressed = null;
          const yaw = this.eye.looking,
            // (The stick's frame: ahead is where the eye looks, as the meadow's held beast is steered: app/meadow-held.ts.)
            ahead = -this.stick.y,
            right = this.stick.x;
          h.mx = ahead * Math.sin(yaw) - right * Math.cos(yaw);
          h.mz = ahead * Math.cos(yaw) + right * Math.sin(yaw);
          h.run = Math.hypot(this.stick.x, this.stick.y) > 0.92;
        }
        stepMeadow(m);
        this.owed -= MEADOW_STEP;
        n++;
      }
      if (n) {
        this.stepMs += performance.now() - t0;
        this.steps += n;
      }
      if (n === 6) this.owed = 0;
    }
    const held = meadowHeld(m);
    if (held) {
      const up = held.k.flies && beastPose(m, held.b).gait > 0 ? FLIER_UP : 0;
      this.lift += (up - this.lift) * (1 - Math.exp(-Math.min(0.1, dt) / 0.3));
      this.eye.update(held.b.x, held.b.z, null, dt, this.lift);
    }
    this.scene.update(m, this.bodies);
  }

  /** The eye turned by a drag (px), or stood off. */
  look(dx: number, dy: number): void {
    this.eye.look(dx, dy);
  }

  /** Whether a young one has been born under the hand since it was last asked. */
  hadYoung(): boolean {
    const h = this.meadow?.hand;
    if (!h || h.young <= this.young) return false;
    this.young = h.young;
    return true;
  }

  /** How its life under the hand ended ("": it lives), and by what. */
  get ended(): { how: string; by: string | null } | null {
    const h = this.meadow?.hand;
    return h?.ended ? { how: h.ended, by: h.by } : null;
  }

  offers(): HudOffer[] {
    const m = this.meadow;
    return m
      ? meadowOffers(m).map((o) => ({ icon: o.icon, label: o.label, can: o.can, words: o.words }))
      : [];
  }

  /** The strip's words, and how fed the one held is (0 … 1). */
  strip(): { words: string; fed: number; x: number; z: number; ate: number; young: number } | null {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null;
    if (!held) return null;
    return {
      words: `${held.k.name} · ${held.k.size >= 1 ? `${held.k.size.toFixed(1)} kg` : `${Math.round(held.k.size * 1000)} g`} · ${held.b.doing}`,
      fed: held.b.energy,
      x: held.b.x,
      z: held.b.z,
      ate: held.h.ate,
      young: held.h.young,
    };
  }

  /** What the last act came to. */
  told(): { words: string; good: boolean } | null {
    return this.meadow?.hand?.told ?? null;
  }

  leave(): void {
    if (this.meadow) this.meadow.hand = null;
    this.meadow = null;
    this.scene.visible = false;
    this.eye.release();
  }
}
