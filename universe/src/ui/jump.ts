// A far year chosen at the start (Phase 63): the world runs there before anything is drawn, behind a
// screen that says how far it has come and about how long is left, and it may be stopped where it
// stands (the world is whole there, and takes up from that year) or left for the title screen.
// History is the same however it gets there. A world a deploy baked ahead (tools/bake.ts) is
// fetched and taken up from the nearest year before the one asked, where the rules are the same.
import { YEAR } from "../kernel/index.ts";
import type { HostClient } from "../bridge/index.ts";

/** A world run ahead, as the deploy's manifest lists it (baked/manifest.json). */

/**
 * The world the title's way into the ages past ours opens (Phase 66, measured 2026-11-04 among the worlds
 * of the catalogue): Earth's "tide 207", whose peoples have every age past ours by this year, the Moon
 * remade among them, in the smallest save that does (6.4 MB against 11.3 for "first light", which never
 * remakes a world). A flame held in 1280, minds of crystal in 1150, beams in 1220, made bodies in 1360,
 * built over in 1810, its star gathered in 1840, a world remade in 1960.
 */
export const PAST_WORLD = { universe: "earth", seed: "tide 207", year: 2000 } as const;

export type Baked = {
  readonly universe: string;
  readonly seed: string;
  readonly year: number;
  readonly file: string;
  readonly bytes: number;
  readonly ruleset: string;
};

/** The world a jump is of, as a baked one must match it. */
type BakedFor = Pick<Baked, "universe" | "seed" | "ruleset">;

/**
 * About how long a year takes, by how far on it is: this machine's milliseconds at every 500th year
 * (tools/sky-survey.ts, its yearMs: Earth's and two aliens' together; to year 3,100 again for Phase 66, whose
 * ages cost more than those before them, and held on from there). Only the shape counts once a jump is under
 * way: a world's own pace so far scales it. Past the last it is taken to hold.
 */
const YEAR_MS = [60, 170, 205, 232, 257, 267, 262, 262, 264, 266, 268, 270, 272];
/** The phone floor (an iPhone 15 Plus) runs at two thirds of this machine's pace (tools/phase6-gate.ts). */
const PHONE = 1.5;

/** About what a year costs, on the machine the shape was measured on. */
function yearCost(year: number): number {
  const at = Math.max(0, year) / 500,
    k = Math.min(YEAR_MS.length - 2, Math.floor(at));
  return YEAR_MS[k]! + (YEAR_MS[k + 1]! - YEAR_MS[k]!) * Math.min(1, at - k);
}

/** About what the years [from, to) cost. */
function costOf(from: number, to: number): number {
  let ms = 0;
  // (By the decade: as near as an estimate needs, and cheap enough to ask each time it is told.)
  for (let y = from; y < to; y += 10) ms += yearCost(y + 5) * Math.min(10, to - y);
  return ms;
}

/** The lands of the worlds the shape was measured on, about: a year's work goes by a world's lands (Phase 65). */
const SHAPE_LANDS = 550;

/**
 * About how many minutes a world takes to reach a year on the phone floor (from one it stands at); and
 * where its lands are known, for those lands: 26 worlds of 6 to 1,374 lands, run to year 3,000, took
 * 1.3 to 2.7 s a land.
 */
export function phoneMinutesTo(year: number, from = 0, lands = SHAPE_LANDS): number {
  return ((costOf(from, year) * PHONE) / 60_000) * (lands / SHAPE_LANDS);
}

/** "about 4 minutes", "under a minute" (or nothing yet, while there is too little to go by). */
function leftWords(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes >= 90) return `about ${Math.round(minutes / 6) / 10} hours left`;
  if (minutes >= 1.5) return `about ${Math.round(minutes)} minutes left`;
  if (minutes >= 0.75) return "about a minute left";
  return "under a minute left";
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** What this deploy baked ahead, and whether the worlds it ran still stand as the catalogue recorded them. */
type BakedManifest = { readonly worlds: readonly Baked[]; readonly catalogueMoved?: string };

async function bakedManifest(): Promise<BakedManifest | null> {
  try {
    // (Not a manifest of an earlier deploy held in a cache; a page's fallback will not read as one.)
    const reply = await fetch("baked/manifest.json", { cache: "no-cache" });
    return reply.ok ? ((await reply.json()) as BakedManifest) : null;
  } catch {
    return null;
  }
}

/** The worlds this deploy baked ahead (none where it baked none). */
export async function bakedWorlds(): Promise<readonly Baked[]> {
  return (await bakedManifest())?.worlds ?? [];
}

/** Whether this deploy found a world no longer running as the catalogue's record of it says (tools/bake.ts). */
export async function catalogueMoved(): Promise<boolean> {
  return !!(await bakedManifest())?.catalogueMoved;
}

/** The nearest world baked ahead at or before a year, if a deploy made one for this seed and these rules. */
async function bakedBefore(world: BakedFor, year: number): Promise<Baked | null> {
  let best: Baked | null = null;
  for (const b of await bakedWorlds())
    if (
      b.universe === world.universe &&
      b.seed === world.seed &&
      b.ruleset === world.ruleset &&
      b.year <= year &&
      b.year > (best?.year ?? 0)
    )
      best = b;
  return best;
}

