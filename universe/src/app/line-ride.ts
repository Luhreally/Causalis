// Live a Line's ride aboard a ship of its realm (2026-11-28, space made a stage you play): Phase 73's ride (view/fleet.ts
// rideEye, off the stern of a hull its realm's fights are drawn with) over a crossing the voyage rule keeps. The world's own
// years pass, one at a time, as it is ridden: in real time (a year every three seconds), quicker, or straight to its landing.
// What the ride tells is the rule's: its people aboard, born and died; their food against need and the share of their work
// that keeps them alive; their grievance; and what history tells of the ship as it happens. Nothing here moves history:
// the years pass as the clock would pass them. Its landing opens the stage's payoff (app/line.ts). Fetched with Live a Line only.
import type { HostClient } from "../bridge/index.ts";
import type { LineVoyage } from "../host/line-story.ts";
import { RideScene } from "../render/line-ride.ts";
import type { Stage } from "../render/index.ts";
import { el } from "../ui/index.ts";
import { YEAR } from "../kernel/index.ts";

/** The paces a ride goes at: a year in so many seconds (0: as fast as the world can go), and how fast the dark goes by. */
export const RIDE_PACES = [
  { words: "a year in three seconds", s: 3, by: 1 },
  { words: "a year a second", s: 1, by: 3 },
  { words: "as fast as it goes", s: 0, by: 9 },
] as const;

/** How far the hand turns the eye a pixel dragged (Phase 73's own), and how far it may tip. */
const TURN = 0.006;

export type RideDeps = {
  readonly client: HostClient;
  readonly stage: Stage;
  /** Where the ride's card goes, and how a key and the card are made (the mode's own). */
  readonly layer: (e: HTMLElement | null) => void;
  readonly card: (
    title: string,
    words: readonly string[],
    keys: readonly HTMLButtonElement[],
    help: string,
  ) => HTMLElement;
  readonly key: (text: string, run: () => void, other?: boolean) => HTMLButtonElement;
  readonly noise: (n: "pop" | "grow" | "loss" | "rise") => void;
  /** The land the story is of (the args of the line's askings). */
  readonly args: () => Record<string, number>;
  /** The mode's own scenes put away while it rides, and back. */
  readonly scenes: (on: boolean) => void;
  /** Come down: the ship's land. */
  readonly landed: (land: string) => void;
  /** Left before it came down. */
  readonly left: () => void;
};

/** A count in words, "1,234". */
const n = (x: number) => Math.round(x).toLocaleString("en");
/** A share in a hundred. */
const share = (x: number) => `${Math.round(x * 100)} in a hundred`;

export class ShipRide {
  private readonly d: RideDeps;
  private scene: RideScene | null = null;
  /** The ship ridden, as last read; its land; the years since it was boarded. */
  voyage: LineVoyage | null = null;
  private land = "";
  private born = 0;
  private died = 0;
  /** Its telling, oldest first, as read since it was boarded (each line once). */
  private readonly told: { year: number; words: string }[] = [];
  private readonly toldSeen = new Set<string>();
  pace = 0;
  paused = false;
  /** Each boarding's own sailing: one left and boarded again does not sail twice. */
  private trips = 0;
  /** Gone straight to its landing (⏭). */
  private skip = false;
  private gone = true;
  /** When the year now shown began to pass (ms), and the share of the crossing shown. */
  private yearAt = 0;
  private shown = 0;
  private was: { scale: string | undefined; near: number; far: number; fov: number } | null = null;
  private drag: { x: number; y: number; id: number } | null = null;

  constructor(d: RideDeps) {
    this.d = d;
  }

  /** Its scene's root on the stage (null till first boarded): the mode's own, never put away with the god game's. */
  get root(): unknown {
    return this.scene?.root ?? null;
  }

  get on(): boolean {
    return !this.gone;
  }

  /** The share of its crossing come, as the ride shows it (0 … 1). */
  get through(): number {
    return this.shown;
  }

