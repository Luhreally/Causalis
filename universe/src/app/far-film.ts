// What fell on a world of another star, watched (War past the line, W6; asked for 2026-11-05: "planet destoryers and star wars type
// stuff, but yk make it high stakes"). The world's clock is held and nothing here writes to history. The world whole, as it stood;
// what is brought against it; then by its rung: a far-off flash that leaves a mark; its whole sky taking fire and going dark; or the
// world itself breaking along its seams, its plates going out past the eye from a fire that goes out behind them, and rubble going
// round where it was. A card says who, what it took and what it did. The film draws from the globe's own mesh and colours.
import "./film.css";
import "./contact.css";
import "./jump.css";
import type { FarFilmPlan, HostClient } from "../bridge/index.ts";
import type { GlobeScene, OrbitRig, Stage } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import { FAR_STRIKE } from "../view/index.ts";

export type FarFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly scene: GlobeScene;
  /** The world whole, as it stood before this: its lights, its air; no rubble. */
  readonly toWorld: (star: string, planet: number, stood: boolean) => Promise<void>;
  /** Paint its face: `dark` 0 … 1 over all of it, from a point outward as it spreads; a mark where it fell. */
  readonly paintFace: (dark: number, mark: boolean) => void;
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  readonly busy: () => boolean;
  /** How far off a whole world fits this screen. */
  readonly fit: () => number;
};

export type FarStage = "whole" | "strikes" | "breaks" | "gone" | "after" | "card";

export type FarFilm = {
  /** Play what fell (false: nothing such). `auto`: the card closes by itself, as the Director's eye wants. */
  play(event: string, auto?: boolean): Promise<boolean>;
  skip(): void;
  readonly playing: boolean;
  state(): { stage: FarStage | null; k: number; words: string; card: boolean; rung: string | null };
};

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const ease = (k: number) => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const STRIKE = FAR_STRIKE;

