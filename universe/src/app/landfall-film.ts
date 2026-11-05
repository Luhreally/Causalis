// A landing watched (Phase 70, first slice; asked for 2026-11-04: "wars of like the people going to other planets and
// fighting the primitive aliens there with machines"): ships over a world, landers down on the natives' own ground, as
// that ground was the year they came, and the fight the two sides' numbers say, told in words. A pure function of the
// plan and the film's clock. The world's clock is held all the while, and nothing here writes to history.
import "./film.css";
import "./contact.css";
import type { HostClient, LandfallPlan, VillagePlan } from "../bridge/index.ts";
import {
  LandfallLayer,
  ShipMark,
  VILLAGE_METRE,
  type GlobeScene,
  type OrbitRig,
  type Stage,
  type VillageScene,
} from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  MEADOW_W,
  clearAt,
  figureOf,
  landfallAt,
  landfallEye,
  landfallMost,
  landfallScript,
  landfallStage,
  landfallWords,
  villageGround,
  type BlazeNow,
  type Burnable,
  type LandfallGround,
  type LandfallNow,
  type LandfallScript,
  type LandfallStage,
} from "../view/index.ts";

type Point = { readonly x: number; readonly y: number; readonly z: number };

export type LandfallFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly world: GlobeScene;
  readonly village: VillageScene;
  readonly toWorld: (star: string, index: number) => Promise<void>;
  readonly toGround: (star: string, index: number, at?: number) => Promise<unknown>;
  /** Where a camp shown stands (metres), and the town's plan. */
  readonly camp: () => { readonly x: number; readonly z: number } | null;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  readonly toOrbit: () => void;
};

export type LandfallFilm = {
  /** Play a people's landing (false: none came to a fight). */
  play(star: string, index: number, n?: number): Promise<boolean>;
  skip(): void;
  scrub(t: number): void;
  /** The film held still; its layer shown or not (what the screen owes to it, for a gate to read). */
  hold(on: boolean): void;
  sight(on: boolean): void;
  readonly playing: boolean;
  /** Whether the ground shown is the film's: a camp's people put by, a town's indoors. */
  readonly holdsGround: boolean;
  readonly townHeld: boolean;
  readonly hour: number;
  state(): {
    stage: "over" | LandfallStage | null;
    k: number;
    t: number;
    end: number;
    words: string;
    card: boolean;
    won: boolean | null;
    left: readonly [number, number];
    ship: Point | null;
  };
  /** What is drawn, on the screen: each still-standing figure's spot (for the gate's eye). */
  spots(): {
    comers: { x: number; y: number; made: boolean }[];
    natives: { x: number; y: number }[];
    fallen: { x: number; y: number }[];
    landers: { x: number; y: number }[];
  };
  shown(): Record<string, number>;
  order(): readonly [{ line: boolean; spacing: number }, { line: boolean; spacing: number }] | null;
  /** The last frame's cost, in ms of the script and the batches. */
  cost(): number;
  plan(): LandfallPlan | null;
};

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const FILM_HOUR = 0.45;

