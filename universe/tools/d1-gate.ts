// node tools/d1-gate.ts [--ci] [--soft] [--shots dir] [--save file.save] [--universe earth|alien] [--water file.save] [--many file.save]: gate 98, what binds realms:
//   1. the rule, pure: how a call is weighed, which way a claim goes, who is feared;
//   2. the paths nobody watches, on a real world: a save from before the rule, loaded and run on; a world at year 40; a vassal whose overlord has fallen; a marriage into a realm that ended; a claim on the seat of a ruler a person plays; a realm at war with its own ally; a water people; a world of many realms;
//   3. what a whole run came to, read for its worst: wars with allies, the largest, how many called came; every call, compact, marriage and envoy's page read for a bad word;
//   4. by real touch at 430 by 932: a realm's Bonds tab; a war with allies told; the alliances (blocs) lens pressed, its colours in the pixels, their list, an alliance's page; a ruler's envoy sent, and answered; one on the road, seen;
//   5. on a desktop: the same pages read.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { preview } from "vite";
import { chromium } from "playwright";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  yearOfMoment,
  type Ref,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { TIES, callOdds, claimEnd, isFeared } from "../src/rules/index.ts";
import {
  bondsOf,
  diplomacyOf,
  endRealm,
  frontier,
  livingMatches,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  tieFormOf,
  tiesOf,
  warsOf,
  type Polity,
} from "../src/sim/index.ts";
import { claimAtDeath } from "../src/sim/war/ties.ts";
import {
  blocPage,
  envoyPage,
  leaguePage,
  matchPage,
  realmTiesTab,
} from "../src/host/inspect/ties.ts";
import { warPage } from "../src/host/inspect/realm.ts";
import { claimOf } from "../src/host/inspect/words.ts";
import { blocsOf } from "../src/host/inspect/ties.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  arg = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  },
  shots = arg("--shots");
if (shots) mkdirSync(shots, { recursive: true });
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
const GPU = [
  "--enable-gpu",
  "--ignore-gpu-blocklist",
  "--use-angle=d3d11",
  "--force_high_performance_gpu",
];
const problems: string[] = [],
  check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  },
  say = (s: string) => console.log(`  ${s}`);
console.log("gate 98, what binds realms");

// 1. The rule, pure.
{
  const s = {
    bond: "pact" as const,
    foeRatio: 1,
    regard: 0.5,
    foeRegard: 0,
    wars: 0,
    rested: 1,
    valour: 0.5,
  };
  const base = callOdds(s).chance;
  check(base > 0.5, "a sworn friend, rested, against an equal, comes less than half the time");
  check(callOdds({ ...s, foeRatio: 6 }).chance < base, "a far stronger foe does not hold one back");
  check(callOdds({ ...s, foeRatio: 6 }).against === "afraid", "afraid is not why they stayed");
  check(callOdds({ ...s, wars: 1 }).against === "spent", "a war of its own is not why they stayed");
  check(callOdds({ ...s, rested: 0 }).against === "weary", "mourning is not why they stayed");
  check(
    callOdds({ ...s, bond: "league", foeRatio: 6 }).chance >=
      callOdds({ ...s, bond: "league" }).chance,
    "a compact sworn in fear is held back by the fear",
  );
  check(callOdds({ ...s, bond: "kin" }).chance < base, "kin come more readily than the sworn");
  check(claimEnd("foster", 0.5, 0.1, true, 0.5) === "seated", "those who choose took no one");
  check(claimEnd("foster", -0.5, 0.1, true, 0.1) === "passedby", "those who choose took a foe");
  check(claimEnd("wed", 0.5, 0.2, true, 0.1) === "passes", "a small friend does not pass");
  check(claimEnd("wed", -0.5, 0.5, true, 0.1) === "war", "a claim on an ill-wisher brings no war");
  check(
    claimEnd("wed", -0.5, 3, true, 0.1) === "passedby",
    "a small claimant goes to war on a giant",
  );
  check(claimEnd("wed", -0.5, 0.5, false, 0.1) === "passedby", "war with no land between");
  check(!isFeared(TIES.fearShare - 0.01, 9), "a small realm is feared");
  check(!isFeared(0.9, 0), "one who won nothing is feared");
}

