// node tools/l4-gate.ts [--ci] [--soft] [--shots dir] [--earth file.save] [--alien file.save]: gate 76, play a ruler (Lives L4), at a
// phone's size, by real touch, on Earth and one alien world, each a far save or (as on CI) a world run a few centuries.
//   1. stations read off the world: rulers alone, by others' leave, and sharing rule must carry different shares;
//   2. a ruler taken from their realm's leaders tab: the bar, the tray, nothing submitted;
//   3. a world under a ruler who does nothing, months run and a year advanced: the same hashes as the same save run without them;
//   4. decrees: refused in words when their standing is gone, accepted once it is back, with its event naming whose word;
//   5. war: declared by touch for a land named, its event and cost; its first battle reached, its page opened; peace asked;
//   6. a marriage of state: what the two realms think of each other moves, the family page keeps it;
//   7. their fall: an old ruler's death said in words, the one who holds the seat offered, ruling on, letting go;
//   8. no error in the page; nothing is wider than the screen; no control is too small.
import { mkdirSync, readFileSync } from "node:fs";
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
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  diplomacyOf,
  frontier,
  politiesOf,
  populationContext,
  stationOf,
  warsOf,
  type Polity,
} from "../src/sim/index.ts";
import { REIGN, mustCarry } from "../src/rules/index.ts";
import type { ReignDecrees, ReignMatches, ReignNow, ReignWars } from "../src/bridge/index.ts";

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
console.log("gate 76, play a ruler");

// 1. Stations, from what the world holds: pure.
check(mustCarry(0, 0) === 0, "a chief by birth must carry anyone");
check(
  mustCarry(2, 2) > mustCarry(0, 1),
  "an assembly's acclaimed head carries no more than a chosen chief",
);
check(
  mustCarry(2, 2) === REIGN.carryByLeave + REIGN.carryShared,
  "an assembly's head's share is off",
);

type Forged = {
  readonly bytes: Buffer;
  readonly universe: "earth" | "alien";
  readonly seed: string;
  /** The realm to rule, and one whose ruler is about to die. */
  readonly realm: string;
  readonly old: string;
  readonly hashAt: number;
  readonly hashes: string;
};

const worldOf = (
  universe: "earth" | "alien",
  seed: string,
  year: number,
  file?: string,
): { world: World; seed: string } => {
  const u = universe === "earth" ? EARTH : ALIEN;
  if (file) {
    const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = u.build(seedFromText(doc.seed));
    return {
      world: loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
        allowRulesetChange: true,
      }).world,
      seed: doc.seed,
    };
  }
  const world = u.build(seedFromText(seed));
  world.runTo(year * YEAR);
  return { world, seed };
};

