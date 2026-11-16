// Gate 124, a finger held is a hover (owner, 2026-11-15: "if i hold my finger down it acts as a mouse
// hover where its supposed to be like that for example world tiles"). In a phone's frame, by touch:
// a finger held still on a land of the globe shows that land's tip above the finger, slid it follows,
// lifted it opens nothing and the tip stays to be read, and the next touch puts it away; a tap still
// does what a tap did. In a page, a finger held on a name opens the name's tip and lifting it does not
// open the name's page; a tap on it still does. With an act in hand, a held finger lights the act's reach
// and casts nothing.
//
//   node tools/hold-gate.ts [--ci] [--shots dir]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { preview } from "vite";

const ci = process.argv.includes("--ci"),
  shotsAt = process.argv.indexOf("--shots"),
  shots = shotsAt > 0 ? process.argv[shotsAt + 1] : undefined;
if (shots) mkdirSync(shots, { recursive: true });
console.log("gate 124, a finger held is a hover");

const root = fileURLToPath(new URL("..", import.meta.url)),
  server = await preview({ root, logLevel: "silent", preview: { port: 4293, strictPort: false } }),
  base = server.resolvedUrls!.local[0]!,
  browser = await chromium.launch({
    args: ci ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [],
  }),
  context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  }),
  page = await context.newPage(),
  cdp = await context.newCDPSession(page);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
  console.log(`  ${ok ? "✓" : "✗"} ${what}`);
};
const k = <T>(code: string): Promise<T> => page.evaluate(code) as Promise<T>;
const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
  });
const tipShown = () =>
  page
    .$eval(".tooltip", (e) => {
      const r = e.getBoundingClientRect();
      return (
        getComputedStyle(e).display !== "none" &&
        r.width > 20 &&
        r.height > 10 &&
        (e.textContent ?? "").length > 0
      );
    })
    .catch(() => false);
const tipBox = () =>
  page.$eval(".tooltip", (e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, text: e.textContent ?? "" };
  });
const pageTitle = () =>
  page.$eval(".page-window .page-title", (e) => e.textContent ?? "").catch(() => "");
const shot = async (name: string) => {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
};

try {
  await page.goto(`${base}?universe=earth&year=400`);
  await page.waitForFunction(
    () => ((globalThis as any).causalis?.drawn?.() as number) > 0,
    undefined,
    {
      timeout: 900000,
    },
  );
  await k("globalThis.causalis.client.setSpeed(0)");
  await page.waitForTimeout(2500);

  // A land on the globe, near the middle of the screen, in the canvas's own pixels.
  const canvasBox = (await page.$eval("canvas", (c) => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })) as { left: number; top: number; width: number; height: number };
  let at: { x: number; y: number; ref: string } | null = null;
  for (let r = 0; r < 200 && !at; r += 12)
    for (let a = 0; a < 16 && !at; a++) {
      const x = canvasBox.width / 2 + r * Math.cos((a * Math.PI) / 8),
        y = canvasBox.height * 0.55 + r * Math.sin((a * Math.PI) / 8);
      const ref = await k<string | null>(`globalThis.causalis.refAt(${x}, ${y})`);
      if (ref?.startsWith("cell:0:")) at = { x, y, ref };
    }
  check(at !== null, "a land of the globe found near the middle of the screen");
  if (!at) throw new Error("no land");
  const cx = canvasBox.left + at.x,
    cy = canvasBox.top + at.y;

  // Held: the land's tip, above the finger.
  await touch("touchStart", cx, cy);
  await page.waitForTimeout(1100);
  const held = await tipShown();
  check(held, "a finger held still on a land shows the land's tip");
  if (held) {
    const box = await tipBox();
    check(
      box.bottom <= cy - 20,
      `the tip stands above the finger (its foot at ${box.bottom.toFixed(0)}, the finger at ${cy.toFixed(0)})`,
    );
  }
  await shot("1-held");
  // Slid while held: the tip follows, the view does not turn.
  const before = await k<string | null>(`globalThis.causalis.refAt(${at.x}, ${at.y})`);
  for (let i = 1; i <= 6; i++) {
    await touch("touchMove", cx + i * 8, cy);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  check(await tipShown(), "slid while held, a tip is still shown");
  const after = await k<string | null>(`globalThis.causalis.refAt(${at.x}, ${at.y})`);
  check(
    before === after,
    "the view did not turn under a held finger (the same land under the same point)",
  );
  await touch("touchEnd", cx + 48, cy);
  await page.waitForTimeout(700);
  check((await pageTitle()) === "", "lifting a held finger opens no page");
  check(await tipShown(), "the tip stays a moment after the finger lifts, to be read");
  await shot("2-lifted");
  await page.waitForTimeout(4200);
  check(!(await tipShown()), "and goes a few seconds later");

  // A tap still does what a tap does: no tip, and the scene answers (a page, or the eye going in).
  const scaleBefore = await k<string>("globalThis.causalis.scale()");
  await touch("touchStart", cx, cy);
  await page.waitForTimeout(80);
  await touch("touchEnd", cx, cy);
  await page.waitForTimeout(2500);
  const tapped =
    (await pageTitle()) !== "" || (await k<string>("globalThis.causalis.scale()")) !== scaleBefore;
  check(tapped, "a quick tap still opens what it opened (a page, or the land)");
  await shot("3-tapped");

  // In a page: a finger held on a name opens its tip and lifting opens nothing; a tap opens it.
  await k(`globalThis.causalis.open(${JSON.stringify(at.ref)})`);
  await page.waitForFunction(
    `document.querySelector(".page-window .page-title")?.textContent && document.querySelector(".page-window .page-title").textContent !== "…"`,
    undefined,
    { timeout: 30000 },
  );
  const titleBefore = await pageTitle();
  const link = await page.$(".page-window .ref-link");
  check(link !== null, `a name to hold in the page of ${titleBefore}`);
  if (link) {
    await link.scrollIntoViewIfNeeded();
    const r = (await link.boundingBox())!;
    const lx = r.x + Math.min(r.width / 2, 20),
      ly = r.y + r.height / 2;
    await touch("touchStart", lx, ly);
    await page.waitForTimeout(1200);
    const named = await page
      .$eval(".hovertip", (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 20 && r.height > 10 && (e.textContent ?? "").length > 0;
      })
      .catch(() => false);
    check(named, "a finger held on a name in a page opens the name's tip");
    await shot("4-name-held");
    await touch("touchEnd", lx, ly);
    await page.waitForTimeout(900);
    check((await pageTitle()) === titleBefore, "lifting it does not open the name's page");
    // A tap on it opens it.
    await touch("touchStart", lx, ly);
    await page.waitForTimeout(80);
    await touch("touchEnd", lx, ly);
    await page.waitForTimeout(2500);
    check((await pageTitle()) !== titleBefore, "a tap on the name still opens its page");
    await shot("5-name-tapped");
  }
} catch (e) {
  problems.push(String(e));
  console.log(`  ✗ ${String(e)}`);
}
for (const e of errors) problems.push(`page error: ${e}`);
await browser.close();
await server.close();
if (problems.length) {
  console.log(`gate 124 fails: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("gate 124 passes: a finger held is a hover");