  /** Aboard the ship of a land: read, drawn, and its years let go. */
  async board(land: string): Promise<boolean> {
    if (!this.gone) return false;
    const v = await this.d.client
      .query<LineVoyage | null>({
        type: "line.voyage",
        args: { ...this.d.args(), land, once: true },
      })
      .catch(() => null);
    if (!v || v.arrived) return false;
    this.gone = false;
    this.voyage = v;
    this.land = land;
    this.born = 0;
    this.died = 0;
    this.told.length = 0;
    this.toldSeen.clear();
    this.take(v);
    this.pace = 0;
    this.paused = false;
    this.skip = false;
    this.yearAt = performance.now();
    this.shown = this.share(v, 0);
    const st = this.d.stage,
      lens = st.camera.camera!;
    this.was = {
      scale: document.body.dataset.scale,
      near: lens.nearClip,
      far: lens.farClip,
      fov: lens.fov,
    };
    lens.nearClip = 0.05;
    lens.farClip = 400;
    lens.fov = 50;
    document.body.dataset.scale = "space";
    this.scene ??= new RideScene(st);
    this.scene.ship(v.side);
    this.scene.yaw = 0;
    this.scene.pitch = 0.62;
    this.d.scenes(false);
    this.scene.visible = true;
    addEventListener("pointerdown", this.down);
    addEventListener("pointermove", this.move);
    addEventListener("pointerup", this.up);
    addEventListener("pointercancel", this.up);
    this.d.noise("grow");
    this.draw();
    void this.sail();
    return true;
  }

  /** Off the ship: everything as it was. */
  leave(): void {
    if (this.gone) return;
    this.gone = true;
    removeEventListener("pointerdown", this.down);
    removeEventListener("pointermove", this.move);
    removeEventListener("pointerup", this.up);
    removeEventListener("pointercancel", this.up);
    if (this.scene) this.scene.visible = false;
    const w = this.was,
      lens = this.d.stage.camera.camera!;
    if (w) {
      lens.nearClip = w.near;
      lens.farClip = w.far;
      lens.fov = w.fov;
      if (w.scale === undefined) delete document.body.dataset.scale;
      else document.body.dataset.scale = w.scale;
    }
    this.was = null;
    this.d.scenes(true);
  }

  destroy(): void {
    this.leave();
    this.scene?.destroy();
    this.scene = null;
  }

  /** A frame: the hull, the dark going by, the eye; how far it has come eased toward the year's. */
  frame(dt: number): void {
    const v = this.voyage;
    if (this.gone || !v || !this.scene) return;
    const p = RIDE_PACES[this.skip ? 2 : this.pace]!,
      frac =
        this.paused || !p.s ? 0 : Math.min(1, (performance.now() - this.yearAt) / (p.s * 1000)),
      aim = this.share(v, frac);
    this.shown += (aim - this.shown) * Math.min(1, dt * 3);
    this.room();
    const k = this.shown,
      burn = k < 0.08 || k > 0.92 ? 1 : 0.25;
    this.scene.frame(dt, k, this.paused ? 0.15 : p.by, this.paused ? 0.25 : burn);
  }

  /**
   * The room the ship is shown in: between the top's column and the ride's card where the card lies across the middle (a
   * phone), else between the top and the screen's foot. Measured twice a second.
   */
  private roomAt = 0;
  private room(): void {
    const now = performance.now();
    if (now - this.roomAt < 500 || !this.scene) return;
    this.roomAt = now;
    const h = innerHeight,
      w = innerWidth,
      across = (r: DOMRect | undefined) => !!r && r.left < w / 2 && r.right > w / 2,
      head = document.querySelector(".line-top")?.getBoundingClientRect(),
      card = document.querySelector(".line-ride")?.getBoundingClientRect(),
      top = across(head) ? head!.bottom : 0,
      foot = across(card) ? card!.top : h,
      free = Math.max(80, foot - top);
    this.scene.raise = (h / 2 - (top + foot) / 2) / h;
    this.scene.back = Math.max(1, Math.min(3, (h * 0.5) / free));
  }

  private share(v: LineVoyage, frac: number): number {
    const span = Math.max(1, v.arrives - v.departed);
    return Math.max(0, Math.min(1, (v.year - v.departed + frac) / span));
  }

  /** What a reading adds to the ride's own tallies: born and died since boarding, and its telling, each line once. */
  private take(v: LineVoyage): void {
    for (const t of v.told) {
      const k = `${t.year} ${t.words}`;
      if (this.toldSeen.has(k)) continue;
      this.toldSeen.add(k);
      this.told.push(t);
    }
  }

