// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run a universe, draw it with PlayCanvas and put the observatory over
// it. ?universe=earth (the default), alien or sandbox; ?seed=…; ?bench=N runs the
// instancing benchmark instead.
import "./styles.css";
import { HostClient, inlinePair, workerPort } from "../bridge/index.ts";
import { GlobeScene, OrbitRig, SandboxScene, Stage, runBench } from "../render/index.ts";
import { PlanetPanel, SandboxPanel } from "../ui/index.ts";
import {
  cellAt,
  cellCenter,
  globeColors,
  sandboxSpec,
  type Lens,
  type SandboxSpec,
} from "../view/index.ts";
import { deviceTier } from "./tier.ts";

const DAY = 86_400;
const SKY = [0.09, 0.1, 0.13] as const;
const SPACE = [0.02, 0.025, 0.045] as const;

const params = new URLSearchParams(location.search);
const seed = params.get("seed") ?? "first light";
const inline = params.has("inline");
const bench = Number(params.get("bench") ?? 0);
const universe = params.get("universe") ?? "earth";

type Exposed = {
  client?: HostClient;
  mode?: string;
  seed?: string;
  universe?: string;
  /** How much is drawn: figures in the sandbox, painted cells on a globe. */
  drawn?: () => number;
  select?: (cell: number) => void;
  bench?: unknown;
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

async function runPlanetPage(): Promise<void> {
  const { canvas, hud } = page(),
    tier = deviceTier(),
    stage = new Stage(canvas, tier, SPACE),
    globe = new GlobeScene(stage);
  const { client, mode } = await connect();
  let painted = 0;
  Object.assign(exposed, { client, mode, seed, universe, drawn: () => painted, stage });
  await client.start(universe, seed);
  client.setInterest({ view: "globe", focus: null });
  let lens: Lens = "terrain";
  const panel = new PlanetPanel(hud, client, lens);
  const paint = () => {
    const frame = client.latestFrame("globe");
    if (!frame) return;
    if (!globe.built)
      globe.build(
        (frame.meta as { frequency: number }).frequency,
        frame.arrays.elevation as Float32Array,
      );
    const colors = globeColors(frame, lens);
    globe.paint(colors);
    painted = colors.length / 4;
  };
  panel.onLens = (l) => {
    lens = l;
    paint();
  };
  const select = (cell: number | null) => {
    globe.mark(cell);
    void panel.select(cell);
  };
  panel.onClose = () => globe.mark(null);
  exposed.select = (cell: number) => select(cell);
  const aspect = () => Math.max(0.3, innerWidth / Math.max(1, innerHeight));
  const fit = () => (aspect() < 1 ? 3.1 / aspect() : 3.3);
  const rig = new OrbitRig(stage, canvas, {
    distance: fit(),
    minDistance: 1.35,
    maxDistance: 12,
    pitch: -18,
    minPitch: -80,
    maxPitch: 80,
    drift: 4,
    onTap: (x, y) => select(globe.pick(x, y)),
  });
  addEventListener("resize", () => {
    if (!rig.userZoomed) rig.distance = fit();
  });
  client.onFrame((frame) => {
    if (frame.view === "globe") paint();
  });
}

async function main(): Promise<void> {
  if (bench > 0) return runBenchPage();
  if (universe === "sandbox") return runSandboxPage();
  return runPlanetPage();
}

void main();
