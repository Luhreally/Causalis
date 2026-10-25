// node tools/phase42-gate.ts [--ci] [--soft] [--shots dir] — the Phase 42 gate (the god's hand in
// a town watched, and the town in trouble, M201; asked for 2026-10-25: "...and just actions of
// stuff"), on the built app, the Earth seed three centuries on, in its greatest town:
//   1. fire sent from the palette on a home of it, touched: its homes catching one after another
//      and burning, the town come running — two throwing water on it, a line passing buckets
//      from its water, others watching; then the flames out, the ruins smouldering;
//   2. a spring set by the square where the hand touches, told in the town's plan where it was set;
//   3. its land shaken: the ground shaking, homes thrown down in dust, the rubble dug.
// (npm run build first; --soft draws in software, as CI's browser does; --shots keeps a
// picture of each step.)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium } from "playwright";

const ci = process.argv.includes("--ci"),
  soft = process.argv.includes("--soft"),
  shots = process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : undefined;
const GPU = [
  "--use-angle=d3d11",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--force_high_performance_gpu",
];
const problems: string[] = [];
const say = (line: string) => console.log(`  ${line}`);
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
/** How long to wait on what the frames bring: longer where they come slowly. */
const slow = (ms: number) => (ci || soft ? ms * 4 : ms);
console.log("the Phase 42 gate");
if (shots) mkdirSync(shots, { recursive: true });

type Person = { name: string; x: number; z: number; task: string | null; why: string | null };
type Blaze = {
  fires: number;
  smoke: number;
  dust: number;
  alight: number;
  shake: number;
  fight: Record<string, number>;
  burning: { x: number; z: number } | null;
  dusty: { x: number; z: number } | null;
};
type Wonder = { kind: string; x: number | null; z: number | null };
type Plan = {
  ref: string;
  name: string;
  town?: { lots: number; struck?: { kind: string; lot: number }[] } | null;
  wonders?: Wonder[];
};

const root = fileURLToPath(new URL("..", import.meta.url)),
  // (CAUSALIS_DIST: a build elsewhere, so that one can be looked at while dist/ is under test.)
  server = await preview({
    root,
    logLevel: "silent",
    preview: { port: 4294, strictPort: false },
    ...(process.env.CAUSALIS_DIST ? { build: { outDir: process.env.CAUSALIS_DIST } } : {}),
  }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: soft ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ci ? [] : GPU,
  });
const errors: string[] = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const until = async (what: string, ok: () => Promise<boolean>, ms = 60000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok().catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  problems.push(`${what} did not come`);
  return false;
};
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};
const people = () => k<Person[]>(`globalThis.causalis.peopleNow?.() ?? []`);
const blaze = () => k<Blaze | null>(`globalThis.causalis.blaze?.() ?? null`);
const now = () => k<number>(`globalThis.causalis.client.status?.t ?? 0`);
const DAY = 86400,
  HOUR = 3600;
/** On to moment t (the clock held): the host's word of it come, and a few frames drawn there. */
const advance = async (t: number) => {
  await k(`globalThis.causalis.client.advance(${Math.round(t)})`);
  await page
    .waitForFunction((at) => ((globalThis as any).causalis.client.status?.t ?? 0) >= at - 1, t, {
      timeout: slow(20000),
    })
    .catch(() => undefined);
  await page.waitForTimeout(slow(500));
};
/** The eye over a point of the town (metres), so far off (the rig's units: ten metres each). */
const face = async (x: number, z: number, distance = 22) => {
  await k(`globalThis.causalis.faceTown(${x}, ${z}, ${distance})`);
  await page.waitForTimeout(slow(1200));
};
const mean = (ps: readonly { x: number; z: number }[]) => ({
  x: ps.reduce((a, p) => a + p.x, 0) / Math.max(1, ps.length),
  z: ps.reduce((a, p) => a + p.z, 0) / Math.max(1, ps.length),
});
const planOf = (ref: string) =>
  k<Plan>(
    `globalThis.causalis.client.query({ type: "village.plan", args: { ref: ${JSON.stringify(ref)} } })`,
  );
