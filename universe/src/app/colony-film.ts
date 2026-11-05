// A landing watched (Phase 64, asked for 2026-11-03: "i wanna see the star wars and landing in planets
// and colonization and all that stuff"): a colony's coming played again as a film, whenever it is asked
// for, from what history holds of it. Its ship crosses to it among the worlds (their orbits running by
// so that the world is there when the ship is) or among the stars; its world comes up to meet it; it
// comes down on its engines on that world's own ground under that world's own sky; those aboard come
// out and set up the first pods; the ship goes back up, and the years go by while its halls grow into
// the town that stands there now, drawn as it stood in those years; and the film ends in that town, its
// people about it. The world's clock is held all the while: nothing is changed by watching, and it can
// be skipped at any moment. The eye is the film's: the rig is given it back at the town's first view.
import "./film.css";
import type {
  ClusterPlan,
  ColonyEntry,
  ColonyGrowth,
  ColonyLook,
  ColonyVoyage,
  HostClient,
  SystemPlan,
  VillagePlan,
} from "../bridge/index.ts";
import {
  ShipMark,
  type GlobeScene,
  type OrbitRig,
  type Stage,
  type SystemScene,
  type VillageScene,
} from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  LY_SCALE,
  bodySize,
  colonyHour,
  colonySky,
  crossingShare,
  descentAt,
  filmShots,
  filmWords,
  growthAt,
  remadeLook,
  remakingAt,
  systemSpec,
  transferAt,
  type FilmStage,
} from "../view/index.ts";

const DAY = 86_400,
  YEAR = 365 * DAY,
  /** How many years of a town's growth are read as it stood. */
  GROWTH_FRAMES = 16;

type Point = { readonly x: number; readonly y: number; readonly z: number };

export type ColonyFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly world: GlobeScene;
  readonly sky: SystemScene;
  /** The world's moment. */
  readonly now: () => number;
  /** To each scale, from wherever the eye is (every other put away). */
  readonly toSystem: () => Promise<SystemPlan>;
  readonly toStars: () => Promise<ClusterPlan>;
  readonly toWorld: (entry: ColonyEntry) => Promise<void>;
  readonly toTown: (cell: number, ref: string) => Promise<void>;
  /** A cut from one scale to another, its readying told. */
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  /** The system's clock while its crossing is filmed (seconds; null: the world's). */
  readonly skyAt: (t: number | null) => void;
  /** The town shown. */
  readonly plan: () => VillagePlan | null;
  /** The eye taken from free roam. */
  readonly toOrbit: () => void;
};

export type ColonyFilm = {
  /** Play a colony's landing (false: it has none to play: a ship still sailing, a land with no ground). */
  play(cell: number): Promise<boolean>;
  /** On to its end. */
  skip(): void;
  /** Whether its town is put away just now (nothing of it is drawn or moved). */
  readonly townAway: boolean;
  readonly playing: boolean;
  /** The look tools: what it is showing. */
  state(): {
    stage: FilmStage | null;
    k: number;
    year: number;
    words: string;
    growth: number;
    /** How far its world's remaking is drawn (below 0: its world as it stands). */
    remade: number;
  };
};

