// A line lived as a beast (Live a Line, S3): one of its age's living world (view/meadow.ts) held by the stick, the land
// and its beasts as the genesis plays them, the line's own lineage among them in the body its genome grows. It does what
// its way of life allows (the meadow's acts: eat, spring, court, bolt, call); when it has young, the player chooses which
// to go on in (the host's youngOf: one keyed change each, through the world's physics); between the generations played the
// line is bred on off the screen (bredOn), and the clock goes on so many years a generation. In the sea's ages before life
// came ashore (S3b), the same, in the shallows: the whole of its ground under water, the sea's own lines about it.
import type { BeastPlan, GenesisPlan, MeadowPlan } from "../bridge/index.ts";
import { BEAST_EYE, FLIER_UP, MeadowScene, PossessEye, type Stage } from "../render/index.ts";
import type { HudOffer } from "../ui/line-hud.ts";
import { LineNest } from "../render/line-nest.ts";
import { SeaView } from "../render/line-sea.ts";
import { sizeTier } from "../view/line.ts";
import {
  MEADOW_H,
  MEADOW_STEP,
  MEADOW_W,
  beastPose,
  holdMeadow,
  meadowHeld,
  meadowOffers,
  newMeadow,
  prey,
  stepMeadow,
  type Beast,
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
  if (["sea swimmer", "sea crawler", "burrower", "drifter", "swimmer"].includes(way))
    return "swimmer";
  if (
    [
      "grazer",
      "browser",
      "great beast",
      "seed-eater",
      "hunter",
      "small hunter",
      "scavenger",
    ].includes(way)
  )
    return way;
  return diet === "flesh"
    ? "small hunter"
    : diet === "seeds"
      ? "seed-eater"
      : diet === "leaves"
        ? "browser"
        : "grazer";
}

/** The age (0 … 15) a moment falls in, millions of years ago (gen/deeptime.ts: sixteen ages of 25 million years). */
export function ageOfMy(my: number): number {
  return Math.max(0, Math.min(15, 15 - Math.floor(my / 25)));
}

/** The most beasts in the shallows (the meadow's own bound is 130). */
const SHALLOWS_MOST = 60;

/**
 * The shallows' hunter (S3b's danger): the largest of its sea's lines, at least twice the line's beast (or, where its
 * sea has none so large, one of the line's own body four times its weight: what a line's kin grows into to eat it). It
 * senses the beast within SENSE metres, swims to it faster than the beast swims but slower than it bolts, and takes it
 * when it has held it GRIP seconds; fed, it swims off a while.
 */
const SHALLOWS_HUNTER = "line:hunter",
  SENSE = 22,
  GRIP = 1.1;
export const HUNTER_NAME = "a hunter of the shallows";
/**
 * Courting (mates and nest): Court calls the nearest grown one of the line's kind within MATE_NEAR metres. It comes to
 * the beast, they court DANCE seconds, a nest is made between them (on land, off the water and clear of the shrubs; in
 * the sea's ages, its eggs floating where the line lives), and after LAY seconds the young one comes out of it.
 */
const MATE_NEAR = 14,
  DANCE = 2.2,
  COME = 4,
  LAY = 1.6;