export function installFarFilm(d: FarFilmDeps): FarFilm {
  const { stage, rig, time, client, scene } = d,
    ui = document.createElement("div"),
    flash = document.createElement("div"),
    yearBox = document.createElement("div"),
    words = document.createElement("div"),
    skipButton = document.createElement("button"),
    card = document.createElement("div");
  ui.className = "colony-film far-film";
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
  let playing = false,
    skipped = false,
    stageNow: FarStage | null = null,
    rungNow: string | null = null,
    shotK = 0,
    shotT = 0,
    shotS = 1,
    frame: ((k: number, dt: number) => void) | null = null,
    shotEnd: (() => void) | null = null;
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
  const eye = (distance: number, up: number, side: number) => {
    // (From over the struck face: it fills the phone's narrow width, and what goes out from it goes past the eye.)
    const l = Math.hypot(STRIKE.x + side, STRIKE.y + up, STRIKE.z) || 1;
    stage.camera.setPosition(
      ((STRIKE.x + side) / l) * distance,
      ((STRIKE.y + up) / l) * distance,
      (STRIKE.z / l) * distance,
    );
    stage.camera.lookAt(0, 0, 0);
  };
  const showCard = (p: FarFilmPlan, auto: boolean) => {
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
    go.textContent = "Back ›";
    go.onclick = () => film.skip();
    card.replaceChildren(h, rows, foot, go);
    card.hidden = false;
    if (auto) setTimeout(() => film.skip(), 9000);
  };
  skipButton.onclick = () => film.skip();
  const film: FarFilm = {
    get playing() {
      return playing;
    },
    state: () => ({
      stage: stageNow,
      k: shotK,
      words: words.textContent ?? "",
      card: !card.hidden,
      rung: rungNow,
    }),
    skip() {
      if (!playing) return;
      skipped = true;
      if (shotEnd) {
        const e = shotEnd;
        shotEnd = null;
        e();
      }
    },
    async play(event, auto = false) {
      if (playing || d.busy()) return false;
      const p = await client.query<FarFilmPlan | null>({ type: "far.plan", args: { event } });
      if (!p) return false;
      playing = true;
      skipped = false;
      rungNow = p.rung;
      time.hold("film");
      rig.enabled = false;
      document.body.classList.add("filming");
      ui.hidden = false;
      card.hidden = true;
      flash.style.opacity = "0";
      yearBox.textContent = `YEAR ${p.year}`;
      const cam = stage.camera.camera!,
        nearWas = cam.nearClip,
        fit = d.fit();
      cam.nearClip = 0.03;
      try {
        // —— The world whole, as it stood.
        stageNow = "whole";
        frame = null;
        shotK = 0;
        await d.cut("that world", async () => {
          await d.toWorld(p.star, p.planet, true);
          rig.enabled = false;
          eye(fit * 1.12, 0, 0);
          words.textContent = p.whole;
        });
        await run(5, (k) => eye(lerp(fit * 1.12, fit, ease(k)), 0.1 * k, 0.08 * k));
        // —— What is brought against it.
        stageNow = "strikes";
        words.textContent = p.strikes;
        if (p.rung === "world") {
          scene.breakBegin(STRIKE);
          // (Its air and its cloud go in the first white of it: nothing lies over its seams.)
          scene.features(false, false, false);
          await run(9, (k) => {
            const e = ease(k);
            eye(lerp(fit, fit * 0.94, e), 0.1, 0.08);
            // A point of white on its face, then its seams opening from there across all of it, the fire under them.
            scene.breakTo(clamp01((k - 0.08) * 1.3), 0);
            scene.breakLight(lerp(0.62, 0.92, e), 0.985, 0, k < 0.08 ? 0 : lerp(1.5, 2.2, e));
            flash.style.opacity = String(k < 0.1 ? (0.1 - k) * 6 : 0);
          });
          // —— It breaks.
          stageNow = "breaks";
          words.textContent = p.breaks;
          await run(11, (k, dt) => {
            void dt;
            const e = ease(k);
            eye(lerp(fit * 0.94, fit * 1.9, e), 0.1, 0.08);
            scene.breakTo(1, k);
            flash.style.opacity = String(k < 0.1 ? 1 - k * 10 : 0);
            scene.breakLight(
              lerp(1, 0.8, k),
              lerp(0.98, 0.3, ease(clamp01(k * 1.4))),
              k > 0.02 ? lerp(1.4, 13, ease(clamp01(k * 1.15))) : 0,
              lerp(3, 2.4, k),
            );
          });
          // —— Its light goes out.
          stageNow = "gone";
          words.textContent = p.gone;
          if (!skipped) scene.ruin(true);
          await run(7, (k) => {
            const e = ease(k);
            eye(lerp(fit * 1.9, fit * 1.25, e), lerp(0.1, 0.42, e), lerp(0.08, 0.2, e));
            scene.breakLight(lerp(0.8, 0, e), lerp(0.3, 0.1, e), 0, lerp(2.4, 0, e));
          });
          scene.breakLight(0, 0, 0);
        } else if (p.rung === "sky") {
          await run(7, (k) => {
            eye(lerp(fit, fit * 0.96, k), 0.1, 0.08);
            const w = k * 3,
              pulse = w - Math.floor(w);
            flash.style.opacity = String(pulse < 0.3 ? (0.3 - pulse) * 2.6 : 0);
            d.paintFace(clamp01(k * 0.45), true);
          });
          stageNow = "breaks";
          words.textContent = p.breaks;
          flash.style.opacity = "0";
          scene.blacken(true);
          await run(9, (k) => {
            eye(lerp(fit * 0.96, fit * 1.08, ease(k)), 0.1, 0.08);
            d.paintFace(clamp01(0.45 + k * 0.55), true);
          });
        } else {
          await run(6, (k) => {
            eye(lerp(fit, fit * 0.8, ease(k)), 0.1, 0.08);
            flash.style.opacity = String(k < 0.16 ? (0.16 - k) * 6 : 0);
            d.paintFace(0, k > 0.1);
          });
          stageNow = "breaks";
          words.textContent = p.breaks;
          await run(5, (k) => eye(lerp(fit * 0.8, fit, ease(k)), 0.1, 0.08));
        }
        flash.style.opacity = "0";
        // —— What is left.
        stageNow = "after";
        words.textContent = p.after;
        await run(5.5, (k) => {
          if (p.rung === "world") eye(lerp(fit * 1.25, fit * 1.12, ease(k)), 0.42, 0.2);
        });
        // —— Who, what it took and what it did: until it is closed.
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
        frame = null;
        shotEnd = null;
        stageNow = null;
        rungNow = null;
        ui.hidden = true;
        flash.style.opacity = "0";
        document.body.classList.remove("filming");
        cam.nearClip = nearWas;
        scene.breakLight(0, 0, 0);
        // (Back on the world as it now is: what is left, its sky dark, or its mark.)
        await d.toWorld(p.star, p.planet, false).catch(() => undefined);
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
