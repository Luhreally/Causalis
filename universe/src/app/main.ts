// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run a universe, draw it with PlayCanvas and put the observatory over
// it. ?universe=earth (the default), alien or sandbox; ?seed=…; ?bench=N runs the
// instancing benchmark instead.
import "./styles.css";
import "./y2k.css";
import { HostClient, inlinePair, workerPort } from "../bridge/index.ts";
import {
  FreeRig,
  GlobeScene,
  GlobeTowns,
  GlobeWars,
  OrbitRig,
  RegionScene,
  RegionWars,
  SandboxScene,
  Stage,
  SystemScene,
  ClusterScene,
  VILLAGE_METRE,
  GalaxyScene,
  galaxyMaterial,
  skyMaterials,
  VillageScene,
  AutoQuality,
  QUALITIES,
  QUALITY_NAMES,
  regionMaterials,
  runBench,
  type GlobeTown,
  type QualityName,
} from "../render/index.ts";
import {
  LabelLayer,
  type Label,
  Tidings,
  PlanetPanel,
  RegionPanel,
  SandboxPanel,
  SystemPanel,
  ClusterPanel,
  VillagePanel,
  WorldPanel,
  GalaxyPanel,
  GuidedWalk,
  FreeControls,
  MapLabels,
  MapModes,
  type FreeMode,
  Outliner,
  SearchBox,
  Tooltip,
  PageWindow,
  Alerts,
  ArmsBook,
  EventWindows,
  isGreat,
  HoverTips,
  LogButton,
  type MapName,
  type PeopleEntry,
  type WorldStats,
} from "../ui/index.ts";
import type {
  ClusterPlan,
  SkyState,
  SystemPlan,
  VillagePlan,
  WorldGlobe,
  GalaxyPlan,
  PageModel,
  Place,
  StarPage,
  WarsMap,
} from "../bridge/index.ts";
import { nearestCell, sphereGrid } from "../kernel/index.ts";

import {
  cellAt,
  cellCenter,
  globeColors,
  regionColors,
  regionFromGlobe,
  regionHeights,
  regionTrees,
  SIGNS,
  keepOut,
  orbitOf,
  villageGround,
  type FreeRules,
  type FreeState,
  battleFront,
  counterWords,
  LY_SCALE,
  hallCells,
  hallDomes,
  landWars,
  warPaths,
  sandboxSpec,
  skyMarks,
  voyageMarks,
  systemExtent,
  systemSpec,
  worldColors,
  lyFromHome,
  homeOf,
  nameShape,
  namesThatFit,
  withinName,
  LENS_NAMES,
  STANDING_COLORS,
  WAR_COLORS,
  type Lens,
  type NameShape,
  type RegionLens,
  type SandboxSpec,
} from "../view/index.ts";

/** A point along a name's line: `d` radians from its centre, on the unit sphere. */
function rim(s: NameShape, d: number): { x: number; y: number; z: number } {
  const c = Math.cos(d),
    n = Math.sin(d);
  return { x: s.x * c + s.ax * n, y: s.y * c + s.ay * n, z: s.z * c + s.az * n };
}
import { deviceTier } from "./tier.ts";

const DAY = 86_400;
/** How fast time runs while the star's system is shown: a month a second, so the worlds can be watched going round. */
const SKY_SPEED = 30 * DAY;
/** What the hand's people do, in words. */
const WORK_WORDS = [
  "a child",
  "a forager",
  "a farmer",
  "a herder",
  "a crafter",
  "a trader",
  "a leader",
];
/** Watching a village starts at an hour a second: a day goes by in 24 seconds. */
const WATCH_DEFAULT = 3600;
const YEAR = 365 * DAY;
const SKY = [0.09, 0.1, 0.13] as const;
const SPACE = [0.02, 0.025, 0.045] as const;

const params = new URLSearchParams(location.search);
const seed = params.get("seed") ?? "first light";
const inline = params.has("inline");
const bench = Number(params.get("bench") ?? 0);
const universe = params.get("universe") ?? "earth";
const startYear = Number(params.get("year") ?? 0);
/** A save to take up on starting (the saves page opens another world's save this way). */
const loadName = params.get("load");
/** ?signs=0 keeps what people say unshown (for measuring). */
const signs = params.get("signs") !== "0";

type Exposed = {
  client?: HostClient;
  mode?: string;
  seed?: string;
  universe?: string;
  /** How much is drawn: figures in the sandbox, painted cells on a globe. */
  drawn?: () => number;
  select?: (cell: number) => void;
  /** Go down from the globe to the region around a cell. */
  descend?: (cell: number) => void;
  /** How many villages the region on screen shows. */
  villages?: () => number;
  /** Watch a village through the microscope; how many people are watched. */
  watch?: (ref: string) => void;
  watching?: () => number;
  /** Out to the home star's system; how many of its bodies are shown. */
  sky?: () => void;
  skyBodies?: () => number;
  /** Out to the stars around; how many are shown. */
  stars?: () => void;
  starCount?: () => number;
  bench?: unknown;
  /** The guided walk's step (from 0), or -1 when it is not showing. */
  walk?: () => number;
  /** The quality the world is drawn at now, and a choice of it (as the settings make it). */
  quality?: () => string;
  setQuality?: (choice: string) => void;
  /** Why the page could not start, if it could not ("webgl" when 3D is unavailable). */
  error?: string;
  /** The PlayCanvas stage, for debugging tools. */
  stage?: Stage;
  /** Beasts, birds and fish drawn about the village watched (0 elsewhere), and each beast now. */
  beasts?: () => number;
  faunaNow?: () => {
    name: string;
    niche: string;
    x: number;
    y: number;
    z: number;
    doing: string;
  }[];
  /** Hold the beasts' clock at a screen time (seconds), or run it again (null). */
  holdFauna?: (s: number | null) => void;
  /** Down to another star's world (its star's ref, its place outward). */
  visitForeign?: (ref: string, index: number) => Promise<void>;
  /** Out to the galaxy, how many of its stars are drawn, and a tap on it (screen px). */
  galaxy?: () => void;
  galaxyStars?: () => number;
  tapGalaxy?: (x: number, y: number) => void;
  /** Down to a world of the system (by its index), and which world is seen now (-1 none). */
  visit?: (index: number) => void;
  visiting?: () => number;
  /** How many halls stand on the world seen whole (M95: halls from orbit). */
  hallsShown?: () => number;
  /** Whether a great happening's window is open (M100). */
  eventOpen?: () => boolean;
  /** Into another star's own system (M95), by its ref; and whose system the sky shows. */
  starSystem?: (ref: string) => void;
  /** Where a star about us stands on the screen, while the stars are shown. */
  starOnScreen?: (ref: string) => { x: number; y: number } | null;
  skyOf?: () => string | null;
  /** Everyone carrying something in the village watched: where and what. */
  carriersNow?: () => { x: number; z: number; carry: string }[];
  /** The marks of war drawn on the globe now (for the look tools). */
  warsDrawn?: () => number;
  /** The hosts and battles a land's map shows of the wars (M95), and whether the wars are known. */
  landWars?: () => { marches: number; battles: number; ships: number; known: boolean };
  spotOnScreen?: (spot: number) => { x: number; y: number } | null;
  faceBattle?: () => boolean;
  /** How the camera is steered now (M98): the orbit's, or free — flying or walking. */
  roaming?: () => string;
  spotBelow?: () => {
    spot: number;
    province: number;
    peopled: boolean;
    near: { spot: number; cell: number } | null;
    land: number;
    map: number | null;
  } | null;
  /** Where the free camera stands and looks, and whether it is passing between scales (M98). */
  freeState?: () => {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    passing: boolean;
  };
  /** The thing under a point of the screen, at the scale shown (M93). */
  refAt?: (x: number, y: number) => string | null;
  /** Turn the globe to a spot of its fine grid, from so far off (for the look tools). */
  faceSpot?: (spot: number, distance?: number) => void;
  /** Zoom on through to the next scale in or out, and which scale is shown (M88, for the look tools). */
  zoomThrough?: (way: "in" | "out") => Promise<void>;
  /** Open a thing's page (Phase 10 M92), and the page open now. */
  open?: (ref: string) => Promise<void>;
  pageOpen?: () => string | null;
  /** Go to where a thing is to be seen. */
  goTo?: (ref: string) => Promise<void>;
  scale?: () => string;
  /** Everyone in sight now, and what they are at (for the look tools). */
  peopleNow?: () => {
    name: string;
    x: number;
    z: number;
    activity: number;
    task: string | null;
    size: number;
  }[];
  /** What the people in view are saying now, in signs (for the look tools). */
  bubblesNow?: () => { key: string; text: string; at: { x: number; y: number } | null }[];
  /** The camera's rig, for the look tools. */
  rig?: OrbitRig;
};
const exposed: Exposed = {};
(globalThis as { causalis?: Exposed }).causalis = exposed;

async function connect(): Promise<{ client: HostClient; mode: string }> {
  if (!inline && typeof Worker !== "undefined") {
    try {
      const worker = new Worker(new URL("../host/worker.ts", import.meta.url), { type: "module" });
      return { client: new HostClient(workerPort(worker)), mode: "worker" };
    } catch {
      // Fall through to the in-thread host.
    }
  }
  const { SimHost, UNIVERSES, IndexedDbByteStore } = await import("../host/index.ts");
  const [page, hostEnd] = inlinePair();
  let storage: InstanceType<typeof IndexedDbByteStore> | undefined;
  try {
    storage = typeof indexedDB === "undefined" ? undefined : new IndexedDbByteStore();
  } catch {
    // Storage refused (a private window): the world runs, unsaved.
  }
  const host = new SimHost(hostEnd, UNIVERSES, {
    clock: () => performance.now(),
    budgetMs: 6,
    ...(storage ? { storage } : {}),
  });
  const loop = async () => {
    await host.pump();
    requestAnimationFrame(() => void loop());
  };
  void loop();
  return { client: new HostClient(page), mode: "in-thread" };
}

function page(): { canvas: HTMLCanvasElement; hud: HTMLElement } {
  const app = document.getElementById("app")!;
  const canvas = document.createElement("canvas");
  canvas.id = "world";
  const hud = document.createElement("div");
  hud.id = "hud";
  app.replaceChildren(canvas, hud);
  return { canvas, hud };
}

async function runBenchPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SKY);
  stage.backdrop("ground", Math.sqrt(bench) * 0.4);
  new OrbitRig(stage, canvas, {
    distance: Math.sqrt(bench) * 0.28 * 1.4,
    minDistance: 2,
    maxDistance: 200,
    pitch: -35,
    onTap: () => {},
  });
  hud.innerHTML = `<header class="bar"><strong class="brand">Instancing benchmark</strong><span class="clock">${bench.toLocaleString()} moving figures · measuring…</span></header>`;
  const result = await runBench(stage, bench);
  exposed.bench = { ...result, tier: tier.name, pixelRatio: stage.device.maxPixelRatio };
  hud.querySelector(".clock")!.textContent =
    `${bench.toLocaleString()} moving figures · ${result.fps.toFixed(1)} fps (${result.frameMs.toFixed(1)} ms a frame) · ${tier.name}`;
}

async function runSandboxPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SKY),
    scene = new SandboxScene(stage, tier);
  stage.backdrop("ground", 30);
  const { client, mode } = await connect();
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => scene.figures(), stage });
  await client.start("sandbox", seed);
  const speed = 30 * DAY;
  client.setSpeed(speed);
  client.setInterest({ view: "ring", focus: null });

  let spec: SandboxSpec | null = null;
  const panel = new SandboxPanel(hud, client, speed);
  const select = (cell: number | null) => {
    panel.select(cell);
    scene.select(
      cell === null
        ? null
        : (() => {
            const [x, z] = cellCenter(cell, spec?.cells.length ?? 16);
            return { x, z };
          })(),
    );
  };
  panel.onClose = () => scene.select(null);
  exposed.select = (cell: number) => select(cell);
  // Fit the ring to the screen: a portrait phone needs the camera further back.
  // Refit when the window turns, unless the viewer has zoomed by hand.
  const fit = () => {
    const aspect = Math.max(0.3, innerWidth / Math.max(1, innerHeight));
    return aspect < 1 ? 26 / aspect : 30;
  };
  const rig = new OrbitRig(stage, canvas, {
    distance: fit(),
    minDistance: 8,
    maxDistance: 110,
    pitch: -42,
    onTap: (x, y) => {
      const p = stage.groundPoint(x, y);
      select(p ? cellAt(p.x, p.z, spec?.cells.length ?? 16) : null);
    },
  });
  addEventListener("resize", () => {
    if (!rig.userZoomed) rig.distance = fit();
  });
  client.onFrame((frame) => {
    if (frame.view !== "ring") return;
    spec = sandboxSpec(frame, tier.crowdCap);
    scene.apply(spec);
  });
}

type Village = { ref: string; name: string; tile: number; population: number; founded: number };

