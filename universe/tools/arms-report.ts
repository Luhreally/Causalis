// node tools/arms-report.ts [seed] [years] [every] [--cradle] — the metals and arms the
// simulation holds, reported every `every` years and at the last year, to compare before and
// after a change to them: each peopled land's tool metal and what it knows; the living realms'
// host designs by their best metal, and where that outruns their seats' tools; the tin and iron
// trade of the last year; the battles and war deaths since the last report. Reads are side-effect
// free (a store's get, never of()), so the report never changes history; observer() is left out,
// as in the other reports. What may not exist yet (armsOf, a war.arms store, tin and iron goods,
// a tip or power field on a battle) is looked up when the report runs and printed as n/a while it
// is missing. --cradle starts the chronicle from the cradle (makePopulationWorld's start option),
// not from the spread of bands the app starts from.
import { YEAR, seedFromText, type StateStore, type World } from "../src/kernel/index.ts";
import { EARTHLIKE, G, GOODS, type Part } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
import type { Polity, PopulationContext } from "../src/sim/index.ts";

/** A host's or a land's metal, worst to best. */
const TIERS = ["stone", "copper", "bronze", "iron", "steel"] as const;
type Tier = (typeof TIERS)[number];
/** What a land knows of metal: metalworking (the market's own), then the lore's principles. */
const KNOWN = ["metalworking", "bronze", "iron", "steel"] as const;
/** The ledger line of goods brought in by trade. */
const IN = sim.LEDGER.indexOf("in");

/** Where a metal sits among the tiers (-1: not a stone or a metal). */
const tierOf = (name: string): number => TIERS.indexOf(name as Tier);

/** A host's best stone or metal part, as its tier (-1: none of its parts is stone or metal). */
function hostTier(parts: readonly Part[]): number {
  return parts.reduce((best, p) => Math.max(best, tierOf(p.material)), -1);
}

/**
 * A good's index in the goods table by its id, or null while there is no such good. Tin and iron
 * are looked up this way, so the report runs before and after they become goods (G may lack them).
 */
function goodIndex(id: string): number | null {
  const named = (G as Record<string, number | undefined>)[id];
  if (named !== undefined && GOODS[named]?.id === id) return named;
  const i = GOODS.findIndex((g) => g.id === id);
  return i >= 0 ? i : null;
}

const bump = (m: Map<string, number>, k: string): void => {
  m.set(k, (m.get(k) ?? 0) + 1);
};
const tally = (m: Map<string, number>, order: readonly string[]): string =>
  order.map((k) => `${k} ${m.get(k) ?? 0}`).join(", ");

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b),
    mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** How many distinct roads (pairs of lands) goods went along. */
const roads = (flows: readonly { readonly from: number; readonly to: number }[]): number =>
  new Set(flows.map((f) => (f.from < f.to ? `${f.from}:${f.to}` : `${f.to}:${f.from}`))).size;

const field = (o: object, key: string): unknown => (o as Record<string, unknown>)[key];

/** A value as a share: a number, or an object holding one under share, armed or value. */
function shareOf(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object")
    for (const k of ["share", "armed", "value"]) {
      const x = field(v, k);
      if (typeof x === "number") return x;
    }
  return NaN;
}

/**
 * Each living realm's armed share, if the code has one yet: armsOf(ctx, realm), else the
 * war.arms store's get. Otherwise the reason there are none (a string).
 */
