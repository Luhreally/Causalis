// node tools/phone-audit.ts [--shots dir] [--save file.save] [--alien file.save] [--only a,b] [--soft] [--dump]: the game at a phone's size (an iPhone 15 Plus, 430 by 932, by touch), every main state of it visited and read for what a thumb meets.
// For each state, a picture (in --shots), and:
//   1. every control to be seen whose middle a finger would not reach (what lies over it);
//   2. the windows of the HUD that lie over one another;
//   3. controls partly off the screen;
//   4. controls smaller than a fingertip (44 by 44 px: a note only);
//   5. how much of the screen the chrome covers.
// On a far save (else a young world run a few decades), and the title screen before it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium, type Page } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { politiesOf, populationContext, warsOf } from "../src/sim/index.ts";
import { HUD_DUMP, hudRead, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  dump = argv.includes("--dump"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  alienFile = arg("--alien"),
  only = arg("--only")?.split(",") ?? null;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const W = 430,
  H = 932;
const say = (s: string) => console.log(`  ${s}`);

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  readonly world: World;
};
const pack = (world: World, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN;
  return {
    bytes: gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    universe,
    seed: world.seed.text,
    world,
  };
};
const fromFile = (file: string, universe: "earth" | "alien"): Forged => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0],
    probe = u.build(seedFromText(doc.seed)),
    world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
      allowRulesetChange: true,
    }).world;
  return pack(world, universe);
};
const youngWorld = (): Forged => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(30 * YEAR);
  return pack(world, "earth");
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4391, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page: Page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  say(`(${what} did not come)`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const seen = (selector: string) =>
  k<boolean>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden") return true;
    }
    return false;
  })()`);

/** A real touch on the first of a selector to be seen (scrolled to, and waited on until it holds still). */
async function press(selector: string): Promise<boolean> {
  const where = () =>
    k<{ x: number; y: number } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
      const r0 = e.getBoundingClientRect();
      if (r0.width === 0 || r0.height === 0) continue;
      e.scrollIntoView({ block: "center", inline: "nearest" });
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  })()`);
  let at = await where();
  if (!at) {
    say(`(nothing to press at ${selector})`);
    return false;
  }
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(slow(100));
    const now = await where();
    if (!now) break;
    if (now.x === at.x && now.y === at.y) break;
    at = now;
  }
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(slow(300));
  return true;
}
const closePage = async () => {
  await k("globalThis.causalis.closePage?.()");
  await settle(250);
};
/** The world's clock stood still (the same moment for every state, whatever pressed a speed). */
const hold = () => k("globalThis.causalis.client?.setSpeed?.(0)").catch(() => undefined);

async function loadSave(f: Forged) {
  const name = `${f.universe}:phone`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`;
  await page.goto(`${base}?${q}&hold=1`);
  await page.waitForFunction(
    () => !!(globalThis as { causalis?: { client?: unknown } }).causalis?.client,
    undefined,
    { timeout: slow(120000) },
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page.evaluate(
    async ([data, keep]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const c = (
        globalThis as unknown as {
          causalis: {
            client: {
              importSave(b: Uint8Array): Promise<unknown>;
              save(n: string): Promise<unknown>;
            };
          };
        }
      ).causalis.client;
      await c.importSave(bytes);
      await c.save(keep as string);
    },
    [f.bytes.toString("base64"), name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await settle(800);
}

const READ = hudRead(),
  DUMP = HUD_DUMP;
type Read = HudRead;
const report: Record<string, Read> = {};
/** A state read: its picture, what a finger meets in it. */
async function look(name: string): Promise<void> {
  await settle(400);
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
  const r = await k<Read>(READ);
  report[name] = r;
  console.log(
    `${name}: ${r.controls} controls, ${r.covered.length} covered, ${r.overlaps.length} overlaps, ${r.off.length} off the screen, ${r.small.length} small; chrome ${(r.chrome * 100).toFixed(0)}% of the screen${r.bar ? `, the bar to ${r.bar} px` : ""}`,
  );
  for (const c of r.covered) say(`covered: ${c}`);
  for (const o of r.overlaps) say(`overlap: ${o}`);
  for (const o of r.off) say(`off: ${o}`);
  if (r.gone.length) say(`wholly off the screen: ${r.gone.slice(0, 6).join("; ")}`);
  if (r.small.length) say(`small: ${r.small.slice(0, 40).join("; ")}`);
  say(`boxes: ${r.boxes.join(" | ")}`);
  if (dump) console.log(await k<string>(DUMP));
}

/** A state, reached and read; one that fails to come is said and the walk goes on. */
async function state(name: string, reach: () => Promise<unknown>): Promise<void> {
  if (only && !only.some((o) => name.startsWith(o))) return;
  try {
    await reach();
    await hold();
    await look(name);
  } catch (error) {
    say(`${name}: could not be reached: ${(error as Error).message.slice(0, 300)}`);
  }
}

// The title screen, and a new world's choices.
await state("title", async () => {
  await page.goto(`${base}?menu`);
  await until("the title", () => seen(".title-window"), slow(60000));
  await settle(800);
});
await state("title-new", async () => {
  await press(".title-window .choice");
  await settle(600);
});

const made = saveFile ? fromFile(saveFile, "earth") : youngWorld();
await loadSave(made);
const towns = [...populationContext(made.world).settlements.all()]
  .filter((s) => s.population > 0)
  .sort((a, b) => b.population - a.population);
const town = towns[Math.min(towns.length - 1, Math.floor(towns.length * 0.02))]!;
say(
  `${towns.length} towns; the town looked at: ${town.name}, ${Math.round(town.population)} people`,
);
const realms = politiesOf(made.world).living(),
  seatOf = realms
    .map((r) => ({ r, t: populationContext(made.world).settlements.seenIn(r.seat)[0] }))
    .find((x) => x.t),
  realm = seatOf?.r.ref ?? realms[0]?.ref ?? null;
const scaleNow = () => k<string>("globalThis.causalis.scale()");
const toTown = async (ref: string) => {
  await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
  await until(
    "the town",
    () =>
      k<boolean>(
        `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
      ),
    slow(60000),
  );
  await settle(1500);
};
const toGlobe = async () => {
  await closePage();
  // (Down from the sky, as a player comes home from it; out of anything nearer.)
  for (let i = 0; i < 4 && (await scaleNow()) !== "globe"; i++) {
    const sky = ["system", "cluster", "galaxy"].includes(await scaleNow());
    await k(`globalThis.causalis.zoomThrough("${sky ? "in" : "out"}")`).catch(() => undefined);
    await settle(1500);
  }
};
const closeCard = () =>
  k(
    `document.querySelector("#hud > .panel:not([hidden]) > .inspector:not([hidden], .page-window) .close")?.click()`,
  );