type U = typeof EARTH;
const loadFile = (u: U, file: string): World => {
  const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
    typeof loadWorld
  >[0];
  return loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
};
const BAD = /undefined|NaN|\[object|\bnull\b|\b(ev|pol|war|cell|town):\d/;
const plain = (x: unknown): string => {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (Array.isArray(x)) return x.map(plain).join("");
  const o = x as { text?: unknown };
  return typeof o.text === "string" ? o.text : "";
};
const wordsOfPage = (m: unknown): string => {
  const out: string[] = [];
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") {
      if (
        key === "text" ||
        key === "title" ||
        key === "name" ||
        key === "label" ||
        key === "icon" ||
        key === "__line"
      )
        out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, typeof x === "string" ? "__line" : key);
      return;
    }
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === "ref" || k === "why" || k === "id" || k === "kind" || k === "type") continue;
        walk(x, k);
      }
  };
  walk(m);
  return out.join(" ");
};
const readClean = (what: string, m: unknown) => {
  const w = wordsOfPage(m);
  check(
    !BAD.test(w),
    `${what} says: ${BAD.exec(w)?.[0]} in "${w.slice(Math.max(0, w.search(BAD) - 60), w.search(BAD) + 60)}"`,
  );
  return w;
};

/** Every thing of what binds them, read: a bad word on any is a defect; returns how many read. */
function readAll(world: World, tag: string): { pages: number; lines: string[] } {
  const store = tiesOf(world),
    realms = politiesOf(world),
    lines: string[] = [];
  let pages = 0;
  for (const c of store.allCalls().slice(-40)) {
    const line = claimOf(world, c.event);
    check(!BAD.test(line), `${tag}: a call says ${line}`);
    lines.push(line);
    const w = warPage(world, c.war);
    readClean(`${tag}: the war of a call`, w);
    pages++;
  }
  for (const l of store.leagues()) {
    readClean(`${tag}: a compact`, leaguePage(world, `league:${l.event}`));
    lines.push(claimOf(world, l.event));
    pages++;
  }
  for (const e of store.envoys().slice(-20)) {
    readClean(`${tag}: an envoy`, envoyPage(world, `envoy:${e.event}`));
    lines.push(claimOf(world, e.event));
    pages++;
  }
  for (const p of realms.living().slice(0, 40)) {
    readClean(`${tag}: a realm's bonds`, realmTiesTab(world, p));
    pages++;
    for (const m of livingMatches(world, p.ref, yearOfMoment(world.now)).slice(0, 1)) {
      readClean(`${tag}: a marriage`, matchPage(world, `match:${m.event}`));
      lines.push(claimOf(world, m.event));
      pages++;
    }
  }
  for (const head of [...blocsOf(world).blocs.keys()].slice(0, 10)) {
    readClean(`${tag}: a bloc`, blocPage(world, `bloc:${head}`));
    pages++;
  }
  return { pages, lines };
}

const file = arg("--save"),
  universe = (arg("--universe") ?? (file && !file.includes("earth--") ? "alien" : "earth")) as
    "earth" | "alien",
  u = universe === "earth" ? EARTH : ALIEN;

// 2. A world at year 40, and a young world run on: on every path, CI's too. One world, forged on as it goes.
const young = EARTH.build(seedFromText("first light"));
{
  young.runTo(40 * YEAR);
  const r = readAll(young, "a world at 40");
  say(`a world at 40: ${politiesOf(young).living().length} realms, ${r.pages} pages read`);
}
// The world this gate goes on: a save from before the rule, or a young world run.
const t0 = performance.now();
let world: World;
if (file) {
  world = loadFile(u, file);
  check(tiesOf(world).allCalls().length === 0, "a save from before the rule holds calls");
  check(tiesOf(world).leagues().length === 0, "a save from before the rule holds compacts");
  readAll(world, "the save as it loaded");
} else {
  world = young;
  world.runTo(300 * YEAR);
}
const startYear = yearOfMoment(world.now);
// Forward until something has answered: a far save's first years are all it needs.
for (let y = startYear + 1; y <= startYear + 60; y++) {
  world.runTo(y * YEAR);
  if (
    y >= startYear + 25 &&
    tiesOf(world)
      .allCalls()
      .some((c) => c.came)
  )
    break;
}
const runYears = yearOfMoment(world.now) - startYear;
say(
  `${world.seed.text} from ${startYear}, ${runYears} years on, ${Math.round(performance.now() - t0)} ms: ${tiesOf(world).allCalls().length} called, ${
    tiesOf(world)
      .allCalls()
      .filter((c) => c.came).length
  } came, ${tiesOf(world).leagues().length} compacts, ${tiesOf(world).embassies().length} embassies, ${politiesOf(world).living().length} realms`,
);

