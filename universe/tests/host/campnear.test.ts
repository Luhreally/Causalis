import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { populationContext } from "../../src/sim/index.ts";
import { bedrockOf } from "../../src/host/inspect/ground.ts";
import {
  BAND_DAY,
  MEADOW_STEP,
  bandHour,
  bandPersonWords,
  bandQuarry,
  newBand,
  newMeadow,
  stepBand,
  stepMeadow,
} from "../../src/view/index.ts";
import type { CampNear, LandPlan, PageModel } from "../../src/bridge/index.ts";

// Phase 29 M160: a camp of a land's bands seen near — one of its bands living its day among the
// land's own beasts, at the world's hour. The Earth seed in its first year.

const world = EARTH.build(seedFromText("first light"));
world.runTo(YEAR / 8 + DAY / 3);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  ctx = populationContext(world),
  cell = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!.cell,
  camps = ask<LandPlan>("towns.land", { cell }).camps;

test("a camp seen near: the land's own beasts, a band of the camp's, the world's hour", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id });
  assert.equal(near.cell, cell);
  assert.deepEqual(near.camp, camps[0]);
  assert.ok(near.size >= 6 && near.size <= 24, `a band of ${near.size}`);
  assert.ok(near.figure, "the people's figure");
  assert.ok(Math.abs(near.hour - ((world.now % DAY) / DAY) * 24) < 1e-9, "the world's hour");
  assert.equal(near.plan.ages.length, 1);
  // (Drawn as the ground the camp stands on is: frosted, lush, sand, or as a quiet age.)
  assert.ok(["icehouse", "hothouse", "dry", "quiet"].includes(near.plan.ages[0]!.kind));
  assert.ok(near.plan.lineages.length >= 3, `${near.plan.lineages.length} lineages`);
  for (const l of near.plan.lineages) {
    assert.ok(l.body, `${l.name} has a body`);
    assert.equal(l.arose, 0);
    assert.equal(l.died, null);
  }
  // (Foragers keep no flock.)
  assert.deepEqual(near.flocks, []);
  assert.deepEqual(
    ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    near,
    "the same asked again",
  );
  assert.equal(ask<CampNear | null>("camp.near", { cell, id: 99 }), null, "no such camp");
});

test("the band lives a day among them, from the world's hour, hunting the land's beasts", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    m = newMeadow(near.plan, 0, near.plan.seed, true),
    names = new Set(near.plan.lineages.map((l) => l.name));
  assert.ok(m.kinds.length >= 2 && m.kinds.every((k) => names.has(k.name)), "the land's own kinds");
  assert.ok(m.shrubs.length > 0 && m.grass.some((g) => g > 0.5), "green and wooded, a land of now");
  const b = newBand(m, near.size, near.people, near.plan.seed, near.hour);
  assert.equal(b.people.length, near.size);
  assert.ok(Math.abs(bandHour(b) - near.hour) < 1e-9, "begun at the world's hour");
  for (let i = 0; i < (2 * BAND_DAY) / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepBand(b, m);
  }
  assert.ok(b.day >= 1, "a day gone");
  assert.ok(b.gathered + b.hunts > 0, "they went out to gather or hunt");
});

test("a herding band's hunters leave its own flock be", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    m = newMeadow(near.plan, 0, near.plan.seed, true),
    k = m.kinds.findIndex((x) => x.feed === "graze" || x.feed === "browse"),
    beast = m.beasts.find((x) => x.kind === k)!;
  assert.ok(beast, "a beast that eats grass or leaf");
  const before = bandQuarry(m, beast);
  m.kinds[k]!.tame = true;
  assert.equal(bandQuarry(m, beast), false, "spared");
  assert.ok(before || m.kinds[k]!.size < 8 || m.kinds[k]!.size > 1200, "wild, it was quarry");
});