/** The middle of the canvas, where the eye looks (faced to a point, that point). */
const middle = { x: 683, y: 400 };

await page.goto(`${base}?universe=earth&seed=${encodeURIComponent("first light")}&year=300`);
await page.waitForFunction(
  () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
  undefined,
  { timeout: 900000 },
);
await k(`globalThis.causalis.setQuality("high")`);
await k(`globalThis.causalis.client.setSpeed(0)`);

// The greatest town drawn lot by lot.
const towns = await k<{ ref: string; name: string; people: number }[]>(
  `globalThis.causalis.client.query({ type: "towns.map" })`,
);
let town: Plan | null = null;
for (const c of towns.slice(0, 10)) {
  const plan = await planOf(c.ref);
  if (plan.town && plan.town.lots >= 60) {
    town = plan;
    break;
  }
}
say(`the town: ${town ? town.name : "none drawn lot by lot"}`);
check(!!town, "no town of the Earth seed is drawn lot by lot by year 300");
if (!town) {
  await browser.close();
  await server.close();
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
await k(`globalThis.causalis.goTo(${JSON.stringify(town.ref)})`);
await until(`${town.name} drawn lot by lot`, async () => (await blaze()) !== null, slow(120000));
await k(`globalThis.causalis.client.setSpeed(0)`);
// A working morning, ten o'clock: its people about (asleep indoors, they are not drawn).
const day = Math.floor((await now()) / DAY) + 1;
await advance(day * DAY + 10 * HOUR);
await until(`${town.name}'s people about`, async () => (await people()).length > 5, slow(30000));

// 1. Fire sent on a home of it, touched.
await face(0, 0, 70);
const home = await k<{ lot: { x: number; y: number; lot: number } | null } | null>(
  `globalThis.causalis.townOnScreen()`,
);
check(!!home?.lot, "no home of the town on the screen to send fire on");
await k(`globalThis.causalis.palette.take("fire")`);
const sent = await now();
if (home?.lot) await page.mouse.click(home.lot.x, home.lot.y);
await until(
  "the fire told in the town's plan",
  async () => !!(await planOf(town!.ref)).town?.struck?.some((s) => s.kind === "fire"),
  slow(30000),
);
const struck = (await planOf(town.ref)).town?.struck?.find((s) => s.kind === "fire");
say(`fire sent on lot ${home?.lot?.lot}: struck at lot ${struck?.lot}`);
check(struck?.lot === home?.lot?.lot, "the fire did not fall on the home touched");
await advance(sent + 40 * 60);
await until("the homes alight drawn", async () => ((await blaze())?.fires ?? 0) > 0, slow(20000));
let b = await blaze();
const f = b?.fight ?? {};
say(
  `forty minutes on: ${b?.alight} homes alight (${b?.fires} drawn), ${b?.smoke} smoking; at it: ${f.douse ?? 0} throwing, ${f.pass ?? 0} passing, ${f.fill ?? 0} filling, ${f.watch ?? 0} watching`,
);
check((b?.alight ?? 0) >= 3, `too few homes alight (${b?.alight})`);
check((b?.fires ?? 0) >= 3, `too few homes drawn alight (${b?.fires})`);
check((f.douse ?? 0) >= 2, "no one throwing water on the fire");
check((f.pass ?? 0) + (f.fill ?? 0) + (f.douse ?? 0) >= 6, "no bucket line at the fire");
check((f.watch ?? 0) >= 2, "no one come to watch the fire");
const throwers = (await people()).filter((p) => p.task === "douse");
if (throwers.length) {
  const m = mean(throwers);
  await face(m.x, m.z, 45);
  await shot("1-fire");
  await face(m.x, m.z, 18);
  await shot("2-brigade");
  if (shots) {
    const line = (await people()).filter((p) => p.task === "pass" || p.task === "fill");
    if (line.length) {
      const l = mean(line);
      await face(l.x, l.z, 9);
      await shot("2b-line");
    }
    if (b?.burning) {
      await face(b.burning.x, b.burning.z, 14);
      await shot("2c-alight");
    }
  }
}
await advance(sent + 6 * HOUR);
b = await blaze();
say(`six hours on: ${b?.alight} alight, ${b?.smoke} smoking`);
check((b?.alight ?? 1) === 0, "the fire still burning six hours on");
check((b?.smoke ?? 0) > 0, "the ruins not smouldering");
if (throwers.length) {
  const m = mean(throwers);
  await face(m.x, m.z, 45);
  await shot("3-after");
}

// 2. A spring set by the square, where the hand touches.
await face(-16, 12, 40);
await k(`globalThis.causalis.palette.take("spring")`);
const touch = await k<{ x: number; y: number } | null>(`globalThis.causalis.townScreen(-16, 12)`);
check(!!touch, "the spot for the spring not on the screen");
await page.mouse.click(touch?.x ?? middle.x, touch?.y ?? middle.y);
await until(
  "the spring told in the town's plan",
  async () => !!(await planOf(town!.ref)).wonders?.some((w) => w.kind === "spring"),
  slow(30000),
);
const spring = (await planOf(town.ref)).wonders?.find((w) => w.kind === "spring");
say(`a spring set: at ${spring?.x}, ${spring?.z}`);
check(
  spring?.x != null && spring.z != null && Math.hypot(spring.x + 16, spring.z - 12) < 8,
  "the spring not set where the hand touched",
);
await page.waitForTimeout(slow(1500));
await shot("4-spring");
// (Drawn there, or a step off it where that is built on.)
const drawn = (
  await k<{ kind: string; x: number; z: number }[]>(`globalThis.causalis.wonders()`)
).find((w) => w.kind === "spring");
say(`drawn at ${drawn?.x.toFixed(1)}, ${drawn?.z.toFixed(1)}`);
check(
  !!drawn && Math.hypot(drawn.x + 16, drawn.z - 12) <= 12.5,
  "the spring not drawn where the hand touched",
);
if (shots && drawn) {
  await face(drawn.x, drawn.z, 3);
  await shot("4b-spring");
}

// 3. Its land shaken.
await k(`globalThis.causalis.palette.take("quake")`);
const shaken = await now();
await page.mouse.click(middle.x, middle.y);
await until(
  "the quake told in the town's plan",
  async () => !!(await planOf(town!.ref)).town?.struck?.some((s) => s.kind === "quake"),
  slow(30000),
);
await k(`globalThis.causalis.palette.putDown()`);
await advance(shaken + 12);
b = await blaze();
say(`the ground shaking: ${b?.shake?.toFixed(2)}`);
check((b?.shake ?? 0) > 0, "the ground not shaking");
if (shots) {
  await advance(shaken + 60);
  const d = (await blaze())?.dusty;
  if (d) {
    await face(d.x, d.z, 24);
    await shot("5a-dust");
  }
}
await advance(shaken + 5 * 60);
b = await blaze();
say(`five minutes on: ${b?.dust} homes in dust, ${b?.alight} alight`);
check((b?.dust ?? 0) > 0, "no dust over homes shaken down");
await shot("5-quake");
await advance(shaken + HOUR);
b = await blaze();
say(`an hour on: ${b?.fight?.dig ?? 0} digging in the rubble`);
check((b?.fight?.dig ?? 0) >= 3, "no one digging in the rubble");
const diggers = (await people()).filter((p) => p.task === "dig" && /rubble/.test(p.why ?? ""));
if (diggers.length) {
  const m = mean(diggers);
  await face(m.x, m.z, 20);
  await shot("6-rubble");
}

await browser.close();
await server.close();
if (errors.length) problems.push(...errors.map((e) => `page error: ${e}`));
if (problems.length) {
  console.log("FAILED:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("the Phase 42 gate passes");
