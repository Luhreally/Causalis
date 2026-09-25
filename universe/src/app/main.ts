// The page's entry: start the simulation host (in a worker, or in-thread with
// ?inline), run the sandbox universe, and show its status. Milestone 7 puts the
// PlayCanvas view and the observatory on top of this.
import "./styles.css";
import { HostClient, inlinePair, workerPort, type Status } from "../bridge/index.ts";

const DAY = 86_400;
const YEAR = 365 * DAY;

const params = new URLSearchParams(location.search);
const seed = params.get("seed") ?? "first light";
const inline = params.has("inline");

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
  const host = new SimHost(hostEnd, UNIVERSES, { clock: () => performance.now() });
  const loop = async () => {
    await host.pump();
    requestAnimationFrame(() => void loop());
  };
  void loop();
  return { client: new HostClient(page), mode: "in-thread" };
}

function when(t: number): string {
  const years = Math.floor(t / YEAR),
    days = Math.floor((t % YEAR) / DAY);
  return `year ${years}, day ${days}`;
}

async function main(): Promise<void> {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <h1>Causalis Universe</h1>
    <p class="lede">A deterministic universe, from a seed to interstellar war, that you can watch,
    question and touch. It is being built beside <a href="../">Causalis Classic</a>.</p>
    <p class="status" id="status">Starting…</p>
    <p class="status" id="world"></p>`;
  const status = document.getElementById("status")!,
    worldLine = document.getElementById("world")!;
  const { client, mode } = await connect();
  const { ruleset } = await client.start("sandbox", seed);
  client.setSpeed(30 * DAY);
  client.onStatus((s: Status) => {
    status.textContent = `Phase 0 sandbox · seed “${seed}” · ${when(s.t)} · ${Math.round(s.achieved / DAY)} days a second · ${mode} · ruleset ${ruleset}`;
  });
  client.subscribe<{ people: number; floods: number; events: number }>(
    { type: "summary" },
    500,
    (v) => {
      worldLine.textContent = `${v.people.toLocaleString()} people · ${v.floods} floods · ${v.events} events remembered`;
    },
  );
  (globalThis as { causalis?: unknown }).causalis = { client, mode, seed };
}

void main();