test("each of the band named in the land's tongue, and told by what they are at", () => {
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    m = newMeadow(near.plan, 0, near.plan.seed, true),
    b = newBand(m, near.size, near.people, near.plan.seed, near.hour, near.names);
  assert.equal(near.names.length, near.size);
  assert.ok(
    near.names.every((n) => n.length >= 2),
    "a name each",
  );
  assert.ok(new Set(near.names).size >= near.size * 0.7, "their names mostly their own");
  assert.deepEqual(
    b.people.map((p) => p.name),
    near.names,
  );
  // (Another camp's band are other people.)
  if (camps[1])
    assert.notDeepEqual(ask<CampNear>("camp.near", { cell, id: camps[1].id }).names, near.names);
  // Through a day each is told by name, as one of the band, at what they are doing.
  const roles = new Set<string>(),
    doings = new Set<string>();
  for (let i = 0; i < BAND_DAY / MEADOW_STEP; i++) {
    stepMeadow(m);
    stepBand(b, m);
    if (i % 40) continue;
    for (const p of b.people) {
      const line = bandPersonWords(b, m, p.id);
      assert.ok(line.startsWith(`${p.name}, `) && line.endsWith("."), line);
      assert.ok(!/undefined|null|NaN/.test(line), line);
      roles.add(line.split(" — ")[0]!.slice(p.name.length + 2));
      doings.add(p.doing);
    }
  }
  assert.ok(roles.size >= 2, [...roles].join("; "));
  assert.ok(doings.size >= 3, [...doings].join(", "));
  // (Unnamed, one of them still; none such, nothing.)
  const unnamed = newBand(m, 6, near.people, near.plan.seed);
  assert.match(bandPersonWords(unnamed, m, 1), /^One of them, /);
  assert.equal(bandPersonWords(unnamed, m, 999), "");
});

test("a camp's crafts are of its land's ground: the keenest stone its rocks give, its wood and fibre; its page tells them", () => {
  // Phase 49 M211: flint from the chalk, chert from the shale, the glass of old lava, quartzite
  // from the sandstone's cobbles, quartz from the granite's veins — the keenest of them that its
  // land has a twenty-fifth of, or the ground under the camp. (Bands went far for good stone.)
  const STONE: Record<string, string> = {
      limestone: "flint",
      shale: "chert",
      "coal-measures": "chert",
      andesite: "obsidian",
      basalt: "basalt",
      sandstone: "quartzite",
      granite: "quartz",
      gneiss: "quartzite",
    },
    KEENEST = ["obsidian", "flint", "chert", "quartzite", "quartz", "basalt"],
    ID = (name: string) => name.replace(" ", "-");
  const stones = new Set<string>();
  let looked = 0;
  for (const p of [...ctx.provinces.all()].sort((a, b) => b.total() - a.total()).slice(0, 16))
    for (const c of ask<LandPlan>("towns.land", { cell: p.cell }).camps.slice(0, 2)) {
      const near = ask<CampNear>("camp.near", { cell: p.cell, id: c.id }),
        under = ask<{ ground: { rock: string } }>("tile", { center: p.cell, tile: c.tile }).ground
          .rock,
        rocks = [
          ID(under),
          ...bedrockOf(world, p.cell)
            .filter(([, k]) => k >= 0.04)
            .map(([r]) => r),
        ],
        best = rocks
          .map((r) => STONE[r]!)
          .sort((a, b) => KEENEST.indexOf(a) - KEENEST.indexOf(b))[0];
      assert.equal(
        near.craft.stone.name,
        best,
        `a camp on ${under} in a land of ${rocks.join(", ")}`,
      );
      assert.ok(
        near.craft.wood && near.craft.fibre && near.craft.binding,
        JSON.stringify(near.craft),
      );
      assert.ok(["bow drill", "hand drill", "strike-a-light"].includes(near.craft.fire));
      assert.ok(near.craft.stone.keen > 0 && near.craft.stone.keen <= 1);
      stones.add(near.craft.stone.name);
      looked++;
    }
  assert.ok(looked >= 8, `${looked} camps looked at`);
  assert.ok(stones.size >= 2, `one stone everywhere (${[...stones].join(", ")})`);
  // The camp's page: its stone, and its crafts in a line, the stone a link to what it is.
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id }),
    page = ask<PageModel>("page", { ref: `camp:${cell}:${camps[0]!.id}` }),
    facts = page.tabs[0]!.blocks.find((b) => b.type === "facts"),
    text = page.tabs[0]!.blocks.find((b) => b.type === "text");
  assert.ok(
    facts?.type === "facts" &&
      facts.rows.some(
        (r) => r.label === "Their stone" && String(r.value).startsWith(near.craft.stone.name),
      ),
    "its stone",
  );
  const line =
    text?.type === "text"
      ? text.lines.find((l) => typeof l[0] === "string" && l[0].startsWith("They knap"))
      : undefined;
  assert.ok(line, "its crafts told");
  const said = line.map((s) => (typeof s === "string" ? s : s.text)).join("");
  assert.ok(said.includes(`They knap ${near.craft.stone.name} — ${near.craft.stone.from}`), said);
  assert.ok(said.includes(`twist ${near.craft.fibre} into cord`), said);
  if (near.craft.stone.ref)
    assert.ok(line.some((s) => typeof s !== "string" && s.ref === near.craft.stone.ref));
});
