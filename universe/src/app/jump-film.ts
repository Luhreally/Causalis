// The first jump watched (Phase 68, asked for 2026-11-03: "i wanna see the star wars and landing in planets and
// colonization and all that stuff"): the first ship of the home world to go by the lanes, played from what history holds of
// it. It climbs away from its own world toward a ring of lights that opens across the dark; it goes in, drawn out to a
// line, in a flash; the sky is drawn past it while the years run on the bar; and it comes out by another star, over the
// world it was bound for. A card tells who, what it cost and what it did. The world's clock is held all the while, and
// nothing here writes to history.
import "./film.css";
import { sound } from "./sound.ts";
import "./contact.css";
import "./jump.css";
import type { HostClient, JumpPlan } from "../bridge/index.ts";
import { LaneLayer, ShipMark, type OrbitRig, type Stage } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";

type Point = { readonly x: number; readonly y: number; readonly z: number };

export type JumpFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  /** Put every scale away and show the home world whole. */
  readonly toHomeWorld: () => Promise<unknown>;
  /** Put every scale away and show a world of another star whole. */
  readonly toForeignWorld: (star: string, planet: number) => Promise<void>;
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  readonly toOrbit: () => void;
  /** Whether another film is playing. */
  readonly busy: () => boolean;
};

export type JumpStage = "leave" | "opens" | "jump" | "through" | "short" | "out" | "card";

export type JumpFilm = {
  /** Play the first jump (false: none has been made). `auto`: the card closes by itself, as the Director's eye wants. */
  play(auto?: boolean): Promise<boolean>;
  skip(): void;
  readonly playing: boolean;
  state(): {
    stage: JumpStage | null;
    k: number;
    words: string;
    year: string;
    card: boolean;
    ship: Point | null;
  };
};

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Where the ring stands on the way out of the home world, and on the way into the far one. */
const RING_OUT = 34,
  RING_IN = -24;