/** Two realms that meet, with land between them, none of them bound. */
function pair(w: World, not: readonly Ref[] = []): [Polity, Polity] | null {
  const ctx = populationContext(w),
    realms = politiesOf(w),
    bonds = bondsOf(w),
    wars = warsOf(w);
  for (const r of diplomacyOf(w).all()) {
    if (not.includes(r.a) || not.includes(r.b)) continue;
    const a = realms.get(r.a),
      b = realms.get(r.b);
    if (!a || !b || a.ended !== null || b.ended !== null) continue;
    if (bonds.between(a.ref, b.ref) || bonds.oathOf(a.ref) || bonds.oathOf(b.ref)) continue;
    if (wars.between(a.ref, b.ref)) continue;
    if (!frontier(ctx, a, b).length) continue;
    return [a, b];
  }
  return null;
}

// A call that fires, on any world: a pact sworn by hand, its friend attacked, the answer read (identical A/B means it did not fire).
{
  const w = world;
  const d0 = pair(w);
  check(!!d0, "no two realms meet at 300");
  if (d0) {
    const [a, d] = d0,
      other = diplomacyOf(w)
        .all()
        .find(
          (r) =>
            ((r.a === d.ref && r.b !== a.ref) || (r.b === d.ref && r.a !== a.ref)) &&
            !warsOf(w).between(r.a, r.b),
        );
    if (other) {
      const ally = (other.a === d.ref ? other.b : other.a) as Ref;
      other.pact = a.event;
      other.opinion = 0.9;
      w.submit("reign.war", { realm: a.ref, ruler: a.ruler.name, against: d.ref });
      w.runTo(w.now + 2 * YEAR);
      const calls = tiesOf(w)
        .allCalls()
        .filter((c) => c.called === ally);
      check(calls.length > 0, "a realm attacked did not call the one sworn to it");
      if (calls[0]) {
        const line = claimOf(w, calls[0].event);
        say(`a call: ${line}`);
        check(/Called by/.test(line), `a call's words: ${line}`);
        const page = warPage(w, calls[0].war),
          text = readClean("the war called to", page);
        check(/Who was called/.test(text), "a war's page does not say who was called");
      }
    } else say("no third realm to call at 300");
  }
}

