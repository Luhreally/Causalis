// Live a Line's tribe (S6, 2026-11-28): a band of the world's people at a camp of its most peopled land, led by the hand.
// It lives its own day as every band seen near does (view/band.ts): out gathering and hunting, home by dusk, asleep by
// night, its crafts by the fire. The hand looks about with the stick (the ring on the ground is where it looks) and sends
// the hunters after the beast nearest there, walks the band on to that ground, or sends the gatherers to the grass for its
// seed. Well fed, the band has children; seed dropped about a fire comes up where the band camped days before, if a wild
// grain grows in its land (view/band-led.ts). Nothing of it reaches the world but the land taught to sow, at the hand's word
// (app/line.ts, the god's act.inspire). Fetched with Live a Line only.
import type { CampNear } from "../bridge/index.ts";
import { BandLayer, MeadowScene, type Stage } from "../render/index.ts";
import { LineBandMarks } from "../render/line-band.ts";
import type { HudOffer } from "../ui/line-hud.ts";
import { LedBand, orderHunt, orderWalk, takeable } from "../view/band-led.ts";
import {
  MEADOW_STEP,
  bandHour,
  campRoom,
  figureOf,
  lifeFigure,
  newBand,
  newMeadow,
  stepMeadow,
  type BandState,
  type MeadowState,
} from "../view/index.ts";

const M = 0.1,
  /** Band seconds a second: a band's day (view/band.ts BAND_DAY, two minutes) in forty seconds. */
  PACE = 3,
  /** How much quicker a night slept through passes. */
  SLEEP = 8,
  /** The eye: so far behind the spot it looks at and so high (scene units), how fast the stick moves it (m/s). */
  BACK = 2.6,
  UP = 4.4,
  LOOK_SPEED = 16,
  /** How far from its camp the hand may look (m); how near the spot a beast must be to be sent after (m). */
  LOOK_REACH = 140,
  HUNT_NEAR = 16;

/** The band's day: when its hunters go out (7:30 to 18:00). */
const isDay = (hour: number) => hour >= 7.5 && hour < 18;

export class LineBand {
  /** A night being slept through (🌙 Sleep): its pace hurried until morning. */
  sleeping = false;
  readonly scene: MeadowScene;
  private readonly folk: BandLayer;
  private readonly marks: LineBandMarks;
  private readonly stage: Stage;
  band: BandState | null = null;
  meadow: MeadowState | null = null;
  led: LedBand | null = null;
  info: CampNear | null = null;
  private bodies: CampNear["plan"]["lineages"][number]["body"][] = [];
  /** Where the hand looks (m). */
  readonly look = { x: 0, z: 0 };
  stick = { x: 0, y: 0 };
  private owed = 0;
  /** The band's own time lived (s), for its limbs and the marks. */
  time = 0;
  /** What came to pass since last asked. */
  readonly news: string[] = [];
  /** What a frame's steps cost (ms), for the look tools. */
  stepMs = 0;

  constructor(stage: Stage) {
    this.stage = stage;
    this.scene = new MeadowScene(stage);
    this.scene.setDetail(2);
    this.folk = new BandLayer(stage, this.scene.root);
    this.marks = new LineBandMarks(stage, this.scene.root);
    this.scene.visible = false;
  }

  /** The band of a land's camp put under the hand: whether a wild grain grows there (its seed comes up). */
  begin(info: CampNear, grain: boolean): void {
    this.info = info;
    this.scene.reset();
    const meadow = newMeadow(info.plan, 0, info.plan.seed, true);
    // (Their own flock grazes among the land's beasts: the hunters leave it be.)
    for (const k of meadow.kinds) if (info.flocks.includes(k.lineage)) k.tame = true;
    const drawn = lifeFigure(figureOf(info.figure, 2), info.figure),
      band = newBand(
        meadow,
        info.size,
        info.people,
        info.plan.seed,
        info.hour,
        info.names,
        campRoom(drawn),
        info.craft,
      );
    this.folk.people(drawn, info.figure);
    this.meadow = meadow;
    this.band = band;
    this.led = new LedBand(band, grain);
    this.bodies = info.plan.lineages.map((l) => l.body);
    this.look.x = band.camp.x;
    this.look.z = band.camp.z;
    this.owed = 0;
    this.time = 0;
    this.news.length = 0;
    this.scene.visible = true;
    this.folk.root.enabled = true;
    const lens = this.stage.camera.camera!;
    lens.nearClip = 0.02;
    lens.farClip = 400;
  }

