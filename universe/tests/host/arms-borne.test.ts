import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { hostDesign } from "../../src/host/arms.ts";
import { armsMade, type Made } from "../../src/host/chain.ts";
import { armsRef, oneArm } from "../../src/host/inspect/arm.ts";
import {
  parseTownsfolkRef,
  type ArmBorne,
  type BattleRoll,
  type Block,
  type Line,
  type PageModel,
} from "../../src/bridge/index.ts";
import { warsOf } from "../../src/sim/index.ts";

// Phase 55 M228: each man of a battle's roll bore an arm made by a maker of his own — one of his
// seat's benches, by who held it then — told on his card, on his page ("What he bore", from the
// ground to his hand) and on the arm's own page (`arms:<battle>:<side>:<his page>`). Read from the
// record, never drawn: looking moves nothing.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
const words = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const blocksOf = (p: PageModel): Block[] => p.tabs.flatMap((t) => t.blocks);
const Y = Math.floor(world.now / YEAR),
  number = (event: string) => Number(event.split(":")[2]),
  // (The newest battles of record, each with its roll of 360 figures to a side.)
  recent = [...warsOf(world).all()]
    .flatMap((war) => war.battles.map((b) => ({ war, b })))
    .filter(({ b }) => b.fell && b.year >= Y - 39)
    .sort((p, q) => q.b.year - p.b.year || number(q.b.event) - number(p.b.event))
    .slice(0, 8)
    .map(({ war, b }) => ({
      war,
      b,
      roll: ask<BattleRoll>("battle.roll", { event: b.event, most: 360 }),
    }));

test("one of an arm's kind, said of the man who bore it", () => {
  assert.equal(oneArm("chert-tipped spears"), "a chert-tipped spear");
  assert.equal(oneArm("obsidian-tipped spears"), "an obsidian-tipped spear");
  assert.equal(oneArm("copper axes"), "a copper axe");
  assert.equal(oneArm("iron swords"), "an iron sword");
  assert.equal(oneArm("bows of horn and sinew"), "a bow of horn and sinew");
  assert.equal(oneArm("machine guns"), "a machine gun");
  assert.equal(oneArm("claws"), "claws");
});

test("each man's arm is made at his seat by a maker of his own, the same each time it is asked", () => {
  assert.ok(recent.length >= 4, `${recent.length} recent battles`);
  let makers = 0,
    told = 0;
  for (const { war, b, roll } of recent)
    for (const side of [0, 1] as const) {
      const realm = side === 0 ? war.attacker : war.defender,
        arm = hostDesign(world, realm, { year: b.year, design: b.designs?.[side] })?.parts.find(
          (p) => p.role === "arm",
        );
      if (!arm) continue;
      const host = armsMade(world, realm, arm, b.year);
      if (!host?.maker) continue;
      const men = [...(side === 0 ? roll.attacker : roll.defender).fell].slice(0, 30),
        names = new Set<string>();
      for (const man of men) {
        const made: Made = armsMade(world, realm, arm, b.year, man.ref)!;
        // (The same stuff and the same bench's kind as his host's; his own maker, the same again.)
        assert.equal(made.stuff, host.stuff);
        assert.equal(made.workshop.name, host.workshop.name);
        assert.equal(made.maker!.trade, host.maker.trade);
        assert.deepEqual(armsMade(world, realm, arm, b.year, man.ref), made);
        names.add(made.maker!.name);
        const borne = ask<ArmBorne | null>("arms.borne", { event: b.event, side, who: man.ref })!;
        assert.match(borne.words, /^an? /);
        assert.equal(borne.page, armsRef(b.event, side, man.ref));
        assert.ok(borne.maker!.startsWith(made.maker!.name));
        told++;
      }
      if (names.size > 1) makers++;
    }
  assert.ok(told > 20, `${told} men's arms told`);
  assert.ok(makers > 0, "the men of a host had more than one maker among them");
});

test("a man's arm has its page: his, from the ground to his hand, borne by him in the battle", () => {
  let seen = 0;
  for (const { b, roll } of recent.slice(0, 3))
    for (const side of [0, 1] as const) {
      const man = (side === 0 ? roll.attacker : roll.defender).fell[0];
      if (!man) continue;
      const p = page(armsRef(b.event, side, man.ref));
      assert.equal(p.kind, "thing");
      assert.ok(p.title.startsWith(`${man.name}'s `) && !/'s an? /.test(p.title), p.title);
      const list = blocksOf(p).find(
        (x) => x.type === "list" && x.title === "From the ground to his hand",
      );
      assert.ok(list && list.type === "list" && list.items.length >= 1);
      const text = blocksOf(p).find((x) => x.type === "text");
      assert.ok(text && text.type === "text" && /^Borne by /.test(words(text.lines[0]!)));
      seen++;
    }
  assert.ok(seen >= 2);
  // The host's arm page is as it was: the realm's, carried in the battle.
  const { b } = recent[0]!,
    host = page(`arm:${b.event}:0:0`);
  assert.match(host.title, / in the battle at /);
  assert.ok(
    blocksOf(host).some((x) => x.type === "list" && x.title === "From the ground to the hand"),
  );
});

test("a fallen man's page tells where he fell, and what he bore there from the ground to his hand", () => {
  let holder = 0,
    levy = 0;
  for (const { roll } of recent)
    for (const s of [roll.attacker, roll.defender])
      for (const man of s.fell.slice(0, 6)) {
        const p = page(man.ref),
          facts = blocksOf(p).find((x) => x.type === "facts");
        if (p.ref.startsWith("unknown")) continue;
        assert.ok(
          facts &&
            facts.type === "facts" &&
            facts.rows.some((r) => /^Fell at the battle at /.test(words(r.value))),
          `${man.ref}: where he fell`,
        );
        const bore = blocksOf(p).find((x) => x.type === "list" && x.title === "What he bore");
        assert.ok(
          bore && bore.type === "list" && bore.items.length >= 2,
          `${man.ref}: what he bore`,
        );
        assert.ok(bore.items[0]!.ref?.startsWith("arms:"));
        if (parseTownsfolkRef(man.ref)) holder++;
        else if (man.ref.startsWith("lv:")) levy++;
      }
  assert.ok(holder > 0, "a line holder's page");
  assert.ok(levy > 0, "a levy man's page");
});

test("watch-shadow: reading arms moves nothing", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