/** A baked world's bytes, told as they come (null: not to be had, or stopped). */
async function bakedBytes(
  b: Baked,
  signal: AbortSignal,
  told: (got: number) => void,
): Promise<Uint8Array | null> {
  try {
    const reply = await fetch(`baked/${b.file}`, { signal });
    if (!reply.ok || !reply.body) return null;
    const reader = reply.body.getReader(),
      parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      told(got);
    }
    const bytes = new Uint8Array(got);
    let at = 0;
    for (const part of parts) {
      bytes.set(part, at);
      at += part.length;
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * The screen kept on while a long run lasts, where the device will (a phone that locks stops the
 * page and the run with it, until it is woken). Answers what lets it go.
 */
function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null,
    over = false;
  const ask = (): void => {
    // (Asked again on coming back: a page hidden loses its lock.)
    if (over || document.visibilityState !== "visible") return;
    navigator.wakeLock?.request("screen").then(
      (got) => {
        if (over) void got.release();
        else lock = got;
      },
      () => {},
    );
  };
  document.addEventListener("visibilitychange", ask);
  ask();
  return () => {
    over = true;
    document.removeEventListener("visibilitychange", ask);
    void lock?.release();
  };
}

/**
 * Run the world to a year behind a screen. Answers when it is there, or where it stands when the
 * viewer stops it, the screen gone by then: with the year it took up from, 0 being its beginning.
 * (Back to the title leaves the page, and the world.)
 */
export async function jumpToYear(
  client: HostClient,
  year: number,
  parent: HTMLElement,
  world?: BakedFor,
): Promise<number> {
  const screen = el("div", "jump-screen"),
    card = el("div", "jump-card"),
    head = el("h2", "jump-head", `Running the world to year ${year.toLocaleString("en")}`),
    bar = el("div", "jump-bar"),
    fill = el("div", "jump-fill"),
    done = el("p", "jump-done", "Year 0"),
    left = el("p", "muted jump-left", "History is written as it runs, year by year."),
    buttons = el("div", "jump-buttons"),
    stop = el("button", "jump-stop", "Begin from here"),
    back = el("button", "jump-back", "Back to the title");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(year));
  bar.append(fill);
  buttons.append(stop, back);
  card.append(head, bar, done, left, buttons);
  screen.append(card);
  parent.append(screen);
  const fetching = new AbortController(),
    letSleep = keepAwake();
  let stopped = false;
  stop.onclick = () => {
    stopped = true;
    stop.disabled = true;
    fetching.abort();
    client.stopJump();
  };
  back.onclick = () => {
    location.href = location.pathname;
  };
  const shown = (share: number) => {
    fill.style.width = `${(Math.min(1, share) * 100).toFixed(1)}%`;
  };
  let from = 0;
  try {
    // A world baked ahead, if there is one to take up from.
    const baked = world ? await bakedBefore(world, year) : null;
    if (baked && !stopped) {
      const mb = (n: number) => (n / 1e6).toFixed(n < 1e7 ? 1 : 0);
      head.textContent = `Fetching the world as it stood in year ${baked.year.toLocaleString("en")}`;
      left.textContent = "Run ahead, the same history; it takes up from there.";
      Object.assign(screen.dataset, { baked: String(baked.year) });
      const bytes = await bakedBytes(baked, fetching.signal, (got) => {
        shown(got / baked.bytes);
        done.textContent = `${mb(Math.min(got, baked.bytes))} of ${mb(baked.bytes)} MB`;
      });
      if (bytes && !stopped) {
        head.textContent = `Opening year ${baked.year.toLocaleString("en")}`;
        done.textContent = `${mb(bytes.length)} MB`;
        left.textContent = "A few moments.";
        try {
          from = Math.floor((await client.importSave(bytes)).t / YEAR);
        } catch (error) {
          // (It runs from its beginning instead: the same world, later.)
          console.warn(`the world baked at year ${baked.year} would not open`, error);
        }
      }
    }
    if (stopped || from >= year) return from;
    head.textContent = `Running the world to year ${year.toLocaleString("en")}`;
    left.textContent = "History is written as it runs, year by year.";
    const say = (t: number, ms: number): void => {
      const y = Math.floor(t / YEAR);
      shown(costOf(from, y) / Math.max(1, costOf(from, year)));
      bar.setAttribute("aria-valuenow", String(y));
      done.textContent = `Year ${y.toLocaleString("en")} of ${year.toLocaleString("en")}`;
      // (This world's pace so far, on this device, over the shape of what is to come.)
      if (y >= from + 20 && ms > 2000)
        left.textContent = leftWords((ms / costOf(from, y)) * costOf(y, year));
      Object.assign(screen.dataset, { year: String(y), ms: String(Math.round(ms)) });
    };
    await client.jump(year * YEAR, (p) => say(p.t, p.ms));
    return from;
  } finally {
    letSleep();
    screen.remove();
  }
}
