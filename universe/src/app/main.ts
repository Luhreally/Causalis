// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run a universe, draw it with PlayCanvas and put the observatory over
// it. ?universe=earth (the default), alien or sandbox; ?seed=…; ?bench=N runs the
// instancing benchmark instead.
import "./styles.css";
import { HostClient, inlinePair, workerPort } from "../bridge/index.ts";
import {
  GlobeScene,
  OrbitRig,
  RegionScene,
  SandboxScene,
  Stage,
  VillageScene,
  runBench,
} from "../render/index.ts";
import {
  LabelLayer,
  Tidings,
  PlanetPanel,
  RegionPanel,
  SandboxPanel,
  VillagePanel,
  type PeopleEntry,
} from "../ui/index.ts";
import type { VillagePlan } from "../bridge/index.ts";
import {
  cellAt,
  cellCenter,
  globeColors,
  regionColors,
  regionHeights,
  sandboxSpec,
  type Lens,
  type RegionLens,
  type SandboxSpec,
} from "../view/index.ts";
import { deviceTier } from "./tier.ts";

const DAY = 86_400;
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
  bench?: unknown;
  /** Why the page could not start, if it could not ("webgl" when 3D is unavailable). */
  error?: string;
  /** The PlayCanvas stage, for debugging tools. */
  stage?: Stage;
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
  const { SimHost, UNIVERSES } = await import("../host/index.ts");
  const [page, hostEnd] = inlinePair();
  const host = new SimHost(hostEnd, UNIVERSES, { clock: () => performance.now(), budgetMs: 6 });
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
    village = new VillageScene(stage);
  const { client, mode } = await connect();
  let painted = 0,
    scale: "globe" | "region" | "village" = "globe";
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => painted, stage });
  await client.start(universe, seed);
  // ?year=N starts the world N years on (it runs there first; history is the same).
  if (startYear > 0) await client.advance(startYear * YEAR);
  client.setInterest({ view: "globe", focus: null });
  const speed = YEAR;
  client.setSpeed(speed);
  let lens: Lens = "terrain",
    regionLens: RegionLens = "land",
    density = new Map<number, number>(),
    foodPrices = new Map<number, number>(),
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
      lens === "food" ? foodPrices : density,
      lens === "realms" ? realms : lens === "faiths" ? faiths : tongues,
    );
    globe.paint(colors);
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
      region.build(meta.ref, meta.size, meta.tileKm, regionHeights(frame));
      regionPanel.show(meta.center, meta.lat, meta.lon, meta.size * meta.tileKm);
      region.setVillages(villages);
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
    lens = l;
    paintGlobe();
    if (["people", "food", "tongues", "realms", "faiths"].includes(l)) void faceThePeople(true);
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
    tongues = new Map(entries.flatMap((e) => (e.tongue ? [[e.cell, e.tongue] as const] : [])));
    realms = new Map(entries.flatMap((e) => (e.realm ? [[e.cell, e.realm] as const] : [])));
    faiths = new Map(entries.flatMap((e) => (e.faith ? [[e.cell, e.faith] as const] : [])));
    if (["people", "food", "tongues", "realms", "faiths"].includes(lens) && scale === "globe")
      paintGlobe();
  });

  const aspect = () => Math.max(0.3, innerWidth / Math.max(1, innerHeight));
  const globeFit = () => (aspect() < 1 ? 3.1 / aspect() : 3.3);
  const regionFit = () => (aspect() < 1 ? 120 / aspect() : 130);
  const selectCell = (cell: number | null) => {
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
          : selectPerson(village.pick(x, y)),
  });

  // Down to a region, and back up to the world: the camera, the scene, the panel,
  // the labels and the host's interest all move together.
  const toRegion = (cell: number) => {
    scale = "region";
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
    regionCell = -1;
    stopVillages?.();
    stopVillages = null;
    villages = [];
    labels.clear();
    region.visible = false;
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
  planetPanel.onCloser = (cell) => toRegion(cell);
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
    plan = await client.query<VillagePlan>({ type: "village.plan", args: { ref } });
    village.build(plan);
    villagePanel.show(plan.name, WATCH_DEFAULT);
    villagePanel.hand = plan.hand;
  };
  const toVillage = async (ref: string) => {
    scale = "village";
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
      distance: 26,
      minDistance: 3,
      maxDistance: 140,
      pitch: -38,
      minPitch: -85,
      maxPitch: -8,
      drift: 0.8,
      target: [0, 0, 0],
    });
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

async function main(): Promise<void> {
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
