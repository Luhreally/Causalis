import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { battleRoll, encodeLevy } from "../../src/host/roll.ts";
import { LINE, ROSTER_YEARS, townRoster } from "../../src/host/roster.ts";
import { populationContext, warsOf } from "../../src/sim/index.ts";
import { settleAll } from "../../src/causal/index.ts";
import { levyManRef, type Line, type PageModel, type VillagePlan } from "../../src/bridge/index.ts";

// Phase 55 M225: a town's many have pages by their line, and a battle's levy by his ref. A holder who
// fell says where he fell and where he lies; one who lives is as old as the years since he was born;
// a ref that is no one (a number that holds no one, a levy man out of his battle's places) is the
// unknown page. One world: the first light, a hundred and twenty-five years on, and every year read
// from it. Relations only.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
settleAll(world);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  page = (ref: string) => ask<PageModel>("page", { ref });

/** A line's words, as a reader sees them. */
const plain = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

/** A page's words, as a reader sees them: its facts' rows, its lists' items and its text lines. */
function words(p: PageModel): string[] {
  const out: string[] = [];
  for (const t of p.tabs)
    for (const b of t.blocks) {
      if (b.type === "facts") out.push(...b.rows.map((r) => plain(r.value)));
      if (b.type === "list") out.push(...b.items.map((i) => plain(i.line)));
      if (b.type === "text") out.push(...b.lines.map((l) => plain(l)));
    }
  return out;
}

/** The towns that sent the most men to the battles of the roster's years, most first. */
const towns = (() => {
  const sent = new Map<string, number>();
  for (const w of warsOf(world).all())
    for (const b of w.battles) {
      if (!b.fell || b.year < Y - ROSTER_YEARS) continue;
      for (const side of [0, 1] as const)
        for (const place of levyPlaces(world, b, side, Infinity))
          if (place.kind === "town" && place.ref)
            sent.set(place.ref, (sent.get(place.ref) ?? 0) + place.sent);
    }
  return [...sent.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 30)
    .map(([ref]) => ref);
})();

/** A man of a town's roster who fell in a battle its men were levied to. */
const fallen = (() => {
  for (const t of towns) {
    const roster = townRoster(world, t);
    for (const rb of roster.battles)
      for (const m of rb.men) if (m.fate === "fell") return { town: t, roster, holder: m.holder };
  }
  return null;
})();

/** A living holder of a town's line now. */
const living = (() => {
  for (const t of towns) {
    const roster = townRoster(world, t),
      lines = Math.ceil(ctx.settlements.get(t as Ref)!.population / LINE);
    for (let k = 0; k < lines; k++) {
      const holder = roster.holder(k);
      if (holder && holder.died === null) return { town: t, roster, line: k, holder };
    }
  }
  return null;
})();

/** A battle's roll, and its first levy man who fell (the attacker's side first). */
const levy = (() => {
  for (const w of warsOf(world).all())
    for (const b of w.battles) {
      if (!b.fell || b.year < Y - ROSTER_YEARS) continue;
      const roll = battleRoll(world, b.event),
        man =
          roll?.attacker.fell.find((e) => e.ref.startsWith("lv:")) ??
          roll?.defender.fell.find((e) => e.ref.startsWith("lv:"));
      if (roll && man) return { roll, man };
    }
  return null;
})();

/** One of a town's folk as its plan draws them: neither a trade nor the healer. */
const drawn = (() => {
  for (const t of towns) {
    const plan = ask<VillagePlan | null>("village.plan", { ref: t, folk: 480 }),
      folk = plan?.people.find((p) => p.folk && !p.trade && !p.healer);
    if (folk) return { town: t, folk };
  }
  return null;
})();

test("a town's many who fell: his page says where he fell and where he lies, and his town is his way up", () => {
  assert.ok(fallen, "a man of a town's roster fell in a battle its men were levied to");
  const { town, roster, holder } = fallen,
    p = page(holder.ref);
  assert.equal(p.kind, "person", "a person's page");
  assert.equal(p.title, roster.nameOf(holder), "titled by his name");
  const says = words(p);
  assert.ok(
    says.some((s) => s.includes("Fell at the battle at")),
    "his page says where he fell",
  );
  assert.ok(
    says.some((s) => /buried/i.test(s)),
    "his page says where he lies",
  );
  assert.ok(
    p.crumbs?.some((s) => typeof s !== "string" && s.ref === town),
    "his way up names his town",
  );
});

test("a holder who lives: his page's age is this year less the year he was born", () => {
  assert.ok(living, "a town's line holds a living man");
  const { roster, holder } = living,
    p = page(holder.ref),
    age = p.stats.find((s) => s.label === "Age");
  assert.equal(p.title, roster.nameOf(holder), "titled by his name");
  assert.equal(age && plain(age.value), `${Y - holder.born}`, "his age this year");
});

test("a town's line with no number is its holder now; a number that holds no one is the unknown page", () => {
  assert.ok(living, "a town's line holds a living man");
  const { town, roster, line, holder } = living;
  const now = page(`folk:${town}:${line}`);
  assert.equal(now.ref, holder.ref, "the line's holder now");
  assert.equal(now.title, roster.nameOf(holder), "titled by the holder's name");
  assert.equal(page(`folk:${town}:${line}:99999`).kind, "unknown", "a number that holds no one");
  assert.equal(page(`folk:${town}:${line}:0`).kind, "unknown", "no such number");
  const had = Math.max(
    ...roster.battles.map((b) => b.lines),
    ...roster.strikes.map((x) => x.lines),
    0,
  );
  assert.equal(page(`folk:${town}:${had + 100000}`).kind, "unknown", "a line the town never had");
});

test("a battle's roll names its levy: his page is titled by his name, says where he fell, and holds the war", () => {
  assert.ok(levy, "a battle of the roster's years has a levy man among its fallen");
  const { roll, man } = levy,
    p = page(man.ref);
  assert.equal(p.title, man.name, "titled by his name in the roll");
  assert.ok(
    words(p).some((s) => s.includes("Fell at the battle at")),
    "his page says where he fell",
  );
  assert.ok(
    p.crumbs?.some((s) => typeof s !== "string" && s.ref === roll.war),
    "his way up holds the war",
  );
});

test("a levy man out of his battle's places, or a battle of no record, is the unknown page", () => {
  assert.ok(levy, "a battle of the roster's years has a levy man among its fallen");
  assert.equal(
    page(levyManRef(levy.roll.event, 0, encodeLevy(999, 2, 0))).kind,
    "unknown",
    "a place out of range",
  );
  assert.equal(page(levyManRef("ev:0:999999999", 0, 0)).kind, "unknown", "no such battle");
});

test("a village's many as its plan draws them: one who is neither a trade nor the healer has the page of their line", () => {
  assert.ok(drawn, "a town's plan draws one of its many");
  const p = page(drawn.folk.ref);
  assert.equal(p.kind, "person", "a person's page");
  assert.equal(p.title, drawn.folk.name, "titled by the name the plan gives");
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