export function installLandfallFilm(d: LandfallFilmDeps): LandfallFilm {
  const { stage, rig, time, client, village } = d,
    layer = new LandfallLayer(stage),
    ui = document.createElement("div"),
    yearBox = document.createElement("div"),
    words = document.createElement("div"),
    skipButton = document.createElement("button"),
    card = document.createElement("div");
  ui.className = "colony-film contact-film landfall-film";
  ui.hidden = true;
  yearBox.className = "film-year";
  words.className = "film-words";
  skipButton.className = "film-skip";
  skipButton.textContent = "Skip ›";
  card.className = "contact-card landfall-card";
  card.hidden = true;
  ui.append(yearBox, skipButton, words, card);
  d.hud.append(ui);
  const ships: ShipMark[] = [];
  let playing = false,
    skipped = false,
    stageNow: "over" | LandfallStage | null = null,
    onGround = false,
    townHeld = false,
    plan: LandfallPlan | null = null,
    script: LandfallScript | null = null,
    now: LandfallNow | null = null,
    alight: readonly Burnable[] = [],
    t = 0,
    shotK = 0,
    frame: ((dt: number) => void) | null = null,
    finish: (() => void) | null = null,
    shipAt: Point | null = null,
    held = false,
    stillHeld = false,
    cost = 0;
  const view = (e: Point, at: Point) => {
    stage.camera.setPosition(e.x, e.y, e.z);
    stage.camera.lookAt(at.x, at.y, at.z);
  };
  stage.onUpdate((dt) => {
    if (!playing || !frame) return;
    frame(dt);
  });
  const end = () => {
    const e = finish;
    finish = null;
    e?.();
  };
  skipButton.onclick = () => film.skip();
  /** The town's lots alight, once they have won it. */
  const blaze = (): BlazeNow | null => {
    if (!plan || !script || !plan.won || !plan.burns || !alight.length || t < script.times.rout + 1)
      return null;
    const fires = alight.map((h, i) => ({
      ...h,
      k: Math.max(0.05, ease(clamp01((t - script!.times.rout - 1 - i * 0.5) / 3))),
    }));
    return { fires, smoke: fires, dust: [], shake: 0 };
  };
  /** Draw the ground act at the film's time. */
  const drawGround = () => {
    if (!plan || !script) return;
    const t0 = performance.now(),
      s = landfallAt(script, t);
    now = s;
    layer.update(s, script, performance.now() / 1000);
    cost = performance.now() - t0;
    const eye = landfallEye(script, t),
      M = VILLAGE_METRE;
    view(
      { x: eye.e.x * M, y: eye.e.y * M, z: eye.e.z * M },
      { x: eye.at.x * M, y: eye.at.y * M, z: eye.at.z * M },
    );
    stageNow = landfallStage(script, t);
    words.textContent = landfallWords(script, t);
    // (The card says it all: nothing shows through it.)
    words.style.visibility = card.hidden ? "" : "hidden";
    shotK = clamp01(t / script.times.end);
  };
  /** The card: who came, what they carried, what it cost each side, who holds the ground. */
  const showCard = (p: LandfallPlan) => {
    const row = (head: string, text: string, good = true) => {
        const e = document.createElement("div"),
          b = document.createElement("b"),
          s = document.createElement("span");
        e.className = `contact-row ${good ? "yes" : "no"}`;
        b.textContent = head;
        s.textContent = text;
        e.append(b, s);
        return e;
      },
      h = document.createElement("h3"),
      rows = document.createElement("div"),
      foot = document.createElement("div"),
      go = document.createElement("button");
    const who = p.who.charAt(0).toUpperCase() + p.who.slice(1);
    h.textContent = `${p.won ? `${who} took the ground` : `The ${p.natives} held their ground`}, year ${p.year}`;
    rows.className = "contact-rows";
    rows.append(
      row("🏴 Who holds the ground", p.holdsWords),
      row("🚀 Who came", p.cameWords),
      row("🏕 Who met them", p.metWords),
      row("⚔ How it went", p.howWords),
      row("⚖ What it cost", p.costWords, false),
      ...(p.terms.length ? [row("🧮 What told", p.terms.join(" "))] : []),
    );
    foot.className = "contact-foot";
    foot.textContent =
      "History holds that they came. What passed is read from both sides' numbers, the same every time, and moves nothing that follows.";
    go.className = "contact-go";
    go.textContent = "Stay here ›";
    go.onclick = () => film.skip();
    card.replaceChildren(h, rows, foot, go);
    card.hidden = false;
  };
  /** Their ground, and which way the ships came down on it. */
  const groundOf = (p: LandfallPlan): LandfallGround => {
    const key = (p.star.length * 37 + p.index * 11 + p.n * 7) % 12;
    if (p.camp) {
      // Their board's far side: the fight runs along its length, from their camp toward the open end.
      const c = d.camp() ?? { x: 0, z: 0 },
        w = c.x <= 0 ? 1 : -1,
        way = { x: w, z: 0 },
        edge = { x: c.x + w * 6, z: Math.max(-16, Math.min(16, c.z)) },
        room = MEADOW_W / 2 - Math.abs(edge.x) * Math.sign(-w * edge.x || 1) - 26,
        huts = Array.from({ length: 7 }, (_, i) => {
          const b = (i / 7) * 2 * Math.PI + key;
          return {
            x: c.x + Math.cos(b) * (7 + (i % 3) * 3),
            z: c.z + Math.sin(b) * (7 + (i % 3) * 3),
          };
        });
      return {
        kind: "camp",
        edge,
        way,
        huts,
        most: { gap: Math.max(28, Math.min(50, room)), across: 24, deep: 13 },
      };
    }
    const town = d.plan()!,
      g = villageGround(town),
      gap = Math.max(40, p.off > 0 ? p.off : 30),
      clear = (x: number, z: number) =>
        g.town ? g.town.clearAt({ x, z }, 9) : clearAt(g, { x, z }, 9);
    let best = { r: Infinity, a: 0 };
    for (let k = 0; k < 12; k++) {
      const a = (((key + k) % 12) / 12) * 2 * Math.PI,
        c = Math.cos(a),
        s = Math.sin(a);
      for (let r = 30; r < 3000 && r < best.r; r += 15)
        if (
          [0, 0.5, 1, 1.4].every((m) => clear(c * (r + gap * m + 12), s * (r + gap * m + 12))) &&
          clear(c * (r + gap + 90), s * (r + gap + 90))
        ) {
          best = { r, a };
          break;
        }
    }
    if (best.r === Infinity) best = { r: g.homesReach + 20, a: (key / 12) * 2 * Math.PI };
    const way = { x: Math.cos(best.a), z: Math.sin(best.a) };
    return { kind: "town", edge: { x: way.x * best.r, z: way.z * best.r }, way, huts: [] };
  };
  const leave = async (p: LandfallPlan) => {
    layer.clear();
    card.hidden = true;
    for (const m of ships) m.visible = false;
    frame = null;
    finish = null;
    stageNow = null;
    shipAt = null;
    now = null;
    script = null;
    onGround = false;
    if (townHeld) {
      village.blazeOverride = null;
      townHeld = false;
    }
    alight = [];
    ui.hidden = true;
    document.body.classList.remove("filming");
    // (As they are now, whatever they were when the ships came.)
    await d.toGround(p.star, p.index).catch(() => undefined);
    rig.enabled = true;
    rig.halt();
    if (held) time.release("film");
    held = false;
    plan = null;
    playing = false;
  };
  const film: LandfallFilm = {
    get playing() {
      return playing;
    },
    get holdsGround() {
      return onGround;
    },
    get townHeld() {
      return townHeld;
    },
    get hour() {
      return FILM_HOUR;
    },
    state: () => ({
      stage: stageNow,
      k: shotK,
      t,
      end: script?.times.end ?? 0,
      words: words.textContent ?? "",
      card: !card.hidden,
      won: plan?.won ?? null,
      left: now?.left ?? [0, 0],
      ship: shipAt,
    }),
    spots() {
      const out = {
        comers: [] as { x: number; y: number; made: boolean }[],
        natives: [] as { x: number; y: number }[],
        fallen: [] as { x: number; y: number }[],
        landers: [] as { x: number; y: number }[],
        /** How wide a body of each host stands on the screen, about its middle (pixels). */
        bodies: [0, 0] as [number, number],
        /** How tall each ship on the screen stands there (pixels). */
        landerPx: [] as number[],
      };
      if (!now || !script) return out;
      const S = script,
        breadth = (
          list: readonly { x: number; z: number; size: number; doing: string }[],
          side: 0 | 1,
        ) => {
          const up = list.filter((f) => f.size > 0 && f.doing !== "fallen"),
            f = up[Math.floor(up.length / 2)];
          if (!f) return 0;
          const a = layer.screen(f.x, f.z),
            b = layer.screen(f.x + S.across.x * S.room[side], f.z + S.across.z * S.room[side]);
          return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
        };
      out.bodies = [breadth(now.comers, 0), breadth(now.natives, 1)];
      for (const c of now.comers) {
        if (c.size <= 0) continue;
        const q = layer.screen(c.x, c.z);
        if (!q) continue;
        if (c.doing === "fallen") out.fallen.push(q);
        else out.comers.push({ ...q, made: script.comers[c.i]!.made });
      }
      for (const n of now.natives) {
        if (n.size <= 0) continue;
        const q = layer.screen(n.x, n.z);
        if (!q) continue;
        if (n.doing === "fallen") out.fallen.push(q);
        else out.natives.push(q);
      }
      for (const l of now.landers) {
        const q = layer.screen(l.x, l.z, l.high + 11);
        if (q) out.landers.push(q);
        const foot = layer.screen(l.x, l.z, l.high),
          top = layer.screen(l.x, l.z, l.high + 22);
        if (q && foot && top && q.x >= 0 && q.x <= innerWidth && q.y >= 0 && q.y <= innerHeight)
          out.landerPx.push(Math.abs(foot.y - top.y));
      }
      return out;
    },
    shown: () => ({ ...layer.shown }),
    order: () => script?.order ?? null,
    cost: () => cost,
    plan: () => plan,
    skip() {
      if (!playing) return;
      skipped = true;
      end();
    },
    hold(on) {
      stillHeld = on;
    },
    sight(on) {
      layer.root.enabled = on;
    },
    scrub(x) {
      if (!playing || !script) return;
      t = Math.max(0, Math.min(script.times.end, x));
      drawGround();
    },
    async play(star, index, n = 0) {
      if (playing) return false;
      const p = await client.query<LandfallPlan | null>({
        type: "folk.landfall",
        args: { star, index, n },
      });
      if (!p) return false;
      plan = p;
      playing = true;
      skipped = false;
      t = 0;
      d.toOrbit();
      time.hold("film");
      held = true;
      rig.enabled = false;
      document.body.classList.add("filming");
      ui.hidden = false;
      card.hidden = true;
      yearBox.textContent = `YEAR ${p.year}`;
      try {
        // Over their world: the ships come in from afar to where they live.
        let site: Point = { x: 0, y: 0, z: 1 },
          side: Point = { x: 1, y: 0, z: 0 };
        stageNow = "over";
        frame = null;
        shotK = 0;
        const shown = Math.max(1, Math.min(3, p.ships));
        await d.cut("that world", async () => {
          await d.toWorld(star, index);
          d.world.setHalls([]);
          const near = await client.query<{ look: { hall: number } } | null>({
            type: "folk.near",
            args: { star, index, at: p.year },
          });
          site = d.world.wayOf(Math.max(0, near?.look.hall ?? 0));
          const l = Math.hypot(site.z, site.x) || 1;
          side = { x: site.z / l, y: 0, z: -site.x / l };
          while (ships.length < shown) ships.push(new ShipMark(stage));
          for (let i = 0; i < ships.length; i++) ships[i]!.visible = i < shown;
          words.textContent = `${p.landers} over a world none of them has seen. The ${p.natives} live below, ${p.stageWords}, and know nothing of it.`;
        });
        if (!skipped)
          await new Promise<void>((done) => {
            let s = 0;
            finish = done;
            frame = (dt) => {
              s += dt;
              const k = clamp01(s / 7),
                e = ease(k),
                off = 1 - e,
                dir = {
                  x: site.x + side.x * off * 0.9,
                  y: site.y + 0.25 * off,
                  z: site.z + side.z * off * 0.9,
                },
                l = Math.hypot(dir.x, dir.y, dir.z) || 1,
                far = lerp(4.6, 1.9, e),
                high = 1 + 0.9 * Math.pow(1 - k, 1.6) + 0.06,
                across = 0.8 * (1 - k) * (1 - k);
              shotK = k;
              ships.slice(0, shown).forEach((m, i) => {
                const lag = 1 + i * 0.09,
                  q = {
                    x: site.x * high * lag + side.x * (across + i * 0.14),
                    y: site.y * high * lag + i * 0.05,
                    z: site.z * high * lag + side.z * (across + i * 0.14),
                  };
                m.at(
                  q.x,
                  q.y,
                  q.z,
                  site.x - q.x,
                  site.y - q.y,
                  site.z - q.z,
                  lerp(0.05, 0.03, e),
                  1,
                  dt,
                );
                if (i === 0) shipAt = q;
              });
              view(
                { x: (dir.x / l) * far, y: (dir.y / l) * far, z: (dir.z / l) * far },
                { x: site.x * 0.55 * e, y: site.y * 0.55 * e, z: site.z * 0.55 * e },
              );
              if (k >= 1) end();
            };
          });
        for (const m of ships) m.visible = false;
        // Down on them, on their own ground, as they were the year the ships came.
        frame = null;
        if (!skipped) {
          await d.cut("their ground", async () => {
            await d.toGround(star, index, p.year);
            rig.enabled = false;
            const ground = groundOf(p),
              detail = stage.quality.detail,
              body = figureOf(p.nativeFigure, detail),
              // (How far apart they must stand for no one to stand in another: a figure's own breadth.)
              room = Math.max(3.2, 5.5 * body.scale);
            const most = landfallMost(detail);
            script = landfallScript(
              p,
              ground,
              ground.most ? [Math.min(18, most[0]), Math.min(56, most[1])] : most,
              [3.2, ground.most ? Math.max(3.2, 4 * Math.min(1.6, body.scale)) : room],
            );
            layer.build(p, script, detail);
            onGround = true;
            if (d.scale() === "village") {
              townHeld = true;
              const w = script.ground,
                way = [0, 0.3, 0.6, 1].map((m) => ({
                  x: w.edge.x - w.way.x * (20 + 90 * m),
                  z: w.edge.z - w.way.z * (20 + 90 * m),
                }));
              alight = p.burns ? village.homesAlong(client.status?.t ?? 0, way, 14) : [];
              village.blazeOverride = blaze;
            }
            t = 0;
            drawGround();
          });
          await new Promise<void>((done) => {
            finish = done;
            frame = (dt) => {
              const s = script!;
              if (t < s.times.end && !stillHeld) t = Math.min(s.times.end, t + dt);
              drawGround();
              if (t >= s.times.end && card.hidden) {
                words.textContent = "";
                showCard(p);
              }
            };
          });
        }
      } finally {
        await leave(p);
      }
      return true;
    },
  };
  return film;
}
