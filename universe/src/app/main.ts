// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run a universe, draw it with PlayCanvas and put the observatory over
// it. ?universe=earth (the default), alien or sandbox; ?seed=…; ?bench=N runs the
// instancing benchmark instead.
import "./styles.css";
import "./y2k.css";
import { HostClient, inlinePair, workerPort } from "../bridge/index.ts";
import {
  GlobeScene,
  OrbitRig,
  RegionScene,
  SandboxScene,
  Stage,
  SystemScene,
  ClusterScene,
  GalaxyScene,
  galaxyMaterial,
  skyMaterials,
  VillageScene,
  AutoQuality,
  QUALITIES,
  QUALITY_NAMES,
  regionMaterials,
  runBench,
  type QualityName,
} from "../render/index.ts";
import {
  LabelLayer,
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
  type PeopleEntry,
} from "../ui/index.ts";
import type {
  ClusterPlan,
  SkyState,
  SystemPlan,
  VillagePlan,
  WorldGlobe,
  GalaxyPlan,
  StarPage,
} from "../bridge/index.ts";
import {
  cellAt,
  cellCenter,
  globeColors,
  regionColors,
  regionHeights,
  regionTrees,
  sandboxSpec,
  skyMarks,
  voyageMarks,
  systemExtent,
  systemSpec,
  worldColors,
  lyFromHome,
  homeOf,
  type Lens,
  type RegionLens,
  type SandboxSpec,
} from "../view/index.ts";
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
  faunaNow?: () => { name: string; niche: string; x: number; z: number; doing: string }[];
  /** Down to another star's world (its star's ref, its place outward). */
  visitForeign?: (ref: string, index: number) => Promise<void>;
  /** Out to the galaxy, how many of its stars are drawn, and a tap on it (screen px). */
  galaxy?: () => void;
  galaxyStars?: () => number;
  tapGalaxy?: (x: number, y: number) => void;
  /** Down to a world of the system (by its index), and which world is seen now (-1 none). */
  visit?: (index: number) => void;
  visiting?: () => number;
  /** Everyone carrying something in the village watched: where and what. */
  carriersNow?: () => { x: number; z: number; carry: string }[];
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
    systemPlan: SystemPlan | null = null;
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
  const planetPanel = new PlanetPanel(hud, client, lens, speed),
    regionPanel = new RegionPanel(hud, client),
    villagePanel = new VillagePanel(hud, client),
    labels = new LabelLayer(hud),
    tidings = new Tidings(hud, client);
  planetPanel.tidings = regionPanel.tidings = villagePanel.tidings = tidings;
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
  labels.blockers = [regionPanel.inspector, villagePanel.inspector];

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
      lens === "realms" ? realms : lens === "faiths" ? faiths : tongues,
    );
    globe.paint(colors);
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
    }
    const colors = regionColors(frame, regionLens);
    region.paint(colors);
    painted = colors.length / 4;
  };
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
    paintGlobe();
    if (["people", "food", "trade", "tongues", "realms", "faiths"].includes(l))
      void faceThePeople(true);
  };
  regionPanel.onLens = (l) => {
    regionLens = l;
    paintRegion();
  };
  client.subscribe<{ carbon: number; warming: number; warmer: string | null }>(
    { type: "planet.air" },
    5000,
    (air) => planetPanel.air(air),
  );
  client.subscribe<PeopleEntry[]>({ type: "people.map" }, 1000, (entries) => {
    planetPanel.people(entries);
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

  const aspect = () => Math.max(0.3, innerWidth / Math.max(1, innerHeight));
  const globeFit = () => (aspect() < 1 ? 3.1 / aspect() : 3.3);
  const regionFit = () => (aspect() < 1 ? 120 / aspect() : 130);
  const selectCell = (cell: number | null) => {
    if (cell !== null) walk.saw("land");
    globe.mark(cell);
    void planetPanel.select(cell);
  };
  const selectTile = (tile: number | null) => {
    region.mark(tile);
    const village = tile === null ? null : region.villageNear(tile);
    const hit = village === null ? undefined : villages.find((v) => v.tile === village);
    if (hit) {
      region.mark(hit.tile);
      void regionPanel.selectVillage(hit.ref);
    } else void regionPanel.select(tile);
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
        ? selectCell(globe.pick(x, y))
        : scale === "region"
          ? selectTile(region.pick(x, y))
          : scale === "system"
            ? selectBody(skyScene.pick(x, y))
            : scale === "cluster"
              ? selectStar(starScene.pick(x, y))
              : scale === "world"
                ? seen && worldPanel.cell(seen, worldScene.pick(x, y))
                : scale === "galaxy"
                  ? tapGalaxy(x, y)
                  : tapVillage(x, y),
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
        sheet = hud.querySelector<HTMLElement>(".panel:not([hidden]) .inspector:not([hidden])"),
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
    systemPanel.select(i);
  };
  const toSystem = async () => {
    scale = "system";
    stage.backdrop("space");
    labels.clear();
    globe.visible = false;
    planetPanel.visible = false;
    if (!systemPlan) {
      systemPlan = await client.query<SystemPlan>({ type: "planet.system" });
      skyScene.build(systemPlan);
    }
    systemPanel.show(systemPlan);
    skyScene.mark(null);
    skyScene.visible = true;
    stopSky?.();
    stopSky = client.subscribe<SkyState>({ type: "space.state" }, 1000, (s) => {
      sky = s;
      systemPanel.update(s);
      clusterPanel.update(s);
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
    void clusterPanel.select(i);
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
    skyScene.visible = false;
    systemPanel.visible = false;
    showWorld(w);
    worldPanel.show(systemPlan, index, w, sky);
    worldPanel.visible = true;
  };
  /** A world made whole, drawn and turned to (every other scale and its panel put away). */
  const showWorld = (w: WorldGlobe) => {
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
    worldFrom = "system";
    worldPanel.backTo = "The sky";
    void toWorld(i);
  };
  // Where a world seen whole was come to from: back leads there.
  let worldFrom: "system" | "cluster" | "galaxy" = "system";
  worldPanel.onBack = () => {
    worldScene.visible = false;
    worldPanel.visible = false;
    seen = null;
    if (worldFrom === "galaxy") void toGalaxy();
    else if (worldFrom === "cluster") void toCluster();
    else void toSystem();
  };
  /** Another star's world, made whole and shown. */
  const toForeignWorld = async (star: StarPage, index: number, from: "cluster" | "galaxy") => {
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
    worldPanel.backTo = from === "galaxy" ? "The galaxy" : "The stars around";
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
    stopSky?.();
    stopSky = null;
    client.setSpeed(planetPanel.speed);
    toGlobe();
  };
  exposed.sky = () => void toSystem();
  exposed.skyBodies = () => (scale === "system" && systemPlan ? systemPlan.bodies.length : 0);
  stage.onUpdate(() => {
    if (scale === "cluster" && clusterPlan)
      starScene.voyages(voyageMarks(clusterPlan, sky, now() / YEAR));
  });
  stage.onUpdate(() => {
    if (scale !== "system" || !systemPlan) return;
    const t = now(),
      spots = systemSpec(systemPlan, t);
    skyScene.update(spots);
    skyScene.marks(skyMarks(sky, spots, t));
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
    // Whichever way it came (a region, or straight from the globe), only the village shows.
    globe.visible = false;
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
    if (!beast) return selectPerson(null);
    selectPerson(null);
    villagePanel.showBeast(beast);
  };
  const selectPerson = (i: number | null) => {
    watched = i;
    village.mark(i);
    if (i === null || !plan) return;
    const p = plan.people[i]!;
    if (p.ref.startsWith("agent:"))
      void villagePanel.showAgent(
        Number(p.ref.slice("agent:".length)),
        p.name,
        p.age,
        p.child ? "a child" : (WORK_WORDS[p.occupation] ?? "at work"),
      );
    else void villagePanel.showPerson(p.ref);
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
    if (watched !== null) villagePanel.moment(village.momentAt(watched));
    // The years turn: re-read the plan, so those who died are gone.
    if (Math.floor(clock.t / YEAR) !== planYear) void loadPlan(plan.ref);
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
  exposed.carriersNow = () => (scale === "village" ? village.carriersNow() : []);
  exposed.rig = rig;

  regionPanel.onBack = () => toGlobe();
  regionPanel.onClose = () => region.mark(null);
  exposed.select = (n: number) => (scale === "globe" ? selectCell(n) : selectTile(n));
  exposed.descend = (cell: number) => toRegion(cell);
  exposed.villages = () => villages.length;

  stage.onUpdate(() => {
    if (scale !== "region" || !villages.length) return;
    const at = region.screenOf(villages.map((v) => v.tile));
    labels.update(
      villages.map((v, i) => ({
        key: v.ref,
        text: v.name,
        at: at[i] ?? null,
        priority: v.population,
      })),
    );
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

async function main(): Promise<void> {
  if (welcome()) return;
  if (bench > 0) return runBenchPage();
  if (universe === "sandbox") return runSandboxPage();
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