export function installJumpFilm(d: JumpFilmDeps): JumpFilm {
  const { stage, rig, time, client } = d,
    ui = document.createElement("div"),
    flash = document.createElement("div"),
    yearBox = document.createElement("div"),
    words = document.createElement("div"),
    skipButton = document.createElement("button"),
    card = document.createElement("div");
  ui.className = "colony-film jump-film";
  ui.hidden = true;
  flash.className = "jump-flash";
  yearBox.className = "film-year";
  words.className = "film-words";
  skipButton.className = "film-skip";
  skipButton.textContent = "Skip ›";
  card.className = "contact-card";
  card.hidden = true;
  ui.append(flash, yearBox, skipButton, words, card);
  d.hud.append(ui);
  let ship: ShipMark | null = null,
    lane: LaneLayer | null = null,
    playing = false,
    skipped = false,
    stageNow: JumpStage | null = null,
    shotK = 0,
    shotT = 0,
    shotS = 1,
    frame: ((k: number, dt: number) => void) | null = null,
    shotEnd: (() => void) | null = null,
    shipAt: Point | null = null,
    nearWas = 0.1;
  const view = (e: Point, at: Point) => {
    stage.camera.setPosition(e.x, e.y, e.z);
    stage.camera.lookAt(at.x, at.y, at.z);
  };
  stage.onUpdate((dt) => {
    if (!playing || !frame) return;
    shotT += dt;
    shotK = clamp01(shotT / shotS);
    frame(shotK, dt);
    if (shotK >= 1 && shotEnd) {
      const e = shotEnd;
      shotEnd = null;
      e();
    }
  });
  const run = (seconds: number, f: (k: number, dt: number) => void) =>
    skipped
      ? Promise.resolve()
      : new Promise<void>((done) => {
          shotT = 0;
          shotK = 0;
          shotS = seconds;
          frame = f;
          shotEnd = done;
        });
  const end = () => {
    if (shotEnd) {
      const e = shotEnd;
      shotEnd = null;
      e();
    }
  };
  skipButton.onclick = () => film.skip();
  const place = (
    x: number,
    y: number,
    z: number,
    size: number,
    burn: number,
    dt: number,
    stretch = 1,
  ) => {
    ship!.at(x, y, z, 0, 0, 1, size, burn, dt, stretch);
    shipAt = { x, y, z };
  };
  const showCard = (p: JumpPlan, auto: boolean) => {
    const h = document.createElement("h3"),
      rows = document.createElement("div"),
      foot = document.createElement("div"),
      go = document.createElement("button");
    h.textContent = p.title;
    rows.className = "contact-rows";
    for (const r of p.rows) {
      const e = document.createElement("div"),
        b = document.createElement("b"),
        t = document.createElement("span");
      e.className = "contact-row yes";
      b.textContent = r.head;
      t.textContent = r.text;
      e.append(b, t);
      rows.append(e);
    }
    foot.className = "contact-foot";
    foot.textContent = p.foot;
    go.className = "contact-go";
    go.textContent = "Back to the world ›";
    go.onclick = () => film.skip();
    card.replaceChildren(h, rows, foot, go);
    card.hidden = false;
    if (auto) setTimeout(() => film.skip(), 9000);
  };
  const film: JumpFilm = {
    get playing() {
      return playing;
    },
    state: () => ({
      stage: stageNow,
      k: shotK,
      words: words.textContent ?? "",
      year: yearBox.textContent ?? "",
      card: !card.hidden,
      ship: shipAt,
    }),
    skip() {
      if (!playing) return;
      skipped = true;
      end();
    },
    async play(auto = false) {
      if (playing || d.busy()) return false;
      const p = await client.query<JumpPlan | null>({ type: "lanes.jump" });
      if (!p) return false;
      ship ??= new ShipMark(stage);
      lane ??= new LaneLayer(stage);
      playing = true;
      skipped = false;
      d.toOrbit();
      time.hold("film");
      rig.enabled = false;
      document.body.classList.add("filming");
      ui.hidden = false;
      card.hidden = true;
      flash.style.opacity = "0";
      yearBox.textContent = `YEAR ${p.year}`;
      const cam = stage.camera.camera!;
      nearWas = cam.nearClip;
      cam.nearClip = 0.03;
      try {
        // —— Leaving: from over its own world, out to where the lane's mouth is opening.
        stageNow = "leave";
        frame = null;
        shotK = 0;
        await d.cut("the home world", async () => {
          await d.toHomeWorld();
          lane!.clear();
          lane!.visible = true;
          ship!.visible = true;
          place(0, 1.1, 0.5, 0.05, 1, 0.016);
          view({ x: 0, y: 1.5, z: -1.3 }, { x: 0, y: 0.35, z: 8 });
          words.textContent = p.leave;
        });
        lane.threadOut(RING_OUT, RING_OUT + 420, 0.03);
        lane.star("far", 0, 0, RING_OUT + 420, 16);
        lane.star("home", -60, 18, -40, 30);
        await run(8, (k, dt) => {
          const e = k * k * k,
            z = lerp(0.5, 28, e);
          place(0, lerp(1.1, 0.25, ease(k)), z, lerp(0.05, 0.16, k), 1, dt);
          lane!.ring(RING_OUT, lerp(1.2, 2.2, k), k * 3, 0.35 + 0.4 * k);
          lane!.mouthGlow(RING_OUT, 0.8 * k);
          view({ x: 0, y: 1.5, z: -1.3 }, { x: 0, y: lerp(0.35, 0.55, k), z: 8 });
        });
        // —— The mouth opening, the ship before it.
        stageNow = "opens";
        words.textContent = p.opens;
        lane.star("home", 0, 0, 0, 0);
        await run(5, (k, dt) => {
          const e = ease(k),
            z = lerp(28.5, RING_OUT - 2.6, e);
          place(0, 0.1 * (1 - k), z, 0.3, 0.8 * (1 - k) + 0.2, dt);
          lane!.ring(RING_OUT, lerp(2.2, 3, e), 3 + k * 7, 0.75 + 0.25 * k);
          lane!.mouthGlow(RING_OUT, lerp(1, 4.2, e));
          view(
            { x: lerp(4.6, 3.2, e), y: lerp(2.2, 1, e), z: lerp(RING_OUT - 11, RING_OUT - 7.5, e) },
            { x: 0, y: 0, z: lerp(RING_OUT - 5, RING_OUT - 1.2, e) },
          );
        });
        // —— The jump: drawn out to a line and gone, in a flash, and the sky begins to run.
        stageNow = "jump";
        if (!skipped) sound.cue("jump");
        words.textContent = p.jump;
        await run(1.7, (k, dt) => {
          const s = k * k;
          if (k < 0.62) place(0, 0, lerp(RING_OUT - 2.6, RING_OUT, s), 0.3, 1, dt, 1 + 60 * s * s);
          else ship!.visible = false;
          lane!.ring(RING_OUT, 3 + 2 * s, 10 + k * 20, 1);
          lane!.mouthGlow(RING_OUT, lerp(4.2, 14, s));
          lane!.sky(RING_OUT, k > 0.55 ? 22 * (k - 0.55) : 0, 200 * k);
          flash.style.opacity = String(k < 0.62 ? s * 1.2 : Math.max(0, 1 - (k - 0.62) * 2.4));
          view(
            { x: lerp(3.2, 0.5, s), y: lerp(1, 0.55, s), z: lerp(RING_OUT - 7.5, RING_OUT - 5, s) },
            { x: 0, y: 0, z: RING_OUT },
          );
        });
        // —— Through it: the sky drawn past, the years running on the bar, and the far star ahead.
        stageNow = "through";
        words.textContent = p.through;
        flash.style.opacity = "0";
        lane.ring(0, 0, 0, 0);
        lane.mouthGlow(0, 0);
        lane.threadOut(0, 0, 0);
        const inside = 60,
          through = p.thrown ? p.arrives - p.thrown.years : p.arrives;
        ship.visible = !skipped;
        lane.star("far", 0, 0, inside + 300, 6);
        await run(4.6, (k, dt) => {
          place(0, 0, inside, 0.22, 0, dt);
          const swing = 0.03 * Math.sin(k * 41);
          lane!.sky(
            inside,
            11 * Math.min(1, k * 4) * Math.min(1, (1 - k) * 6 + 0.35),
            120 + 240 * k,
          );
          lane!.star("far", 0, 0, inside + 300, 8 + 26 * k * k);
          yearBox.textContent = `YEAR ${Math.round(lerp(p.year, through, k))}`;
          view(
            { x: 0.35 + swing, y: 0.42 - swing, z: inside - 2.3 },
            { x: 0, y: 0.02, z: inside + 8 },
          );
        });
        // —— Thrown out short, where the lane gave way under it: the rest on its own drive.
        if (p.thrown && !skipped) {
          stageNow = "short";
          words.textContent = p.short ?? "";
          lane.sky(0, 0, 0);
          lane.star("far", 0, 0, inside + 300, 7);
          flash.style.background = "#ffb080";
          await run(5.5, (k, dt) => {
            flash.style.opacity = String(Math.max(0, 0.9 - k * 3));
            place(0.3 * Math.sin(k * 3), 0.2 * Math.cos(k * 2), inside + 2 * k, 0.22, 0.25 + k, dt);
            yearBox.textContent = `YEAR ${Math.round(lerp(through, p.arrives, k * k))}`;
            view({ x: 1.2, y: 0.7, z: inside - 3.4 }, { x: 0, y: 0, z: inside + 6 });
          });
          flash.style.background = "";
          flash.style.opacity = "0";
        }
        // —— Out, by another star, over the world it was bound for.
        stageNow = "out";
        if (!skipped) sound.cue("out");
        frame = null;
        shotK = 0;
        await d.cut("that star", async () => {
          await d.toForeignWorld(p.star, p.planet);
          ship!.visible = !skipped;
          lane!.star("home", 0, 0, 0, 0);
          lane!.threadOut(0, 0, 0);
          place(0, 0, RING_IN, 0.3, 0, 0.016, 30);
          view({ x: 0.7, y: 0.7, z: RING_IN - 4 }, { x: 0, y: 0, z: RING_IN + 6 });
        });
        words.textContent = p.out;
        yearBox.textContent = `YEAR ${p.arrives}`;
        await run(9, (k, dt) => {
          const e = ease(clamp01((k - 0.12) / 0.88)),
            burst = clamp01(k / 0.12),
            z = lerp(RING_IN + 0.4, -2.6, e);
          place(
            lerp(0, 0.55, e),
            lerp(0, 0.3, e),
            z,
            lerp(0.3, 0.06, e),
            0.15 + 0.85 * e,
            dt,
            1 + 30 * (1 - burst),
          );
          flash.style.opacity = String(Math.max(0, 1 - k * 7));
          lane!.ring(RING_IN, lerp(3.4, 0.2, burst), 30 + k * 10, 1 - burst);
          lane!.mouthGlow(RING_IN, lerp(9, 0, burst));
          lane!.sky(RING_IN + 2, 14 * Math.max(0, 1 - k * 5), 400 + 300 * k);
          lane!.star("far", -14, 12, 60, 7);
          view(
            {
              x: lerp(0.7, 1.15, e),
              y: lerp(0.7, 0.65, e),
              z: lerp(RING_IN - 4, -4.6, e),
            },
            { x: lerp(0, 0.2, e), y: lerp(0, 0.1, e), z: lerp(RING_IN + 6, 0, e) },
          );
        });
        flash.style.opacity = "0";
        // —— Who, what it cost and what it did: until it is closed.
        stageNow = "card";
        words.textContent = "";
        if (!skipped) {
          showCard(p, auto);
          frame = null;
          await new Promise<void>((done) => {
            shotEnd = done;
          });
        }
      } finally {
        card.hidden = true;
        ship!.visible = false;
        lane!.clear();
        lane!.visible = false;
        frame = null;
        shotEnd = null;
        stageNow = null;
        shipAt = null;
        ui.hidden = true;
        flash.style.opacity = "0";
        flash.style.background = "";
        document.body.classList.remove("filming");
        cam.nearClip = nearWas;
        await d.toHomeWorld().catch(() => undefined);
        rig.enabled = true;
        rig.halt();
        time.release("film");
        playing = false;
      }
      return true;
    },
  };
  return film;
}