type Nest = {
  x: number;
  z: number;
  size: number;
  eggs: number;
  wet: boolean;
  bed: boolean;
  t: number;
  laid: boolean;
};

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
  /** The shallows' hunter: its beast's id, how long it has held the line's beast, how long it is fed. */
  private hunter = { id: -1, grip: 0, fed: 0 };
  /** The line's own weight (kg). */
  private mass = 0;
  /** Whether the shallows' hunter is near (m; null: none), for the page. */
  danger: number | null = null;
  /** The mate called and how long they have courted; the nest made, how long since, its eggs. */
  private court: { mate: number; t: number; from: number; fed: number; owed: number } | null = null;
  private nest: Nest | null = null;
  private readonly nestDraw: LineNest;
  private readonly sea: SeaView;
  /** In the sea's ages: the eye under water, the floor what all stands on. */
  private shallows = false;
  /** What the courting is at, for the page: "coming", "courting", "nest" (null: none). */
  courting: "coming" | "courting" | "nest" | null = null;
  /** The last bite (its time on the meadow's clock), and the meals counted so far. */
  private bite: { t: number; ate: number } = { t: -1, ate: 0 };

  constructor(stage: Stage) {
    this.stage = stage;
    this.scene = new MeadowScene(stage);
    this.scene.setDetail(2);
    this.eye = new PossessEye(stage);
    this.nestDraw = new LineNest(stage, this.scene.root);
    this.sea = new SeaView(stage, this.scene.root);
  }

  /**
   * The line's beast put into its age's living world: the plan's lineages of that age, the line's own among them. In the
   * sea's ages (`shallows`), the whole ground under water and `sea` the sea's own lines about it.
   */
  begin(
    plan: GenesisPlan,
    line: LineBody,
    my: number,
    sea: readonly MeadowPlan["lineages"][number][] | null,
  ): string | null {
    this.mass = line.genome.mass;
    this.shallows = !!sea;
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
      big = sea
        ? (sea
            .filter((l) => (l.body?.size ?? 0) >= line.genome.mass * 2)
            .sort((a, b) => b.body!.size - a.body!.size)[0] ?? null)
        : null,
      hunterBody = big?.body ?? { ...line.body, size: line.genome.mass * 4 },
      hunter = sea
        ? [
            {
              ref: SHALLOWS_HUNTER,
              name: HUNTER_NAME,
              niche: "swimmer",
              arose: age,
              died: null,
              size: hunterBody.size,
              level: 2,
              body: hunterBody,
              words: null,
            },
          ]
        : [],
      others = sea
        ? [...sea.map((l) => ({ ...l, arose: age, died: null })), ...hunter]
        : plan.lineages,
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
    this.court = null;
    this.nest = null;
    this.courting = null;
    this.bite = { t: -1, ate: 0 };
    // (Of the shallows' hunter, one only: the first of its kind, the rest let go.)
    const hk = m.kinds.findIndex((x) => x.ref === SHALLOWS_HUNTER);
    this.hunter = { id: -1, grip: 0, fed: 6 };
    if (hk >= 0) {
      const of = m.beasts.filter((x) => x.kind === hk);
      for (const x of of.slice(1)) m.beasts.splice(m.beasts.indexOf(x), 1);
      if (of[0]) this.hunter.id = of[0].id;
    }
    const held = meadowHeld(m)!;
    // (The eye stands off by the body's own drawn size, however small: a worm of grams is seen as a worm is, close to it,
    // and the lens's near and far planes are set to that scale each frame: frame().)
    this.eye.height = Math.max(0.004, this.scene.sizeOf(LINE_REF) ?? held.k.length * 0.6);
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
          if (this.pressed !== null) {
            const o = meadowOffers(m)[this.pressed];
            h.act = o?.act ?? null;
            // (Court: a mate called to it, not a young one at once.)
            if (o?.act === "court" && o.can) {
              h.act = null;
              this.callMate();
            }
          }
          this.pressed = null;
          const yaw = this.eye.looking,
            // (The stick's frame: ahead is where the eye looks, as the meadow's held beast is steered: app/meadow-held.ts.)
            ahead = -this.stick.y,
            right = this.stick.x;
          h.mx = ahead * Math.sin(yaw) - right * Math.cos(yaw);
          h.mz = ahead * Math.cos(yaw) + right * Math.sin(yaw);
          h.run = Math.hypot(this.stick.x, this.stick.y) > 0.92;
        }
        const had = h?.young ?? 0;
        stepMeadow(m);
        this.hunt(MEADOW_STEP);
        this.woo(MEADOW_STEP, had);
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
      // (The lens to the body's scale, in the meadow's units (0.1 a metre): its near plane a twentieth of the way to the
      // body, never past the stage's own 0.1; its far plane where the meadow and its sky end, so depth keeps its grain.)
      const lens = this.stage.camera.camera;
      if (lens) {
        const off = this.eye.distance * this.eye.height * 0.1;
        lens.nearClip = Math.min(0.1, Math.max(0.0003, off * 0.05));
        lens.farClip = Math.min(400, Math.max(60, lens.nearClip * 4e4));
      }
    }
    this.scene.update(m, this.bodies);
    // (The eye stands off by the body as it is drawn, read once it is: at the hand's taking nothing is drawn yet, and the
    // meadow draws its least beasts larger than life.)
    const drawn = this.scene.sizeOf(LINE_REF);
    if (drawn && Math.abs(drawn - this.eye.height) > 1e-6) this.eye.height = Math.max(0.004, drawn);
    // (Under water: the water's face well over the eye, the haze closing in some lengths of the eye's reach off.)
    const reach = this.eye.distance * this.eye.height;
    this.sea.update(
      this.shallows && !!held,
      Math.max(this.eye.stood.y * 1.8, this.eye.height * 6, 1.5),
      MEADOW_W * 2,
      reach * 0.6,
      reach * 6,
    );
    const c = this.court,
      mate = c && held ? m.beasts.find((x) => x.id === c.mate) : null;
    if (held && held.h.ate > this.bite.ate) this.bite = { t: m.t, ate: held.h.ate };
    const since = m.t - this.bite.t,
      size = Math.max(held?.k.length ?? 0, this.eye.height);
    this.nestDraw.update({
      bite:
        held && this.bite.t >= 0 && since < 1
          ? {
              x: held.b.x + Math.sin(held.b.heading) * size * 0.5,
              z: held.b.z + Math.cos(held.b.heading) * size * 0.5,
              y: size * 0.45,
              t: since,
              size,
              heading: held.b.heading,
            }
          : null,
      court:
        c && mate && held && this.courting === "courting"
          ? {
              x: (mate.x + held.b.x) / 2,
              z: (mate.z + held.b.z) / 2,
              t: c.t,
              // (As large as the beast is drawn: the meadow draws its least beasts larger than life.)
              size: Math.max(held.k.length, this.eye.height),
            }
          : null,
      nest: this.nest,
    });
  }

  /** Court pressed: the nearest grown one of its kind near is called to it. */
  private callMate(): void {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null;
    if (!m || !held || this.court || this.nest) return;
    let best: Beast | null = null,
      bd = MATE_NEAR;
    for (const o of m.beasts) {
      if (o === held.b || o.kind !== held.b.kind || o.doing === "coming" || o.age <= held.k.grown)
        continue;
      const d = Math.hypot(o.x - held.b.x, o.z - held.b.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best) return;
    this.court = { mate: best.id, t: 0, from: bd, fed: held.b.energy, owed: 0 };
    this.courting = "coming";
    held.h.told = { words: "It courts: one of its kind comes to it", t: m.t, good: true };
  }

  /** The courting's step: the mate comes, they court, the nest is made, the young one comes out of it. */
  private woo(dt: number, had: number): void {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null;
    if (!m || !held) return;
    const c = this.court,
      n = this.nest;
    if (n) {
      n.t += dt;
      // (The young is had as the nest is made, while the pair are as fed as they came together: the meadow's own birth,
      // the young set at the nest; it is shown for the choosing LAY seconds after: hadYoung.)
      if (c && held.h.young > had) {
        const young = m.beasts[m.beasts.length - 1];
        if (young && young.kind === held.b.kind) {
          // (Just out of the nest, past its rim and its eggs.)
          young.x = n.x + 1.1 * n.size;
          young.z = n.z;
        }
        n.eggs = Math.max(0, n.eggs - 1);
        held.b.energy -= c.owed;
        this.court = null;
        this.courting = null;
      } else if (c && n.t > MEADOW_STEP * 1.5) {
        // (The meadow would not have the young born (its why told): the eggs come to nothing.)
        const why = held.h.told?.words ?? "";
        n.eggs = 0;
        held.b.energy -= c.owed;
        this.court = null;
        this.courting = null;
        held.h.told = {
          words: `The eggs came to nothing${why ? `: ${why}` : ""}`,
          t: m.t,
          good: false,
        };
      }
      // (The nest stays a while, then is left.)
      if (n.t > 40) this.nest = null;
      return;
    }
    if (!c) return;
    const mate = m.beasts.find((x) => x.id === c.mate);
    if (!mate) {
      this.court = null;
      this.courting = null;
      return;
    }
    const dx = held.b.x - mate.x,
      dz = held.b.z - mate.z,
      d = Math.hypot(dx, dz) || 1,
      near = held.k.length * 1.3;
    mate.heading = Math.atan2(dx, dz);
    if (d > near) {
      // (It comes to the call at a run, and within COME seconds however far: the meadow's own courting asks no time at
      // all, and a beast of grams at its own pace took minutes to cross the meadow's reach, starving the pair.)
      const step = Math.min(d - near, Math.max(held.k.walk * 2, c.from / COME) * dt);
      mate.x += (dx / d) * step;
      mate.z += (dz / d) * step;
      mate.doing = "walking";
      c.t = 0;
      this.courting = "coming";
      // (Gone too far off from it: the mate gives up.)
      if (d > MATE_NEAR * 2) {
        this.court = null;
        this.courting = null;
      }
      return;
    }
    // (Close: they court side by side, the mate kept there.)
    mate.x = held.b.x - (dx / d) * near;
    mate.z = held.b.z - (dz / d) * near;
    mate.doing = "resting";
    this.courting = "courting";
    c.t += dt;
    if (c.t < DANCE) return;
    // (Beside the pair, not under them: to the side of the line between them that no beast stands on.)
    const size = Math.max(held.k.length, this.eye.height),
      mx = held.b.x - dx / 2,
      mz = held.b.z - dz / 2,
      side = (k: number) => ({
        x: mx + (-dz / d) * size * 1.4 * k,
        z: mz + (dx / d) * size * 1.4 * k,
      }),
      clear = (p: { x: number; z: number }) =>
        Math.min(...m.beasts.map((o) => Math.hypot(o.x - p.x, o.z - p.z))),
      at = clear(side(1)) >= clear(side(-1)) ? side(1) : side(-1);
    this.nest = {
      ...this.nestPlace(at.x, at.z, size, held.k.feed === "swim"),
      t: 0,
      laid: true,
    };
    this.courting = "nest";
    held.h.told = { words: "They make a nest", t: m.t, good: true };
    // (Whether it can have young is judged as it was when Court was pressed, as the meadow's own courting judges it at
    // once; what the courting cost it is paid as soon as the young is had or not: owed.)
    c.owed = Math.max(0, c.fed - held.b.energy);
    held.b.energy += c.owed;
    held.h.act = "court";
  }

  /** Where the nest goes, about (`x`, `z`): on land clear of the water and the shrubs; for a swimmer, in the water. */
  private nestPlace(
    x: number,
    z: number,
    size: number,
    wet: boolean,
  ): { x: number; z: number; size: number; eggs: number; wet: boolean; bed: boolean } {
    const m = this.meadow!,
      p = m.pond;
    if (p) {
      const dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz) || 1;
      if (wet && d > p.r - size) {
        x = p.x + (dx / d) * Math.max(0, p.r - size * 1.2);
        z = p.z + (dz / d) * Math.max(0, p.r - size * 1.2);
      } else if (!wet && d < p.r + size) {
        x = p.x + (dx / d) * (p.r + size * 1.2);
        z = p.z + (dz / d) * (p.r + size * 1.2);
      }
    }
    if (!wet)
      for (const s of m.shrubs) {
        const dx = x - s.x,
          dz = z - s.z,
          d = Math.hypot(dx, dz) || 1,
          clear = s.r + size * 0.7;
        if (d < clear) {
          x = s.x + (dx / d) * clear;
          z = s.z + (dz / d) * clear;
        }
      }
    return { x, z, size, eggs: 3, wet, bed: this.shallows };
  }

  /**
   * What about it hunts the line's beast (the names of the kinds whose hunters take its kind, by the meadow's own rule,
   * and the shallows' hunter where there is one), and how many kinds about are larger than it.
   */
  hunted(): { by: string[]; larger: number } {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null;
    if (!m || !held) return { by: [], larger: 0 };
    const by = m.kinds
      .filter((k) => k !== held.k && !k.gone && (prey(k, held.k) || k.ref === SHALLOWS_HUNTER))
      .filter((k) => m.beasts.some((b) => m.kinds[b.kind] === k))
      .map((k) => k.name);
    return {
      by: [...new Set(by)],
      larger: m.kinds.filter(
        (k) => k !== held.k && k.size > held.k.size && m.beasts.some((b) => m.kinds[b.kind] === k),
      ).length,
    };
  }

  /** The beast held made grown and fed, a mate set beside it, and Court pressed (a look tool's shortcut). */
  courtNow(): boolean {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null;
    if (!m || !held) return false;
    held.b.energy = 1;
    held.b.age = Math.max(held.b.age, held.k.grown + 1);
    const mate = m.beasts.find(
      (x) => x !== held.b && x.kind === held.b.kind && x.doing !== "coming",
    );
    if (mate) {
      mate.age = Math.max(mate.age, held.k.grown + 1);
      mate.x = held.b.x + Math.sin(held.b.heading) * held.k.length * 4;
      mate.z = held.b.z + Math.cos(held.b.heading) * held.k.length * 4;
    }
    const i = meadowOffers(m).findIndex((o) => o.act === "court");
    if (i < 0) return false;
    this.pressed = i;
    return true;
  }

  /** Under water: the water's face and the eye's height over the floor (m), and whether the pool's face is put by. */
  get under(): { over: number; eye: number; pool: boolean } | null {
    const pool = this.scene.root.findByName("pool") as { enabled?: boolean } | null;
    return this.sea.over === null
      ? null
      : { over: this.sea.over, eye: this.eye.stood.y, pool: !!pool?.enabled };
  }

  /** The nest and the courting, for the look tools. */
  get nestNow(): { courting: string | null; nest: Nest | null } {
    return { courting: this.courting, nest: this.nest };
  }

  /** The shallows' hunter's step: to the line's beast where it senses it, gripping it, taking it. */
  private hunt(dt: number): void {
    const m = this.meadow,
      held = m ? meadowHeld(m) : null,
      o = m?.beasts.find((x) => x.id === this.hunter.id);
    this.danger = null;
    if (!m || !held || !o) return;
    const dx = held.b.x - o.x,
      dz = held.b.z - o.z,
      d = Math.hypot(dx, dz) || 1,
      reach = 0.6 * (o.kind >= 0 ? (m.kinds[o.kind]?.length ?? 1) : 1) + 0.5 * held.k.length;
    if (this.hunter.fed > 0) {
      this.hunter.fed -= dt;
      return;
    }
    if (d > SENSE) {
      this.hunter.grip = Math.max(0, this.hunter.grip - dt);
      return;
    }
    this.danger = d;
    // (Faster than the beast swims, slower than it bolts.)
    const v = held.k.walk * 1.6,
      step = Math.min(Math.max(0, d - reach * 0.8), v * dt);
    o.heading = Math.atan2(dx, dz);
    o.x += (dx / d) * step;
    o.z += (dz / d) * step;
    o.doing = "chasing";
    if (d <= reach) {
      this.hunter.grip += dt;
      if (this.hunter.grip >= GRIP) {
        held.h.ended = "taken";
        held.h.by = HUNTER_NAME;
        m.beasts.splice(m.beasts.indexOf(held.b), 1);
        this.hunter = { ...this.hunter, grip: 0, fed: 20 };
      }
    } else this.hunter.grip = Math.max(0, this.hunter.grip - dt * 0.5);
  }

  /** How much of the line's beast is left to the shallows' hunter's grip (1: free). */
  get whole(): number {
    return 1 - this.hunter.grip / GRIP;
  }

  /** The hand gone on into another of the line's own kind about it (false: none is left there). */
  kin(): boolean {
    const m = this.meadow;
    if (!m) return false;
    const k = m.kinds.findIndex((x) => x.ref === LINE_REF),
      was = m.hand?.id,
      b = m.beasts.find((x) => x.kind === k && x.doing !== "coming" && x.id !== was);
    if (!b) return false;
    m.hand = null;
    if (!holdMeadow(m, b.id)) return false;
    this.young = 0;
    this.eye.behind(b.heading, true);
    return true;
  }

  /** The eye turned by a drag (px), or stood off. */
  look(dx: number, dy: number): void {
    this.eye.look(dx, dy);
  }

  /** Whether a young one has been born under the hand since it was last asked. */
  hadYoung(): boolean {
    const h = this.meadow?.hand;
    // (A young one of the nest is shown once it has come out of it.)
    if (!h || h.young <= this.young || (this.nest && this.nest.eggs < 3 && this.nest.t < LAY))
      return false;
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
      // (The line's own weight: the meadow keeps its beasts no lighter than its own least.)
      words: `${held.k.name} · ${sizeTier(this.mass).words}, ${this.mass >= 1 ? `${this.mass.toFixed(1)} kg` : this.mass >= 0.001 ? `${(this.mass * 1000).toFixed(this.mass < 0.01 ? 1 : 0)} g` : `${Math.round(this.mass * 1e6)} mg`} · ${held.b.doing}`,
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
    this.court = null;
    this.nest = null;
    this.courting = null;
    this.nestDraw.update({ court: null, nest: null });
    this.sea.update(false, 0, 0, 0, 0);
    this.shallows = false;
    const lens = this.stage.camera.camera;
    if (lens) {
      lens.nearClip = 0.1;
      lens.farClip = 400;
    }
    if (this.meadow) this.meadow.hand = null;
    this.meadow = null;
    this.scene.visible = false;
    this.eye.release();
  }
}