async function runPlanetPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SPACE),
    globe = new GlobeScene(stage),
    region = new RegionScene(stage),
    village = new VillageScene(stage),
    skyScene = new SystemScene(stage),
    starScene = new ClusterScene(stage),
    // Another world of the system, seen whole (M81); the whole galaxy (M80).
    worldScene = new GlobeScene(stage),
    galaxyScene = new GalaxyScene(stage);
  stage.backdrop("space");
  // While the world is made, the shaders of the scales below are readied, so the first
  // "Look closer" draws at once.
  // (With the sun casting shadows: a village drawn at High casts them from its first frame.)
  stage.warm(
    [...regionMaterials(stage), ...skyMaterials(stage), { material: galaxyMaterial() }],
    true,
  );
  const { client, mode } = await connect();
  let painted = 0,
    scale: "globe" | "region" | "village" | "system" | "cluster" | "world" | "galaxy" = "globe",
    clusterPlan: ClusterPlan | null = null,
    systemPlan: SystemPlan | null = null,
    // The system the sky shows (the home star's, or another's, M95), which the sky's scene
    // holds built, and the star it is of when another's.
    skyPlan: SystemPlan | null = null,
    skyBuilt = "",
    skyStar: StarPage | null = null;
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => painted, stage });
  await client.start(universe, seed);
  // ?load=name takes up a save; ?year=N starts the world N years on (it runs there
  // first; history is the same).
  const loaded = loadName ? await client.load(loadName).catch(() => null) : null;
  if (!loaded && startYear > 0) await client.advance(startYear * YEAR);
  client.setInterest({ view: "globe", focus: null });
  const speed = YEAR;
  client.setSpeed(speed);
  let lens: Lens = "terrain",
    regionLens: RegionLens = "land",
    density = new Map<number, number>(),
    foodPrices = new Map<number, number>(),
    trade = new Map<number, number>(),
    tongues = new Map<number, readonly [number, number, number]>(),
    realms = new Map<number, readonly [number, number, number]>(),
    faiths = new Map<number, readonly [number, number, number]>(),
    villages: Village[] = [],
    regionCell = -1,
    stopVillages: (() => void) | null = null;
  const planetPanel = new PlanetPanel(hud, client, speed),
    regionPanel = new RegionPanel(hud, client),
    villagePanel = new VillagePanel(hud, client),
    labels = new LabelLayer(hud),
    // What the people in view are saying, in signs over their heads (M86).
    bubbles = new LabelLayer(hud, "bubble"),
    tidings = new Tidings(hud, client),
    // Every thing's page, in one window (Phase 10 M92).
    pageWindow = new PageWindow(hud, client);
  // (Set once the scales are made: what a page is of, lit in the scene.)
  let pointAt: (page: PageModel) => void = () => {};
  planetPanel.tidings = regionPanel.tidings = villagePanel.tidings = tidings;
  pageWindow.tidings = tidings;
  // The tooltips that tell of a name or break a number down, on a desk (Phase 10 M97): a name
  // in one tells of its thing in turn, and a click on it opens its page.
  const hoverTips = new HoverTips(hud, client);
  hoverTips.onOpen = (ref) => void pageWindow.open(ref);
  pageWindow.hoverTips = planetPanel.hoverTips = hoverTips;
  // Realms' arms (Phase 11 M102): asked once each, borne beside their names everywhere.
  const armsBook = new ArmsBook(client);
  pageWindow.arms = hoverTips.arms = labels.arms = armsBook;
  // What is followed (its counters are "ours", and those that fight it its foes', M101).
  let followedRefs = new Set<string>();
  // The corner's tools under the bar (Phase 10 M96): the alerts, search for anything by name,
  // the outliner of what is followed and the message log; free roam's controls join them.
  const corner = document.createElement("div");
  corner.className = "corner-tools";
  hud.append(corner);
  const alerts = new Alerts(corner, client, hoverTips),
    searchBox = new SearchBox(corner, client),
    outliner = new Outliner(corner),
    logButton = new LogButton(corner);
  outliner.arms = searchBox.arms = armsBook;
  alerts.onOpen = (ref) => void pageWindow.open(ref);
  searchBox.onOpen = (ref) => void pageWindow.open(ref);
  outliner.onOpen = (ref) => void pageWindow.open(ref);
  outliner.onLetGo = (ref) => void tidings.unfollow(ref);
  tidings.onFollowed = (followed) => {
    outliner.set(followed);
    followedRefs = new Set(followed.map((f) => f.ref));
  };
  logButton.onOpen = () => void pageWindow.open("world:log");
  tidings.onTold = (n) => logButton.told(n);
  // Great happenings told in windows (Phase 11 M100), answered by the god's hand where it can:
  // or as cards, or not at all, as the viewer chooses.
  const events = new EventWindows(
    hud,
    client,
    // (Not in the way of a machine driving the page, unless it asks: ?events.)
    !!(navigator as { webdriver?: boolean }).webdriver && !params.has("events"),
  );
  events.onOpen = (ref) => void pageWindow.open(ref);
  events.onGoTo = async (ref) => {
    const place = await client.query<Place | null>({ type: "place", args: { ref } });
    if (place) await goTo(place);
  };
  tidings.onGreat = (t) => {
    if (!isGreat(t) || events.mode === "card") return false;
    if (events.mode === "window") events.tell(t);
    return true;
  };
  exposed.eventOpen = () => events.open;
  // (The world's own pages — its chronicle, saves, settings — open in its panel instead.)
  planetPanel.onWorldPage = () => pageWindow.close();
  // The world's chronicle and its ledger (Phase 10 M96b): pages of the window like any other.
  planetPanel.onChronicle = () => void pageWindow.open("world:chronicle");
  planetPanel.onLedger = () => void pageWindow.open("world:ledger");
  planetPanel.onConcepts = () => void pageWindow.open("concept:index");
  planetPanel.onChip = (what) => {
    if (what === "hungry") {
      // (The hungry are shown on the map: the food lens.)
      planetPanel.onLens("food");
      return;
    }
    const at: Record<string, string> = {
      people: "world:chronicle#story",
      towns: "world:ledger#towns",
      realms: "world:ledger#realms",
      wars: "world:ledger#wars",
      faiths: "world:ledger#faiths",
      tongues: "world:ledger#tongues",
      colonies: "world:ledger#sky",
    };
    void pageWindow.open(at[what] ?? "world:ledger");
  };
  // While a page is open the scales' own windows stand aside (their sheets would cover it).
  pageWindow.onOpen = (page) => {
    if (page.kind === "log") logButton.read();
    document.body.classList.add("paging");
    markBarBottom();
    pointAt(page);
  };
  // The page window stands below whichever scale's bar shows (its lines wrap as it narrows):
  // read as a page opens and twice a second (a resize observer on the bars trips WebKit's
  // loop check as the scales' panels come and go).
  const markBarBottom = () => {
    const bar = [...document.querySelectorAll<HTMLElement>(".panel > header.bar")].find(
        (b) => b.offsetParent !== null,
      ),
      y = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 64}px`;
    if (document.documentElement.style.getPropertyValue("--bar-bottom") !== y)
      document.documentElement.style.setProperty("--bar-bottom", y);
  };
  setInterval(markBarBottom, 500);
  pageWindow.onClose = () => document.body.classList.remove("paging");
  exposed.open = (ref: string) => pageWindow.open(ref);
  exposed.pageOpen = () => pageWindow.current;
  // The guided walk: on a first visit (not for a machine driving the page, unless asked
  // with ?walk), and again from Help.
  const walk = new GuidedWalk(planetPanel.bar);
  if (
    !GuidedWalk.walked() &&
    (!(navigator as { webdriver?: boolean }).webdriver || params.has("walk"))
  )
    walk.start();
  planetPanel.onHelp = () => walk.start();
  planetPanel.onAsked = () => walk.saw("why");
  pageWindow.onAsked = () => walk.saw("why");
  exposed.walk = () => walk.current;
  // Quality (M76): the viewer's choice, kept in this browser, or Auto — from the device's
  // kind, stepping down while frames drag (and up where a display runs faster than 60).
  const QUALITY_KEY = "causalis.quality",
    readChoice = (): QualityName | "auto" => {
      try {
        const v = localStorage.getItem(QUALITY_KEY);
        // (A machine driving the page — tests, tools — draws at High, fixed, so what it
        // measures does not move under it.)
        const fallback = (navigator as { webdriver?: boolean }).webdriver ? "high" : "auto";
        return v && (v === "auto" || (QUALITY_NAMES as readonly string[]).includes(v))
          ? (v as QualityName | "auto")
          : fallback;
      } catch {
        return "auto";
      }
    };
  let choice = readChoice(),
    auto: AutoQuality | null = null,
    fps = 0,
    frames: number[] = [];
  const setChoice = (c: QualityName | "auto") => {
    choice = c;
    try {
      localStorage.setItem(QUALITY_KEY, c);
    } catch {
      // Nothing to keep it in: it holds for this visit.
    }
    const start: QualityName = c === "auto" ? (tier.name === "phone" ? "high" : "ultra") : c;
    auto = c === "auto" ? new AutoQuality(start, "ultra") : null;
    stage.setQuality(QUALITIES[start]);
  };
  setChoice(choice);
  stage.onUpdate((dt) => {
    // (A hitch — a tab come back, a world being made — is not the device's pace.)
    if (dt <= 0 || dt > 0.25 || !painted) return;
    frames.push(dt);
    if (frames.length >= 60) {
      fps = Math.round(frames.length / frames.reduce((a, b) => a + b, 0));
      frames = [];
    }
    const next = auto?.frame(dt * 1000);
    if (next) stage.setQuality(QUALITIES[next]);
  });
  stage.onQuality((q) => {
    if (scale === "globe") paintGlobe();
    const frame = client.latestFrame("region");
    if (scale === "region" && frame) region.plantTrees(regionTrees(frame, q.regionTrees));
    if (scale === "village" && plan) village.build(plan);
  });
  planetPanel.onQualityChoice = (c) => setChoice(c);
  planetPanel.qualityNow = () => ({ choice, name: stage.quality.name, fps });
  exposed.quality = () => stage.quality.name;
  exposed.setQuality = (c: string) => setChoice(c as QualityName | "auto");
  labels.blockers = [regionPanel.inspector, villagePanel.inspector, pageWindow.inspector];
  bubbles.blockers = labels.blockers;
  // The signs' font, readied before any village is entered: its first drawing is slow (a
  // colour font loaded and its glyphs drawn), and would otherwise stall a frame there.
  {
    const warm = document.createElement("span");
    warm.className = "bubble";
    warm.textContent = Object.values(SIGNS).join("");
    warm.style.opacity = "0.01";
    warm.style.pointerEvents = "none";
    hud.append(warm);
    setTimeout(() => warm.remove(), 4000);
  }

  /** The globe's colours as its lens paints them (the land's "as the map" shows them, M95). */
  let globeLensColors: Uint8Array | null = null;
  const paintGlobe = () => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    if (!globe.built)
      globe.build(
        (frame.meta as { frequency: number }).frequency,
        frame.arrays.elevation as Float32Array,
      );
    const colors = globeColors(
      frame,
      lens,
      lens === "food" ? foodPrices : lens === "trade" ? trade : density,
      lens === "realms"
        ? realms
        : lens === "faiths"
          ? faiths
          : lens === "diplomacy"
            ? standings
            : lens === "war"
              ? fronts
              : tongues,
      // (Borders between realms, faiths, tongues: a grand strategy map's.)
      sphereGrid((frame.meta as { frequency: number }).frequency),
      // (Lands taken by force, still resenting it, in shadow: M104.)
      lens === "realms" || lens === "war" ? takenLands : undefined,
    );
    globe.paint(colors);
    globeLensColors = colors;
    // Clouds over the land as it is; none over what a lens paints.
    globe.weather = lens === "terrain" && stage.quality.clouds;
    painted = colors.length / 4;
  };
  const paintRegion = () => {
    const frame = client.latestFrame("region");
    if (!frame || scale !== "region") return;
    const meta = frame.meta as {
      ref: string;
      center: number;
      size: number;
      tileKm: number;
      lat: number;
      lon: number;
    };
    if (region.key !== meta.ref) {
      const t0 = performance.now();
      region.build(meta.ref, meta.size, meta.tileKm, regionHeights(frame));
      // The phone's budgets are measured by these (npm run gate:7).
      performance.measure("region.build", { start: t0 });
      regionPanel.show(meta.center, meta.lat, meta.lon, meta.size * meta.tileKm);
      region.setVillages(villages);
      region.plantTrees(regionTrees(frame, stage.quality.regionTrees));
      showLandWars();
      // Come down from the globe onto a spot of it: that spot in the middle (M95).
      const parent = frame.arrays.parent as Int32Array | undefined;
      if (arriveAt !== null && parent) {
        let x = 0,
          z = 0,
          n = 0;
        const half = ((meta.size - 1) * meta.tileKm) / 2;
        for (let t = 0; t < parent.length; t++)
          if (parent[t] === arriveAt) {
            x += (t % meta.size) * meta.tileKm - half;
            z += Math.floor(t / meta.size) * meta.tileKm - half;
            n++;
          }
        if (n) rig.target.set(x / n, region.heightAt(x / n, z / n), z / n);
      }
      arriveAt = null;
    }
    // (The globe's lens seen in the land: each tile its spot's colour on the map, M95.)
    const parent = frame.arrays.parent as Int32Array | undefined,
      colors =
        regionLens === "world" && parent && globeLensColors
          ? regionFromGlobe(frame, parent, globeLensColors)
          : regionColors(frame, regionLens);
    region.paint(colors);
    painted = colors.length / 4;
  };
  /** The spot of the globe a zoom went down into, to stand in the middle of its land's map. */
  let arriveAt: number | null = null;
  /** Turn to the most peopled province; closer, for the lenses that show the people. */
  async function faceThePeople(closer: boolean): Promise<void> {
    const map = await client.query<PeopleEntry[]>({ type: "people.map" });
    const most = [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)[0];
    if (!most || scale !== "globe") return;
    const place = await client.query<{ lat: number; lon: number }>({
      type: "cell",
      args: { cell: most.centre },
    });
    rig.face(place.lat, place.lon);
    if (closer && !rig.userZoomed) rig.distance = Math.min(rig.distance, 2);
  }
  planetPanel.onLens = (l) => {
    walk.saw("lens");
    lens = l;
    mapModes.lens = l;
    mapModes.say(null);
    if (l === "diplomacy") void readStandings();
    if (l === "war") void readFronts();
    paintGlobe();
    if (["people", "food", "trade", "tongues", "realms", "faiths"].includes(l))
      void faceThePeople(true);
  };
  // The map modes' bar (Phase 10 M96), in the world's top bar (floating on a desk).
  const mapModes = new MapModes(lens);
  planetPanel.bar.append(mapModes.element);
  mapModes.onLens = (l) => planetPanel.onLens(l);
  // The diplomacy lens is of a realm: the one a page open is of (or its land's), else the
  // most peopled; the war lens shows the wars' sides, what they fight for, what was taken.
  let standings = new Map<number, readonly [number, number, number]>(),
    fronts = new Map<number, readonly [number, number, number]>(),
    takenLands = new Map<number, readonly [number, number, number]>(),
    focusRealm: string | null = null;
  const readStandings = async () => {
    const open = pageWindow.current,
      focus = open?.startsWith("pol:")
        ? open
        : open?.startsWith("cell:")
          ? (
              (
                await client.query<{
                  stats: { label: string; value: (string | { ref: string })[] }[];
                }>({
                  type: "page",
                  args: { ref: open },
                })
              ).stats
                .find((x) => x.label === "Realm")
                ?.value.find((v) => typeof v !== "string") as { ref: string } | undefined
            )?.ref
          : null;
    if (focus) focusRealm = focus;
    if (!focusRealm) {
      const rs = await client.query<{ ref: string; people: number }[]>({ type: "realms.map" });
      focusRealm = [...rs].sort((a, b) => b.people - a.people)[0]?.ref ?? null;
    }
    if (!focusRealm) return;
    const d = await client.query<{ name: string | null; lands: [number, string][] }>({
      type: "diplomacy.map",
      args: { realm: focusRealm },
    });
    standings = new Map(
      d.lands.map(([c, k]) => [c, STANDING_COLORS[k] ?? STANDING_COLORS.neutral!]),
    );
    mapModes.say(d.name ? `as ${d.name} sees them` : null);
    if (lens === "diplomacy") paintGlobe();
  };
  const readFronts = async () => {
    const w = await client.query<{
      lands: [number, string][];
      taken: [number, readonly [number, number, number]][];
    }>({ type: "war.lens" });
    fronts = new Map(w.lands.map(([c, k]) => [c, WAR_COLORS[k] ?? WAR_COLORS.attacker!]));
    takenLands = new Map(w.taken);
    if (lens === "war") mapModes.say(w.lands.length ? null : "no war is being fought");
    if (lens === "war" || lens === "realms") paintGlobe();
  };
  setInterval(() => {
    if (scale !== "globe") return;
    if (lens === "diplomacy") void readStandings();
    // (The realms' map too: the lands taken by force are in shadow on it.)
    if (lens === "war" || lens === "realms") void readFronts();
  }, 3000);
  // The top bar's numbers.
  client.subscribe<WorldStats>({ type: "world.stats" }, 2000, (st) => planetPanel.stats(st));
  // Realms' names written across their lands on the political map, and a star at each seat.
  const mapNames = new MapLabels(hud);
  let realmNames: {
    ref: string;
    text: string;
    lands: number;
    shape: NameShape;
    seat: { x: number; y: number; z: number } | null;
  }[] = [];
  const readNames = async () => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    const grid = sphereGrid((frame.meta as { frequency: number }).frequency),
      rs = await client.query<{ ref: string; short: string; spots: number[]; seat: number }[]>({
        type: "realms.map",
      });
    realmNames = rs.flatMap((r) => {
      const shape = nameShape(r.spots, grid);
      if (!shape) return [];
      const p = grid.positions,
        seat =
          r.seat >= 0 && r.spots.length > 1
            ? { x: p[r.seat * 3]!, y: p[r.seat * 3 + 1]!, z: p[r.seat * 3 + 2]! }
            : null;
      return [{ ref: r.ref, text: r.short.toUpperCase(), lands: r.spots.length, shape, seat }];
    });
  };
  const NAMED: readonly Lens[] = ["realms", "diplomacy", "war"];
  setInterval(() => {
    if (scale === "globe" && NAMED.includes(lens)) void readNames();
  }, 5000);
  let namesAt = 0;
  stage.onUpdate(() => {
    if (scale !== "globe" || !NAMED.includes(lens)) {
      if (namesAt) {
        mapNames.clear();
        namesAt = 0;
      }
      return;
    }
    if (!realmNames.length) {
      if (!namesAt) void readNames();
      namesAt = 1;
      return;
    }
    // (Laid out a dozen times a second: they move with the globe, not with each frame.)
    const t = performance.now();
    if (t - namesAt < 80) return;
    namesAt = t;
    const points = realmNames.flatMap((r) => {
      const s = r.shape;
      return [
        { x: s.x, y: s.y, z: s.z },
        rim(s, s.half),
        rim(s, -s.half),
        ...(r.seat ? [r.seat] : [{ x: s.x, y: s.y, z: s.z }]),
      ];
    });
    const at = globe.screenOf(points),
      names: MapName[] = [],
      laid: { name: MapName; seat: MapName | null; lands: number }[] = [];
    realmNames.forEach((r, i) => {
      const c = at[i * 4]!,
        a = at[i * 4 + 1]!,
        b = at[i * 4 + 2]!,
        seat = at[i * 4 + 3]!;
      if (c.facing < 0.25) return;
      const len = Math.hypot(b.x - a.x, b.y - a.y),
        size = Math.min(44, len / (r.text.length * 0.95 + 1));
      let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      const alpha = Math.min(1, (c.facing - 0.25) / 0.3);
      if (size < 8) return;
      laid.push({
        lands: r.lands,
        name: { key: r.ref, text: r.text, x: c.x, y: c.y, angle, size, alpha },
        seat:
          r.seat && seat.facing > 0.25
            ? {
                key: `${r.ref} seat`,
                text: "★",
                x: seat.x,
                y: seat.y,
                angle: 0,
                size: Math.max(10, Math.min(18, size * 0.7)),
                alpha,
                seat: true,
              }
            : null,
      });
    });
    // (The largest first; one that would cross another is left out, as such maps do.)
    const fits = namesThatFit(
      laid.map((l) => ({ ...l.name, chars: l.name.text.length, rank: l.lands })),
    );
    laid.forEach((l, i) => {
      const k = fits[i]!;
      if (k) names.push({ ...l.name, size: l.name.size * k });
    });
    // A seat's star, where it does not sit on a name's letters.
    const written = names.map((n) => ({ ...n, chars: n.text.length }));
    laid.forEach((l, i) => {
      const s = l.seat;
      if (s && fits[i] && !written.some((n) => withinName(n, s.x, s.y))) names.push(s);
    });
    mapNames.update(names);
  });
  regionPanel.onLens = (l) => {
    regionLens = l;
    paintRegion();
  };
  client.subscribe<{ carbon: number; warming: number; warmer: string | null }>(
    { type: "planet.air" },
    5000,
    (air) => planetPanel.air(air),
  );
  // (Each land's middle spot on the globe, to turn to it: M88.)
  let centres = new Map<number, number>();
  client.subscribe<PeopleEntry[]>({ type: "people.map" }, 1000, (entries) => {
    planetPanel.people(entries);
    centres = new Map(entries.map((e) => [e.cell, e.centre]));
    density = new Map(entries.map((e) => [e.cell, e.density]));
    foodPrices = new Map(entries.map((e) => [e.cell, e.food]));
    trade = new Map(entries.map((e) => [e.cell, e.trade]));
    tongues = new Map(entries.flatMap((e) => (e.tongue ? [[e.cell, e.tongue] as const] : [])));
    realms = new Map(entries.flatMap((e) => (e.realm ? [[e.cell, e.realm] as const] : [])));
    faiths = new Map(entries.flatMap((e) => (e.faith ? [[e.cell, e.faith] as const] : [])));
    if (
      ["people", "food", "trade", "tongues", "realms", "faiths"].includes(lens) &&
      scale === "globe"
    )
      paintGlobe();
  });

  // The year's wars on the globe (M87): hosts marching toward what they want, ships where
  // their way crosses the sea, clashes where history fought.
  const globeWars = new GlobeWars(stage, stage.root);
  let warsKey = "",
    warsNow: WarsMap | null = null;
  client.subscribe<WarsMap>({ type: "wars.map" }, 2000, (map) => {
    const frame = client.latestFrame("globe"),
      key = JSON.stringify(map);
    if (!frame || key === warsKey) return;
    warsKey = key;
    warsNow = map;
    showLandWars();
    globeWars.set(
      warPaths(
        map,
        sphereGrid((frame.meta as { frequency: number }).frequency),
        frame.arrays.elevation as Float32Array,
      ),
    );
  });
  stage.onUpdate(() => {
    globeWars.root.enabled = scale === "globe";
    if (scale === "globe") globeWars.update(performance.now() / 1000);
    regionWars.visible = scale === "region";
    if (scale === "region") regionWars.update(performance.now() / 1000);
  });
  exposed.warsDrawn = () =>
    scale === "globe" ? globeWars.drawn : scale === "region" ? regionWars.drawn : 0;
  exposed.landWars = () => ({ ...regionWars.shown, known: warsNow !== null });
  // Where a spot of the globe is on the screen (for the look tools: to zoom at a thing).
  exposed.spotOnScreen = (spot: number) => {
    const frame = client.latestFrame("globe");
    if (!frame || scale !== "globe") return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      [at] = globe.screenOf([{ x: p[spot * 3]!, y: p[spot * 3 + 1]!, z: p[spot * 3 + 2]! }]);
    return at && at.facing > 0 ? { x: at.x, y: at.y } : null;
  };
  // The same wars seen closer in a land (Phase 10 M95): its hosts coming in for what they
  // want or going out to the front, its defenders, its battles of this year and last.
  const regionWars = new RegionWars(stage);
  const showLandWars = () => {
    const frame = client.latestFrame("region"),
      globeFrame = client.latestFrame("globe"),
      parent = frame?.arrays.parent as Int32Array | undefined;
    if (
      !frame ||
      !globeFrame ||
      !warsNow ||
      !parent ||
      region.key !== (frame.meta as { ref: string }).ref
    ) {
      regionWars.set(null, () => 0);
      return;
    }
    const meta = frame.meta as { size: number; tileKm: number };
    regionWars.set(
      landWars(
        warsNow,
        parent,
        meta.size,
        meta.tileKm,
        sphereGrid((globeFrame.meta as { frequency: number }).frequency),
      ),
      (x, z) => region.heightAt(x, z),
      (x, z) => region.seaAt(x, z),
    );
  };
  // The world's towns on the globe (M95): what is zoomed into is there before it, and named
  // as the view closes in.
  const globeTowns = new GlobeTowns(stage);
  let townsShown: GlobeTown[] = [],
    townsAt = -Infinity;
  const readTowns = async () => {
    townsAt = performance.now();
    const frame = client.latestFrame("globe");
    if (!frame) return;
    townsShown = await client.query<GlobeTown[]>({ type: "towns.map" });
    globeTowns.set(
      townsShown,
      sphereGrid((frame.meta as { frequency: number }).frequency),
      frame.arrays.elevation as Float32Array,
    );
  };
  /**
   * How a host stands to what is followed (M101): its own realm followed ("ours"), or fighting
   * a realm followed ("foe").
   */
  const stanceOf = (realm: string, war: string): "ours" | "foe" | undefined => {
    if (followedRefs.has(realm)) return "ours";
    const w = warsNow?.wars.find((x) => x.ref === war),
      enemy = w ? (w.attacker.ref === realm ? w.defender.ref : w.attacker.ref) : null;
    return enemy && followedRefs.has(enemy) ? "foe" : undefined;
  };
  /** Each seat under siege, marked where it stands (M104): a victory there, the seat still held. */
  const siegeMarks = (): Label[] => {
    const frame = client.latestFrame("globe");
    if (!frame || !warsNow || !globeWars.root.enabled) return [];
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions,
      besieged = warsNow.wars.filter((w) => w.siege !== null),
      at = globe.screenOf(
        besieged.map((w) => ({
          x: p[w.siege! * 3]!,
          y: p[w.siege! * 3 + 1]!,
          z: p[w.siege! * 3 + 2]!,
        })),
        1.03,
      );
    return besieged.flatMap((w, i) =>
      at[i]!.facing > 0.15
        ? [
            {
              key: `siege:${w.ref}`,
              text: `🏰 ${w.defender.name.split(" of ").at(-1)} besieged`,
              at: { x: at[i]!.x, y: at[i]!.y },
              priority: 1.6e9,
            },
          ]
        : [],
    );
  };
  /** Each host on the globe as its counter (M101): its realm's arms and the men it fields. */
  const globeCounters = (): Label[] =>
    globeWars.hostsOnScreen().flatMap((h) => {
      const w = warsNow?.wars.find((x) => x.ref === h.ref),
        side = w ? (h.attacker ? w.attacker : w.defender) : null;
      return side
        ? [
            {
              key: `${h.ref}:${side.ref}`,
              text: counterWords(side.fields),
              at: { x: h.x, y: h.y },
              priority: 1.5e9,
              badge: { realm: side.ref, stance: stanceOf(side.ref, h.ref) },
            },
          ]
        : [];
    });
  let townsNamed = false;
  stage.onUpdate(() => {
    globeTowns.visible = scale === "globe";
    if (scale !== "globe") return;
    // (Read again every half-minute while near enough to be seen.)
    if (rig.distance < 2.6 && performance.now() - townsAt > 30_000) void readTowns();
    globeTowns.update(rig.distance);
    const named = globeTowns.named(stage.camera.camera!, rig.distance),
      counters = [...siegeMarks(), ...globeCounters()];
    if (named.length || counters.length || townsNamed)
      labels.update([
        ...counters,
        ...named.map((n) => ({
          key: n.town.ref,
          text: n.town.city ? `🏙️ ${n.town.name}` : n.town.name,
          at: { x: n.x, y: n.y },
          priority: n.town.people,
        })),
      ]);
    townsNamed = named.length + counters.length > 0;
  });
  /** The town drawn nearest a point of the screen on the globe, within a finger's reach. */
  const townAt = (x: number, y: number): GlobeTown | null => {
    let best: GlobeTown | null = null,
      bestD = 24;
    for (const n of globeTowns.named(stage.camera.camera!, rig.distance)) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = n.town;
      }
    }
    return best;
  };

  const aspect = () => Math.max(0.3, innerWidth / Math.max(1, innerHeight));
  const globeFit = () => (aspect() < 1 ? 3.1 / aspect() : 3.3);
  const regionFit = () => (aspect() < 1 ? 120 / aspect() : 130);
  // A land touched on the globe: its page (a spot of the sea, the spot's own).
  const selectCell = (cell: number | null) => {
    globe.mark(cell);
    if (cell === null) {
      pageWindow.close();
      return;
    }
    walk.saw("land");
    const frame = client.latestFrame("globe"),
      province = (frame?.arrays.province as Int32Array | undefined)?.[cell] ?? -1;
    if (province >= 0) {
      // (Its region readied, so "go to" and zooming in draw at once.)
      void client.query({ type: "region.prepare", args: { cell: province } }).catch(() => {});
      void pageWindow.open(`cell:0:${province}`);
    } else void pageWindow.open(`spot:0:${cell}`);
  };
  // Among the stars: a ship, a hall, a fleet or a battle (M93), else a star.
  const tapStars = (x: number, y: number) => {
    const voyage = starScene.pickVoyage(x, y);
    if (voyage) void pageWindow.open(voyage);
    else selectStar(starScene.pick(x, y));
  };
  const tapGlobe = (x: number, y: number) => {
    const town = townAt(x, y),
      war = town ? null : globeWars.pick(x, y);
    if (town || war) {
      globe.mark(null);
      void pageWindow.open(town ? town.ref : war!);
    } else selectCell(globe.pick(x, y));
  };
  const tapRegion = (x: number, y: number) => {
    const war = regionWars.pick(x, y);
    if (war) void pageWindow.open(war);
    else selectTile(region.pick(x, y));
  };
  const selectTile = (tile: number | null) => {
    region.mark(tile);
    const village = tile === null ? null : region.villageNear(tile);
    const hit = village === null ? undefined : villages.find((v) => v.tile === village);
    if (hit) {
      region.mark(hit.tile);
      void pageWindow.open(hit.ref);
      return;
    }
    if (tile === null) {
      pageWindow.close();
      return;
    }
    // The ground there: what lies in it, or the land's own page.
    void client
      .query<{ deposit: { ref: string } | null }>({
        type: "tile",
        args: { center: regionCell, tile },
      })
      .then((t) => pageWindow.open(t.deposit ? t.deposit.ref : `cell:0:${regionCell}`));
  };
  const rig = new OrbitRig(stage, canvas, {
    distance: globeFit(),
    minDistance: 1.35,
    maxDistance: 12,
    pitch: -18,
    minPitch: -80,
    maxPitch: 80,
    drift: 1.5,
    onTap: (x, y) =>
      scale === "globe"
        ? tapGlobe(x, y)
        : scale === "region"
          ? tapRegion(x, y)
          : scale === "system"
            ? selectBody(skyScene.pick(x, y))
            : scale === "cluster"
              ? tapStars(x, y)
              : scale === "world"
                ? tapWorld(x, y)
                : scale === "galaxy"
                  ? tapGalaxy(x, y)
                  : tapVillage(x, y),
  });
  /**
   * What stands at a point of a village's ground, of what is not a person or a beast (M93):
   * its battle's hosts (the battle), a home (its household, if met, else its town's
   * families), a field (its town).
   */
  const villageThingAt = (x: number, y: number): string | null => {
    const at = plan ? onPlane(x, y, 0) : null;
    if (!plan || !at) return null;
    const mx = at.x / VILLAGE_METRE,
      mz = at.z / VILLAGE_METRE,
      front = battleFront(plan),
      event = plan.life?.battle?.event;
    if (front && event && Math.hypot(mx - front.x, mz - front.z) < 30) return event;
    let home = -1,
      near = 7;
    plan.homes.forEach((h, k) => {
      const d = Math.hypot(h.x - mx, h.z - mz);
      if (d < near) {
        near = d;
        home = k;
      }
    });
    if (home >= 0) return plan.homes[home]!.household ?? `${plan.ref}#families`;
    for (const f of plan.fields) {
      const c = Math.cos(-f.yaw),
        s = Math.sin(-f.yaw),
        dx = mx - f.x,
        dz = mz - f.z,
        lx = dx * c - dz * s,
        lz = dx * s + dz * c;
      if (Math.abs(lx) < f.w / 2 && Math.abs(lz) < f.d / 2) return plan.ref;
    }
    return null;
  };
  /** The thing under a point of the screen, at the scale shown (for the tooltip). */
  const refAt = (x: number, y: number): string | null => {
    switch (scale) {
      case "globe": {
        const town = townAt(x, y);
        if (town) return town.ref;
        const war = globeWars.pick(x, y);
        if (war) return war;
        const spot = globe.pick(x, y),
          frame = client.latestFrame("globe"),
          province =
            spot === null ? -1 : ((frame?.arrays.province as Int32Array | undefined)?.[spot] ?? -1);
        return spot === null ? null : province >= 0 ? `cell:0:${province}` : `spot:0:${spot}`;
      }
      case "region": {
        const war = regionWars.pick(x, y);
        if (war) return war;
        const tile = region.pick(x, y),
          near = tile === null ? null : region.villageNear(tile),
          v = near === null ? undefined : villages.find((w) => w.tile === near);
        return v ? v.ref : tile === null ? null : `cell:0:${regionCell}`;
      }
      case "village": {
        const i = village.pick(x, y);
        if (i !== null && plan?.people[i]) return plan.people[i]!.ref;
        const beast = village.pickBeast(x, y);
        return beast ? beast.ref : villageThingAt(x, y);
      }
      case "system": {
        const i = skyScene.pick(x, y);
        return i === null ? null : (skyPlan?.bodies[i]?.ref ?? null);
      }
      case "cluster": {
        const voyage = starScene.pickVoyage(x, y);
        if (voyage) return voyage;
        const i = starScene.pick(x, y);
        return i === null ? null : (clusterPlan?.stars[i]?.ref ?? null);
      }
      case "world":
        return hallAt(x, y);
      default:
        return null;
    }
  };
  // The tooltip (M93): on a desk, what the pointer rests on, in a few words.
  const tooltip = new Tooltip(hud, client);
  let hoverAt = 0;
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) {
      tooltip.hide();
      return;
    }
    // (Asked a dozen times a second at most: a pick reads the scene.)
    const now = performance.now();
    if (now - hoverAt < 80) return;
    hoverAt = now;
    const rect = canvas.getBoundingClientRect();
    tooltip.point(refAt(e.clientX - rect.left, e.clientY - rect.top), e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerleave", () => tooltip.hide());
  canvas.addEventListener("pointerdown", () => tooltip.hide());
  canvas.addEventListener("wheel", () => tooltip.hide(), { passive: true });
  exposed.refAt = refAt;
  // A zoom goes toward what is under the pointer (Phase 10 M95): the globe turns it to the
  // middle; a flat scene (a land, a village, a sky, the stars, the galaxy) slides it there.
  type Point = { x: number; y: number; z: number };
  const onPlane = (x: number, y: number, h = 0): Point | null => {
    const cam = stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dy = to.y - from.y;
    if (Math.abs(dy) < 1e-9) return null;
    const k = (h - from.y) / dy;
    return k < 0 || k > 1
      ? null
      : { x: from.x + (to.x - from.x) * k, y: h, z: from.z + (to.z - from.z) * k };
  };
  const onGlobe = (x: number, y: number): Point | null => {
    const cam = stage.camera.camera!,
      from = cam.screenToWorld(x, y, cam.nearClip),
      to = cam.screenToWorld(x, y, cam.farClip),
      dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z,
      a = dx * dx + dy * dy + dz * dz,
      b = 2 * (from.x * dx + from.y * dy + from.z * dz),
      c = from.x * from.x + from.y * from.y + from.z * from.z - 1.01 * 1.01,
      disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const k = (-b - Math.sqrt(disc)) / (2 * a);
    return { x: from.x + dx * k, y: from.y + dy * k, z: from.z + dz * k };
  };
  rig.anchor = (x, y) =>
    scale === "globe" || scale === "world"
      ? onGlobe(x, y)
      : scale === "region"
        ? region.pointAt(x, y)
        : onPlane(x, y);
  stage.onUpdate(() => {
    rig.round = scale === "globe" || scale === "world";
    const regionFrame = scale === "region" ? client.latestFrame("region") : null,
      half = regionFrame
        ? (((regionFrame.meta as { size: number }).size - 1) *
            (regionFrame.meta as { tileKm: number }).tileKm) /
          2
        : 0;
    rig.bounds =
      scale === "region"
        ? { x: 0, z: 0, reach: half * 0.85 }
        : scale === "village"
          ? { x: 0, z: 0, reach: (plan?.districts ? 600 : 300) * VILLAGE_METRE }
          : null;
  });
  // Framed between the bar of whichever scale is up and, on a phone, the sheet open below
  // (read a few times a second, not each frame).
  let covered = { top: 0, bottom: 0 },
    coveredAt = -Infinity;
  rig.covered = () => {
    const now = performance.now();
    if (now - coveredAt > 250) {
      coveredAt = now;
      const h = Math.max(1, innerHeight),
        bar = hud.querySelector<HTMLElement>(".panel:not([hidden]) .bar"),
        // (A page open stands over the scales' own windows.)
        sheet =
          hud.querySelector<HTMLElement>(".page-panel .inspector:not([hidden])") ??
          hud.querySelector<HTMLElement>(".panel:not([hidden]) .inspector:not([hidden])"),
        s = sheet?.getBoundingClientRect(),
        // A sheet across the foot of the screen (a phone's), not a column at its side.
        across = !!s && s.width > innerWidth * 0.8 && s.bottom > h - 40;
      covered = {
        top: bar ? bar.getBoundingClientRect().bottom / h : 0,
        bottom: across ? (h - s!.top) / h : 0,
      };
    }
    return covered;
  };

  // Down to a region, and back up to the world: the camera, the scene, the panel,
  // the labels and the host's interest all move together.
  const toRegion = (cell: number) => {
    scale = "region";
    // The globe's lens, seen in the land too (M95): its terrain, the land's own; else the map's.
    regionLens = lens === "terrain" ? "land" : "world";
    regionPanel.markLens(regionLens);
    regionPanel.mapLens(lens === "terrain" ? null : LENS_NAMES[lens]);
    stage.backdrop("ground", regionFit());
    regionCell = cell;
    globe.visible = false;
    region.visible = true;
    planetPanel.visible = false;
    regionPanel.visible = true;
    rig.configure({
      distance: regionFit(),
      minDistance: 12,
      maxDistance: 260,
      pitch: -48,
      minPitch: -85,
      maxPitch: -12,
      drift: 1.5,
      target: [0, 0, 0],
    });
    client.setInterest({ view: "region", focus: `cell:0:${cell}` });
    villages = [];
    stopVillages?.();
    stopVillages = client.subscribe<Village[]>(
      { type: "settlements", args: { cell } },
      1000,
      (list) => {
        if (regionCell !== cell) return;
        villages = list;
        region.setVillages(list);
      },
    );
    paintRegion();
  };
  const toGlobe = () => {
    scale = "globe";
    stage.backdrop("space");
    regionCell = -1;
    stopVillages?.();
    stopVillages = null;
    villages = [];
    labels.clear();
    bubbles.clear();
    region.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    starScene.visible = false;
    clusterPanel.visible = false;
    globe.visible = true;
    regionPanel.visible = false;
    planetPanel.visible = true;
    rig.configure({
      distance: globeFit(),
      minDistance: 1.35,
      maxDistance: 12,
      minPitch: -80,
      maxPitch: 80,
      drift: 1.5,
      target: [0, 0, 0],
    });
    client.setInterest({ view: "globe", focus: null });
    paintGlobe();
  };
  planetPanel.onCloser = (cell) => {
    walk.saw("scale");
    void toRegion(cell);
  };
  // Out to the star's system, and back to the world: the worlds go round a month a second.
  const systemPanel = new SystemPanel(hud, client);
  let sky: SkyState = { programs: [], colonies: [] },
    stopSky: (() => void) | null = null;
  const selectBody = (i: number | null) => {
    skyScene.mark(i);
    const b = i === null ? undefined : skyPlan?.bodies[i];
    if (b) void pageWindow.open(b.ref);
    else {
      pageWindow.close();
      systemPanel.select(null);
    }
  };
  const toSystem = async () => {
    scale = "system";
    stage.backdrop("space");
    labels.clear();
    bubbles.clear();
    globe.visible = false;
    planetPanel.visible = false;
    systemPlan ??= await client.query<SystemPlan>({ type: "planet.system" });
    // (Built again when another star's was shown since.)
    if (skyBuilt !== "home") {
      skyScene.build(systemPlan);
      skyBuilt = "home";
    }
    skyPlan = systemPlan;
    skyStar = null;
    systemPanel.show(systemPlan);
    skyScene.mark(null);
    skyScene.visible = true;
    stopSky?.();
    stopSky = client.subscribe<SkyState>({ type: "space.state" }, 1000, (s) => {
      sky = s;
      systemPanel.update(s);
      clusterPanel.update(s);
      if (scale === "world" && worldFrom === "system" && seen) showHalls(seenAt, seen);
    });
    systemPanel.visible = true;
    client.setSpeed(SKY_SPEED);
    rig.configure({
      // The whole system in view: its farthest orbit across the screen's narrow side.
      distance: (systemExtent(systemPlan) * 2.9) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: 400,
      pitch: -60,
      minPitch: -89,
      maxPitch: -10,
      drift: 0.6,
      target: [0, 0, 0],
    });
  };
  // Its beginning (M89): the genesis of this very world, from the galaxy's birth.
  planetPanel.onGenesis = () => {
    location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(seed)}&genesis=1`;
  };
  planetPanel.onSky = () => {
    walk.saw("scale");
    void toSystem();
  };
  // Keeping the world: a save of one's own, and one kept every five minutes of watching.
  const saveName = `${universe}:${seed}`;
  planetPanel.onSave = async () => {
    try {
      const { bytes } = await client.save(saveName);
      return `saved (${(bytes / 1e6).toFixed(1)} MB)`;
    } catch (error) {
      return `not saved: ${(error as Error).message}`;
    }
  };
  // Another world's save opens in a page of its own world, and loads there.
  const elsewhere = (u: string, s: string, name: string) => {
    location.search = `?universe=${encodeURIComponent(u)}&seed=${encodeURIComponent(s)}&load=${encodeURIComponent(name)}`;
  };
  planetPanel.onSaves = () => client.saves();
  planetPanel.onLoadSave = async (save) => {
    if (save.universe !== universe || save.seed !== seed) {
      elsewhere(save.universe, save.seed, save.name);
      return "opening that world…";
    }
    try {
      const got = await client.load(save.name);
      paintGlobe();
      return `back at year ${Math.floor(got.t / YEAR)}${got.fellBack ? " (from the save before; the latest did not read)" : ""}`;
    } catch (error) {
      return `not loaded: ${(error as Error).message}`;
    }
  };
  planetPanel.onExport = async () => {
    try {
      const bytes = await client.exportSave(),
        a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/gzip" }));
      a.download = `causalis-${universe}-${seed.replace(/[^a-z0-9]+/gi, "-")}.causalis`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      return `kept as ${a.download} (${(bytes.length / 1e6).toFixed(1)} MB)`;
    } catch (error) {
      return `not kept: ${(error as Error).message}`;
    }
  };
  planetPanel.onImport = async (file) => {
    try {
      const got = await client.importSave(new Uint8Array(await file.arrayBuffer()));
      if (got.universe !== universe || got.seed !== seed) {
        // Another world: keep it under its own name, and open it there.
        const name = `${got.universe}:${got.seed}`;
        await client.save(name);
        elsewhere(got.universe, got.seed, name);
        return "opening that world…";
      }
      paintGlobe();
      return `back at year ${Math.floor(got.t / YEAR)}`;
    } catch (error) {
      return `not opened: ${(error as Error).message}`;
    }
  };
  setInterval(() => void client.save(`${saveName}:auto`).catch(() => {}), 5 * 60_000);
  // Out to the stars around, and back to the star's system.
  const clusterPanel = new ClusterPanel(hud, client);
  const selectStar = (i: number | null) => {
    starScene.mark(i, clusterPlan);
    const s = i === null ? undefined : clusterPlan?.stars[i];
    if (s) void pageWindow.open(s.ref);
    else {
      pageWindow.close();
      void clusterPanel.select(null);
    }
  };
  const toCluster = async () => {
    scale = "cluster";
    stage.backdrop("space");
    globe.visible = false;
    planetPanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    if (!clusterPlan) {
      clusterPlan = await client.query<ClusterPlan>({ type: "galaxy.cluster" });
      starScene.build(clusterPlan);
    }
    clusterPanel.show(clusterPlan);
    starScene.mark(null, clusterPlan);
    starScene.visible = true;
    clusterPanel.visible = true;
    rig.configure({
      distance: (clusterPlan.radius * 0.3 * 2.8) / Math.min(1, aspect()),
      minDistance: 1,
      maxDistance: 200,
      pitch: -30,
      minPitch: -89,
      maxPitch: 60,
      drift: 1,
      target: [0, 0, 0],
    });
  };
  systemPanel.onStars = () => void toCluster();
  clusterPanel.onSelect = (i) => starScene.mark(i, clusterPlan);
  clusterPanel.onBack = () => {
    starScene.visible = false;
    clusterPanel.visible = false;
    void toSystem();
  };
  exposed.stars = () => void toCluster();
  exposed.starOnScreen = (ref: string) => {
    const i = clusterPlan?.stars.findIndex((s) => s.ref === ref) ?? -1;
    return scale === "cluster" && i >= 0 ? starScene.starOnScreen(i) : null;
  };
  exposed.starCount = () => (scale === "cluster" && clusterPlan ? clusterPlan.stars.length : 0);
  systemPanel.onSelect = (i) => skyScene.mark(i);
  // Down to a world of the system: made whole on the host (a moment), painted, turned.
  const worldPanel = new WorldPanel(hud);
  let seen: WorldGlobe | null = null,
    seenAt = -1;
  const toWorld = async (index: number) => {
    if (!systemPlan) return;
    const body = systemPlan.bodies[index]!,
      w = await client.query<WorldGlobe>({ type: "world.globe", args: { ref: body.ref } });
    scale = "world";
    seen = w;
    seenAt = index;
    // (A world of the home star's: back leads to its sky.)
    worldFrom = "system";
    skyScene.visible = false;
    systemPanel.visible = false;
    showWorld(w);
    showHalls(index, w);
    // (Its halls, if it has any, turned to: what was seen from the sky is seen closer.)
    const hall = worldScene.hallsAt[0];
    if (hall) {
      rig.halt();
      rig.yaw = (Math.atan2(hall.x, hall.z) * 180) / Math.PI;
      rig.pitch = (-Math.asin(hall.y) * 180) / Math.PI;
    }
    worldPanel.show(systemPlan, index, w, sky);
    worldPanel.visible = true;
  };
  // Halls from orbit (M95): a body of the home star's seen whole shows the halls set down on
  // it, where the view places each site, its domes as many as its people, its lights aglow.
  let hallsShown: { ref: string; label: string; people: number }[] = [],
    hallsNamed = false;
  const showHalls = (index: number, w: WorldGlobe) => {
    const here = (sky?.colonies ?? []).filter((c) => c.body === index),
      cells = hallCells(w.frequency, w.cover);
    worldScene.setHalls(
      here.map((c) => ({ cell: cells[c.site % cells.length]!, domes: hallDomes(c.people) })),
    );
    hallsShown = here.map((c) => ({
      ref: `cell:0:${c.cell}`,
      label: `🏛️ The halls of ${c.founder ?? c.realm ?? "a fallen realm"}`,
      people: c.people,
    }));
  };
  exposed.hallsShown = () => (scale === "world" ? hallsShown.length : 0);
  /** The halls drawn nearest a point of the screen, within a finger's reach; or null. */
  const hallAt = (x: number, y: number): string | null => {
    if (scale !== "world" || !hallsShown.length) return null;
    let best: string | null = null,
      bestD = 26;
    worldScene.screenOf(worldScene.hallsAt, 1.02).forEach((at, i) => {
      const d = Math.hypot(at.x - x, at.y - y);
      if (at.facing > 0.1 && d < bestD && hallsShown[i]) {
        bestD = d;
        best = hallsShown[i]!.ref;
      }
    });
    return best;
  };
  /** A tap on a world seen whole: its halls (their page), else the spot of it tapped. */
  const tapWorld = (x: number, y: number) => {
    const hall = hallAt(x, y);
    if (hall) void pageWindow.open(hall);
    else if (seen) worldPanel.cell(seen, worldScene.pick(x, y));
  };
  stage.onUpdate(() => {
    if (scale !== "world") return;
    const named = hallsShown.length
      ? worldScene.screenOf(worldScene.hallsAt, 1.04).flatMap((at, i) =>
          at.facing > 0.12 && hallsShown[i]
            ? [
                {
                  key: hallsShown[i]!.ref,
                  text: hallsShown[i]!.label,
                  at: { x: at.x, y: at.y },
                  priority: hallsShown[i]!.people,
                },
              ]
            : [],
        )
      : [];
    if (named.length || hallsNamed) labels.update(named);
    hallsNamed = named.length > 0;
  });
  /** A world made whole, drawn and turned to (every other scale and its panel put away). */
  const showWorld = (w: WorldGlobe) => {
    hallsShown = [];
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    village.visible = false;
    villagePanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    worldScene.build(w.frequency, w.elevation);
    // (A glow about the rim where there is air enough to glow; clouds where it carries them —
    // a giant's bands are its clouds.)
    const airy = w.air !== "none" && w.air !== "trace",
      giant = w.kind === "giant" || w.kind === "ice giant";
    worldScene.features(
      w.water === "seas",
      airy,
      stage.quality.clouds &&
        !giant &&
        (w.air === "thick" || w.air === "crushing" || w.air === "breathable"),
    );
    worldScene.paint(worldColors(w, Math.floor(now() / YEAR)));
    worldScene.visible = true;
    rig.configure({
      distance: globeFit(),
      minDistance: 1.35,
      maxDistance: 12,
      pitch: -18,
      minPitch: -80,
      maxPitch: 80,
      drift: 1.5,
      target: [0, 0, 0],
    });
  };
  systemPanel.onVisit = (i) => {
    // (Another star's world, from its own system; else one of the home star's.)
    if (skyStar) {
      void toForeignWorld(skyStar, i, "star");
      return;
    }
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    void toWorld(i);
  };
  // Where a world seen whole was come to from: back leads there.
  let worldFrom: "system" | "cluster" | "galaxy" | "star" = "system";
  worldPanel.onBack = () => {
    worldScene.visible = false;
    worldPanel.visible = false;
    seen = null;
    if (worldFrom === "galaxy") void toGalaxy();
    else if (worldFrom === "cluster") void toCluster();
    else if (worldFrom === "star" && skyStar) void toStarSystem(skyStar);
    else void toSystem();
  };
  /**
   * Another star's own system (M95), as the home star's is shown: its worlds on their orbits,
   * each tapped for its page and gone to, seen whole; back, the stars about it.
   */
  const toStarSystem = async (star: StarPage) => {
    const plan = await client.query<SystemPlan>({
      type: "galaxy.system",
      args: { ref: star.ref },
    });
    scale = "system";
    stage.backdrop("space");
    labels.clear();
    bubbles.clear();
    for (const hide of [globe, starScene, galaxyScene, worldScene]) hide.visible = false;
    for (const hide of [planetPanel, clusterPanel, galaxyPanel, worldPanel]) hide.visible = false;
    skyScene.build(plan);
    skyBuilt = star.ref;
    skyPlan = plan;
    skyStar = star;
    // (Our sky's news is of our star: not read while another's is shown.)
    stopSky?.();
    stopSky = null;
    systemPanel.show(plan, true);
    skyScene.mark(null);
    skyScene.visible = true;
    systemPanel.visible = true;
    client.setSpeed(SKY_SPEED);
    rig.configure({
      distance: (systemExtent(plan) * 2.9) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: 400,
      pitch: -60,
      minPitch: -89,
      maxPitch: -10,
      drift: 0.6,
      target: [0, 0, 0],
    });
  };
  exposed.starSystem = (ref: string) =>
    void client
      .query<StarPage>({ type: "galaxy.star", args: { ref } })
      .then((page) => toStarSystem(page));
  /** Another star's world, made whole and shown. */
  const toForeignWorld = async (
    star: StarPage,
    index: number,
    from: "cluster" | "galaxy" | "star",
  ) => {
    const w = await client.query<WorldGlobe>({
      type: "world.globe",
      args: { star: star.ref, index },
    });
    scale = "world";
    seen = w;
    seenAt = index;
    worldFrom = from;
    starScene.visible = false;
    clusterPanel.visible = false;
    galaxyScene.visible = false;
    galaxyPanel.visible = false;
    showWorld(w);
    worldPanel.backTo =
      from === "galaxy" ? "The galaxy" : from === "star" ? "Its star" : "The stars around";
    worldPanel.showForeign(star, index, w, Math.floor(now() / YEAR));
    worldPanel.visible = true;
  };
  // Out to the whole galaxy: its disk drawn from its own numbers, tapped for the stars there.
  const galaxyPanel = new GalaxyPanel(hud, client);
  let galaxyPlan: GalaxyPlan | null = null,
    galaxyDrawn = "";
  const GALAXY_STARS = { low: 6000, balanced: 15000, high: 30000, ultra: 50000 } as const;
  const toGalaxy = async () => {
    galaxyPlan ??= await client.query<GalaxyPlan>({ type: "galaxy.plan" });
    scale = "galaxy";
    stage.backdrop("space");
    globe.visible = false;
    planetPanel.visible = false;
    starScene.visible = false;
    clusterPanel.visible = false;
    skyScene.visible = false;
    systemPanel.visible = false;
    if (galaxyDrawn !== stage.quality.name) {
      galaxyScene.build(galaxyPlan, GALAXY_STARS[stage.quality.name]);
      galaxyDrawn = stage.quality.name;
    }
    galaxyScene.mark(null);
    galaxyScene.visible = true;
    galaxyPanel.show(galaxyPlan);
    galaxyPanel.visible = true;
    const R = galaxyPlan.radius / 1000;
    rig.configure({
      distance: (R * 2.3) / Math.min(1, aspect()),
      minDistance: 2,
      maxDistance: R * 6,
      pitch: -55,
      minPitch: -89,
      maxPitch: -5,
      drift: 0.4,
      target: [0, 0, 0],
    });
  };
  const tapGalaxy = (x: number, y: number) => {
    if (!galaxyPlan) return;
    const at = galaxyScene.pick(x, y);
    if (!at) return;
    galaxyScene.mark(at, galaxyPlan.radius / 1000 / 40);
    const from = lyFromHome(galaxyPlan, at.x, at.z);
    void galaxyPanel.near(from.x, from.y);
  };
  galaxyPanel.onStar = (s) => {
    if (!galaxyPlan || !s) return;
    const home = homeOf(galaxyPlan);
    galaxyScene.mark(
      { x: home.x + s.x / 1000, z: home.z + s.y / 1000 },
      galaxyPlan.radius / 1000 / 80,
    );
  };
  galaxyPanel.onVisit = (star, i) => void toForeignWorld(star, i, "galaxy");
  galaxyPanel.onBack = () => {
    galaxyScene.visible = false;
    galaxyPanel.visible = false;
    void toCluster();
  };
  clusterPanel.onGalaxy = () => void toGalaxy();
  clusterPanel.onVisit = (star, i) => void toForeignWorld(star, i, "cluster");
  // One zoom (M88): pushing on past a scale's nearest or farthest view goes through to the
  // next — out from a village to its land, the world, its sky, the stars about it and the
  // galaxy; in again to the land and the village under the middle of the screen — each
  // readied ahead as the view nears its edge, a quick fade over the swap, and a word on the
  // screen only while a scale is still being readied (at once, on a phone, for the heavy ones).
  const readying = document.createElement("div"),
    swap = document.createElement("div"),
    edgeHint = document.createElement("div");
  readying.className = "readying";
  readying.hidden = true;
  swap.className = "swap";
  edgeHint.className = "edge-hint";
  edgeHint.style.opacity = "0";
  hud.append(swap, readying, edgeHint);
  const ready = async <T>(what: string, work: () => Promise<T> | T, heavy = false): Promise<T> => {
    const say = () => {
      readying.textContent = `Readying ${what}…`;
      readying.hidden = false;
    };
    const late = setTimeout(say, heavy && tier.name === "phone" ? 0 : 160);
    try {
      return await work();
    } finally {
      clearTimeout(late);
      readying.hidden = true;
    }
  };
  const fadeOver = async (swapNow: () => Promise<void> | void) => {
    swap.classList.add("on");
    await new Promise((r) => setTimeout(r, 90));
    try {
      await swapNow();
    } finally {
      requestAnimationFrame(() => swap.classList.remove("on"));
    }
  };
  /** Turn the globe to a spot of its fine grid, from so far off. */
  const faceSpot = (spot: number, distance?: number) => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions;
    rig.halt();
    rig.yaw = (Math.atan2(p[spot * 3]!, p[spot * 3 + 2]!) * 180) / Math.PI;
    rig.pitch = (-Math.asin(p[spot * 3 + 1]!) * 180) / Math.PI;
    if (distance) {
      rig.userZoomed = true;
      rig.distance = distance;
    }
  };
  /**
   * Readied ahead, as the view nears the far edge of the world, its sky or the stars: the
   * next scale out only (built as its own scale would build it), and never nearer in, where
   * the land and the village are drawn.
   */
  let aheadBusy = false;
  const readyAhead = () => {
    if (aheadBusy) return;
    const next =
      scale === "globe" && !systemPlan
        ? async () => {
            systemPlan = await client.query<SystemPlan>({ type: "planet.system" });
            skyScene.build(systemPlan);
            skyBuilt = "home";
          }
        : scale === "system" && !clusterPlan
          ? async () => {
              clusterPlan = await client.query<ClusterPlan>({ type: "galaxy.cluster" });
              starScene.build(clusterPlan);
            }
          : scale === "cluster" && !galaxyPlan
            ? async () => {
                galaxyPlan = await client.query<GalaxyPlan>({ type: "galaxy.plan" });
              }
            : null;
    if (!next) return;
    aheadBusy = true;
    void next().finally(() => {
      aheadBusy = false;
    });
  };
  const OUT_TO: Partial<Record<string, string>> = {
      village: "its land",
      region: "the world",
      globe: "the sky",
      system: "the stars about us",
      cluster: "the galaxy",
      world: "where you came from",
    },
    IN_TO: Partial<Record<string, string>> = {
      galaxy: "the stars about us",
      cluster: "the star under the pointer",
      system: "the world under the pointer",
      globe: "the land under the pointer",
      region: "the village nearest the pointer",
    };
  stage.onUpdate(() => {
    const edge = rig.edge,
      next = edge > 0 ? OUT_TO[scale] : edge < 0 ? IN_TO[scale] : undefined;
    if (edge > 0.6) readyAhead();
    // At an edge with somewhere to go: say so.
    const show = !!next && Math.abs(edge) > 0.97;
    edgeHint.textContent = next ? `${edge > 0 ? "Zoom on out" : "Zoom on in"} to ${next}` : "";
    edgeHint.style.opacity = show ? String(0.55 + 0.45 * rig.pushing) : "0";
  });
  // Out from the world, the sky's view follows the home world round its orbit while it is
  // close, and eases onto the star as it draws back.
  let followHome = false;
  stage.onUpdate(() => {
    if (scale !== "system" || !systemPlan || skyStar || !followHome) return;
    const home = systemSpec(systemPlan, now())[0]!,
      k = Math.max(0, Math.min(1, (rig.distance - 4) / 30));
    rig.target.set(home.x * (1 - k), 0, home.z * (1 - k));
    if (k >= 1) followHome = false;
  });
  let through = false;
  /** A village's view turned on its battle, the line where the hosts meet (M95). */
  const faceBattle = (): boolean => {
    const front = scale === "village" && plan ? battleFront(plan) : null;
    if (!front) return false;
    rig.target.set(front.x * VILLAGE_METRE, 0, front.z * VILLAGE_METRE);
    rig.userZoomed = true;
    // (Near enough to see each soldier: some ninety metres off.)
    rig.distance = 9;
    return true;
  };
  exposed.faceBattle = faceBattle;
  const zoomThrough = async (way: "in" | "out") => {
    followHome = false;
    if (way === "out") {
      if (scale === "village") {
        const tile = villages.find((v) => v.ref === plan?.ref)?.tile;
        await fadeOver(() => villagePanel.onBack?.());
        // Low over the village, its land about it.
        const at = tile === undefined ? null : region.groundAt(tile);
        if (at) rig.target.set(at.x, at.y, at.z);
        rig.userZoomed = true;
        rig.distance = 18;
      } else if (scale === "region") {
        // Facing the spot the land's map was looked at, not only its middle.
        // (This land's map only: another's, not yet replaced, would face somewhere else.)
        const frame = client.latestFrame("region"),
          own = (frame?.meta as { center?: number } | undefined)?.center === regionCell,
          parent = own ? (frame?.arrays.parent as Int32Array | undefined) : undefined,
          looked = parent?.[region.tileAt(rig.target.x, rig.target.z)],
          spot = looked ?? centres.get(regionCell);
        await fadeOver(() => toGlobe());
        if (spot !== undefined) faceSpot(spot, 1.6);
      } else if (scale === "globe") {
        await fadeOver(() => ready("the sky", () => toSystem(), true));
        // Close on the home world (followed round its orbit), the rest of its system about it.
        followHome = true;
        rig.userZoomed = true;
        rig.distance = 3.2;
      } else if (scale === "system") {
        await fadeOver(() => ready("the stars about us", () => toCluster(), true));
        rig.userZoomed = true;
        rig.distance = 20;
        // (Out of another star's system: the stars about it, it in the middle.)
        const star = skyStar ? clusterPlan?.stars.find((x) => x.ref === skyStar!.ref) : undefined;
        if (star) rig.target.set(star.x * LY_SCALE, star.z * LY_SCALE, star.y * LY_SCALE);
      } else if (scale === "world") {
        await fadeOver(() => worldPanel.onBack());
      } else if (scale === "cluster") {
        await fadeOver(() => ready("the galaxy", () => toGalaxy(), true));
        if (galaxyPlan) {
          const home = homeOf(galaxyPlan);
          rig.target.set(home.x, 0, home.z);
        }
        rig.userZoomed = true;
        rig.distance = 70;
      }
    } else if (scale === "galaxy") {
      await fadeOver(() =>
        ready(
          "the stars about us",
          () => {
            galaxyScene.visible = false;
            galaxyPanel.visible = false;
            return toCluster();
          },
          true,
        ),
      );
      rig.userZoomed = true;
      rig.distance = 150;
    } else if (scale === "cluster") {
      // Into the star under the pointer: another's, its world seen whole; our own, our sky.
      const i = rig.pointer ? starScene.pick(rig.pointer.x, rig.pointer.y) : null,
        star = i === null ? undefined : clusterPlan?.stars[i];
      if (star && star.distance > 0 && star.planets > 0) {
        const page = await client.query<StarPage>({ type: "galaxy.star", args: { ref: star.ref } });
        await fadeOver(() => ready("its worlds", () => toStarSystem(page), true));
        return;
      }
      await fadeOver(() =>
        ready(
          "our sky",
          () => {
            starScene.visible = false;
            clusterPanel.visible = false;
            return toSystem();
          },
          true,
        ),
      );
      rig.userZoomed = true;
      rig.distance = 260;
    } else if (scale === "system") {
      // Into the world under the pointer: another of the system, seen whole; else our own.
      const i = rig.pointer ? skyScene.pick(rig.pointer.x, rig.pointer.y) : null;
      // (Another star's: the world under the pointer, else the nearest to the middle.)
      if (skyStar && skyPlan?.bodies.length) {
        const star = skyStar,
          at = i ?? skyScene.pick(innerWidth / 2, innerHeight / 2) ?? 0;
        await fadeOver(() => ready("that world", () => toForeignWorld(star, at, "star"), true));
        return;
      }
      if (i !== null && i > 0 && systemPlan?.bodies[i]) {
        worldFrom = "system";
        worldPanel.backTo = "The sky";
        await fadeOver(() => ready("that world", () => toWorld(i), true));
        return;
      }
      await fadeOver(() => {
        stopSky?.();
        stopSky = null;
        client.setSpeed(planetPanel.speed);
        toGlobe();
      });
      rig.userZoomed = true;
      rig.distance = 10;
    } else if (scale === "globe") {
      // Down into the land under the pointer (else the middle of the screen; the sea has
      // none), that spot of it in the middle.
      const frame = client.latestFrame("globe"),
        at = rig.aimed,
        len = at ? Math.hypot(at.x, at.y, at.z) || 1 : 1;
      let spot = !frame
          ? null
          : at
            ? nearestCell(
                sphereGrid((frame.meta as { frequency: number }).frequency),
                at.x / len,
                at.y / len,
                at.z / len,
              )
            : globe.pick(innerWidth / 2, innerHeight / 2),
        cell =
          spot === null || !frame
            ? null
            : ((frame.arrays.province as Int32Array | undefined)?.[spot] ?? null);
      // (Over the sea near a coast: the nearest land, a few spots off, is what was meant.)
      if ((cell === null || cell < 0) && spot !== null && frame) {
        const near = landNear(spot, frame);
        if (near) {
          spot = near.spot;
          cell = near.cell;
        }
      }
      if (cell === null || cell < 0 || !density.has(cell)) return;
      arriveAt = spot;
      await fadeOver(() => ready("the land", () => toRegion(cell)));
      rig.userZoomed = true;
      rig.distance = 150;
    } else if (scale === "region") {
      // Into the village nearest the pointer (else the middle of the screen).
      const aim = rig.pointer ?? { x: innerWidth / 2, y: innerHeight / 2 },
        on = region.screenOf(villages.map((v) => v.tile));
      let best = -1,
        bestD = Infinity;
      on.forEach((p, i) => {
        if (!p) return;
        const d = Math.hypot(p.x - aim.x, p.y - aim.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) return;
      const ref = villages[best]!.ref,
        // (Zoomed in on a battle: its village's view faces the fight.)
        war = regionWars.pick(aim.x, aim.y, 160);
      await fadeOver(() => ready("the village", () => toVillage(ref)));
      if (war?.startsWith("ev:")) faceBattle();
    } else if (scale === "world") {
      // (A world seen whole goes in no further: a world of people is its globe, the home one.)
      return;
    }
  };
  // Free roam (Phase 10 M98): the camera flown where the viewer will — or walked, among a
  // village's people — above the ground and out of the walls, and on through the scales by
  // height, as zooming goes: up out of a village into its land and out to the world, down
  // out of the sky into the land below and into the village flown down to.
  const free = new FreeRig(stage, canvas),
    freeControls = new FreeControls(corner);
  let roaming: FreeMode = "orbit",
    passing = false;
  /** How the free camera moves at the scale shown. */
  const roamRules = (mode: FreeMode): FreeRules => {
    const M = VILLAGE_METRE;
    switch (scale) {
      case "village":
        return mode === "walk"
          ? { speed: 1.4 * M, height: 5, clearance: 0.1 * M, walk: { eye: 1.7 * M } }
          : { speed: 5 * M, height: 25 * M, clearance: 1.5 * M };
      case "region":
        return { speed: 0.5, height: 8, clearance: 0.12 };
      case "globe":
      case "world":
        // (As fast as it is high over the globe's face: its width crossed in a few seconds.)
        return {
          speed: 0.02,
          height: 0.15,
          clearance: 0,
          space: true,
          round: true,
          pace: (s) => Math.max(0.01, Math.hypot(s.x, s.y, s.z) - 1) * 0.6,
        };
      default:
        // The sky, the stars, the galaxy: as quick as the view is wide.
        return {
          speed: Math.max(0.05, rig.distance * 0.06),
          height: rig.distance,
          clearance: 0,
          space: true,
        };
    }
  };
  const roamGround = (): ((x: number, z: number) => number | null) =>
    scale === "village"
      ? () => 0
      : scale === "region"
        ? (x, z) => region.heightAt(x, z)
        : () => null;
  const roamKeep = (mode: FreeMode): ((s: FreeState) => FreeState) | null => {
    if (scale === "village" && plan) {
      const ground = villageGround(plan),
        M = VILLAGE_METRE;
      // (Among the homes, out of their walls: walking, or flown as low as their roofs.)
      return (s) => {
        if (mode !== "walk" && s.y > 9 * M) return s;
        const p = { x: s.x / M, z: s.z / M };
        keepOut(ground, p, 0.4);
        return { ...s, x: p.x * M, z: p.z * M };
      };
    }
    if (scale === "globe" || scale === "world")
      return (s) => {
        // Off its face, and no farther than its sky (a world seen whole has no sky to go on to).
        const r = Math.hypot(s.x, s.y, s.z),
          k = r < 1.03 ? 1.03 / r : r > 16 ? 16 / r : 1;
        return k === 1 ? s : { ...s, x: s.x * k, y: s.y * k, z: s.z * k };
      };
    return null;
  };
  const setRoam = (asked: FreeMode, handBack = true) => {
    const mode: FreeMode = asked === "walk" && scale !== "village" ? "fly" : asked;
    if (mode === "orbit") {
      if (free.on && handBack) {
        // Handed back to the orbit: turning about where the free camera looks, from where it stood.
        const l = rig.limits,
          groundY = scale === "region" ? region.heightAt(free.state.x, free.state.z) : 0,
          round = scale === "globe" || scale === "world";
        if (round) {
          const s = free.state;
          rig.target.set(0, 0, 0);
          rig.yaw = (Math.atan2(s.x, s.z) * 180) / Math.PI;
          rig.pitch = Math.max(
            l.minPitch,
            Math.min(
              l.maxPitch,
              (-Math.asin(s.y / (Math.hypot(s.x, s.y, s.z) || 1)) * 180) / Math.PI,
            ),
          );
          rig.distance = Math.max(l.min, Math.min(l.max, Math.hypot(s.x, s.y, s.z)));
        } else {
          const o = orbitOf(free.state, groundY, l.max * 0.5);
          rig.target.set(o.target.x, o.target.y, o.target.z);
          rig.yaw = o.yaw;
          rig.pitch = Math.max(l.minPitch, Math.min(l.maxPitch, o.pitch));
          rig.distance = Math.max(l.min, Math.min(l.max, o.distance));
        }
        rig.userZoomed = true;
      }
      free.stop(passing);
      rig.enabled = true;
    } else {
      free.ground = roamGround();
      free.keep = roamKeep(mode);
      // (From the orbit's own place, not the camera lifted clear of the bar: over a globe that
      // lift is degrees of its face, and "up" would rise over another spot.)
      const v = rig.view,
        y = (v.yaw * Math.PI) / 180,
        p = (v.pitch * Math.PI) / 180;
      free.start(roamRules(mode), {
        x: v.target.x + v.distance * Math.cos(p) * Math.sin(y),
        y: v.target.y - v.distance * Math.sin(p),
        z: v.target.z + v.distance * Math.cos(p) * Math.cos(y),
        yaw: v.yaw,
        pitch: v.pitch,
      });
      rig.enabled = false;
      // Walking: down among the people, at the eye's height, looking along the ground.
      if (mode === "walk") {
        const s = free.state,
          o = orbitOf(s, 0, 40 * VILLAGE_METRE);
        free.state = { ...s, x: o.target.x, y: 1.7 * VILLAGE_METRE, z: o.target.z, pitch: -4 };
      }
    }
    roaming = mode;
    // (The scales' own hints — "drag to turn" — are not how a free camera goes.)
    document.body.classList.toggle("roaming", mode !== "orbit");
    freeControls.set(mode, scale === "village");
  };
  freeControls.onMode = setRoam;
  exposed.roaming = () => roaming;
  exposed.freeState = () => ({ ...free.state, passing });
  // The spot of the globe under the free camera, its land, and the land nearest (look tools).
  exposed.spotBelow = () => {
    const frame = client.latestFrame("globe"),
      s = free.state,
      r = Math.hypot(s.x, s.y, s.z) || 1;
    if (!frame) return null;
    const spot = nearestCell(
        sphereGrid((frame.meta as { frequency: number }).frequency),
        s.x / r,
        s.y / r,
        s.z / r,
      ),
      province = (frame.arrays.province as Int32Array | undefined)?.[spot] ?? -1;
    return {
      spot,
      province,
      peopled: density.has(province),
      near: landNear(spot, frame),
      land: regionCell,
      map: (client.latestFrame("region")?.meta as { center?: number } | undefined)?.center ?? null,
    };
  };
  freeControls.onStick = (s) => (free.stick = s);
  free.onTap = (x, y) => rig.tap(x, y);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && roaming !== "orbit") setRoam("orbit");
  });
  // Where the free camera's scale should change (by its height), and into what.
  free.onMoved = (s) => {
    if (passing || roaming === "orbit") return;
    const mode = roaming,
      go = (how: () => Promise<void>) => {
        passing = true;
        setRoam("orbit");
        void how().finally(() => {
          // (A frame for the next scale's orbit to stand the camera, then on roaming.)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              passing = false;
              setRoam(mode === "walk" && scale !== "village" ? "fly" : mode);
            }),
          );
        });
      };
    if (scale === "village" && s.y > 140 * VILLAGE_METRE) go(() => zoomThrough("out"));
    else if (scale === "region") {
      const under = region.heightAt(s.x, s.z);
      if (s.y - under > 180) {
        // Out to the world, facing the spot flown over (set once the orbit has the camera
        // back: handing it back turns it about where the free camera looked).
        go(async () => {
          rig.target.set(s.x, under, s.z);
          await zoomThrough("out");
        });
      } else if (s.y - under < 0.6) {
        const tile = region.villageNear(region.tileAt(s.x, s.z), 1),
          v = tile === null ? undefined : villages.find((x) => x.tile === tile);
        if (v)
          go(async () => {
            await fadeOver(() => ready("the village", () => toVillage(v.ref)));
            rig.distance = 20;
          });
      }
    } else if (scale === "globe") {
      const r = Math.hypot(s.x, s.y, s.z);
      // Far out from the world: on into its sky.
      if (r > 14) go(() => zoomThrough("out"));
      else if (r < 1.07) {
        // Down into the land flown down to.
        rig.aimed = { x: s.x / r, y: s.y / r, z: s.z / r };
        rig.pointer = null;
        go(() => zoomThrough("in"));
      }
    }
  };
  // (A scale left while roaming by its own buttons, or gone to: the orbit takes the camera back,
  // as the new scale stands it.)
  let roamedAt = "";
  stage.onUpdate(() => {
    if (roamedAt !== scale) {
      if (roaming !== "orbit" && !passing) setRoam("orbit", false);
      freeControls.set(roaming, scale === "village");
      roamedAt = scale;
    }
  });
  rig.onBeyond = (way) => {
    if (through) return;
    through = true;
    void zoomThrough(way).finally(() => {
      through = false;
    });
  };
  exposed.zoomThrough = (way: "in" | "out") => zoomThrough(way);
  exposed.scale = () => scale;
  exposed.faceSpot = faceSpot;
  exposed.galaxy = () => void toGalaxy();
  exposed.visitForeign = async (ref: string, index: number) =>
    toForeignWorld(
      await client.query<StarPage>({ type: "galaxy.star", args: { ref } }),
      index,
      "cluster",
    );
  exposed.galaxyStars = () =>
    scale === "galaxy" && galaxyPlan ? GALAXY_STARS[stage.quality.name] : 0;
  exposed.tapGalaxy = tapGalaxy;
  exposed.visit = (i: number) => void toWorld(i);
  exposed.visiting = () => (scale === "world" && seen ? seenAt : -1);
  systemPanel.onBack = () => {
    // (From another star's system, back to the stars about it.)
    if (skyStar) {
      skyScene.visible = false;
      systemPanel.visible = false;
      void toCluster();
      return;
    }
    stopSky?.();
    stopSky = null;
    client.setSpeed(planetPanel.speed);
    toGlobe();
  };
  exposed.sky = () => void toSystem();
  exposed.skyBodies = () => (scale === "system" && skyPlan ? skyPlan.bodies.length : 0);
  /** Whose system the sky shows: the home star's (null), or another's ref. */
  exposed.skyOf = () => (scale === "system" ? (skyStar?.ref ?? null) : null);
  let fleetsNamed = false;
  stage.onUpdate(() => {
    if (scale !== "cluster" || !clusterPlan) return;
    starScene.voyages(voyageMarks(clusterPlan, sky, now() / YEAR));
    // Each war fleet as its counter (M101): its realm's arms and its strength, edged by how
    // it stands to what is followed.
    const counters: Label[] = starScene.fleetsOnScreen().map((h) => ({
      key: `fleet:${h.ref}`,
      text: h.strength.toFixed(1),
      at: { x: h.sx, y: h.sy },
      priority: 1.5e9,
      badge: {
        realm: h.realm,
        stance: followedRefs.has(h.realm) ? "ours" : followedRefs.has(h.enemy) ? "foe" : undefined,
      },
    }));
    if (counters.length || fleetsNamed) labels.update(counters);
    fleetsNamed = counters.length > 0;
  });
  stage.onUpdate(() => {
    if (scale !== "system" || !skyPlan) return;
    const t = now(),
      spots = systemSpec(skyPlan, t);
    skyScene.update(spots);
    // (Another star's has none of ours about it.)
    skyScene.marks(skyMarks(skyStar ? { programs: [], colonies: [] } : sky, spots, t));
  });
  planetPanel.onClose = () => globe.mark(null);
  // Down into a village to watch its day, and back up to its land. Watching is
  // looking: the plan is read from the host, the day is drawn by the view, and
  // nothing is sent back but the speed.
  let plan: VillagePlan | null = null,
    planYear = -1,
    watched: number | null = null,
    clock = { t: 0, wall: 0, speed: 0 },
    shown = 0;
  client.onStatus((s) => (clock = { t: s.t, wall: performance.now(), speed: s.speed }));
  /** The sim time now, carried forward smoothly between the host's reports. */
  const now = () => {
    const ahead = Math.min(1, (performance.now() - clock.wall) / 1000) * clock.speed;
    shown = Math.max(shown, clock.t + ahead);
    return Math.min(shown, clock.t + clock.speed);
  };
  const loadPlan = async (ref: string) => {
    // Asked once a year: the year is marked before the answer comes.
    planYear = Math.floor(clock.t / YEAR);
    const q0 = performance.now();
    plan = await client.query<VillagePlan>({
      type: "village.plan",
      args: { ref, families: stage.quality.families },
    });
    performance.measure("village.plan", { start: q0 });
    const t0 = performance.now();
    village.build(plan);
    performance.measure("village.build", { start: t0 });
    villagePanel.show(plan.name, WATCH_DEFAULT);
    villagePanel.hand = plan.hand;
    villagePanel.works = { era: plan.era, what: plan.works?.mine?.what ?? null };
  };
  const toVillage = async (ref: string) => {
    scale = "village";
    stage.backdrop("ground", 40, true);
    labels.clear();
    bubbles.clear();
    // Whichever way it came (a region, or straight from the globe), only the village shows.
    globe.visible = false;
    planetPanel.visible = false;
    region.visible = false;
    regionPanel.visible = false;
    watched = null;
    village.mark(null);
    shown = 0;
    await loadPlan(ref);
    village.visible = true;
    villagePanel.visible = true;
    client.setSpeed(WATCH_DEFAULT);
    rig.configure({
      // A city is seen from further off: most of its quarters in view.
      distance: plan?.districts ? 78 : 26,
      minDistance: 3,
      maxDistance: 140,
      pitch: -38,
      minPitch: -85,
      maxPitch: -8,
      drift: 0.8,
      target: [0, 0, 0],
    });
    // (And its haze starts as far off.)
    if (plan?.districts) stage.backdrop("ground", 110, true);
  };
  // A tap in the village: someone, else a beast (its lineage and what it is doing), else no one.
  const tapVillage = (x: number, y: number) => {
    const i = village.pick(x, y);
    if (i !== null) return selectPerson(i);
    const beast = village.pickBeast(x, y);
    if (!beast) {
      selectPerson(null);
      // (A soldier of its battle, a home, a field: their pages.)
      const thing = villageThingAt(x, y);
      if (thing) void pageWindow.open(thing);
      else pageWindow.close();
      return;
    }
    selectPerson(null);
    village.markBeast(beast.index);
    void pageWindow.open(beast.ref).then(() => pageWindow.setLive(`Now ${beast.doing}`));
  };
  const selectPerson = (i: number | null) => {
    watched = i;
    village.mark(i);
    if (i !== null) village.markBeast(null);
    if (i === null || !plan) return;
    void pageWindow.open(plan.people[i]!.ref);
  };
  regionPanel.onWatch = (ref) => void toVillage(ref);
  villagePanel.onSpeed = (s) => client.setSpeed(s);
  villagePanel.onClose = () => selectPerson(null);
  villagePanel.onBack = () => {
    village.visible = false;
    villagePanel.visible = false;
    plan = null;
    client.setSpeed(planetPanel.speed);
    toRegion(regionCell);
  };
  stage.onUpdate(() => {
    if (scale !== "village" || !plan) return;
    const t = now();
    stage.daylight((t % DAY) / DAY);
    village.update(t);
    villagePanel.tick(t);
    if (watched !== null) {
      villagePanel.moment(village.momentAt(watched));
      // (What they are doing now, on their page.)
      const m = village.momentAt(watched),
        p = plan.people[watched];
      if (m && p && pageWindow.current === p.ref) pageWindow.setLive(villagePanel.nowWords(m));
    }
    // The years turn: re-read the plan, so those who died are gone.
    if (Math.floor(clock.t / YEAR) !== planYear) void loadPlan(plan.ref);
    if (signs) bubbles.update(village.bubbles());
    // Families met are named over their homes; under the hand, the village is its own name.
    if (plan.hand) {
      labels.update([]);
      return;
    }
    const names = new Map(
      plan.people.map((p) => [plan!.homes[p.home]!.household, p.name.split(" ").at(-1)!]),
    );
    labels.update(
      village.homesOnScreen().map((h) => ({
        key: h.household,
        text: names.get(h.household) ?? "",
        at: h.at,
        priority: 1,
      })),
    );
  });
  exposed.watch = (ref: string) => void toVillage(ref);
  exposed.watching = () => (scale === "village" && plan ? plan.people.length : 0);
  exposed.beasts = () => (scale === "village" ? village.beastsDrawn : 0);
  exposed.faunaNow = () => (scale === "village" ? village.faunaNow() : []);
  exposed.holdFauna = (s: number | null) => {
    village.heldFauna = s;
  };
  exposed.carriersNow = () => (scale === "village" ? village.carriersNow() : []);
  exposed.bubblesNow = () => (scale === "village" ? village.bubbles() : []);
  exposed.peopleNow = () => (scale === "village" ? village.peopleNow() : []);
  exposed.rig = rig;

  // Going to anything (Phase 10 M92): a page's place, from whatever scale is up — the scale
  // left as its own way back would leave it, the world's clock given back, and the way
  // there taken under one fade (through the world, which every scale opens from).
  const leaveScale = () => {
    if (scale === "village") {
      village.visible = false;
      villagePanel.visible = false;
      plan = null;
      watched = null;
      client.setSpeed(planetPanel.speed);
    } else if (
      scale === "system" ||
      scale === "cluster" ||
      scale === "galaxy" ||
      scale === "world"
    ) {
      stopSky?.();
      stopSky = null;
      client.setSpeed(planetPanel.speed);
      galaxyScene.visible = false;
      galaxyPanel.visible = false;
      worldScene.visible = false;
      worldPanel.visible = false;
    }
  };
  // Keeping a person in view (Phase 10 M94): the village's view follows them as they go.
  let keeping: string | null = null;
  const keep = (ref: string | null) => {
    keeping = ref;
    rig.follow = ref
      ? () => {
          const i = plan?.people.findIndex((p) => p.ref === keeping) ?? -1,
            m = i >= 0 ? village.momentAt(i) : null;
          return m && !m.hidden ? { x: m.x * VILLAGE_METRE, y: 0, z: m.z * VILLAGE_METRE } : null;
        }
      : null;
    pageWindow.redrawActions();
  };
  pageWindow.sceneActions = (page) => {
    if (
      scale !== "village" ||
      page.kind !== "person" ||
      !plan?.people.some((p) => p.ref === page.ref)
    )
      return [];
    const on = keeping === page.ref;
    return [
      {
        label: on ? "🎯 Kept in view ✓" : "🎯 Keep in view",
        title: "The view follows them as they go (a drag still turns about them)",
        on,
        run: () => {
          keep(on ? null : page.ref);
          if (!on) rig.flyTo({ distance: Math.min(rig.distance, 9) }, 0.8);
        },
      },
    ];
  };
  // (Kept in view only in their village: another scale, or another village, lets them go.)
  stage.onUpdate(() => {
    if (keeping && (scale !== "village" || !plan?.people.some((p) => p.ref === keeping)))
      keep(null);
  });
  /** The land nearest a spot of the sea, within a few spots (a coast zoomed at), if any. */
  const landNear = (
    spot: number,
    frame: NonNullable<ReturnType<typeof client.latestFrame>>,
  ): { spot: number; cell: number } | null => {
    const grid = sphereGrid((frame.meta as { frequency: number }).frequency),
      province = frame.arrays.province as Int32Array | undefined;
    if (!province) return null;
    let ring = [spot];
    const seen = new Set(ring);
    for (let step = 0; step < 3; step++) {
      const next: number[] = [];
      for (const s of ring)
        for (let k = grid.offsets[s]!; k < grid.offsets[s + 1]!; k++) {
          const n = grid.neighbours[k]!;
          if (seen.has(n)) continue;
          seen.add(n);
          const cell = province[n] ?? -1;
          if (cell >= 0 && density.has(cell)) return { spot: n, cell };
          next.push(n);
        }
      ring = next;
    }
    return null;
  };
  /** Where a spot of the globe is to be faced from (the orbit's turn and tilt). */
  const facingOf = (spot: number): { yaw: number; pitch: number } | null => {
    const frame = client.latestFrame("globe");
    if (!frame) return null;
    const p = sphereGrid((frame.meta as { frequency: number }).frequency).positions;
    return {
      yaw: (Math.atan2(p[spot * 3]!, p[spot * 3 + 2]!) * 180) / Math.PI,
      pitch: (-Math.asin(p[spot * 3 + 1]!) * 180) / Math.PI,
    };
  };
  const goTo = async (place: Place) => {
    walk.saw("scale");
    // Where it is already in the scene shown: a flight there, not a fade (M94).
    if (scale === "globe" && place.scale === "globe") {
      const f = facingOf(place.spot);
      if (f) {
        rig.flyTo({ ...f, distance: 2.2 });
        globe.mark(place.spot);
        return;
      }
    }
    if (scale === "region" && place.scale === "region" && place.cell === regionCell) {
      const at = place.tile === undefined ? null : region.groundAt(place.tile);
      rig.flyTo({ target: at ?? { x: 0, y: 0, z: 0 }, distance: at ? 60 : regionFit() });
      if (place.tile !== undefined) region.mark(place.tile);
      return;
    }
    if (scale === "village" && place.scale === "village" && place.town === plan?.ref) {
      const who = place.person,
        i = who ? plan.people.findIndex((p) => p.ref === who) : -1,
        m = i >= 0 ? village.momentAt(i) : null;
      if (m) {
        watched = i;
        village.mark(i);
        rig.flyTo({
          target: { x: m.x * VILLAGE_METRE, y: 0, z: m.z * VILLAGE_METRE },
          distance: 8,
        });
        keep(who!);
      } else rig.flyTo({ target: { x: 0, y: 0, z: 0 }, distance: plan.districts ? 78 : 26 });
      return;
    }
    const town =
      place.scale === "village"
        ? await client.query<{ cell: number }>({ type: "settlement", args: { ref: place.town } })
        : null;
    const star =
      place.scale === "world"
        ? await client.query<StarPage>({ type: "galaxy.star", args: { ref: place.star } })
        : null;
    await fadeOver(async () => {
      leaveScale();
      if (scale !== "globe") toGlobe();
      switch (place.scale) {
        case "globe":
          faceSpot(place.spot, 2.2);
          globe.mark(place.spot);
          swoop();
          return;
        case "region": {
          await ready("the land", () => toRegion(place.cell));
          const at = place.tile === undefined ? null : region.groundAt(place.tile);
          if (at) {
            rig.target.set(at.x, at.y, at.z);
            rig.distance = 60;
            region.mark(place.tile!);
          }
          swoop();
          return;
        }
        case "village": {
          regionCell = town!.cell;
          await ready("the village", () => toVillage(place.town));
          const who = place.person;
          if (who && plan) {
            const i = plan.people.findIndex((p) => p.ref === who);
            if (i >= 0) {
              watched = i;
              village.mark(i);
              // (Their village come to: the view on them, kept on them as they go.)
              const m = village.momentAt(i);
              if (m) {
                rig.target.set(m.x * VILLAGE_METRE, 0, m.z * VILLAGE_METRE);
                rig.distance = 8;
              }
              keep(who);
            }
          }
          swoop();
          return;
        }
        case "system":
          await ready("the sky", () => toSystem(), true);
          if (place.body !== undefined) skyScene.mark(place.body);
          return;
        case "body":
          await ready("the sky", () => toSystem(), true);
          await toWorld(place.index);
          return;
        case "cluster": {
          await ready("the stars about us", () => toCluster(), true);
          const i = clusterPlan?.stars.findIndex((x) => x.ref === place.star) ?? -1;
          if (i >= 0) starScene.mark(i, clusterPlan);
          return;
        }
        case "galaxy":
          await ready("the galaxy", () => toGalaxy(), true);
          return;
        case "world":
          await toForeignWorld(star!, place.index, "cluster");
          return;
      }
    });
  };
  /** Come to a scale: drawn back a little, and in to where it stands, as if flown there. */
  const swoop = () => {
    const to = rig.distance;
    rig.distance = Math.min(rig.limits.max, to * 1.8);
    rig.flyTo({ distance: to }, 0.9);
  };
  pageWindow.onGoTo = (place) => void goTo(place);
  // What a page is of, lit in the scene when it is there (a link followed, not only a tap).
  pointAt = (page) => {
    const p = page.place;
    if (!p) return;
    if (scale === "globe") {
      const spot =
        p.scale === "globe" ? p.spot : p.scale === "region" ? centres.get(p.cell) : undefined;
      if (spot !== undefined) globe.mark(spot);
    } else if (scale === "region") {
      if (p.scale === "village") {
        const v = villages.find((x) => x.ref === p.town);
        if (v) region.mark(v.tile);
      } else if (p.scale === "region" && p.tile !== undefined && p.cell === regionCell)
        region.mark(p.tile);
    } else if (scale === "village" && plan) {
      if (page.kind === "lineage") village.markLineage(page.ref);
      else if (p.scale === "village" && p.person && p.town === plan.ref) {
        const i = plan.people.findIndex((x) => x.ref === p.person);
        if (i >= 0) {
          watched = i;
          village.mark(i);
          village.markBeast(null);
        }
      }
    } else if (scale === "system" && (p.scale === "body" || p.scale === "system")) {
      const i = p.scale === "body" ? p.index : p.body;
      if (i !== undefined) skyScene.mark(i);
    } else if (scale === "cluster" && p.scale === "cluster") {
      const i = clusterPlan?.stars.findIndex((x) => x.ref === p.star) ?? -1;
      if (i >= 0) starScene.mark(i, clusterPlan);
    }
  };
  exposed.goTo = async (ref: string) => {
    const place = await client.query<Place | null>({ type: "place", args: { ref } });
    if (place) await goTo(place);
  };

  regionPanel.onBack = () => toGlobe();
  regionPanel.onClose = () => region.mark(null);
  exposed.select = (n: number) => (scale === "globe" ? selectCell(n) : selectTile(n));
  exposed.descend = (cell: number) => toRegion(cell);
  exposed.villages = () => villages.length;

  stage.onUpdate(() => {
    if (scale !== "region" || !villages.length) return;
    const at = region.screenOf(villages.map((v) => v.tile));
    labels.update([
      ...villages.map((v, i) => ({
        key: v.ref,
        text: v.name,
        at: at[i] ?? null,
        priority: v.population,
      })),
      // Its hosts' counters and its battles, over the towns about them (M95, M101).
      ...regionWars.labels().map((l) =>
        l.badge
          ? {
              ...l,
              badge: { realm: l.badge.realm, stance: stanceOf(l.badge.realm, l.badge.war) },
            }
          : l,
      ),
    ]);
  });
  addEventListener("resize", () => {
    if (!rig.userZoomed) rig.distance = scale === "globe" ? globeFit() : regionFit();
  });
  // Open facing the people (the most peopled province), not wherever the camera starts.
  void faceThePeople(false);
  client.onFrame((frame) => {
    if (frame.view === "globe") paintGlobe();
    else if (frame.view === "region") paintRegion();
  });
}

/**
 * The first visit (a bare address, never welcomed before): what the universe is, a
 * choice of where to begin, and how to watch. Links with a universe or seed skip it.
 */
function welcome(): boolean {
  let seen = false;
  try {
    seen = localStorage.getItem("causalis.welcomed") === "1";
  } catch {
    // Storage may be shut (a private window): welcome again, harmlessly.
  }
  if (location.search || seen) return false;
  const words = [
      "amber",
      "kestrel",
      "tide",
      "ember",
      "harrow",
      "lumen",
      "quill",
      "sorrel",
      "vale",
      "wren",
    ],
    pick = () => {
      const u = new Uint32Array(2);
      crypto.getRandomValues(u);
      return `${words[u[0]! % words.length]} ${u[1]! % 1000}`;
    },
    app = document.getElementById("app")!,
    box = document.createElement("div"),
    title = document.createElement("h1"),
    lead = document.createElement("p"),
    choices = document.createElement("div"),
    how = document.createElement("ul");
  box.className = "welcome";
  title.textContent = "Causalis Universe";
  lead.textContent =
    "A universe that runs on its own: worlds, their living things, peoples and their histories, all the way out to the stars. You watch it, ask why anything is so, and — when you choose — lay your hand on it.";
  choices.className = "choices";
  for (const [label, note, query] of [
    ["Earth", "a world like ours, from its first farmers", "?universe=earth"],
    [
      "From the beginning",
      "the galaxy born, a world forming, the first cells, creatures and people — then choose when to begin",
      "?universe=earth&genesis=1",
    ],
    [
      "A world never seen",
      "an open world: any sky, any body, any people",
      `?universe=alien&seed=${encodeURIComponent(pick())}`,
    ],
    ["The sandbox", "a small ring of cells to try the hand on", "?universe=sandbox"],
  ] as const) {
    const b = document.createElement("button"),
      small = document.createElement("small");
    b.className = "choice";
    b.textContent = label;
    small.textContent = note;
    b.append(small);
    b.onclick = () => {
      try {
        localStorage.setItem("causalis.welcomed", "1");
      } catch {
        // Nothing to remember it in: fine.
      }
      location.search = query;
    };
    choices.append(b);
  }
  for (const line of [
    "Tap any place, person or event, and ask “why?” — every answer opens onto its causes.",
    "The lenses colour the world by what you want to see: people, food, trade, realms, tongues, life, ores.",
    "“Look closer” goes down to a land and its villages; “The sky” goes out to the stars.",
    "Your hand — rain, harvest, plague, inspiration, a warmer world, a star's flare — is always a choice, and always in the chronicle.",
  ]) {
    const li = document.createElement("li");
    li.textContent = line;
    how.append(li);
  }
  box.append(title, lead, choices, how);
  app.replaceChildren(box);
  return true;
}

/**
 * The genesis (M89): the world's own beginning, stage by stage, and then where to begin —
 * the world's page, at the year chosen.
 */
async function runGenesisPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SPACE);
  stage.backdrop("space");
  const { client, mode } = await connect();
  Object.assign(exposed, { client, mode, seed, universe, stage, drawn: () => 1 });
  await client.start(universe, seed);
  const { runGenesis } = await import("./genesis.ts");
  await runGenesis({
    stage,
    hud,
    canvas,
    client,
    tier,
    universe,
    seed,
    beginAt: (year) =>
      (location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(seed)}${year > 0 ? `&year=${year}` : ""}`),
    another: () => {
      const u = new Uint32Array(1);
      crypto.getRandomValues(u);
      location.search = `?universe=alien&seed=${encodeURIComponent(`genesis ${u[0]! % 100000}`)}&genesis=1`;
    },
  });
}

async function main(): Promise<void> {
  if (welcome()) return;
  if (bench > 0) return runBenchPage();
  if (universe === "sandbox") return runSandboxPage();
  if (params.has("genesis")) return runGenesisPage();
  return runPlanetPage();
}

main().catch((error: Error) => {
  // A browser that cannot draw in 3D (WebGL off or missing) is told so plainly.
  const webgl = /webgl/i.test(error.message);
  exposed.error = webgl ? "webgl" : error.message;
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  const box = document.createElement("div");
  box.className = "failure";
  const title = document.createElement("h1");
  title.textContent = "Causalis Universe";
  const text = document.createElement("p");
  text.textContent = webgl
    ? "This browser cannot draw in 3D (WebGL is turned off or missing), so the universe cannot be shown here."
    : `Something went wrong while starting: ${error.message}`;
  box.append(title, text);
  app.append(box);
});