  /** A frame: the band and its land stepped at the band's pace (none while paused), the eye moved by the stick. */
  frame(dt: number, paused: boolean): void {
    const b = this.band,
      m = this.meadow;
    if (!b || !m || !this.led) return;
    if (!paused) {
      const t0 = performance.now();
      // (A night slept through: hurried on to the morning, seen passing.)
      const pace = this.sleeping ? PACE * SLEEP : PACE;
      this.owed += Math.min(0.1, dt) * pace;
      this.time += Math.min(0.1, dt) * pace;
      let n = 0;
      while (this.owed >= MEADOW_STEP && n < 12) {
        stepMeadow(m);
        this.led.step(b, m);
        this.owed -= MEADOW_STEP;
        n++;
      }
      if (n === 12) this.owed = 0;
      if (this.sleeping && isDay(bandHour(b))) this.sleeping = false;
      this.stepMs = performance.now() - t0;
      this.news.push(...b.news);
      b.news.length = 0;
      // (The stick's frame: ahead is up the screen, away from the eye.)
      this.look.x += this.stick.x * LOOK_SPEED * Math.min(0.1, dt);
      this.look.z -= this.stick.y * LOOK_SPEED * Math.min(0.1, dt);
      const dx = this.look.x - b.camp.x,
        dz = this.look.z - b.camp.z,
        far = Math.hypot(dx, dz);
      if (far > LOOK_REACH) {
        this.look.x = b.camp.x + (dx / far) * LOOK_REACH;
        this.look.z = b.camp.z + (dz / far) * LOOK_REACH;
      }
    }
    this.scene.update(m, this.bodies);
    this.folk.update(b, this.time, m);
    const here = Math.hypot(this.look.x - b.camp.x, this.look.z - b.camp.z) < 10;
    this.marks.update({
      look: { x: this.look.x, z: this.look.z, can: !b.going && !here },
      // (The camps left behind: where seed was dropped, but the one they are at.)
      hearths: this.led.seed.filter((s) => Math.hypot(s.x - b.camp.x, s.z - b.camp.z) >= 6),
      sprouted: this.led.sprouted,
      // (The camp's own ground: nothing of the grain on it while they are camped; none while they walk.)
      clear: b.going
        ? []
        : [
            {
              x: b.camp.x,
              z: b.camp.z,
              r: Math.max(
                4.5 * b.spread,
                ...b.shelters.map(
                  (h) => Math.hypot(h.x - b.camp.x, h.z - b.camp.z) + 3.4 * b.spread,
                ),
              ),
            },
            { x: b.work.x, z: b.work.z, r: 2.5 * b.spread },
            { x: b.frame.x, z: b.frame.z, r: 2.5 * b.spread },
            ...b.shelters.map((h) => ({ x: h.x, z: h.z, r: 3.4 * b.spread })),
          ],
      t: this.time,
    });
    const cam = this.stage.camera;
    cam.setPosition(this.look.x * M, UP, this.look.z * M + BACK);
    cam.lookAt(this.look.x * M, 0, this.look.z * M);
  }

  /** The beast nearest the spot looked at that the hunters could take (its id), or null. */
  quarry(): number | null {
    const m = this.meadow;
    if (!m) return null;
    let best: number | null = null,
      bd = HUNT_NEAR;
    for (const q of m.beasts) {
      const d = Math.hypot(q.x - this.look.x, q.z - this.look.z);
      if (d < bd && takeable(m, q)) {
        bd = d;
        best = q.id;
      }
    }
    return best;
  }