// The globe, and what is done from it.
await state("globe", async () => {
  await closePage();
  await until("the people bar", () => seen(".people-chip"), slow(10000));
});
await state("globe-lens", async () => {
  await press('.mapmodes .mode[aria-label="Realms"]');
  await settle(800);
});
await state("globe-lens-food", async () => {
  await press('.mapmodes .mode[aria-label="Food"]');
  await settle(800);
});
await press('.mapmodes .mode[aria-label="Land"]');
if (await seen(".people-fold")) {
  await state("people-folded", async () => {
    await press(".people-fold");
    await settle(400);
  });
  await press(".people-fold");
}
await state("search", async () => {
  await press(".search-open");
  await page.keyboard.type(town.name.slice(0, 4));
  await settle(1200);
});
await press(".search-open");
await state("outliner", async () => {
  await press(".outliner-open");
  await settle(500);
});
await press(".outliner-open");
await state("log", async () => {
  await press(".log-open");
  await settle(800);
});
await closePage();
await state("chronicle", async () => {
  await k(`globalThis.causalis.open("world:chronicle")`);
  await settle(1200);
});
await state("years", async () => {
  await k(`globalThis.causalis.open("world:chronicle#years")`);
  await settle(1200);
});
await state("ledger", async () => {
  await k(`globalThis.causalis.open("world:ledger")`);
  await settle(1200);
});
await closePage();
await state("settings", async () => {
  await press('.bar .link[aria-label="Settings"], .bar .link[title="Settings"]');
  await settle(800);
});
await closeCard();
await closePage();
if (realm) {
  await state("realm-page", async () => {
    await k(`globalThis.causalis.open(${JSON.stringify(realm)})`);
    await settle(1200);
  });
  await state("leaders", async () => {
    await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
    await until("the leaders tab", () => seen(".leader-rule"), slow(30000));
    await settle(600);
  });
  await closePage();
}
await state("palette", async () => {
  await press(".palette-toggle");
  await settle(600);
});
await state("palette-flesh", async () => {
  await press('.palette-tab[data-kind="flesh"]');
  await settle(400);
});
await state("palette-act", async () => {
  await press(".palette-act");
  await settle(500);
});
await k("globalThis.causalis.palette.putDown()");
if (await seen(".palette.open")) await press(".palette-toggle");
await state("brushes", async () => {
  await press(".brush-toggle");
  await settle(800);
});
await press(".brush-close");
await state("director", async () => {
  await press(".director-button");
  await settle(2500);
});
await k("globalThis.causalis.watchIt?.(false)");
await hold();
await toGlobe();

// The land.
await state("region", async () => {
  await closePage();
  await k(`globalThis.causalis.descend(${town.cell})`);
  await until(
    "the land",
    () => k<boolean>(`globalThis.causalis.scale() === "region"`),
    slow(60000),
  );
  await until("its towns", () => k<boolean>(`globalThis.causalis.villages() > 0`), slow(30000));
  await settle(2500);
});