// The paths nobody watches.
{
  const w = world;
  const ctx = populationContext(w),
    realms = politiesOf(w),
    p0 = pair(w);
  if (p0) {
    const [v, o] = p0;
    // A vassal whose overlord has fallen.
    bondsOf(w).add({
      kind: "vassal",
      from: v.ref,
      to: o.ref,
      war: warsOf(w).all()[0]?.ref ?? (v.ref as Ref),
      event: v.event,
      grain: 0,
      since: yearOfMoment(w.now) - 10,
      until: yearOfMoment(w.now) + 30,
      paid: 0,
      short: 0,
      shortSince: 0,
    });
    readClean("a vassal's bonds", realmTiesTab(w, v));
    endRealm(ctx, o, w.now, { ref: v.event, role: "trigger", weight: 1 });
    w.runTo(w.now + YEAR);
    check(!bondsOf(w).oathOf(v.ref), "an oath to one fallen still holds");
    readClean("a vassal whose overlord has fallen", realmTiesTab(w, v));
    readClean("a bloc of one who fell", blocPage(w, `bloc:${o.ref}`));
  }
  // A marriage into a realm that ended; and a claim on the seat of a ruler a person plays.
  const p1 = pair(w);
  if (p1) {
    const [a, b] = p1,
      event = w.events.emit({
        type: "ties.match",
        subjects: [a.ref, b.ref],
        place: null,
        causes: [],
        data: {
          realm: realmName(a),
          other: realmName(b),
          who: "Ana Vel",
          to: "Tor Ash",
          form: "wed",
        },
      }),
      year = yearOfMoment(w.now),
      o = orderOf(w)!,
      m = {
        with: b.ref,
        who: "Ana Vel",
        whoSex: 1,
        whoBorn: year - 30,
        to: "Tor Ash",
        toSex: 0,
        toBorn: year - 32,
        year: year - 25,
        event,
        form: "wed" as const,
      },
      oa = o.of(a.ref);
    if (oa) {
      oa.matches = [...(oa.matches ?? []), m];
      const page = readClean("a marriage's page", matchPage(w, `match:${event}`));
      check(
        /Standing/.test(page),
        `a marriage's claim is not told as standing: ${page.slice(0, 160)}`,
      );
      const ruler = a.ruler,
        death = w.events.emit({
          type: "polity.succession",
          subjects: [a.ref],
          place: null,
          causes: [],
          data: { name: realmName(a), old: ruler.name, age: 60 },
        }),
        done = claimAtDeath(populationContext(w), a, ruler, death, false, w.now);
      check(!!done, "a house with no one left, and a marriage standing: no one came forward");
      if (done) {
        const claims = w.events.all().filter((e) => e.type === "ties.claim"),
          line = claimOf(w, claims.at(-1)!.id);
        say(`a claim: ${line}`);
        check(!BAD.test(line), `a claim says: ${line}`);
        check(!line.includes(`and ${ruler.name},`), `the one who died came forward: ${line}`);
        if (done.ruler) a.ruler = { ...done.ruler, since: year, event: death };
        // (The person who played them now reads that they rule no more, or that it has fallen.)
        const reign = u.queries["reign.now"]!(w, { realm: a.ref, ruler: ruler.name }) as {
          fell: unknown;
        } | null;
        if (a.ended !== null || done.ruler)
          check(!!reign?.fell, "the played ruler's page does not say their rule ended");
      }
    }
    // The other realm ends: the marriage lapses, its page says so.
    const ctx2 = populationContext(w);
    if (b.ended === null) endRealm(ctx2, b, w.now, { ref: b.event, role: "trigger", weight: 1 });
    check(
      !livingMatches(w, a.ref, yearOfMoment(w.now)).some((x) => x.event === event),
      "a marriage into a realm that ended stands",
    );
    const page = readClean("a marriage into a realm that ended", matchPage(w, `match:${event}`));
    check(/Lapsed/.test(page), "a marriage into a realm that ended does not say its claim lapsed");
  }
  w.runTo(w.now + 3 * YEAR);
  readAll(w, "after what was forged");
  void realms;
}
// A water people; a world of many realms.
for (const [flag, label] of [
  ["--water", "a water people"],
  ["--many", "a world of many realms"],
] as const) {
  const f = arg(flag);
  if (!f || !existsSync(f)) continue;
  const w = loadFile(ALIEN, f),
    from = yearOfMoment(w.now),
    t = performance.now();
  w.runTo((from + 10) * YEAR);
  const ms = (performance.now() - t) / 10,
    any = politiesOf(w).living()[0],
    form = any ? tieFormOf(w, any) : "none",
    r = readAll(w, label);
  say(
    `${label}: ${w.seed.text}, ${politiesOf(w).living().length} realms, ${Math.round(ms)} ms a year, their way of it "${form}", ${r.pages} pages read`,
  );
  if (flag === "--water") check(form === "graft", `a water people's way is ${form}`);
  for (const line of r.lines.slice(-3)) say(`  ${line}`);
}

// 3. What the run came to, read for its worst.
const read = readAll(world, world.seed.text),
  store = tiesOf(world),
  wars = warsOf(world)
    .all()
    .filter((w) => w.declared > startYear && !w.civil),
  callOf = (ref: Ref) => (world.events.get(ref)?.data as { call?: string } | null)?.call,
  sides = new Map<string, number>();
for (const w of wars) {
  const c = callOf(w.event);
  if (c) sides.set(c, (sides.get(c) ?? 0) + 1);
}
const largest = 2 + Math.max(0, ...sides.values());
say(`${read.pages} pages read; the largest war held ${largest} realms`);
check(largest <= 2 + TIES.callMost, `a war of ${largest} realms: more than the rule lets come`);
for (const l of read.lines.slice(-8)) say(`LINE ${l}`);

// 4. By real touch.
const fileName = `${universe}:gate98`;
const u2 = file ? u : EARTH;
const bytes = gzipSync(
  JSON.stringify(saveWorld(world, rulesetId(world, u2.version), { universe: u2.name })),
);
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4298, strictPort: false } }),
  site = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: ci || soft ? 1 : 2,
    hasTouch: true,
    isMobile: true,
  }),
  page = await context.newPage(),
  errors: string[] = [];
