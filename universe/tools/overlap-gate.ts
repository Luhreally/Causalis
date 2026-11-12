// node tools/overlap-gate.ts [--save file.save] [--shots dir] [--only phone|desk] [--states a,b] [--soft] [--dump]
// The overlap gate (asked 2026-11-11: "no panels should ever overlap or cover another one … it
// should just be an innate thing thats not allowed"): on the built app, at a phone's size (an iPhone
// 15 Plus, 430 by 932, by touch) and at a desk's (1366 by 800, by mouse), every main state of the
// game visited with the corner's rail as full as it can be (every tool in it shown, every kind of
// alert lit), and in each:
//   1. no two windows of the HUD lie over one another, but for the pairs below, each with its reason;
//   2. no control is covered at its middle by another window;
//   3. no control lies partly off the screen;
//   4. every state is reached, and the rail read full in each where it stands.
// What is not read as a window, by design: a window and what it holds (a dropdown inside its own
// window, a page's tabs); the scene's own words over the world — names on the map, labels, what
// people say, the tooltips resting under the pointer — and the fade between scales (LAYERS in
// tools/hud-read.ts); what draws nothing of its own (a row or column holding buttons: its buttons are
// read). And the pairs in EXEMPT below.
// On a save given (else the first light at year 125). (npm run build first; the gate reads dist/.)
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type BrowserContext, type Page } from "playwright";
import { HUD_DUMP, hudRead, type Exemption, type HudRead } from "./hud-read.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft") || argv.includes("--ci"),
  dump = argv.includes("--dump"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots"),
  saveFile = arg("--save"),
  onlyView = arg("--only"),
  onlyStates = arg("--states")?.split(",") ?? null;
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const say = (s: string) => console.log(`  ${s}`);

/**
 * The pairs that may lie over one another, by design. Each is narrow: the one window, what it may lie
 * over, and why. Nothing else may. (None now: where one window met another, one of them was made to
 * give way — what the corner's rail opens puts the news, the director's line and the cards beside the
 * rail out of sight while it is open, and they come back as it is put by.)
 */
const EXEMPT: readonly Exemption[] = [];

console.log("the overlap gate");
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4393, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : GPU,
  });

const VIEWS = [
  {
    name: "phone",
    options: {
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: soft ? 1 : 2,
      hasTouch: true,
      isMobile: true,
    },
  },
  { name: "desk", options: { viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 } },
] as const;

const failures: string[] = [];
const READ = hudRead(EXEMPT, 1);

/** The corner's rail as full as a world can make it: every tool shown, and every kind of alert lit
 * (those the world has not lit stood in by their like, each a button as an alert is, in a row of
 * their own beside the alerts' own, so the alerts' redrawing leaves them be). */
const FILL = `(() => {
  for (const b of document.querySelectorAll(".corner-tools :is(.colonies-button, .strikes-button)")) b.hidden = false;
  const alerts = document.querySelector(".corner-tools .alerts");
  if (!alerts) return 0;
  let row = alerts.querySelector(".gate-fill-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "alerts-row gate-fill-row";
    alerts.append(row);
  }
  const icons = ["⚔️", "🍞", "⚖️", "🤒", "💰", "🔥", "🕯️", "🏚️", "🛬", "🌟"],
    want = Math.max(0, icons.length - alerts.querySelectorAll(".alert:not(.gate-fill)").length);
  while (row.children.length > want) row.lastElementChild.remove();
  for (let i = row.children.length; i < want; i++) {
    const b = document.createElement("button");
    b.className = "alert tone-war gate-fill";
    b.setAttribute("aria-label", "Filled by the gate: 3");
    const icon = document.createElement("span"), count = document.createElement("span");
    icon.className = "alert-icon"; icon.textContent = icons[i];
    count.className = "alert-count"; count.textContent = "3";
    b.append(icon, count);
    row.append(b);
  }
  return alerts.querySelectorAll(".alert").length;
})()`;
const FILLED = `document.querySelectorAll(".corner-tools .alert").length >= 10 || !document.querySelector(".corner-tools .alerts")`;