/** One shot: how it starts, what it shows at each moment. */
type Shot = {
  readonly stage: FilmStage;
  readonly seconds: number;
  /** Made ready (behind a cut, if it wants one). */
  readonly enter: () => Promise<void>;
  readonly cuts: string | null;
  readonly frame: (k: number, dt: number, wall: number) => void;
};

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function installColonyFilm(d: ColonyFilmDeps): ColonyFilm {
  const { stage, rig, village, client, time } = d,
    ui = document.createElement("div"),
    yearBox = document.createElement("div"),
    words = document.createElement("div"),
    skipButton = document.createElement("button");
  ui.className = "colony-film";
  ui.hidden = true;
  yearBox.className = "film-year";
  words.className = "film-words";
  skipButton.className = "film-skip";
  skipButton.textContent = "Skip ›";
  skipButton.setAttribute("aria-label", "Skip to the town as it stands now");
  ui.append(yearBox, skipButton, words);
  d.hud.append(ui);
  let ship: ShipMark | null = null;
  let playing = false,
    townAway = false,
    /** The shot running, how far through (seconds), its end told. */
    shot: Shot | null = null,
    shotT = 0,
    shotEnd: (() => void) | null = null,
    wall = 0,
    skipped = false,
    year = 0,
    growthShown = -1,
    /** How far its world's remaking is drawn, in twentieths (-1: its world as it stands now). */
    remadeShown = -1;

  /** Its world's ground and sky as they stood at a share of its remaking (Phase 66). */
  const showRemade = (look: ColonyLook, share: number) => {
    const step = Math.round(share * 20);
    if (step === remadeShown) return;
    remadeShown = step;
    const as = remadeLook(look, step / 20);
    village.colonyAs(as);
    stage.colonySky(colonySky(as));
  };
  const say = (y: number, text: string) => {
    year = y;
    yearBox.textContent = `YEAR ${Math.floor(y)}`;
    words.textContent = text;
  };
  const view = (e: Point, at: Point) => {
    stage.camera.setPosition(e.x, e.y, e.z);
    stage.camera.lookAt(at.x, at.y, at.z);
  };
  stage.onUpdate((dt) => {
    if (!playing || !shot) return;
    shotT += dt;
    wall += dt;
    const k = clamp01(shotT / shot.seconds);
    shot.frame(k, dt, wall);
    if (k >= 1 && shotEnd) {
      const end = shotEnd;
      shotEnd = null;
      end();
    }
  });

  /** The shots of a colony's film. */
  const shotsOf = (
    entry: ColonyEntry,
    look: ColonyLook,
    voyage: ColonyVoyage,
    nowYear: number,
  ): Shot[] => {
    const ref = entry.town!,
      times = filmShots(nowYear - look.founded),
      seconds = (s: FilmStage) => times.find((x) => x.stage === s)!.seconds,
      text = (s: FilmStage) => filmWords(s, look, voyage, entry.founder);
    // The way it comes down by, and the eye before it: toward what hangs in its sky (else across its
    // star's light), set once its ground is drawn.
    let way = { x: 0, z: 1 },
      growth: ColonyGrowth = [],
      pose = { e: { x: 0, y: 8, z: 60 } as Point, at: { x: 0, y: 0, z: 0 } as Point },
      lastAngle = 0;
    const crossing: Shot =
      voyage.kind === "star"
        ? (() => {
            let to: Point = { x: 1, y: 0, z: 1 },
              span = 1;
            return {
              stage: "crossing",
              seconds: seconds("crossing"),
              cuts: "the stars about us",
              enter: async () => {
                const plan = await d.toStars(),
                  star = plan.stars.find((s) => s.ref === voyage.star);
                to = star
                  ? { x: star.x * LY_SCALE, y: star.z * LY_SCALE, z: star.y * LY_SCALE }
                  : { x: 4, y: 0, z: 4 };
                span = Math.hypot(to.x, to.y, to.z) || 1;
                say(voyage.departed, text("crossing"));
                ship!.visible = true;
              },
              frame: (k, dt) => {
                const share = crossingShare(k),
                  p = { x: to.x * share, y: to.y * share, z: to.z * share },
                  far = 3.4 + Math.max(2.4, span * 0.8) * Math.sin(Math.PI * k),
                  a = 0.7 + k * 0.7;
                ship!.at(p.x, p.y, p.z, to.x, to.y, to.z, 0.05 * Math.pow(far, 0.7), 1, dt);
                view(
                  {
                    x: p.x + far * 0.82 * Math.sin(a),
                    y: p.y + far * 0.5,
                    z: p.z + far * 0.82 * Math.cos(a),
                  },
                  p,
                );
                say(lerp(voyage.departed, voyage.arrives, share), text("crossing"));
              },
            } satisfies Shot;
          })()
        : (() => {
            const tEnd = look.founded * YEAR,
              tStart = tEnd - voyage.days * DAY;
            let a = { x: 0, z: 0 },
              b = { x: 1, z: 1 },
              near = 1.2,
              span = 1;
            return {
              stage: "crossing",
              seconds: seconds("crossing"),
              cuts: "the sky",
              enter: async () => {
                const plan = await d.toSystem(),
                  index = voyage.body ?? 1,
                  start = systemSpec(plan, tStart)[0]!,
                  end = systemSpec(plan, tEnd)[index]!;
                a = { x: start.x, z: start.z };
                b = { x: end.x, z: end.z };
                span = Math.hypot(a.x - b.x, a.z - b.z);
                near = Math.max(0.9, bodySize(plan.bodies[index]!) * 7);
                d.sky.mark(index);
                d.skyAt(tStart);
                ship!.visible = true;
                say(look.founded - voyage.days / 365, text("crossing"));
              },
              frame: (k, dt) => {
                const share = crossingShare(k);
                d.skyAt(lerp(tStart, tEnd, share));
                const p = transferAt(a.x, a.z, b.x, b.z, share),
                  q = transferAt(a.x, a.z, b.x, b.z, Math.min(1, share + 0.005)),
                  // (Close by the home world, drawn back to see its way among the worlds, close on the other.)
                  far =
                    lerp(1.1, near, k) +
                    Math.max(2.6, span * 0.95) * Math.pow(Math.sin(Math.PI * k), 1.1),
                  turn = 0.5 + k * 1.1;
                ship!.at(
                  p.x,
                  p.y,
                  p.z,
                  q.x - p.x,
                  q.y - p.y,
                  q.z - p.z,
                  0.055 * Math.pow(far, 0.7),
                  k < 0.92 ? 1 : (1 - k) / 0.08,
                  dt,
                );
                view(
                  {
                    x: p.x + far * 0.76 * Math.sin(turn),
                    y: p.y + far * 0.62,
                    z: p.z + far * 0.76 * Math.cos(turn),
                  },
                  p,
                );
                say(lerp(look.founded - voyage.days / 365, look.founded, share), text("crossing"));
              },
            } satisfies Shot;
          })();
    const arrival: Shot = (() => {
      let site: Point = { x: 0, y: 0, z: 1 },
        side: Point = { x: 1, y: 0, z: 0 };
      return {
        stage: "arrival",
        seconds: seconds("arrival"),
        cuts: "that world",
        enter: async () => {
          d.skyAt(null);
          await d.toWorld(entry);
          // (As it was when they came: none of the halls of those who came after.)
          d.world.setHalls([]);
          site = d.world.wayOf(Math.max(0, look.hall));
          const l = Math.hypot(site.z, site.x) || 1;
          side = { x: site.z / l, y: 0, z: -site.x / l };
          say(look.founded, text("arrival"));
        },
        frame: (k, dt) => {
          const e = ease(k),
            off = 1 - e,
            dir = {
              x: site.x + side.x * off * 0.9,
              y: site.y + 0.25 * off,
              z: site.z + side.z * off * 0.9,
            },
            l = Math.hypot(dir.x, dir.y, dir.z) || 1,
            far = lerp(4.6, 1.34, e),
            high = 1 + 0.9 * Math.pow(1 - k, 1.6),
            across = 0.8 * (1 - k) * (1 - k),
            p = {
              x: site.x * high + side.x * across,
              y: site.y * high,
              z: site.z * high + side.z * across,
            };
          ship!.at(
            p.x,
            p.y,
            p.z,
            site.x - p.x,
            site.y - p.y,
            site.z - p.z,
            lerp(0.05, 0.012, e),
            1,
            dt,
          );
          view(
            { x: (dir.x / l) * far, y: (dir.y / l) * far, z: (dir.z / l) * far },
            { x: site.x * 0.55 * e, y: site.y * 0.55 * e, z: site.z * 0.55 * e },
          );
        },
      } satisfies Shot;
    })();
    const descent: Shot = {
      stage: "descent",
      seconds: seconds("descent"),
      cuts: "its ground",
      enter: async () => {
        ship!.visible = false;
        await d.toTown(entry.cell, ref);
        townAway = true;
        village.groundOnly();
        // (The world its first ship found, not what its people have made of it since.)
        if (look.remaking) showRemade(look, look.remade ?? 0);
        village.colony.landed();
        stage.daylight(colonyHour(look, 0));
        // What the town's first view is, for the film to end at.
        const y = (rig.yaw * Math.PI) / 180,
          p = (rig.pitch * Math.PI) / 180,
          t = { x: rig.target.x, y: rig.target.y, z: rig.target.z },
          dist = rig.distance;
        pose = {
          e: {
            x: t.x + dist * Math.cos(p) * Math.sin(y),
            y: t.y - dist * Math.sin(p),
            z: t.z + dist * Math.cos(p) * Math.cos(y),
          },
          at: t,
        };
        const hang = village.colony.hanging ?? stage.starWay,
          flat = hang ? Math.hypot(hang.x, hang.z) || 1 : 1;
        way = hang ? { x: hang.x / flat, z: hang.z / flat } : { x: 0, z: 1 };
        lastAngle = Math.atan2(-way.x, -way.z);
        // Its town as it stood, year by year: asked once its plan says how it lies.
        const town = d.plan()?.town;
        if (town)
          growth = await client.query<ColonyGrowth>({
            type: "colony.growth",
            args: {
              cell: entry.cell,
              frames: GROWTH_FRAMES,
              axis: town.axis,
              most: town.lots,
            },
          });
        say(look.founded, text("descent"));
      },
      frame: (k, dt, w) => {
        const f = descentAt(k);
        village.colony.landing(way.x, way.z, f.high, f.short, f.burn, f.lean, w, dt);
        // (From beside its pad, up at it as it comes; down with it to its ground, the sky over its hills.)
        const low = ease(clamp01((k - 0.25) / 0.6)),
          near = f.high < 8 ? (1 - f.high / 8) * f.burn : 0,
          shake = 0.05 * near * Math.sin(w * 47);
        view(
          { x: -way.x * 25 + shake, y: 1.7 + shake, z: -way.z * 25 },
          {
            x: lerp(way.x * f.short, 0, low),
            y: lerp(f.high + 2, 3.4, low),
            z: lerp(way.z * f.short, 0, low),
          },
        );
      },
    };
    const first: Shot = {
      stage: "first",
      seconds: seconds("first"),
      cuts: null,
      enter: async () => {
        say(look.founded, text("first"));
      },
      frame: (k, dt, w) => {
        village.colony.landing(way.x, way.z, 0, 0, 0, 0, w, dt);
        village.colony.settlers(k, w);
        const n = Math.max(0, (k - 0.3) / 0.7) * 11;
        village.colony.camp(n, n - Math.floor(n));
        const a = Math.atan2(-way.x, -way.z) + 0.55 * ease(k),
          r = lerp(25, 17, ease(k));
        lastAngle = a;
        view(
          { x: Math.sin(a) * r, y: lerp(1.7, 3.2, k), z: Math.cos(a) * r },
          { x: 0, y: lerp(3.4, 1.3, ease(k)), z: 0 },
        );
      },
    };
    let years: number[] = [];
    const grown: Shot = {
      stage: "growth",
      seconds: seconds("growth"),
      cuts: null,
      enter: async () => {
        growthShown = -1;
        // (Up to the year the world stands in, its last frame the town as it stands.)
        years = growth.map((f, i) => (i === growth.length - 1 ? nowYear : f.year));
        say(look.founded, text("growth"));
      },
      frame: (k, dt, w) => {
        // Its ship goes back up, and only then is the first hall seen where it stood.
        const up = clamp01(k / 0.12);
        if (up < 1) {
          village.colony.landing(way.x, way.z, 170 * up * up, 0, 1, 0, w, dt);
        } else village.colony.landerGone();
        const { frame: i, year: at } = growthAt(years, clamp01((k - 0.06) / 0.94));
        if (k > 0.06) {
          if (i !== growthShown && growth[i]) {
            growthShown = i;
            village.growth(growth[i]!.town, ref, growth[i]!.year * YEAR);
            if (i >= 1) village.colony.campGone();
          }
          if (Math.floor(w * 6) !== Math.floor((w - dt) * 6)) village.growthAt(at * YEAR);
          // (Its world remade about them, over the years it went on: its air, its warmth, its green.)
          const share = look.remaking ? remakingAt(look.remaking, at) : 0;
          if (look.remaking) showRemade(look, share);
          const g = growth[Math.max(0, growthShown)],
            as = share > 0 ? remadeLook(look, share) : null;
          if (g && k > 0.12)
            say(
              at,
              `${g.people.toLocaleString("en")} people; ${g.homes.toLocaleString("en")} halls and homes.${
                !as
                  ? ""
                  : share >= 1
                    ? " Its world remade: its air breathed open."
                    : ` Its world being remade: ${as.pressure.toFixed(2)} bar, ${Math.round(as.temperature)} °C.`
              }`,
            );
          else say(at, text("growth"));
        }
        // The eye drawn back from where it stood to the town's first view.
        const e = ease(k),
          from = lastAngle,
          to = Math.atan2(pose.e.x - pose.at.x, pose.e.z - pose.at.z);
        let turn = to - from;
        while (turn > Math.PI) turn -= 2 * Math.PI;
        while (turn < -Math.PI) turn += 2 * Math.PI;
        const a = from + turn * e,
          r = lerp(17, Math.hypot(pose.e.x - pose.at.x, pose.e.z - pose.at.z), e);
        view(
          {
            x: lerp(0, pose.at.x, e) + Math.sin(a) * r,
            y: lerp(3.2, pose.e.y, e),
            z: lerp(0, pose.at.z, e) + Math.cos(a) * r,
          },
          { x: pose.at.x * e, y: lerp(1.3, pose.at.y, e), z: pose.at.z * e },
        );
      },
    };
    return [crossing, arrival, descent, first, grown];
  };

  /** The film over, by its end or a skip: its town as it stands, the eye the rig's, the clock free. */
  const finish = (entry: ColonyEntry) => {
    ship!.visible = false;
    d.skyAt(null);
    village.growth(undefined, "", 0);
    // (Its world as it stands now.)
    const stands = d.plan()?.colony;
    if (remadeShown >= 0 && stands) {
      village.colonyAs(stands);
      stage.colonySky(colonySky(stands));
    }
    remadeShown = -1;
    village.colony.landed();
    townAway = false;
    shot = null;
    shotEnd = null;
    // (Where a skip came before its ground was reached: the town's own first view.)
    if (d.plan()?.ref === entry.town) village.visible = true;
    rig.enabled = true;
    rig.halt();
    time.release("film");
    ui.hidden = true;
    document.body.classList.remove("filming");
    playing = false;
  };

  skipButton.onclick = () => film.skip();
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") film.skip();
  });

  const film: ColonyFilm = {
    get playing() {
      return playing;
    },
    get townAway() {
      return townAway;
    },
    state: () => ({
      stage: shot?.stage ?? null,
      k: shot ? clamp01(shotT / shot.seconds) : 0,
      year,
      words: words.textContent ?? "",
      growth: growthShown,
      remade: remadeShown / 20,
    }),
    skip() {
      if (!playing) return;
      skipped = true;
      if (shotEnd) {
        const end = shotEnd;
        shotEnd = null;
        end();
      }
    },
    async play(cell) {
      if (playing) return false;
      const [list, told] = await Promise.all([
          client.query<ColonyEntry[]>({ type: "colony.list" }),
          client.query<{ look: ColonyLook | null; voyage: ColonyVoyage | null }>({
            type: "colony.look",
            args: { cell, landing: true },
          }),
        ]),
        entry = list.find((c) => c.cell === cell);
      if (!entry?.town || !told.look || !told.voyage) return false;
      ship ??= new ShipMark(stage);
      playing = true;
      skipped = false;
      townAway = false;
      wall = 0;
      growthShown = -1;
      d.toOrbit();
      time.hold("film");
      rig.enabled = false;
      document.body.classList.add("filming");
      ui.hidden = false;
      say(told.look.founded, "");
      try {
        const shots = shotsOf(entry, told.look, told.voyage, Math.floor(d.now() / YEAR));
        for (const s of shots) {
          if (skipped) break;
          const enter = s.enter;
          if (s.cuts) await d.cut(s.cuts, enter);
          else await enter();
          if (skipped) break;
          shot = s;
          shotT = 0;
          await new Promise<void>((done) => {
            shotEnd = done;
          });
        }
        // (Skipped before its ground was come to: straight there.)
        if (d.plan()?.ref !== entry.town)
          await d.cut("its ground", () => d.toTown(entry.cell, entry.town!));
      } catch {
        // (A shot that could not be shown: on to its town if that can be, and whatever else, the
        // eye, the clock and the chrome given back below.)
        await Promise.resolve(d.toTown(entry.cell, entry.town!)).catch(() => undefined);
      } finally {
        finish(entry);
      }
      return true;
    },
  };
  return film;
}