page.setDefaultTimeout(slow(60000));
page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const until = async (what: string, ok: () => Promise<boolean>, ms = slow(60000)) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(80);
  }
  problems.push(`${what} did not come`);
  return false;
};
const settle = (ms: number) => page.waitForTimeout(slow(ms));
const centre = (sel: string) =>
  k<{ x: number; y: number; w: number; h: number; under: string | null } | null>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, under: top && (e === top || e.contains(top)) ? null : String(top ? top.className || top.tagName : "nothing") };
    }
    return null;
  })()`);
const seen = (sel: string) => centre(sel).then((c) => !!c);
const tap = async (sel: string, what = sel) => {
  await k(
    `(() => { for (const e of document.querySelectorAll(${JSON.stringify(sel)})) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { e.scrollIntoView({ block: "center", inline: "center" }); return; } } })()`,
  );
  await page.waitForTimeout(slow(150));
  type At = { x: number; y: number; w: number; h: number; under: string | null };
  let at: At | null = null;
  await until(`${what} on the screen`, async () => {
    at = await centre(sel);
    return !!at;
  });
  if (!at) return;
  const p = at as At;
  check(!p.under, `${what} lies under ${p.under}`);
  check(
    p.x - p.w / 2 >= -1 && p.x + p.w / 2 <= 431 && p.y > 0 && p.y < 932,
    `${what} lies off the screen, at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  );
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(slow(300));
};
const words = (sel: string) =>
  k<string>(`(() => {
    for (const e of document.querySelectorAll(${JSON.stringify(sel)})) {
      const r = e.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) return e.innerText;
    }
    return "";
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 431");
const pageText = () => words(".page-window");
const open = async (ref: string) => {
  await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
  await until(`the page ${ref}`, async () => (await pageText()).length > 20, slow(30000));
  await settle(300);
};
const tabPress = async (name: string) => {
  const at = await k<number>(
    `[...document.querySelectorAll(".page-window .tabs .tab")].findIndex((b) => b.textContent.includes(${JSON.stringify(name)}))`,
  );
  check(at >= 0, `no ${name} tab`);
  if (at >= 0) await tap(`.page-window .tabs .tab:nth-child(${at + 1})`, `the ${name} tab`);
};
const closePage = async () => {
  await k(`globalThis.causalis.closePage?.()`);
  await settle(200);
};
async function takeUp(): Promise<void> {
  const q = `universe=${u2.name === "alien" ? "alien" : "earth"}&seed=${encodeURIComponent(world.seed.text)}`,
    drawn = () =>
      page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await page.goto(`${site}?${q}&hold=1`);
  await drawn();
  await page.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), fileName],
  );
  await page.goto(`${site}?${q}&load=${encodeURIComponent(fileName)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
}
// The realm most bound; a war with allies; a compact, if one has been.
const living = politiesOf(world).living(),
  head = [...blocsOf(world).blocs.entries()].sort((a, b) => b[1].length - a[1].length)[0],
  bound = head ? head[0] : living[0]!.ref,
  called = store.allCalls().find((c) => c.came) ?? store.allCalls().at(-1),
  compact = store.leagues().at(-1);
await takeUp();
{
  await open(bound);
  await tabPress("Bonds");
  await until("the bonds", async () => /Stands with/.test(await pageText()), slow(20000));
  const text = await pageText();
  say(`the Bonds tab on the screen: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  check(/Stands with/.test(text), "the Bonds tab does not say who it stands with");
  check(!BAD.test(text), `the Bonds tab says ${BAD.exec(text)?.[0]}`);
  check(await fits(), "the Bonds tab is wider than the screen");
  await shot("1-bonds");
  await closePage();
}
if (called) {
  await open(called.war);
  const text = await pageText();
  say(`a war's page: ${text.replace(/\s+/g, " ").slice(0, 400)}`);
  check(
    /Who was called|With allies|Called, and stood by/i.test(text),
    "a war with a call does not tell it",
  );
  check(!BAD.test(text), `a war's page says ${BAD.exec(text)?.[0]}`);
  await shot("2-war");
  await closePage();
} else say("no call in this run to read on a war's page");
if (compact) {
  await open(`league:${compact.event}`);
  const text = await pageText();
  say(`a compact's page: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  check(/Who gathered/i.test(text), "a compact's page does not say who gathered");
  check(!BAD.test(text), `a compact's page says ${BAD.exec(text)?.[0]}`);
  await shot("3-compact");
  await closePage();
}
// The blocs lens (in the UI "Alliances": "league" is a realm's title), by touch; its colours in the pixels; its list, and one of them.
{
  const before = await page.screenshot();
  const opened = await seen(`.mapmodes .mode[aria-label="Alliances"]`);
  if (!opened) {
    // (Its bar is behind the phone's map button.)
    await k(
      `[...document.querySelectorAll("button")].find((b) => /map|lens|fold the bar/i.test(b.title || b.getAttribute("aria-label") || ""))?.click()`,
    );
    await settle(500);
  }
  await tap(`.mapmodes .mode[aria-label="Alliances"]`, "the alliances lens");
  await until(
    "the alliances' key",
    async () =>
      (await k<number>(`document.querySelectorAll(".alliance-key").length`)) > 0 ||
      /alone/.test(await words(".legend-note")),
    slow(20000),
  );
  await settle(1500);
  const key = await words(".legend");
  say(`the lens: ${key.replace(/\s+/g, " ")}`);
  check(/alliance|alone/i.test(key), `the lens does not say what it shows: "${key}"`);
  const after = await page.screenshot();
  check(Buffer.compare(before, after) !== 0, "the alliances lens changed nothing on the screen");
  await shot("4-lens");
  if (await seen(".legend-action")) {
    await tap(".legend-action", "every alliance");
    await until(
      "their list",
      async () => /By their people|No two realms/i.test(await pageText()),
      slow(20000),
    );
    const list = await pageText();
    check(!BAD.test(list), `the alliances' list says ${BAD.exec(list)?.[0]}`);
    await closePage();
  } else check(false, "the alliances lens has no way to their list");
  if (await seen(".alliance-key")) {
    await tap(".alliance-key", "an alliance in the key");
    await until(
      "an alliance's page",
      async () => /Who stands in it/i.test(await pageText()),
      slow(20000),
    );
    const text = await pageText();
    say(`an alliance's page: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
    check(!BAD.test(text), `an alliance's page says ${BAD.exec(text)?.[0]}`);
    await shot("5-bloc");
    await closePage();
  } else check(!head, "the alliances lens keys no alliance");
}
// A ruler's envoy, sent and answered.
let sentTo: string | null = null;
{
  const met = (p: Polity) =>
    diplomacyOf(world)
      .all()
      .filter((r) => r.a === p.ref || r.b === p.ref).length;
  const ruled =
    living
      .filter((p) => met(p) > 0 && !warsOf(world).fighting(p.ref).length)
      .sort((a, b) => met(b) - met(a))[0] ?? living[0]!;
  await k(`globalThis.causalis.open(${JSON.stringify(`${ruled.ref}#leaders`)})`);
  await until("the leaders tab", () => seen(".leader-rule"), slow(60000));
  await settle(300);
  await tap(".leader-rule", "Rule as them");
  await until(
    "the ruling bar",
    async () => (await seen(".reign-strip")) && !!(await k("globalThis.causalis.reign.state()")),
    slow(120000),
  );
  await settle(1200);
  const buy = page.locator(`.reign-drama[data-choice="buy"]`);
  if (await buy.count().catch(() => 0)) await buy.first().tap();
  await tap(`.reign-act[data-act="envoys"]`, "the tray's Envoy");
  await until("the envoy's sheet", () => seen(".reign-envoy"), slow(20000));
  const sheet = await words(".reign-envoy");
  say(`the sheet: ${sheet.replace(/\s+/g, " ").slice(0, 300)}`);
  check(
    /believe their host/.test(sheet),
    "the sheet does not say what they know of the other's host",
  );
  check(!BAD.test(sheet), `the envoy's sheet says ${BAD.exec(sheet)?.[0]}`);
  check(await fits(), "the envoy's sheet is wider than the screen");
  await shot("6-sheet");
  const can = await seen(`.reign-send[data-can="1"]`);
  check(can, "no envoy can be sent by a ruler at peace who meets others");
  if (can) {
    const asked = await k<string>(
      `globalThis.causalis.client.query({ type: "reign.envoys", args: { realm: ${JSON.stringify(ruled.ref)} } }).then((d) => JSON.stringify(d.realms.map((r) => r.errands.map((e) => e.can))))`,
    );
    await tap(`.reign-send[data-can="1"]`, "send an envoy");
    await until(
      "the envoy gone",
      async () =>
        (await k<string>(
          `globalThis.causalis.client.query({ type: "reign.envoys", args: { realm: ${JSON.stringify(ruled.ref)} } }).then((d) => JSON.stringify(d.realms.map((r) => r.errands.map((e) => e.can))))`,
        )) !== asked,
      slow(30000),
    );
    await settle(500);
    sentTo = await k<string | null>(
      `globalThis.causalis.client.query({ type: "reign.envoys", args: { realm: ${JSON.stringify(ruled.ref)} } }).then((d) => d.realms.find((r) => r.errands.some((e) => e.errand === "embassy" && !e.can))?.ref ?? null)`,
    );
    await tap(`.reign-act[data-act="envoys"]`, "the tray's Envoy, again");
    await until("the envoy's sheet, again", () => seen(".reign-envoy"), slow(20000));
    const again = await words(".life-winwords.reign-envoywords");
    say(`after it went: ${again.replace(/\s+/g, " ").slice(0, 200)}`);
    const all = await k<string>(
      `[...document.querySelectorAll(".reign-envoy")].map((e) => e.innerText).join(" ")`,
    );
    check(
      /Your people are at their seat already|You are sworn to them already/.test(all),
      "the sheet does not say what the envoy did",
    );
    await shot("7-sent");
  }
  const refused = await seen(`.reign-send[data-can="0"]`);
  if (refused) {
    await tap(`.reign-send[data-can="0"]`, "an errand they would not hear");
    await settle(400);
    await shot("8-refused");
  }
}
// One on the road, seen: the land of a seat an envoy went from this year or last.
{
  await k(`globalThis.causalis.reign?.leave?.()`);
  await settle(400);
  // (Its land's own colours, as a person goes down to it.)
  await k(`document.querySelector('.mapmodes .mode[aria-label="Land"]')?.click()`);
  await settle(300);
  const list = await k<{ cell: number; event: string; color: number[] }[]>(`(async () => {
    const realms = await globalThis.causalis.client.query({ type: "realms.map" });
    return realms;
  })().then(() => [])`);
  void list;
  const envoy = [...store.envoys()]
    .reverse()
    .find((e) => politiesOf(world).get(e.from)?.ended === null);
  check(!!envoy, "no envoy in the last years");
  const cellOf = envoy ? politiesOf(world).get(envoy.from)!.seat : -1;
  if (envoy) {
    // (The year it went: the world was left at the moment the save was made.)
    await k(`globalThis.causalis.closePage?.()`);
    await k(`globalThis.causalis.descend(${cellOf})`);
    await until(
      "the land drawn",
      async () =>
        Object.keys(
          (await k<{ traffic: Record<string, number> }>(`globalThis.causalis.land()`)).traffic,
        ).length > 0,
      slow(60000),
    );
    const land = await k<{ traffic: Record<string, number> }>(`globalThis.causalis.land()`);
    say(`on its roads: ${JSON.stringify(land.traffic)}`);
    const year = yearOfMoment(world.now);
    if (year - envoy.year <= 1)
      check((land.traffic.envoy ?? 0) > 0, "one on an errand is not on the land's roads");
    const where = () =>
      k<{ x: number; y: number; z: number } | null>(`globalThis.causalis.landCarrier("envoy")`);
    // (On the rider itself, not the ground under it: a far city's trodden ground stands well over the ground.)
    const faceIt = (a: { x: number; y: number; z: number }, far: number) =>
      k(
        `(() => { const c = globalThis.causalis; c.faceLand(${a.x}, ${a.z}, ${far}); c.rig.target.y = ${a.y}; })()`,
      );
    let at = await where();
    if (at) {
      await k(`(() => { const r = globalThis.causalis.rig; r.pitch = -35; r.yaw = 40; })()`);
      await faceIt(at, 30);
      await settle(1200);
      await shot("9-road-far");
      // (As near as a person can come on a land. It has gone on as the eye came down: to where it is now.)
      at = await where();
      if (at) await faceIt(at, 12);
      await settle(700);
      at = await where();
      if (at) await faceIt(at, 12);
      await settle(120);
      await shot("9-road");
      // (Through a far town the road runs under its blocks: on along it, to where it goes in the open.)
      for (let i = 1; i <= 4; i++) {
        await k(`globalThis.causalis.client.setSpeed(86400)`);
        await page.waitForTimeout(9000);
        await k(`globalThis.causalis.client.setSpeed(0)`);
        await page.waitForTimeout(300);
        at = await where();
        if (at) await faceIt(at, 12);
        await settle(300);
        await shot(`9-road-${i}`);
      }
      // A person's way to them: ⌖ Go to on their page, and a press on them opening it.
      type Rider = { ref: string; x: number; y: number };
      const riders = () => k<Rider[]>(`globalThis.causalis.landRiders?.() ?? []`);
      const ref = (await riders())[0]?.ref ?? null;
      check(!!ref, "one on a road has no place on the screen");
      if (ref) {
        await k(`globalThis.causalis.open(${JSON.stringify(ref)})`);
        await until(
          "the envoy's page, read",
          async () =>
            (await k<string>(
              `document.querySelector(".page-window .page-title")?.textContent ?? ""`,
            )) !== "…",
        );
        await tap(".page-window:not([hidden]) .go-to", "⌖ Go to on an envoy's page");
        await until(
          "the eye come to the one on a road",
          async () => (await k<number>(`globalThis.causalis.rig.distance`)) <= 12.01,
          slow(20000),
        );
        await settle(1200);
        const r = (await riders()).find((x) => x.ref === ref) ?? null;
        const name = await k<string>(
          `[...document.querySelectorAll("#hud *")].map((e) => (e.children.length ? "" : e.textContent ?? "")).find((t) => t.startsWith("📜 ")) ?? ""`,
        );
        say(`their name over them: ${name}`);
        check(/^📜 \S/.test(name), "no name over the one on a road, as near as a person can come");
        say(`gone to the rider: ${JSON.stringify(r)}`);
        check(
          !!r && r.x > 0 && r.x < 430 && r.y > 150 && r.y < 900,
          `⌖ Go to left the one on a road off the screen: ${JSON.stringify(r)}`,
        );
        await shot("9-road-go-to");
        if (r) {
          await page.touchscreen.tap(r.x, r.y);
          await until(
            "the page of the one pressed on a road",
            async () => (await k<string>(`String(globalThis.causalis.pageOpen?.() ?? "")`)) === ref,
          );
          await until(
            "the envoy's page, read again",
            async () =>
              (await k<string>(
                `document.querySelector(".page-window .page-title")?.textContent ?? ""`,
              )) !== "…",
          );
          await shot("9-road-page");
          await k(`globalThis.causalis.closePage?.()`);
        }
      }
    }
    // One come from another seat, standing at its court: the ruler's own, sent above.
    const to = sentTo ? politiesOf(world).get(sentTo as never) : null,
      town = to
        ? populationContext(world)
            .settlements.inProvince(to.seat)
            .find((v) => v.name === to.town)
        : null;
    say(`at a court: the ruler's own at ${to?.town ?? "nowhere"}, ${town?.ref ?? "no town"}`);
    check(!!town, "the seat the envoy went to is no town");
    if (town) {
      await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
      await until(
        "the seat's town",
        async () => (await k<string>("globalThis.causalis.scale()")) === "village",
      );
      await settle(2500);
      const here = await k<{ ref: string } | null>(
        "globalThis.causalis.planNow?.()?.envoy ?? null",
      );
      check(!!here?.ref, `no one from another seat stands at the court of ${to!.town}`);
      const place = await k<{ worldX: number; worldZ: number; yaw: number } | null>(
        "globalThis.causalis.court?.()?.place ?? null",
      );
      say(`its court: ${JSON.stringify(place)}`);
      if (place) {
        // (By day, and from above the roofs between.)
        const t = await k<number>("globalThis.causalis.client.status?.t ?? 0");
        await k(
          `globalThis.causalis.client.advance(${Math.floor(t / 86400) * 86400 + 86400 + 12 * 3600})`,
        );
        await settle(1500);
        await k(
          `globalThis.causalis.rig.flyTo({ target: { x: ${place.worldX * 0.1}, y: 0.2, z: ${place.worldZ * 0.1} }, yaw: ${(place.yaw * 180) / Math.PI}, distance: 2, pitch: -55 })`,
        );
        await settle(1500);
        await shot("9-court");
      }
    }
  }
}
await context.close();
// 5. On a desktop.
const desk = await browser.newContext({ viewport: { width: 1366, height: 768 } }),
  page2 = await desk.newPage();
page2.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
{
  const q = `universe=${u2.name === "alien" ? "alien" : "earth"}&seed=${encodeURIComponent(world.seed.text)}`;
  await page2.goto(`${site}?${q}&hold=1`);
  await page2.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page2.evaluate(
    async ([data, keep]) => {
      const b = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
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
      await c.importSave(b);
      await c.save(keep as string);
    },
    [bytes.toString("base64"), `${fileName}d`],
  );
  await page2.goto(`${site}?${q}&load=${encodeURIComponent(`${fileName}d`)}&hold=1`);
  await page2.waitForFunction(
    () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
    undefined,
    { timeout: slow(180000) },
  );
  await page2.evaluate(`globalThis.causalis.open(${JSON.stringify(`${bound}#ties`)})`);
  await page2.waitForTimeout(slow(1500));
  const text = (await page2.evaluate(
    `(() => { const e = document.querySelector(".page-window"); return e ? e.innerText : ""; })()`,
  )) as string;
  check(/Stands with/.test(text), "the desktop's Bonds tab does not say who it stands with");
  check(!BAD.test(text), `the desktop's Bonds tab says ${BAD.exec(text)?.[0]}`);
  if (shots) await page2.screenshot({ path: join(shots, "10-desktop.png") });
}
await browser.close();
await server.close();
check(!errors.length, `errors on the page: ${errors.slice(0, 3).join(" | ").slice(0, 500)}`);
void plain;
if (problems.length) {
  console.log(`gate 98 FAILED:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("gate 98 passed");
process.exit(0);
