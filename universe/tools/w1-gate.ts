// node tools/w1-gate.ts [--ci] [--soft] [--shots dir]: gate 72, order from fire (war-reach-plan.md W1), at a phone's size.
// A town of the Earth seed, its clock held, with a war made up about it (causalis.holdTownWar): a host of machine
// guns and armoured cars against one of self-loading rifles, at each doing a host stands or fights at, and then
// swords against swords.
//   1. past the rifle: no one closes to the hand, no tents, the ground each figure holds near the law's; team guns, cars;
//   2. the siege past the ladders: guns standing off, shells landing in the lots, the storm squads in the streets;
//   3. swords: tents about the walls, the line, the hand, as they were;
//   4. no error in the page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";
import type { TownDoing, TownWar, TownWarScene } from "../src/view/index.ts";

const argv = process.argv.slice(2),
  soft = argv.includes("--soft"),
  ci = argv.includes("--ci"),
  shotsAt = argv.indexOf("--shots"),
  shots = shotsAt >= 0 ? argv[shotsAt + 1] : undefined;
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
console.log("gate 72, order from fire");
const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4272, strictPort: false } }),
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
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};

// A town by day, its clock held.
await page.goto(`${base}?universe=earth&seed=first%20light&year=450&hold=1`);
await page.waitForFunction(
  () => ((globalThis as { causalis?: { drawn?: () => number } }).causalis?.drawn?.() ?? 0) > 0,
  undefined,
  { timeout: 1_800_000 },
);
await k("globalThis.causalis.client.setSpeed(0)");
await k(`globalThis.causalis.client.advance(globalThis.causalis.client.status.t + 8 * 3600)`);
const book = await ask<{ realms: { ref: string }[] }>("wealth.book"),
  list = await ask<{ leaders: { town: string | null }[] }>("leaders.of", {
    realm: book.realms[0]!.ref,
  }),
  town = list.leaders[0]!.town!;
await k(`globalThis.causalis.goTo(${JSON.stringify(town)})`);
await page.waitForFunction(
  () => (globalThis as { causalis?: { scale?: () => string } }).causalis?.scale?.() === "village",
  undefined,
  { timeout: slow(120000) },
);
await page.waitForTimeout(slow(1500));

type Host = { arm: string; guard: string; mount: string };
const side = (name: string, host: Host, color: [number, number, number]) => ({
  ref: `pol:gate:${name}`,
  name,
  color,
  fields: 3000,
  arms: null,
  host,
});
const hostOf = (
  s: 0 | 1,
  doing: TownDoing,
  k = 1,
  more: Record<string, unknown> = {},
): TownWar["hosts"][number] => ({ side: s, doing, k, gathered: 1, words: doing, ...more });
const fight = (stage: "drawn" | "engaged", k: number): TownWar["fight"] => ({
  stage,
  k,
  key: "war:gate:1",
});
const CASES: readonly (readonly [string, Partial<TownWar>])[] = [
  ["drawn", { fight: fight("drawn", 1), hosts: [hostOf(0, "drawn"), hostOf(1, "drawn")] }],
  [
    "engaged",
    { fight: fight("engaged", 0.55), hosts: [hostOf(0, "engaged"), hostOf(1, "engaged")] },
  ],
  ["guard", { hosts: [hostOf(1, "guard")] }],
  ["holding", { hosts: [hostOf(0, "holding")] }],
  ["besieging", { siege: true, hosts: [hostOf(0, "besieging"), hostOf(1, "besieged")] }],
  [
    "assaulting",
    {
      siege: true,
      fight: fight("engaged", 0.6),
      hosts: [hostOf(0, "assaulting"), hostOf(1, "besieged")],
    },
  ],
];
const warOf = (a: Host, d: Host, c: Partial<TownWar>): TownWar =>
  ({
    ref: "war:gate:1",
    sides: [side("the Reds", a, [0.8, 0.2, 0.2]), side("the Blues", d, [0.2, 0.3, 0.8])],
    hosts: [],
    fight: null,
    fought: null,
    placed: null,
    eve: false,
    siege: false,
    burning: 0,
    words: "the war",
    ...c,
  }) as TownWar;
/** The war held about the town, the eye well back over `at`, a few frames drawn; what its scene is. */
const see = async (tw: TownWar, name: string, far: number, on: 0 | 1 | "town" = 0) => {
  await k(`globalThis.causalis.holdTownWar(${JSON.stringify(tw)})`);
  await page.waitForTimeout(slow(900));
  const scene = await k<TownWarScene | null>("globalThis.causalis.townWarScene()");
  const m = on === "town" ? null : (scene?.middles[on] ?? null);
  await k(`globalThis.causalis.faceTown(${m ? m.x : 0}, ${m ? m.z : 0}, ${far})`);
  await page.waitForTimeout(slow(900));
  await shot(name);
  return scene;
};
const each = (s: TownWarScene) => s.soldiers.length / 4;
const standing = (s: TownWarScene, side: 0 | 1) =>
  s.soldiers.slice(side * 2 * each(s), side * 2 * each(s) + each(s)).filter((q) => q.size > 0.5);