/** A world with one realm to rule, chosen by what it has about it, and another whose ruler is very old. */
function forge(
  universe: "earth" | "alien",
  seedAsked: string,
  year: number,
  file?: string,
): Forged {
  const started = performance.now(),
    u = universe === "earth" ? EARTH : ALIEN,
    { world, seed } = worldOf(universe, seedAsked, year, file),
    ctx = populationContext(world),
    realms = politiesOf(world),
    diplomacy = diplomacyOf(world),
    wars = warsOf(world),
    near = (p: Polity) =>
      diplomacy
        .of(p.ref)
        .map((r) => realms.get(r.a === p.ref ? r.b : r.a)!)
        .filter((q) => q && q.ended === null),
    living = [...realms.living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    ),
    fit = (p: Polity) =>
      near(p).some((q) => frontier(ctx, p, q).length > 0 && !wars.between(p.ref, q.ref)),
    // (One by birth, ruling alone, is answered at once: one by others' leave is read in step 1.)
    // (Those by birth, ruling alone, are answered at once: one by others' leave is the old one, read in step 7.)
    alone = (p: Polity) => mustCarry(p.leadership, p.succession) === 0,
    fitting = [
      ...living.filter((p) => alone(p) && fit(p)),
      ...living.filter((p) => !alone(p) && fit(p)),
    ],
    old =
      living.find((p) => !alone(p) && !fitting.slice(0, 6).includes(p)) ??
      living.find((p) => !fitting.slice(0, 6).includes(p)) ??
      living.at(-1)!,
    now = Math.floor(world.now / YEAR);
  if (!fitting.length) throw new Error(`no realm with a neighbour in reach on ${seed}`);
  // Very old, so a year or few under the life table's oldest band will see them gone.
  old.ruler = { ...old.ruler, born: now - 3 * ctx.life.bands.at(-1)! };
  const bytes = gzipSync(
      JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
    ),
    names = new Map(fitting.map((p) => [p.ref, p.ruler.name])),
    // The same save run on with no one ruled: the hashes to meet.
    hashAt = world.now + YEAR;
  world.runTo(hashAt);
  const hashes = JSON.stringify(world.domainHashes());
  // One whose ruler lives through the years the gate runs (a death is keyed by the seat and the moment).
  world.runTo(hashAt + 3 * YEAR);
  const realm = fitting.find(
    (p) => p !== old && p.ended === null && p.ruler.name === names.get(p.ref),
  );
  if (!realm) throw new Error(`no ruler lives through three years on ${seed}`);
  const st = stationOf(ctx, realm);
  say(
    `${seed}: year ${now}, ${living.length} realms; ruling ${realm.town} (${realm.members.length} lands, leadership ${realm.leadership}, by ${realm.succession}, law ${realm.law}): must carry ${st.carry}, standing ${st.legitimacy.toFixed(2)}, past reach ${st.beyond.length}; the old one at ${old.town}; made in ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
  return { bytes, universe, seed, realm: realm.ref, old: old.ref, hashAt, hashes };
}

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4276, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
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
const ask = <T>(type: string, args: unknown = {}) =>
  k<T>(
    `globalThis.causalis.client.query({ type: ${JSON.stringify(type)}, args: ${JSON.stringify(args)} })`,
  );
const command = (type: string, args: unknown) =>
  k<unknown>(
    `globalThis.causalis.client.command(${JSON.stringify(type)}, ${JSON.stringify(args)})`,
  );
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
/** Where it is on the screen, if anything can be pressed there: the element under its middle must be it, or in it. */
const centre = (sel: string) =>
  k<{ x: number; y: number; under: boolean } | null>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, under: !!top && !(e === top || e.contains(top)) };
  })()`);
/** A real touch: a control under another element is found this way. */
const tap = async (sel: string) => {
  await k(
    `document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center", inline: "center" })`,
  );
  await page.waitForTimeout(60);
  let at: { x: number; y: number; under: boolean } | null = null;
  await until(`${sel} on the screen`, async () => !!(at = await centre(sel)));
  if (!at) return;
  const p = at as { x: number; y: number; under: boolean };
  check(!p.under, `${sel} is under another element`);
  await page.touchscreen.tap(p.x, p.y);
};
const big = (sel: string) =>
  k<boolean>(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44;
  })()`);
const fits = () => k<boolean>("document.documentElement.scrollWidth <= 430");
const seen = (sel: string) => centre(sel).then((c) => !!c);
const text = (sel: string) =>
  k<string>(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ""`);
const reign = () => k<ReignNow | null>("globalThis.causalis.reign.state()");
const clock = () => k<number>("globalThis.causalis.client.status.t");
const advanceTo = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await until(`the clock at ${t}`, async () =>
    k<boolean>(`globalThis.causalis.client.status.t >= ${Math.round(t)} - 1`),
  );
};