async function walk(view: (typeof VIEWS)[number]): Promise<void> {
  const context: BrowserContext = await browser.newContext(view.options),
    page: Page = await context.newPage(),
    errors: string[] = [],
    touch = view.name === "phone",
    W = view.options.viewport.width;
  page.setDefaultTimeout(slow(60000));
  page.on("pageerror", (e) => errors.push(e.message));
  const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
  const settle = (ms: number) => page.waitForTimeout(slow(ms));
  const until = async (what: string, ok: () => Promise<boolean>, ms = slow(25000)) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await ok().catch(() => false)) return true;
      await page.waitForTimeout(80);
    }
    say(`(${what} did not come)`);
    return false;
  };
  const seen = (selector: string) =>
    k<boolean>(`(() => {
      for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden") return true;
      }
      return false;
    })()`);
  /** A real touch (or click) on the first of a selector to be seen, once it holds still. */
  const press = async (selector: string): Promise<boolean> => {
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
    if (!at) return false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(slow(100));
      const now = await where();
      if (!now) break;
      if (now.x === at.x && now.y === at.y) break;
      at = now;
    }
    if (touch) await page.touchscreen.tap(at.x, at.y);
    else {
      await page.mouse.click(at.x, at.y);
      // (The pointer put by where it rests on nothing, so no tip of its own stands over what is read.)
      await page.mouse.move(W / 2, 4);
    }
    await page.waitForTimeout(slow(300));
    return true;
  };
  /** A tool of the corner's rail pressed: on the rail, or from the ⋯'s sheet where it is folded. */
  const tool = async (cls: string): Promise<boolean> => {
    // (Touched only where a finger would meet it: the rail redraws as its alerts come and go, so
    // the point is read and checked in the same moment, and read again if something else is there.)
    const exact = (selector: string) =>
      k<{ x: number; y: number } | null>(`(() => {
        for (const e of document.querySelectorAll(${JSON.stringify(selector)})) {
          const r = e.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
          return hit && (hit === e || e.contains(hit)) ? { x, y } : null;
        }
        return null;
      })()`);
    const reach = async (selector: string) => {
      for (let i = 0; i < 10; i++) {
        if (fill) await k(FILL);
        await k("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
        const at = await exact(selector);
        if (at) {
          if (touch) await page.touchscreen.tap(at.x, at.y);
          else await page.mouse.click(at.x, at.y);
          await page.waitForTimeout(slow(300));
          return true;
        }
        await page.waitForTimeout(slow(150));
      }
      return false;
    };
    if (fill) await k(FILL);
    await k("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
    if (await seen(`.corner-tools .${cls}`)) return reach(`.corner-tools .${cls}`);
    if (!(await seen(".corner-more"))) return false;
    if (!(await seen(".corner-more-sheet"))) await reach(".corner-more");
    return reach(`.corner-more-row[data-tool~="${cls}"]`);
  };
  const hold = () => k("globalThis.causalis?.client?.setSpeed?.(0)").catch(() => undefined);
  const closePage = async () => {
    await k("globalThis.causalis.closePage?.()").catch(() => undefined);
    await settle(250);
  };
  const closeCard = () =>
    k(
      `document.querySelector("#hud > .panel:not([hidden]) > .inspector:not([hidden], .page-window) .close")?.click()`,
    );
  const scaleNow = () => k<string>("globalThis.causalis.scale()");
  let fill = false;
  const reached = new Set<string>();

  /** A state read: filled, a frame let pass, read, and its failures told. */
  const look = async (name: string) => {
    await settle(400);
    let r: HudRead | null = null,
      filled = true;
    for (let i = 0; i < 3; i++) {
      if (fill) {
        await k(FILL);
        await k("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
        await page.waitForTimeout(60);
      }
      r = await k<HudRead>(READ);
      // (An alert's own poll may have redrawn the row between: filled and read again.)
      filled = !fill || (await k<boolean>(FILLED));
      if (filled) break;
    }
    const at = `${view.name} ${name}`;
    if (shots) await page.screenshot({ path: join(shots, `${view.name}-${name}.png`) });
    reached.add(name);
    console.log(
      `${at}: ${r!.controls} controls, ${r!.overlaps.length} overlaps, ${r!.covered.length} covered, ${r!.off.length} off; chrome ${(r!.chrome * 100).toFixed(0)}%`,
    );
    if (!filled) failures.push(`${at}: the corner's rail could not be read full`);
    for (const o of r!.overlaps) failures.push(`${at}: overlap: ${o}`);
    for (const c of r!.covered) failures.push(`${at}: covered: ${c}`);
    for (const o of r!.off) failures.push(`${at}: off the screen: ${o}`);
    for (const f of [...r!.overlaps, ...r!.covered, ...r!.off]) say(f);
    if (dump) console.log(await k<string>(HUD_DUMP));
  };
  /** A state, reached and read; one that fails to come is a failure, and the walk goes on. */
  const state = async (name: string, reach: () => Promise<unknown>) => {
    if (onlyStates && !onlyStates.some((o) => name.startsWith(o))) return;
    try {
      await reach();
      await hold();
      await look(name);
    } catch (error) {
      failures.push(`${view.name} ${name}: not reached: ${(error as Error).message.slice(0, 200)}`);
      say(`${name}: not reached: ${(error as Error).message.slice(0, 200)}`);
    }
  };
  const must = async (what: string, ok: boolean | Promise<boolean>) => {
    if (!(await ok)) throw new Error(what);
  };

  // The title screen, and a new world's choices.
  await state("title", async () => {
    await page.goto(`${base}?menu`);
    await must(
      "the title",
      until("the title", () => seen(".title-window"), slow(60000)),
    );
    await settle(800);
  });
  await state("title-new", async () => {
    await must("a choice", press(".title-window .choice"));
    await settle(600);
  });

  // The world.
  const q = saveFile ? `universe=earth&seed=${encodeURIComponent("first light")}` : "";
  if (saveFile) {
    await page.goto(`${base}?${q}&hold=1`);
    await page.waitForFunction(
      () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
      undefined,
      { timeout: slow(180000) },
    );
    await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
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
      await c.save("earth:overlap");
    }, readFileSync(saveFile).toString("base64"));
    await page.goto(`${base}?${q}&load=${encodeURIComponent("earth:overlap")}&hold=1`);
  } else
    await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=125`);
  await page.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(240000) },
  );
  await hold();
  await settle(1500);
  fill = true;
  const towns = await k<{ ref: string; cell: number; people: number; name: string }[]>(
      `globalThis.causalis.client.query({ type: "towns.map", args: {} })`,
    ),
    sorted = [...towns].sort((a, b) => b.people - a.people),
    town = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.02))]!;
  say(`${towns.length} towns; the town looked at: ${town.name}`);
  const toTown = async (ref: string) => {
    await k(`globalThis.causalis.goTo(${JSON.stringify(ref)})`);
    await must(
      "the town",
      until(
        "the town",
        () =>
          k<boolean>(
            `globalThis.causalis.scale() === "village" && globalThis.causalis.planNow()?.ref === ${JSON.stringify(ref)}`,
          ),
        slow(60000),
      ),
    );
    await settle(1500);
  };
  const toGlobe = async () => {
    await closePage();
    for (let i = 0; i < 4 && (await scaleNow()) !== "globe"; i++) {
      const sky = ["system", "cluster", "galaxy"].includes(await scaleNow());
      await k(`globalThis.causalis.zoomThrough("${sky ? "in" : "out"}")`).catch(() => undefined);
      await settle(1500);
    }
  };

  // The globe: its bar open and folded, every lens, every tool of the corner and what it opens.
  await state("globe", async () => {
    await closePage();
    await until("the people bar", () => seen(".people-chip"), slow(10000));
  });
  if (await seen(".bar-fold")) {
    await state("globe-folded", async () => {
      await must("the bar's fold", press(".bar-fold"));
      await settle(500);
    });
    await press(".bar-fold");
    await settle(400);
  }
  const lenses = await k<string[]>(
    `[...document.querySelectorAll(".mapmodes .mode")].map((b) => b.getAttribute("aria-label"))`,
  );
  for (const lens of lenses)
    await state(`lens-${lens.toLowerCase().replace(/\W+/g, "-")}`, async () => {
      await must(lens, press(`.mapmodes .mode[aria-label=${JSON.stringify(lens)}]`));
      await settle(300);
    });
  await press('.mapmodes .mode[aria-label="Land"]');
  for (const [name, open] of [
    ["search", "search-open"],
    ["outliner", "outliner-open"],
    ["more", "corner-more"],
  ] as const) {
    if (name === "more")
      // (An alert's own cases, from its button or from the ⋯'s sheet if it is folded there.)
      await state("alert", async () => {
        if (await seen(".corner-tools .alert:not(.gate-fill)"))
          await must("an alert", press(".corner-tools .alert:not(.gate-fill)"));
        else {
          await must("the ⋯", press(".corner-more"));
          await k(
            `[...document.querySelectorAll(".corner-more-row")].find((b) => !/Filled by the gate/.test(b.textContent))?.click()`,
          );
        }
        await must(
          "its cases",
          until("its cases", () => seen(".alert-list"), slow(5000)),
        );
        await settle(500);
      });
    await k("document.querySelector('.alert.on')?.click()");
    await state(name, async () => {
      await must(open, open === "corner-more" ? press(".corner-more") : tool(open));
      await settle(700);
    });
    // (Put by as it was opened, until it is: under a loaded machine a surface can still be opening when the first
    // press comes, and one left open covers the next three, as it did once on 2026-11-12 with the suite running.)
    for (let i = 0; i < 8 && (await seen(`.${open}.on`)); i++) {
      await k(`document.querySelector(".${open}.on")?.click()`);
      await settle(300);
    }
  }
  await state("log", async () => {
    await must("the log", tool("log-open"));
    await settle(900);
  });
  await closePage();
  await state("page", async () => {
    await k(`globalThis.causalis.open(${JSON.stringify(town.ref)})`);
    await settle(1200);
  });
  await closePage();
  await state("settings", async () => {
    await must(
      "settings",
      press('.bar .link[aria-label="Settings"], .bar .link[title="Settings"]'),
    );
    await settle(800);
  });
  await closeCard();
  await closePage();
  await state("strikes", async () => {
    await must("strikes", tool("strikes-button"));
    await settle(900);
  });
  await k(
    `document.querySelector(".strike-sheet:not([hidden]) .colony-sheet-head button")?.click()`,
  );
  await settle(300);
  await state("colonies", async () => {
    await must("colonies", tool("colonies-button"));
    await settle(900);
  });
  await k(
    `document.querySelector('.colony-sheet:not([hidden]) button[aria-label="Close the worlds settled"]')?.click()`,
  );
  await settle(300);
  await state("brushes", async () => {
    await must("brushes", tool("brush-toggle"));
    await settle(800);
  });
  await press(".brush-close");
  // (On a phone the god's hand is a button's; on a desk it is always out.)
  if (touch)
    await state("palette", async () => {
      await must("the god's hand", press(".palette-toggle"));
      await settle(600);
    });
  await k("globalThis.causalis.palette?.putDown?.()").catch(() => undefined);
  if (await seen(".palette.open")) await press(".palette-toggle");
  await state("director", async () => {
    await must("the director", tool("director-button"));
    await settle(2500);
  });
  await k("globalThis.causalis.watchIt?.(false)").catch(() => undefined);
  await hold();
  await toGlobe();
  // The news: what is followed told, as the years run.
  await state("news", async () => {
    // (Its land followed, from its page, as a viewer follows it.)
    await k(`globalThis.causalis.select(${town.cell})`);
    await until("its land's page", () => seen(".page-window .follow"), slow(15000));
    if (await seen(".page-window .follow:not(.on)")) await press(".page-window .follow:not(.on)");
    await closePage();
    // (And the greatest realms, as a viewer follows them from their pages, so news comes soon.)
    await k(`(async () => {
      const c = globalThis.causalis.client,
        realms = (await c.query({ type: "realms.map" })).sort((a, b) => b.people - a.people).slice(0, 6);
      for (const r of realms) await c.query({ type: "observe.watch", args: { ref: r.ref, on: true } });
    })()`).catch(() => undefined);
    await k("globalThis.causalis.client.setSpeed(86400 * 365)");
    await must(
      "the news",
      until("the news", () => seen(".tidings > .tiding"), slow(90000)),
    );
    await hold();
    await settle(600);
  });

  // The land, the town, a building's card, a page over the town.
  await state("region", async () => {
    await closePage();
    await k(`globalThis.causalis.descend(${town.cell})`);
    await must(
      "the land",
      until("the land", () => k<boolean>(`globalThis.causalis.scale() === "region"`), slow(60000)),
    );
    await until("its towns", () => k<boolean>(`globalThis.causalis.villages() > 0`), slow(30000));
    await settle(2500);
  });
  await state("village", () => toTown(town.ref));
  await state("village-stores", async () => {
    await must("the stores", press(".town-stores"));
    await settle(800);
  });
  await closeCard();
  await state("village-board", async () => {
    await must("the board", press(".town-board"));
    await settle(1000);
  });
  await closePage();
  await closeCard();
  await state("village-asks", async () => {
    await must("the asks", press(".town-ask"));
    await until("the sheet", () => seen(".ask-sheet .ask-row"), slow(20000));
    await settle(600);
  });
  await k(`document.querySelector(".ask-sheet:not([hidden]) .close")?.click()`);
  await closePage();
  await state("village-card", async () => {
    // (A building tapped: its card.)
    const at = { x: W / 2, y: view.options.viewport.height * 0.68 };
    if (touch) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await page.mouse.move(W / 2, 4).catch(() => undefined);
    await settle(1200);
  });
  await closePage();
  await closeCard();
  await state("free-walk", async () => {
    await must("walking", tool("free-walk"));
    await settle(1500);
  });
  await k(`document.querySelector(".free-walk")?.click()`);
  await settle(800);

  // A life lived, from inside a home.
  /** Someone in the home, where a finger can touch them clear of the windows. */
  const someoneIn = async () =>
    (await k<{ kind: string; x: number; y: number }[]>("globalThis.causalis.home.spots()")).find(
      (s) =>
        s.kind === "person" &&
        s.y > 180 &&
        s.y < view.options.viewport.height - 130 &&
        s.x < W - 70,
    );
  await state("home", async () => {
    await toTown(town.ref);
    const homes = await k<{ n: number; state: string; people: number }[]>(
        `globalThis.causalis.client.query({ type: "home.survey", args: { town: ${JSON.stringify(town.ref)} } })`,
      ),
      lived = homes.filter((s) => s.state === "stands" && s.people > 0);
    if (!lived.length) throw new Error("no home");
    // (Someone must be in, for a life to be taken up from there: the clock stands still inside a
    // home, so if no one is in at this hour, the next home is tried, the day moved on between.)
    for (let i = 0; ; i++) {
      const n = lived[i % lived.length]!.n;
      await k(`globalThis.causalis.home.open(${JSON.stringify({ town: town.ref, n })})`);
      await must(
        "its roof lifted",
        until("its roof lifted", async () => {
          const s = await k<{ lifted: boolean; flying: boolean } | null>(
            "globalThis.causalis.home.state()",
          );
          return !!s && s.lifted && !s.flying;
        }),
      );
      await settle(800);
      if (await someoneIn()) break;
      if (i >= 11) throw new Error("no one in at any hour tried");
      await k("globalThis.causalis.home.close?.()").catch(() => undefined);
      await settle(400);
      if (i % lived.length === lived.length - 1 || i % 3 === 2) {
        await k("globalThis.causalis.client.setSpeed(3600)");
        await page.waitForTimeout(1500);
        await hold();
      }
    }
  });
  await state("life", async () => {
    const p = await someoneIn();
    if (!p) throw new Error("no one in");
    if (touch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await until("their sheet", () => k<boolean>(`!document.querySelector(".home-who").hidden`));
    await settle(400);
    await must("Live", press(".home-live"));
    await must(
      "their life",
      until(
        "their life",
        () => k<boolean>(`document.body.classList.contains("living")`),
        slow(90000),
      ),
    );
    await settle(1500);
  });
  await state("life-book", async () => {
    await must("the book", press(".life-bookbtn"));
    await settle(800);
  });
  await k(
    "document.querySelector('.life-book') && (document.querySelector('.life-book').hidden = true)",
  );
  await press(".life-letgo");
  await until(
    "the life let go",
    () => k<boolean>(`!document.body.classList.contains("living")`),
    slow(30000),
  );
  await settle(800);
  await k("globalThis.causalis.home.close?.()").catch(() => undefined);
  await settle(800);

  // A battle watched.
  const wars = await k<{ wars: { battles: { event: string; fallen: number }[] }[] }>(
    `globalThis.causalis.client.query({ type: "wars.map" })`,
  ).catch(() => ({ wars: [] }));
  const greatest = wars.wars.flatMap((w) => w.battles).sort((a, b) => b.fallen - a.fallen)[0];
  await state("battle", async () => {
    if (!greatest) throw new Error("the world has no battle");
    await closePage();
    await k(`globalThis.causalis.watchBattle(${JSON.stringify(greatest.event)})`);
    await must(
      "the battle",
      until(
        "the battle",
        async () => (await k<unknown>("globalThis.causalis.battle()")) !== null,
        slow(60000),
      ),
    );
    await settle(3000);
  });
  await k(
    `[...document.querySelectorAll(".battle-panel:not([hidden]) button")].find((b) => /The land/.test(b.textContent))?.click()`,
  ).catch(() => undefined);
  await settle(800);

  // The sky.
  await toGlobe();
  for (const to of ["system", "galaxy"])
    await state(to, async () => {
      for (let i = 0; i < 3 && (await scaleNow()) !== to; i++) {
        await k(`globalThis.causalis.zoomThrough("out")`).catch(() => undefined);
        await until(`the ${to}`, async () => (await scaleNow()) === to, slow(20000));
      }
      if ((await scaleNow()) !== to) throw new Error(`not at the ${to}`);
      await settle(2500);
    });

  for (const e of errors.slice(0, 5)) say(`page error: ${e.slice(0, 200)}`);
  await context.close();
}

for (const view of VIEWS) if (!onlyView || onlyView === view.name) await walk(view);
await browser.close();
await server.close();
console.log(
  failures.length
    ? `the overlap gate FAILS: ${failures.length}\n${failures.map((f) => `  ${f}`).join("\n")}`
    : "the overlap gate passes: no window of the HUD lies over another, nor off the screen",
);
process.exit(failures.length ? 1 : 0);