  /** The years let go, one at a time at the ride's pace, until it comes down or it is left. */
  private async sail(): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms)),
      trip = ++this.trips,
      off = () => this.gone || this.trips !== trip;
    while (!off()) {
      // (Each year waits out its pace, looked at often: a pace changed, a hold, or ⏭, is taken at once.)
      const p = RIDE_PACES[this.skip ? 2 : this.pace]!,
        rest = p.s * 1000 - (performance.now() - this.yearAt);
      if (this.paused || rest > 0) {
        await wait(this.paused ? 150 : Math.min(150, rest));
        continue;
      }
      const from = this.voyage?.year ?? 0;
      // (The year let pass as the clock would pass it; then the ship read as that year left it.)
      await this.d.client.advance((this.d.client.status?.t ?? 0) + YEAR);
      if (off()) return;
      const v = await this.d.client
        .query<LineVoyage | null>({
          type: "line.voyage",
          args: { ...this.d.args(), land: this.land, since: from },
        })
        .catch(() => null);
      if (off()) return;
      if (!v) {
        this.leave();
        this.d.left();
        return;
      }
      this.born += v.born;
      this.died += v.died;
      const before = this.told.length;
      this.take(v);
      const prev = this.voyage;
      this.voyage = {
        ...v,
        side: prev?.side ?? v.side,
        crew: prev?.crew ?? null,
        lands: prev?.lands ?? null,
      };
      if (this.told.length > before) this.d.noise("pop");
      if (v.arrived) {
        this.shown = 1;
        const land = this.land;
        this.leave();
        this.d.landed(land);
        return;
      }
      this.draw();
      this.yearAt = performance.now();
    }
  }

  /** The ride's card: where it is bound, how it goes aboard, what has happened, and its keys. */
  private draw(): void {
    const v = this.voyage;
    if (this.gone || !v) return;
    const left = Math.max(0, v.arrives - v.year),
      rows: [string, string][] = [
        [
          "The year",
          `${v.year}: ${left} ${left === 1 ? "year" : "years"} to go of ${v.arrives - v.departed}`,
        ],
        ["Aboard", `${n(v.people)} people, ${n(v.young)} of them children`],
        [
          "Born, died",
          `${n(v.born)} and ${n(v.died)} last year; ${n(this.born)} and ${n(this.died)} since you came aboard`,
        ],
        [
          "Food",
          `${v.fed >= 0.995 ? "enough for all" : `${share(v.fed)} of what they need`}; ${share(v.keep)} of their work keeps them alive`,
        ],
        ["Grievance", share(v.grievance)],
        [
          "Its way",
          v.lanes
            ? `by ${v.lanes.hops} ${v.lanes.hops === 1 ? "lane" : "lanes"} between the stars${v.lanes.thrown ? `; a lane threw it ${v.lanes.thrown.short} light-years short, ${v.lanes.thrown.years} years more` : ""}`
            : `by ${v.drive}${v.aboardYears !== null ? `, ${v.aboardYears} years passing aboard` : ""}`,
        ],
      ];
    if (v.crew) rows.push(["With you", `${v.crew.name}, ${v.crew.words}`]);
    const p = RIDE_PACES[this.pace]!,
      keys = [
        this.d.key(this.paused ? "▶ Go on" : "⏸ Hold", () => {
          this.paused = !this.paused;
          this.yearAt = performance.now();
          this.draw();
        }),
        this.d.key(
          `⏩ ${RIDE_PACES[(this.pace + 1) % 2]!.words}`,
          () => {
            this.pace = (this.pace + 1) % 2;
            this.draw();
          },
          true,
        ),
        this.d.key(
          "⏭ To its landing",
          () => {
            this.skip = true;
            this.paused = false;
            this.draw();
          },
          true,
        ),
        this.d.key(
          "Leave the ship",
          () => {
            this.leave();
            this.d.left();
          },
          true,
        ),
      ];
    const box = this.d.card(
      `Aboard, bound for ${v.words.replace(/^A /, "a ")}`,
      [
        this.skip
          ? "The years go by as fast as they can, to its landing."
          : this.paused
            ? "Held. Drag to look about the ship."
            : `The years go by, ${p.words}. Drag to look about the ship.`,
      ],
      keys,
      "help:ride",
    );
    box.classList.add("line-payoff", "line-ride");
    const tally = el("dl", "line-tally");
    for (const [k, w] of rows) tally.append(el("dt", "", k), el("dd", "", w));
    box.querySelector(".line-card-head")!.after(tally);
    if (this.told.length) {
      const log = el("ul", "line-ride-told");
      for (const t of this.told.slice(-2)) log.append(el("li", "", `${t.year}: ${t.words}.`));
      tally.after(log);
    }
    this.d.layer(box);
  }

  private readonly down = (e: PointerEvent) => {
    if ((e.target as Element | null)?.closest?.("button, .line-card, .line-top, a")) return;
    this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  private readonly move = (e: PointerEvent) => {
    const g = this.drag;
    if (!g || g.id !== e.pointerId || !this.scene) return;
    this.scene.yaw -= (e.clientX - g.x) * TURN;
    this.scene.pitch = Math.max(-0.9, Math.min(1.2, this.scene.pitch + (e.clientY - g.y) * TURN));
    g.x = e.clientX;
    g.y = e.clientY;
  };
  private readonly up = (e: PointerEvent) => {
    if (this.drag?.id === e.pointerId) this.drag = null;
  };
}
