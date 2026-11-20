// A meeting of fleets watched on its sea (2026-11-19). Its words asked of the host (host/inspect/seafight.ts), laid out by
// view/seafight.ts and drawn by render/seafight.ts on a clock of its own: the world's clock held, the battle's own speeds, its
// course drawn back and forth. The street film's caption and one row of controls; a name over each flagship. Nothing here
// writes to history: what goes down and who holds the sea after is what history says.
import "./sea-fight.css";
import { sound } from "./sound.ts";
import type { HostClient, SeaFightNear } from "../bridge/index.ts";
import { SEA_UP, SeaLayer, type OrbitRig, type Stage } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  BATTLE_SPEEDS,
  SEA_LENGTH,
  SEA_MOMENTS,
  newSeaFight,
  seaTally,
  seaWords,
  type SeaField,
} from "../view/index.ts";

export type SeaFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  /** Everything of the world put away, for the sea alone (inside a cut, its readying told). */
  readonly enter: (work: () => void) => Promise<void>;
  /** Back to where it was entered from, with the page it was pressed on (or `page`, asked for from the film) open again. */
  readonly leave: (page?: string) => Promise<void>;
};

export type SeaFilm = {
  /** Watch a meeting of fleets by its event (false: it is not one, or is no longer kept). */
  play(event: string): Promise<boolean>;
  stop(page?: string): void;
  readonly playing: boolean;
  readonly keys: { toggle(): void; pick(i: number): boolean };
  seek(s: number): void;
  /** The film as it stands, as plain numbers (a check reads it). */
  state(): {
    event: string | null;
    s: number;
    end: number;
    speed: number;
    drawn: readonly number[];
    down: readonly number[];
    gone: readonly number[];
    afloat: number;
    hulls: number;
    sails: number;
    pennants: number;
    flags: { text: string; x: number; y: number }[];
    words: string;
  };
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const setText = (node: HTMLElement, text: string) => {
  if (node.textContent !== text) node.textContent = text;
};
const SPEED_WORDS = ["❚❚", "½×", "1×", "2×", "4×"] as const;
const tonnes = (n: number) => `${Math.round(n).toLocaleString("en-US")} t`;

export function installSeaFilm(d: SeaFilmDeps): SeaFilm {
  const { hud, client, time, rig, stage } = d;
  const ui = el("div", "street-film sea-film"),
    title = el("div", "street-title"),
    where = el("div", "street-where"),
    tally = el("div", "street-tally"),
    bar = el("div", "street-bar"),
    speedButtons = BATTLE_SPEEDS.map((_, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.title = i === 0 ? "Hold it still" : `At ${SPEED_WORDS[i]} its pace`;
      b.onclick = () => setSpeed(i);
      return b;
    }),
    course = el("div", "street-course"),
    fill = el("div", "street-course-fill"),
    again = el("button", "street-again", "↺"),
    page = el("button", "street-page", "›"),
    done = el("button", "street-done", "✕"),
    words = el("button", "street-words");
  again.title = "From its beginning";
  page.title = "Its page: whose fleets, who commanded, what each lost and why they met";
  page.setAttribute("aria-label", "Its page");
  done.title = "Back to the world as it stands";
  done.setAttribute("aria-label", "Back to the world");
  course.append(fill);
  course.setAttribute("role", "slider");
  course.setAttribute("aria-label", "Its course");
  course.title = "Draw it back and forth: any moment of it";
  words.title = "All of what is told of it, or two lines";
  words.onclick = () => ui.classList.toggle("open");
  words.append(title, where, tally);
  bar.append(again, ...speedButtons, page, done);
  ui.append(words, course, bar);
  ui.hidden = true;
  hud.append(ui);
  // (A name over each flagship, in her side's colour.)
  const flags = [0, 1].map(() => {
    const flag = el("div", "sea-flag");
    flag.hidden = true;
    hud.append(flag);
    return flag;
  });
  const rgb = (c: readonly number[]) =>
    `rgb(${c.map((x) => Math.round(Math.min(1, x * 1.25) * 255)).join(",")})`;

  let layer: SeaLayer | null = null,
    near: SeaFightNear | null = null,
    field: SeaField | null = null,
    flagHull: [number, number] = [-1, -1],
    s = 0,
    wall = 0,
    speed = 2,
    was = 2,
    playing = false,
    heardSmoke = 0,
    heardGone = 0,
    cueAt = 0,
    session = 0,
    coveredWas: OrbitRig["covered"] | null = null;

  const setSpeed = (i: number) => {
    const next = Math.max(0, Math.min(BATTLE_SPEEDS.length - 1, i));
    if (next === 0 && speed > 0) was = speed;
    speed = next;
    if (speed > 0 && s >= SEA_LENGTH) seek(0);
    speedButtons.forEach((b, n) => b.classList.toggle("active", n === speed));
  };
  const seek = (to: number) => {
    s = Math.max(0, Math.min(SEA_LENGTH, to));
    heardGone = field ? seaTally(field, s).gone.reduce((a, b) => a + b, 0) : 0;
    draw();
  };
  const scrub = (e: PointerEvent) => {
    const r = course.getBoundingClientRect();
    seek(((e.clientX - r.left) / Math.max(1, r.width)) * SEA_LENGTH);
  };
  course.onpointerdown = (e) => {
    course.setPointerCapture(e.pointerId);
    scrub(e);
  };
  course.onpointermove = (e) => {
    if (course.hasPointerCapture(e.pointerId)) scrub(e);
  };
  again.onclick = () => {
    seek(0);
    if (speed === 0) setSpeed(was);
  };
  // (Its page is read with the world back: the film is left for it.)
  page.onclick = () => {
    stop(near?.event);
  };

  const stop = (page?: string) => {
    if (!playing) return;
    playing = false;
    session++;
    layer?.setup(null);
    time.release("sea fight");
    if (coveredWas) rig.covered = coveredWas;
    coveredWas = null;
    document.body.classList.remove("filming", "sea-filming");
    ui.hidden = true;
    ui.classList.remove("open");
    for (const flag of flags) flag.hidden = true;
    near = null;
    field = null;
    rig.follow = null;
    rig.halt();
    void d.leave(page);
  };
  done.onclick = () => stop();

  /** Who a side is, in a line: its ships, its flagship, who commands. */
  const sideLine = (i: 0 | 1): string => {
    const x = near!.sides[i],
      n = field!.drawn[i] * field!.per[i];
    return `${x.name}: ${tonnes(x.tons)}, some ${n.toLocaleString("en-US")} ${n === 1 ? "ship" : "ships"} (${x.ships})${x.flagship ? `, in the ${x.flagship}` : ""}${x.led ? ` under ${x.led}` : ""}`;
  };

  const draw = () => {
    if (!layer || !field || !near) return;
    layer.update(s, wall);
    fill.style.width = `${((s / SEA_LENGTH) * 100).toFixed(1)}%`;
    const t = seaTally(field, s),
      a = near.sides[0],
      b = near.sides[1],
      at = `Year ${near.year}${near.off ? `, off ${near.off}` : ""}`;
    setText(
      where,
      s < SEA_MOMENTS.meet
        ? `${at}. ${sideLine(0)}. ${sideLine(1)}`
        : `${at}. ${seaWords(field, s)}`,
    );
    const stands = Math.max(field.per[0], field.per[1]),
      said = `${a.name}: ${tonnes(t.tons[0])} sunk of ${tonnes(a.tons)}|${b.name}: ${tonnes(t.tons[1])} sunk of ${tonnes(b.tons)}${stands > 1 ? `  ·  a hull drawn stands for ${field.per[0] === field.per[1] ? stands : `${field.per[0]} and ${field.per[1]}`} ships` : ""}`;
    if (tally.dataset.said !== said) {
      tally.dataset.said = said;
      const [first, second] = said.split("|"),
        chip = (c: readonly number[]) => {
          const x = el("span", "street-chip");
          x.style.background = rgb(c);
          return x;
        };
      tally.replaceChildren(chip(a.color), ` ${first}  ·  `, chip(b.color), ` ${second}`);
    }
    // Each flagship's name over her while she is afloat, clear of the caption and of the other's.
    const box = ui.getBoundingClientRect();
    let first: { x: number; y: number; w: number } | null = null;
    flags.forEach((flag, side) => {
      const i = flagHull[side]!,
        n = i >= 0 ? layer!.hullNow(i) : null,
        p = n && n.sunk < 0.6 ? layer!.onScreen(i, field!.hulls[i]!.long * 0.95) : null;
      if (!p || p.y > box.top - 34 || p.y < 30 || p.x < 8 || p.x > innerWidth - 8) {
        flag.hidden = true;
        return;
      }
      flag.hidden = false;
      const w = flag.offsetWidth || 120;
      let x = Math.max(6, Math.min(innerWidth - w - 6, p.x - w / 2)),
        y = p.y - 24;
      if (first && Math.abs(first.y - y) < 24 && x < first.x + first.w + 4 && first.x < x + w + 4)
        y = first.y + (y >= first.y ? 24 : -24);
      if (y + 22 > box.top - 4) y = box.top - 28;
      if (side === 0) first = { x, y, w };
      flag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    });
  };

  const play = async (event: string): Promise<boolean> => {
    const f = await client
      .query<SeaFightNear | null>({ type: "fleet.fight", args: { event } })
      .catch(() => null);
    if (!f) return false;
    stop();
    const my = ++session;
    await d.enter(() => {
      layer ??= new SeaLayer(stage);
      near = f;
      // (On a small or slow device, fewer hulls a side.)
      field = newSeaFight(f, stage.quality.detail >= 1 ? 20 : 14);
      layer.setup(field);
      const tall = innerWidth < innerHeight,
        far = Math.max(18, field.reach * (tall ? 1.7 : 1.1) + 10);
      stage.backdrop("ground", far * 1.6);
      rig.configure({
        distance: far,
        minDistance: 4,
        maxDistance: far * 2.2,
        pitch: tall ? -36 : -26,
        minPitch: -85,
        maxPitch: -6,
        drift: 0,
        // (On a tall screen the caption stands over the foot: the sea's middle is looked at a little past it.)
        target: [0, SEA_UP + 0.3, 0],
      });
      // (On a tall screen: seen along the lines, so both fit.)
      rig.yaw = tall ? 68 : 18;
      rig.follow = null;
    });
    if (my !== session) return false;
    flagHull = [0, 1].map((side) => field!.hulls.findIndex((h) => h.side === side && h.flag)) as [
      number,
      number,
    ];
    flags.forEach((flag, side) => {
      const x = f.sides[side]!;
      flag.textContent = x.flagship
        ? `⚑ the ${x.flagship}${x.led ? ` · ${x.led}` : ""}`
        : (x.led ?? "");
      flag.style.borderLeftColor = rgb(x.color);
      flag.hidden = true;
    });
    s = 0;
    wall = 0;
    heardSmoke = 0;
    heardGone = 0;
    cueAt = 0;
    setSpeed(2);
    time.hold("sea fight");
    // (The sea is framed in what the caption leaves of the screen: on a short one it stands over a third of it.)
    coveredWas ??= rig.covered;
    rig.covered = () => ({
      top: 0,
      bottom: ui.hidden ? 0 : (ui.getBoundingClientRect().height + 30) / Math.max(1, innerHeight),
    });
    document.body.classList.add("filming", "sea-filming");
    ui.hidden = false;
    setText(title, f.title);
    delete tally.dataset.said;
    playing = true;
    draw();
    return true;
  };

  stage.onUpdate((dt) => {
    if (!playing || !field || !layer) return;
    wall += dt;
    const pace = BATTLE_SPEEDS[speed] ?? 0;
    s = Math.min(SEA_LENGTH, s + dt * pace);
    draw();
    if (pace <= 0) return;
    // Its sound: guns as they speak (a few a second at the most), a hull going down.
    const smoke = layer.shown.smoke,
      gone = seaTally(field, s).gone.reduce((a, b) => a + b, 0);
    if (smoke > heardSmoke && wall >= cueAt) {
      sound.cue("gun", 0.4, undefined, { far: 22, pan: ((wall * 7) % 2) - 1 > 0 ? 0.3 : -0.3 });
      cueAt = wall + 0.4;
    }
    if (gone > heardGone) sound.cue("thud", 0.5, undefined, { far: 18, pan: 0 });
    heardSmoke = smoke;
    heardGone = gone;
  });

  return {
    play,
    stop,
    get playing() {
      return playing;
    },
    keys: {
      toggle: () => setSpeed(speed === 0 ? was : 0),
      pick: (i: number) => {
        if (i < 1 || i >= BATTLE_SPEEDS.length) return false;
        setSpeed(i);
        return true;
      },
    },
    seek,
    state() {
      return {
        event: near?.event ?? null,
        s,
        end: SEA_LENGTH,
        speed: BATTLE_SPEEDS[speed] ?? 0,
        drawn: field?.drawn ?? [0, 0],
        down: field?.down ?? [0, 0],
        gone: field ? seaTally(field, s).gone : [0, 0],
        afloat: layer?.shown.afloat ?? 0,
        hulls: layer?.shown.hulls ?? 0,
        sails: layer?.shown.sails ?? 0,
        pennants: layer?.shown.pennants ?? 0,
        flags: flags
          .filter((f) => !f.hidden)
          .map((f) => {
            const r = f.getBoundingClientRect();
            return { text: f.textContent ?? "", x: r.left, y: r.top };
          }),
        words: `${where.textContent ?? ""} | ${tally.textContent ?? ""}`,
      };
    },
  };
}