  /** What the hand may do now, each with why it cannot where it cannot (four: the HUD's). */
  offers(): HudOffer[] {
    const b = this.band,
      m = this.meadow,
      l = this.led;
    if (!b || !m || !l) return [];
    const q = this.quarry(),
      beast = q === null ? null : m.beasts.find((x) => x.id === q),
      name = beast ? m.kinds[beast.kind]!.name : null,
      hour = bandHour(b),
      day = isDay(hour);
    return [
      !day
        ? {
            icon: "🌙",
            label: "Sleep",
            can: !this.sleeping,
            words: this.sleeping ? "The night passing" : "Let the night pass, on to the morning",
          }
        : {
            icon: "🏹",
            label: "Hunt",
            can: q !== null && day && !b.going && !b.kill,
            words:
              q === null
                ? "Look at a beast the hunters could take (the ring on it), then send them"
                : !day
                  ? "The hunters go out by day"
                  : b.going
                    ? "The band is walking on"
                    : b.kill
                      ? "A kill is being cut up"
                      : `Send the hunters after the ${name}`,
          },
      {
        icon: "🚶",
        label: "Walk on",
        can: !b.going && Math.hypot(this.look.x - b.camp.x, this.look.z - b.camp.z) >= 10,
        words: b.going
          ? "The band is walking on"
          : Math.hypot(this.look.x - b.camp.x, this.look.z - b.camp.z) < 10
            ? "Look at fresh ground away from the camp, then walk the band on to it"
            : this.led!.walkTo
              ? "They walk on at first light: look elsewhere to change where"
              : "Walk the band on to the ground you look at, at first light",
      },
      {
        icon: l.grass ? "🍇" : "🌾",
        label: l.grass ? "Fruit" : "Seed",
        can: true,
        words: l.grass
          ? "Send the gatherers back to the woods, for fruit and leaves"
          : "Send the gatherers to the grass, for its seed",
      },
      {
        icon: "🌱",
        label: "Sow",
        can: !!l.sprouted,
        words: l.sprouted
          ? "Teach your land to sow, as your band has seen"
          : l.grain
            ? "Seed dropped by a fire may come up: come back to an old camp after some days"
            : "No wild grain grows in this land",
      },
    ];
  }

  /** The hand's act (its place among the four): what came of it, in words; null if it is the sowing, for the page. */
  act(i: number): { words: string; good: boolean } | "sow" {
    const b = this.band!,
      m = this.meadow!,
      l = this.led!;
    if (i === 0 && !isDay(bandHour(b))) {
      this.sleeping = true;
      return { words: "The band sleeps; the night passes", good: true };
    }
    if (i === 0) {
      const q = this.quarry();
      if (q === null) return { words: "No beast they could take where you look", good: false };
      const why = orderHunt(b, m, q);
      return why
        ? { words: `${why[0]!.toUpperCase()}${why.slice(1)}`, good: false }
        : {
            words: `The hunters go after the ${m.kinds[m.beasts.find((x) => x.id === q)!.kind]!.name}`,
            good: true,
          };
    }
    if (i === 1) {
      const why = orderWalk(b, l, this.look.x, this.look.z);
      return why
        ? { words: `${why[0]!.toUpperCase()}${why.slice(1)}`, good: false }
        : { words: "The band will pack up at first light and walk on there", good: true };
    }
    if (i === 2) {
      l.grass = !l.grass;
      return {
        words: l.grass
          ? "The gatherers go to the grass for its seed, eaten by the fire"
          : "The gatherers go back to the woods",
        good: true,
      };
    }
    if (l.sprouted) return "sow";
    return {
      words: l.grain
        ? "Nothing sown yet: seed dropped by a fire may come up where they camped before"
        : "No wild grain grows in this land",
      good: false,
    };
  }

  /** So many of the band's days lived at once, for the look tools (frames not drawn): the steps taken. */
  live(days: number): number {
    const b = this.band,
      m = this.meadow;
    if (!b || !m) return 0;
    const n = Math.round((days * 120) / MEADOW_STEP);
    for (let i = 0; i < n; i++) {
      stepMeadow(m);
      this.led!.step(b, m);
    }
    this.time += n * MEADOW_STEP;
    this.news.push(...b.news);
    b.news.length = 0;
    return n;
  }

  /** Lived on to the next morning at its camp (walking on, let arrive), for the look tools: whether it came to one. */
  toMorning(): boolean {
    const b = this.band;
    if (!b) return false;
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < 120 / MEADOW_STEP && Math.abs(bandHour(b) - 8) > 0.1; i++)
        this.live(MEADOW_STEP / 120);
      if (!b.going) return true;
      this.live(0.3);
    }
    return false;
  }

  /** The band's hour (0 … 24). */
  hour(): number {
    return this.band ? bandHour(this.band) : 0;
  }

  /** The strip's words: how many they are, their food, the hour. */
  strip(): { words: string; full: number } | null {
    const b = this.band;
    if (!b) return null;
    const hour = bandHour(b),
      when =
        hour < 6.5 || hour >= 20.5
          ? "night"
          : hour < 7.5
            ? "morning"
            : hour < 18
              ? "day"
              : "evening";
    return {
      words: `${b.people.length} in the band · ${b.food.toFixed(1)} days of food · ${when}, day ${b.day + 1}`,
      full: Math.max(0, Math.min(1, b.food / 6)),
    };
  }

  leave(): void {
    this.scene.visible = false;
    this.folk.root.enabled = false;
    this.band = null;
    this.meadow = null;
    this.led = null;
    this.info = null;
    this.stage.camera.camera!.nearClip = 0.1;
  }
}