/** The ground each figure holds: the box they stand in, over how many stand in it (m²). */
const groundOf = (qs: readonly { x: number; z: number }[]) => {
  const xs = qs.map((q) => q.x),
    zs = qs.map((q) => q.z);
  return ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs))) / qs.length;
};

const MACHINE: Host = { arm: "automatic", guard: "helmet", mount: "armoured" },
  LOADER: Host = { arm: "autoloader", guard: "helmet", mount: "foot" },
  SWORD: Host = { arm: "sword", guard: "shield", mount: "foot" };
// 1, 2. A modern host, at each doing.
for (const [doing, c] of CASES) {
  const scene = await see(
    warOf(MACHINE, LOADER, c),
    `modern-${doing}`,
    doing === "drawn" || doing === "engaged" ? 42 : 34,
    doing === "drawn" || doing === "engaged" ? 0 : doing === "guard" ? 1 : "town",
  );
  check(!!scene, `modern ${doing}: no scene`);
  if (!scene) continue;
  const all = scene.soldiers.filter((q) => q.size > 0.5 && q.doing !== "fallen");
  check(all.length > 0, `modern ${doing}: nobody there`);
  check(!all.some((q) => q.doing === "fight"), `modern ${doing}: someone fights by the hand`);
  check(scene.tents.length === 0, `modern ${doing}: tents about the town`);
  if (doing === "drawn") {
    const g = groundOf(standing(scene, 0));
    say(
      `modern drawn: ${g.toFixed(0)} m² a figure (√ ${Math.sqrt(g).toFixed(0)} m), ${each(scene)} a side`,
    );
    check(g > 800, `modern drawn holds ${g.toFixed(0)} m² a figure`);
    check((scene.teamGuns?.length ?? 0) > 0, "no team guns");
    check((scene.cars?.length ?? 0) > 0, "no cars");
    check(
      all.some((q) => q.doing === "prone"),
      "no one down",
    );
  }
  if (doing === "engaged") {
    check(
      all.some((q) => q.doing === "fire"),
      "no one firing",
    );
    check(
      all.some((q) => q.doing === "advance") || all.some((q) => q.doing === "prone"),
      "no bounds",
    );
  }
  if (doing === "besieging" || doing === "assaulting") {
    check((scene.battery?.length ?? 0) >= 3, `${doing}: no guns standing off`);
    check((scene.shells?.length ?? 0) > 0, `${doing}: no shells`);
    check(scene.fires.length > 0, `${doing}: nothing alight`);
  }
  say(
    `modern ${doing}: ${all.length} figures, doing ${[...new Set(all.map((q) => q.doing))].join(", ")}`,
  );
}
// 2b. Close to: a squad down about its team gun, and the guns standing off.
{
  const scene = await see(warOf(MACHINE, LOADER, CASES[0]![1]), "modern-drawn-2", 42);
  const g = scene?.teamGuns?.[0];
  if (g) {
    await k(`globalThis.causalis.faceTown(${g.x}, ${g.z}, 7)`);
    await page.waitForTimeout(slow(900));
    await shot("modern-team-gun");
  }
  const siege = await see(
      warOf(MACHINE, LOADER, CASES[4]![1]),
      "modern-besieging-wide",
      62,
      "town",
    ),
    b = siege?.battery?.[1];
  check(!!b, "no battery to look at");
  if (b) {
    await k(`globalThis.causalis.faceTown(${b.x}, ${b.z}, 11)`);
    await page.waitForTimeout(slow(900));
    await shot("modern-battery");
  }
  const lot = siege?.shells?.[0];
  if (lot) {
    await k(`globalThis.causalis.faceTown(${lot.x}, ${lot.z}, 16)`);
    await page.waitForTimeout(slow(1400));
    await shot("modern-shells");
  }
}
// 3. Swords.
for (const [doing, c] of CASES) {
  const scene = await see(
    warOf(SWORD, SWORD, c),
    `sword-${doing}`,
    doing === "drawn" || doing === "engaged" ? 28 : 34,
    doing === "drawn" || doing === "engaged" ? 0 : doing === "guard" ? 1 : "town",
  );
  if (!scene) {
    check(false, `sword ${doing}: no scene`);
    continue;
  }
  check(!scene.teamGuns?.length && !scene.battery?.length, `sword ${doing}: guns`);
  if (doing === "besieging") check(scene.tents.length > 0, "swords: no tents");
  if (doing === "engaged")
    check(
      scene.soldiers.some((q) => q.size > 0.5 && q.doing === "fight"),
      "swords: no one fights",
    );
}
await k("globalThis.causalis.holdTownWar(null)");
// 4.
check(errors.length === 0, `errors in the page: ${errors.slice(0, 3).join(" | ")}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 72 FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("gate 72 passed");
process.exit(0);