/** A world as the page takes it up: kept under its own name, then opened by it. */
async function takeUp(f: Forged): Promise<void> {
  const name = `${f.universe}:gate76`,
    q = `universe=${f.universe}&seed=${encodeURIComponent(f.seed)}`,
    drawn = () =>
      page.waitForFunction(
        () =>
          ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
        undefined,
        { timeout: slow(180000) },
      );
  await page.goto(`${base}?${q}&hold=1`);
  await drawn();
  const b64 = f.bytes.toString("base64");
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
    [b64, name],
  );
  await page.goto(`${base}?${q}&load=${encodeURIComponent(name)}&hold=1`);
  await drawn();
  await k("globalThis.causalis.client.setSpeed(0)");
}

/** Take a realm's ruler by touch, from their realm's leaders tab. */
async function takeRuler(realm: string, tag: string, name: string): Promise<void> {
  await k(`globalThis.causalis.open(${JSON.stringify(`${realm}#leaders`)})`);
  await until(`${tag}: the leaders tab`, () => seen(".leader-rule"), slow(60000));
  check(await big(".leader-rule"), `${tag}: Rule as them is too small to press`);
  await settle(300);
  await shot(`${name}-leaders`);
  await tap(".leader-rule");
  await until(
    `${tag}: the ruling bar`,
    async () => (await seen(".reign-strip")) && !!(await reign()),
    slow(120000),
  );
}

async function play(f: Forged, tag: string): Promise<void> {
  await takeUp(f);
  const hashesNow = () => ask<unknown>("hashes").then((h) => JSON.stringify(h));

  // 2. Taken: the bar, the tray; nothing recorded.
  const commandsBefore = await k<number>(`globalThis.causalis.client.status.t`);
  await takeRuler(f.realm, tag, `${tag}-1`);
  await until(
    `${tag}: the eye at their home`,
    async () =>
      (await k<string>("globalThis.causalis.scale()")) === "village" || !(await reign())?.town,
    slow(120000),
  );
  await settle(1500);
  const r0 = (await reign())!;
  say(`${tag}: ${r0.ruler}, ${r0.title}, ${r0.age}: ${r0.station}`);
  say(
    `${tag}: ${r0.people} people, ${r0.lands} lands, host ${r0.host}, ${Math.round(r0.legitimacy * 100)}% rightful, ${r0.head.toFixed(1)} a head (${r0.rank} of ${r0.of}), ${r0.neighbours.length} near, ${r0.wars.length} wars, heir: ${r0.heir}`,
  );
  for (const sel of [
    ".reign-letgo",
    ".reign-pace",
    ".reign-chip",
    `.reign-act[data-act="decrees"]`,
    `.reign-act[data-act="wars"]`,
    `.reign-act[data-act="matches"]`,
    `.reign-act[data-act="walk"]`,
  ])
    check(await big(sel), `${tag}: ${sel} is too small to press`);
  check(await fits(), `${tag}: the bar is wider than the screen`);
  const fact = await k<boolean>(`(() => {
    const s = document.querySelector(".reign-strip").getBoundingClientRect(), t = document.querySelector(".reign-tray").getBoundingClientRect();
    return s.bottom < t.top && s.bottom < 460 && t.bottom <= 932;
  })()`);
  check(fact, `${tag}: the bar and the tray leave no world between them`);
  await shot(`${tag}-2-ruling`);
  void commandsBefore;

  // 3. A ruler who does nothing: the months run, a year is advanced to; the world is the same as without them.
  await tap(".reign-pace:nth-of-type(2)");
  const t0 = await clock();
  await until(
    `${tag}: the months going by`,
    async () => (await clock()) > t0 + 86_400,
    slow(30000),
  );
  const moved = (await clock()) - t0;
  say(`${tag}: under them the clock ran ${(moved / 86_400).toFixed(0)} days`);
  await shot(`${tag}-2b-months`);
  await tap(".reign-pace");
  await settle(300);
  if ((await clock()) < f.hashAt) await advanceTo(f.hashAt);
  check(
    (await clock()) === f.hashAt,
    `${tag}: the clock ran past the year to compare (${await clock()} against ${f.hashAt})`,
  );
  const same = (await hashesNow()) === f.hashes;
  check(same, `${tag}: a ruler who did nothing changed the world`);
  say(`${tag}: a year under a ruler who did nothing: ${same ? "the same hashes" : "DIFFERENT"}`);

  // 4. A decree refused: their standing gone, by the sign from the heavens.
  const legit = async () =>
    (await ask<ReignNow>("reign.now", { realm: f.realm, ruler: r0.ruler })).legitimacy;
  for (let i = 0; i < 6 && (await legit()) >= REIGN.wordLine; i++)
    await command("act.mandate", { realm: f.realm, sign: -1 });
  await tap(`.reign-act[data-act="decrees"]`);
  await until(`${tag}: the decrees`, () => seen(".reign-opt"));
  check(
    await k<boolean>(
      `[...document.querySelectorAll(".reign-opt")].every((b) => b.dataset.can === "0")`,
    ),
    `${tag}: a decree is offered with no standing`,
  );
  check(await big(".reign-opt"), `${tag}: a decree's button is too small to press`);
  await tap(".reign-opt");
  await until(`${tag}: the refusal in words`, async () =>
    /rightful/.test(await text(".reign-said")),
  );
  say(`${tag}: refused: ${await text(".reign-said")}`);
  check(await fits(), `${tag}: the decrees are wider than the screen`);
  await shot(`${tag}-3-refused`);
  check(
    !!(await k<boolean>(`!document.querySelector(".reign-sheet").hidden`)),
    `${tag}: the sheet closed on a refusal`,
  );
  await tap(".reign-close");
  // A decree accepted, its standing back.
  for (let i = 0; i < 6 && (await legit()) < 0.6; i++)
    await command("act.mandate", { realm: f.realm, sign: 1 });
  const decrees = await ask<ReignDecrees>("reign.decrees", { realm: f.realm }),
    open = decrees.laws.flatMap((l) =>
      l.options.filter((o) => o.can).map((o) => ({ law: l.law, to: o.to, label: o.label })),
    );
  check(open.length > 0, `${tag}: nothing can be decreed even with the standing back`);
  const pick = open.find((o) => o.law !== "tithe") ?? open[0];
  if (pick) {
    const before = await legit();
    await tap(`.reign-act[data-act="decrees"]`);
    await until(`${tag}: the decrees again`, () => seen(".reign-opt"));
    await settle(200);
    await shot(`${tag}-4-decrees`);
    await tap(`.reign-opt[data-law="${pick.law}"][data-to="${pick.to}"]`);
    await until(`${tag}: the decree going out`, async () => !(await seen(".reign-sheet")));
    await settle(300);
    const after = await legit(),
      deeds = await k<{ type: string; causes: string[]; by: string }[]>(
        `globalThis.causalis.client.query({ type: "reign.deeds", args: { realm: ${JSON.stringify(f.realm)} } })`,
      );
    say(
      `${tag}: decreed ${pick.law} to ${pick.label}: standing ${before.toFixed(3)} to ${after.toFixed(3)}; told as ${deeds.at(-1)?.type}`,
    );
    check(after < before, `${tag}: the decree cost nothing`);
    check(
      deeds.some((d) => d.by === r0.ruler),
      `${tag}: history does not say whose word it was`,
    );
    await shot(`${tag}-5-decreed`);
  }

  // 5. War by touch, for a land named; its first battle reached.
  await tap(`.reign-act[data-act="wars"]`);
  await until(`${tag}: the neighbours`, () => seen(".reign-declare"), slow(30000));
  const sheet = await ask<ReignWars>("reign.wars", { realm: f.realm }),
    foe = sheet.foes.find((x) => x.can && x.aims.length);
  check(!!foe, `${tag}: no neighbour can be gone to war on`);
  await settle(200);
  await shot(`${tag}-6-neighbours`);
  if (foe) {
    say(`${tag}: war on ${foe.name} (${foe.regard}): ${foe.words}`);
    const standingWas = await legit();
    await tap(`.reign-foe[data-foe="${foe.ref}"] .reign-declare`);
    await until(
      `${tag}: war declared`,
      async () => (await reign())?.wars.some((w) => w.foe === foe.ref) === true,
    );
    await settle(400);
    await shot(`${tag}-7-war`);
    check((await legit()) < standingWas, `${tag}: the war cost nothing`);
    const w = (await reign())!.wars.find((x) => x.foe === foe.ref);
    say(
      `${tag}: ${w?.words}, year ${w?.since}; chip: ${await text('.reign-chip[data-chip="wars"]')}`,
    );
    // The first battle comes at the end of the year after the one it was declared in.
    const yearEnd = (Math.floor((await clock()) / YEAR) + 2) * YEAR + 2;
    await advanceTo(yearEnd);
    await until(
      `${tag}: its first battle`,
      async () =>
        ((await reign())?.wars.find((x) => x.foe === foe.ref)?.battles ?? 0) > 0 ||
        !(await reign())?.wars.some((x) => x.foe === foe.ref),
      slow(60000),
    );
    await settle(600);
    say(`${tag}: the bar says: ${await text(".reign-told")}`);
    await tap(`.reign-act[data-act="wars"]`);
    await until(`${tag}: the war's line`, () => seen(".reign-warline, .reign-lately"), slow(30000));
    const after = await ask<ReignWars>("reign.wars", { realm: f.realm }),
      over = after.lately.find((x) => x.foe === foe.ref);
    if (over)
      say(
        `${tag}: ${over.came} ${over.last?.words}, fallen ${over.fallen[0]} and ${over.fallen[1]}`,
      );
    const battle = await seen(".reign-battle");
    check(battle, `${tag}: the first battle is not on the war's line`);
    if (battle) {
      say(`${tag}: ${await text(".reign-battle")}`);
      await settle(200);
      await shot(`${tag}-8-battle-line`);
      await tap(".reign-battle");
      await until(`${tag}: the battle's page`, () => seen(".page-panel .page-icon"), slow(30000));
      await settle(600);
      await shot(`${tag}-9-battle-page`);
      await k(`globalThis.causalis.closePage?.()`);
      await settle(300);
      if (await seen(".reign-peace")) {
        await tap(".reign-peace");
        await settle(600);
        const said = await text(".reign-said");
        say(`${tag}: asked for peace: ${said || "they heard"}`);
        await shot(`${tag}-10-peace`);
        if (await seen(".reign-close")) await tap(".reign-close");
      }
    } else if (await seen(".reign-close")) await tap(".reign-close");
  }

  // 6. A marriage of state.
  await settle(200);
  await tap(`.reign-act[data-act="matches"]`);
  await until(`${tag}: the matches`, () => seen(".reign-matchwords"), slow(30000));
  const m = await ask<ReignMatches>("reign.matches", { realm: f.realm }),
    match = m.matches.find((x) => x.can);
  say(`${tag}: ${m.words}`);
  await settle(200);
  await shot(`${tag}-11-matches`);
  if (match) {
    await tap(`.reign-wed[data-can="1"]`);
    await until(`${tag}: the wedding`, async () => !(await seen(".reign-sheet")));
    const after = await ask<ReignMatches>("reign.matches", { realm: f.realm }),
      still = after.matches.find((x) => x.to === match.to);
    say(
      `${tag}: wed ${match.who.name} to ${match.partner.name} of ${match.toName}: what they think of each other, ${match.opinion.toFixed(2)} to ${match.after.toFixed(2)}`,
    );
    check(!still || still.opinion > match.opinion, `${tag}: the marriage moved nothing`);
    await settle(300);
    await shot(`${tag}-12-wed`);
    await k(`globalThis.causalis.open(${JSON.stringify(`rule:${f.realm}#family`)})`);
    await until(`${tag}: the family page keeping the marriage`, async () =>
      (await text(".page-panel")).includes(match.partner.name),
    );
    await settle(300);
    await shot(`${tag}-12b-family`);
    await k(`globalThis.causalis.closePage?.()`);
    await settle(200);
  } else {
    check(m.words.length > 0, `${tag}: no match and no words why`);
    await tap(".reign-close");
  }

  // Walk in their body, and back to the bar.
  await tap(`.reign-act[data-act="walk"]`);
  const walked = await until(
    `${tag}: their body`,
    () => k<boolean>("!!globalThis.causalis.possess.state()"),
    slow(120000),
  );
  if (walked) {
    await settle(600);
    await shot(`${tag}-13-walk`);
    await tap(".possess-letgo");
    await until(`${tag}: back at the bar`, () => seen(".reign-strip"), slow(60000));
    // Live as them from their body; 👑 Rule on the life's tray brings the bar back.
    await tap(`.reign-act[data-act="walk"]`);
    await until(
      `${tag}: their body again`,
      () => k<boolean>("!!globalThis.causalis.possess.state()"),
      slow(120000),
    );
    await settle(500);
    await tap(".possess-live");
    const lived = await until(
      `${tag}: their life`,
      async () =>
        (await seen(".life-strip:not(.reign-strip)")) &&
        !!(await k<unknown>("globalThis.causalis.life.state()")),
      slow(120000),
    );
    if (lived) {
      await until(`${tag}: 👑 Rule on the life's tray`, () => seen(".life-rule"), slow(30000));
      await settle(300);
      await shot(`${tag}-13b-life`);
      await tap(".life-rule");
      await until(`${tag}: ruling again from the life`, () => seen(".reign-strip"), slow(120000));
      await settle(600);
    }
  }

  // Let go: back to the world as it was.
  await tap(".reign-letgo");
  await until(`${tag}: let go`, async () => !(await seen(".reign-strip")));
  check(
    !(await k<boolean>(`document.body.classList.contains("ruling")`)),
    `${tag}: the page still says it is ruling`,
  );

  // 7. A fall: an old ruler taken, the years gone by.
  await takeRuler(f.old, tag, `${tag}-14`);
  await settle(1000);
  const oldOne = (await reign())!;
  say(`${tag}: ${oldOne.ruler}, ${oldOne.title}: ${oldOne.station}`);
  await tap(`.reign-act[data-act="decrees"]`);
  await until(`${tag}: their decrees`, () => seen(".reign-opt"));
  await settle(200);
  await shot(`${tag}-14b-station`);
  await tap(".reign-close");
  for (let y = 0; y < 40 && !(await reign())?.fell; y++) {
    await advanceTo((await clock()) + YEAR);
    await settle(500);
  }
  const fell = (await reign())?.fell;
  check(!!fell, `${tag}: ${oldOne.ruler} would not die`);
  if (fell) {
    await until(`${tag}: the window of their fall`, () => seen(".reign-window .life-wintitle"));
    say(`${tag}: ${fell.title}: ${fell.words}`);
    check(await big(".reign-end"), `${tag}: Let go is too small to press`);
    await settle(200);
    await shot(`${tag}-15-fall`);
    if (fell.heir) {
      await tap(".reign-heir");
      await until(
        `${tag}: ruling on`,
        async () =>
          (await reign())?.ruler === fell.heir!.name &&
          !(await seen(".reign-window .life-wintitle")),
      );
      await shot(`${tag}-16-heir`);
      await tap(".reign-letgo");
    } else await tap(".reign-end");
    await until(`${tag}: let go at the last`, async () => !(await seen(".reign-strip")));
  }
  await k(`globalThis.causalis.closePage?.()`);
}

try {
  await play(forge("earth", "first light", 450, arg("--earth")), "earth");
  await play(forge("alien", "harrow 348", 400, arg("--alien")), "alien");
} catch (e) {
  problems.push(`${(e as Error).message}\n${(e as Error).stack ?? ""}`);
}
for (const e of errors) problems.push(`in the page: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.error(`gate 76 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 76 passed");
process.exit(0);