function armsValues(
  world: World,
  ctx: PopulationContext,
  living: readonly Polity[],
): number[] | string {
  const lib = sim as unknown as Record<string, unknown>;
  try {
    if (typeof lib.armsOf === "function") {
      const armsOf = lib.armsOf as (c: PopulationContext, p: Polity) => unknown;
      return living.map((r) => shareOf(armsOf(ctx, r)));
    }
    if (world.hasStore("war.arms")) {
      const store = world.store<StateStore>("war.arms") as unknown as Record<string, unknown>;
      if (typeof store.get !== "function") return "war.arms has no get";
      const get = store.get as (ref: unknown) => unknown;
      return living.map((r) => shareOf(get.call(store, r.ref)));
    }
    return "no armsOf or war.arms store yet";
  } catch (e) {
    return `threw: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function armsLine(world: World, ctx: PopulationContext, living: readonly Polity[]): string {
  const v = armsValues(world, ctx, living);
  if (typeof v === "string") return `n/a (${v})`;
  const xs = v.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return xs.length
    ? `min ${xs[0]!.toFixed(3)}, median ${median(xs).toFixed(3)}, max ${xs.at(-1)!.toFixed(3)} over ${xs.length} realms`
    : "n/a (no numbers)";
}

/** The median |ln(powerA/powerB)| over the battles that record their two sides under `key`. */
function powerGap(battles: readonly object[], key: string): string {
  const gaps = battles.flatMap((b) => {
    const v = field(b, key);
    if (!Array.isArray(v) || v.length !== 2) return [];
    const [a, c] = v as [unknown, unknown];
    return typeof a === "number" && typeof c === "number" && a > 0 && c > 0
      ? [Math.abs(Math.log(a / c))]
      : [];
  });
  return gaps.length ? median(gaps).toFixed(3) : "n/a (no battle records a pair)";
}

function main(): void {
  const argv = process.argv.slice(2),
    cradle = argv.includes("--cradle"),
    [seedText = "first light", yearsArg = "900", everyArg = "300"] = argv.filter(
      (a) => !a.startsWith("--"),
    ),
    years = Number(yearsArg),
    every = Number(everyArg),
    stray = argv.filter((a) => a.startsWith("--") && a !== "--cradle");
  if (stray.length) console.log(`ignored flags: ${stray.join(" ")}`);
  if (!Number.isInteger(years) || years < 1 || !Number.isInteger(every) || every < 1) {
    console.error("usage: node tools/arms-report.ts [seed] [years] [every] [--cradle]");
    process.exitCode = 1;
    return;
  }
  // Every `every` years, and the last year too when it is not one of them.
  const marks: number[] = [];
  for (let y = every; y <= years; y += every) marks.push(y);
  if (marks.at(-1) !== years) marks.push(years);

  const world = sim.makePopulationWorld(seedFromText(seedText), {
      prior: EARTHLIKE,
      start: cradle ? "cradle" : "spread",
    }),
    ctx = sim.populationContext(world),
    markets = sim.marketsOf(world),
    realms = sim.politiesOf(world),
    designs = sim.designsOf(world),
    wars = sim.warsOf(world),
    TIN = goodIndex("tin"),
    IRON = goodIndex("iron");
  console.log(
    `arms-report "${seedText}": ${cradle ? "cradle" : "spread"} start, earthlike prior; reports at ${marks.join(", ")}`,
  );

  const reportYear = (from: number, to: number, ms: number): void => {
    const span = to - from,
      lands = ctx.provinces.all(),
      peopled = lands.filter((p) => p.total() > 0),
      people = peopled.reduce((s, p) => s + p.total(), 0);
    console.log(
      `\n— year ${to}: ${people} people in ${peopled.length} peopled lands · ${ms.toFixed(0)} ms for ${span} years, ${(ms / span).toFixed(1)} ms/year —`,
    );

    // The metal each land's tools are headed with, what it knows, and bronze tools with tin bought in.
    const tools = new Map<string, number>(),
      known = new Map<string, number>();
    let bronze = 0,
      bronzeTin = 0;
    for (const p of peopled) {
      const tool = sim.toolMetal(ctx, p.cell);
      bump(tools, tool);
      for (const k of KNOWN) if (sim.knows(ctx, p.cell, k)) bump(known, k);
      if (tool === "bronze") {
        bronze++;
        if (TIN !== null && (markets.get(p.cell)?.years.at(-1)?.ledger[IN]?.[TIN] ?? 0) > 0)
          bronzeTin++;
      }
    }
    console.log(`  tools: ${tally(tools, [...new Set([...TIERS, ...tools.keys()])])}`);
    console.log(`  knows: ${tally(known, KNOWN)}`);
    console.log(
      `  bronze tools ${bronze}; of them with tin bought in the last year: ${TIN === null ? "n/a (no tin good)" : bronzeTin}`,
    );

    // The last closed year's trade in tin and iron, and the most roads a metal crossed.
    const flows = markets.flows,
      recorded = markets.allRoutes().length > 0,
      trade: string[] = [];
    let most: number | null = null;
    for (const [name, good] of [
      ["tin", TIN],
      ["iron", IRON],
    ] as const) {
      if (good === null) {
        trade.push(`${name} n/a (no ${name} good)`);
        continue;
      }
      const fs = flows.filter((f) => f.good === good);
      trade.push(`${name} ${fs.length} flows`);
      if (recorded) most = Math.max(most ?? 0, roads(fs));
    }
    console.log(
      `  trade: ${trade.join(", ")}; most roads a metal crossed: ${recorded ? (most ?? "n/a") : "n/a (no routes recorded)"}`,
    );

    // The living realms' host designs by their best metal, and where it outruns their seats' tools.
    const living = realms.living(),
      tiers = new Map<string, number>(),
      mismatch: { name: string; seat: number; tool: string; host: string }[] = [];
    let noDesign = 0,
      noMetal = 0;
    for (const r of living) {
      const d = designs.of(r.ref);
      if (!d) {
        noDesign++;
        continue;
      }
      const host = hostTier(d.parts);
      if (host < 0) {
        noMetal++;
        continue;
      }
      bump(tiers, TIERS[host]!);
      const tool = sim.toolMetal(ctx, r.seat);
      if (host > tierOf(tool))
        mismatch.push({ name: sim.realmName(r), seat: r.seat, tool, host: TIERS[host]! });
    }
    console.log(
      `  host tiers, ${living.length} living realm${living.length === 1 ? "" : "s"}: ${tally(tiers, TIERS)}; no stone or metal part ${noMetal}; no design yet ${noDesign}`,
    );
    mismatch.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    console.log(`  mismatches (host metal above its seat's tools): ${mismatch.length}`);
    for (const m of mismatch.slice(0, 5))
      console.log(`    ${m.name}: seat cell ${m.seat}, tools ${m.tool}, host ${m.host}`);
    console.log(`  arms share: ${armsLine(world, ctx, living)}`);

    // The battles fought since the last report, and the war deaths in them.
    const battles = wars.all().flatMap((w) => w.battles),
      fought = battles.filter((b) => b.year > from && b.year <= to),
      seen = (key: string) => battles.some((b) => key in b),
      tipped = !seen("tip")
        ? "n/a (no tip field on a battle)"
        : fought.length
          ? `${((100 * fought.filter((b) => field(b, "tip")).length) / fought.length).toFixed(0)}%`
          : "no battles";
    const powerKey = ["armed", "power"].find(seen),
      gap =
        powerKey === undefined
          ? "n/a (no armed or power field on a battle)"
          : powerGap(fought, powerKey);
    const fallen = fought.reduce((s, b) => s + b.fallen[0] + b.fallen[1], 0),
      decades = span / 10;
    console.log(
      `  battles since the last report ${fought.length}; tipped ${tipped}; median |ln(powerA/powerB)| ${gap}`,
    );
    console.log(
      `  war deaths ${fallen} in ${decades} decades: ${(fallen / decades).toFixed(1)} per decade`,
    );
  };

  let from = 0;
  for (const to of marks) {
    const t0 = performance.now();
    world.runTo(to * YEAR);
    const ms = performance.now() - t0;
    reportYear(from, to, ms);
    from = to;
  }
}

main();