// The town.
await state("village", async () => {
  await toTown(town.ref);
});
await state("village-stores", async () => {
  await press(".town-stores");
  await settle(800);
});
await closeCard();
await state("village-money", async () => {
  await press(".town-money:not(.town-board):not(.town-ask)");
  await settle(1200);
});
await press(".town-money:not(.town-board):not(.town-ask)");
await state("village-board", async () => {
  await press(".town-board");
  await settle(1000);
});
await closePage();
await closeCard();
await state("village-asks", async () => {
  await press(".town-ask");
  await until("the sheet", () => seen(".ask-sheet .ask-row"), slow(20000));
  await settle(600);
});
await k(`document.querySelector(".ask-sheet:not([hidden]) .close")?.click()`);
await closePage();
const plan = await k<{ people: { ref: string; child: boolean; occupation: number }[] } | null>(
  "globalThis.causalis.planNow()",
);
const one = plan?.people.find((p) => !p.child && p.occupation > 0);
if (one)
  await state("village-person", async () => {
    await k(`globalThis.causalis.open(${JSON.stringify(one.ref)})`);
    await settle(1200);
  });
await closePage();
await state("village-tap", async () => {
  // (A building tapped: its card.)
  await page.touchscreen.tap(215, 640);
  await settle(1200);
});
await closePage();
await closeCard();
await state("colonies", async () => {
  await press(".colonies-button");
  await settle(1000);
});
// (Put by with its own ✕, as a thumb would; the rail is back once it is.)
await press('.colony-sheet-head button[aria-label="Close the worlds settled"]');
await until(
  "the worlds settled put by",
  () => k<boolean>(`!document.querySelector(".colony-sheet:not([hidden])")`),
  slow(5000),
);
await state("free-fly", async () => {
  await press(".free-fly");
  await settle(1000);
});
await press(".free-fly");
await state("free-walk", async () => {
  await press(".free-walk");
  await settle(1500);
});
await press(".free-walk");
await settle(800);

// Inside a home, and a life lived from it.
await state("home", async () => {
  await toTown(town.ref);
  const homes = await ask<{ n: number; state: string; people: number }[]>("home.survey", {
      town: town.ref,
    }),
    lived = homes.find((s) => s.state === "stands" && s.people > 0) ?? homes[0];
  if (!lived) throw new Error("no home");
  await k(`globalThis.causalis.home.open(${JSON.stringify({ town: town.ref, n: lived.n })})`);
  await until("its roof lifted", async () => {
    const s = await k<{ lifted: boolean; flying: boolean } | null>(
      "globalThis.causalis.home.state()",
    );
    return !!s && s.lifted && !s.flying;
  });
  await settle(800);
});
await state("home-who", async () => {
  const p = (
    await k<{ kind: string; x: number; y: number }[]>("globalThis.causalis.home.spots()")
  ).find((s) => s.kind === "person" && s.y > 180 && s.y < 800);
  if (!p) throw new Error("no one in");
  await page.touchscreen.tap(p.x, p.y);
  await until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
  await settle(500);
});
await state("life", async () => {
  await press(".home-live");
  await until(
    "their life",
    () => k<boolean>(`document.body.classList.contains("living")`),
    slow(90000),
  );
  await settle(1500);
});
await state("life-book", async () => {
  await press(".life-bookbtn");
  await settle(800);
});
await k(
  "document.querySelector('.life-book') && (document.querySelector('.life-book').hidden = true)",
);
await state("life-page", async () => {
  await k(`globalThis.causalis.open("agent:" + globalThis.causalis.life.state().agent)`);
  await settle(1000);
});
await closePage();
await press(".life-letgo");
await until(
  "the life let go",
  () => k<boolean>(`!document.body.classList.contains("living")`),
  slow(30000),
);
await settle(800);
await k("globalThis.causalis.home.close?.()");
await settle(800);

// A possession, and a reign.
if (realm && seatOf?.t) {
  await state("possess", async () => {
    await toTown(seatOf.t!.ref);
    const why = await k<string | null>(
      `(async () => { const list = await globalThis.causalis.client.query({ type: "leaders.of", args: { realm: ${JSON.stringify(realm)} } }); await globalThis.causalis.leaders.home(list.leaders[0]); await new Promise((r) => setTimeout(r, 800)); return await globalThis.causalis.leaders.possess(); })()`,
    );
    if (why) throw new Error(why);
    await until(
      "possessing",
      () => k<boolean>(`document.body.classList.contains("possessing")`),
      slow(40000),
    );
    await settle(1500);
  });
  await press(".possess-letgo");
  await until(
    "let go",
    async () => !(await k<boolean>("!!globalThis.causalis.possess.state()")),
    slow(30000),
  );
  await state("reign", async () => {
    await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
    await until("the leaders tab", () => seen(".leader-rule"), slow(60000));
    await settle(300);
    await press(".leader-rule");
    await until("the ruling bar", () => seen(".reign-strip"), slow(120000));
    await settle(2000);
  });
  await state("reign-decrees", async () => {
    await press(`.reign-act[data-act="decrees"]`);
    await settle(800);
  });
  await press(".reign-close");
  await press(".reign-letgo");
  await until(
    "let go",
    () => k<boolean>(`!document.body.classList.contains("ruling")`),
    slow(60000),
  );
  await settle(800);
}

// War: a battle watched, a war unfolding, a town at war.
const wars = await ask<{
  wars: { ref: string; ended: number | null; battles: { event: string; fallen: number }[] }[];
}>("wars.map").catch(() => ({ wars: [] }));
const greatest = wars.wars.flatMap((w) => w.battles).sort((a, b) => b.fallen - a.fallen)[0];
if (greatest)
  await state("battle", async () => {
    await closePage();
    await k(`globalThis.causalis.watchBattle(${JSON.stringify(greatest.event)})`);
    await until(
      "the battle",
      async () => (await k<unknown>("globalThis.causalis.battle()")) !== null,
      slow(60000),
    );
    await settle(3000);
  });
const war = wars.wars.find((w) => w.battles.length > 2) ?? wars.wars[0];
if (war)
  await state("war", async () => {
    await k(`globalThis.causalis.watchWar(${JSON.stringify(war.ref)})`);
    await until(
      "the war",
      async () => (await k<unknown>("globalThis.causalis.war()")) !== null,
      slow(60000),
    );
    await settle(2500);
  });
await k("globalThis.causalis.leaveWar?.()");
await settle(1000);
{
  const at = warsOf(made.world)
      .all()
      .find((x) => x.ended === null),
    seat = at ? politiesOf(made.world).get(at.defender)?.seat : undefined,
    there = seat === undefined ? undefined : towns.find((s) => s.cell === seat);
  if (there)
    await state("village-war", async () => {
      await toTown(there.ref);
      await settle(1500);
    });
}

// The sky: the system, the stars, the galaxy.
// (Out from the globe a scale at a time, as a thumb zooms: each scale with its card, then put by.)
await toGlobe();
for (const to of ["system", "cluster", "galaxy"]) {
  await state(to, async () => {
    for (let i = 0; i < 3 && (await scaleNow()) !== to; i++) {
      await k(`globalThis.causalis.zoomThrough("out")`).catch(() => undefined);
      await until(`the ${to}`, async () => (await scaleNow()) === to, slow(20000));
    }
    if ((await scaleNow()) !== to) throw new Error(`not at the ${to}`);
    await settle(2500);
  });
  await state(`${to}-bare`, async () => {
    await closeCard();
    await settle(800);
  });
}
await toGlobe();

// A great happening in its window, and the guided walk, as a first visit has them.
await state("walk", async () => {
  await page.goto(
    `${base}?universe=${made.universe}&seed=${encodeURIComponent(made.seed)}&load=${encodeURIComponent(`${made.universe}:phone`)}&hold=1&events&walk`,
  );
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await until("the walk", () => seen(".walk"), slow(20000));
  await settle(800);
});
if (await seen(".walk .link")) await press(".walk .link");
await state("event", async () => {
  // (Their realms followed, by their pages' Follow, as a viewer does.)
  for (const r of realms.slice(0, 8)) {
    await k(`globalThis.causalis.open(${JSON.stringify(r.ref)})`);
    await settle(600);
    if (await seen(".page-window .follow:not(.on)")) await press(".page-window .follow:not(.on)");
  }
  await closePage();
  await k("globalThis.causalis.client.setSpeed(86400 * 365)");
  const came = await until(
    "a great happening's window",
    () => k<boolean>("globalThis.causalis.eventOpen()"),
    slow(150000),
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  if (!came) throw new Error("no window came");
  await settle(1200);
});

for (const e of errors.slice(0, 10)) say(`page error: ${e.slice(0, 300)}`);
if (shots) writeFileSync(join(shots, "audit.json"), JSON.stringify(report, null, 1));
const totals = Object.values(report).reduce(
  (t, r) => ({
    covered: t.covered + r.covered.length,
    overlaps: t.overlaps + r.overlaps.length,
    off: t.off + r.off.length,
  }),
  { covered: 0, overlaps: 0, off: 0 },
);
console.log(
  `phone audit: ${Object.keys(report).length} states; ${totals.covered} covered controls, ${totals.overlaps} overlaps, ${totals.off} controls partly off the screen`,
);
await browser.close();
await server.close();
process.exit(0);
