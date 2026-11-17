// What each realm loves and what crosses its borders unseen, on its pages, the Ledger's Tastes and Intoxicants tabs, and an
// alliance's members compared (host/inspect/tastes.ts, ledger-tastes.ts, bloc-compare.ts). First Light a century on; rows written
// by hand are put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Block, Line } from "../../src/bridge/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { alliancesOf } from "../../src/host/inspect/ties.ts";
import { ledgerCtx } from "../../src/host/inspect/ledger-kit.ts";
import { intoxLedger, tastesLedger } from "../../src/host/inspect/ledger-tastes.ts";
import {
  TASTES,
  entailStats,
  lovedOf,
  mostTaken,
  tastesRead,
} from "../../src/host/inspect/tastes.ts";
import { carriedIn, carryBlocks, worldCarryBlocks } from "../../src/host/inspect/carriers.ts";
import { BLOC_SECTIONS } from "../../src/host/inspect/bloc-compare.ts";
import { CONTRA, CONTRA_STORE, moneyStore, politiesOf, underworldOf } from "../../src/sim/index.ts";
import { CONTRA_CAUSES, G, INTOX_KINDS, INTOX_WORDS, WARE_ARMS } from "../../src/rules/index.ts";
import { universeWorld } from "./worlds.ts";

const world = universeWorld(EARTH, "first light", 100);

const words = (l: Line): string => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const texts = (blocks: readonly Block[]) =>
  blocks
    .flatMap((b) =>
      b.type === "text"
        ? b.lines.map(words)
        : b.type === "facts"
          ? b.rows.flatMap((r) => [
              r.label,
              words(r.value),
              ...(r.parts ?? []).map((p) => words(p.label)),
            ])
          : b.type === "table"
            ? [b.title ?? "", ...b.rows.flatMap((r) => r.cells.map(words))]
            : [],
    )
    .join("\n");

test("the Ledger's Tastes tab: each realm's loves against the world's middle, and a row for every thing", () => {
  const blocks = tastesLedger(world, ledgerCtx(world)),
    realms = blocks.find((b) => b.type === "table" && b.title?.startsWith("What each realm"));
  assert.ok(realms && realms.type === "table" && realms.rows.length > 0);
  const things = blocks.find((b) => b.type === "table" && b.title?.startsWith("Each thing"));
  assert.ok(things && things.type === "table");
  assert.equal(things.rows.length, TASTES.length);
  // A realm said to love a thing takes it at least a quarter beyond the world's middle.
  const t = tastesRead(world);
  for (const p of politiesOf(world).living().slice(0, 30))
    for (const l of lovedOf(world, p.ref)) {
      assert.ok(l.ratio >= 1.25);
      assert.ok(Math.abs(l.v / t.middle[l.taste]! - l.ratio) < 1e-9);
    }
});

test("the Ledger's Intoxicants tab: one block for each kind, its world's line, absent said honestly", () => {
  const blocks = intoxLedger(world, ledgerCtx(world));
  for (const k of INTOX_KINDS) {
    const name = INTOX_WORDS[k].name,
      head = blocks.find((b) => b.type === "text" && b.title?.toLowerCase() === name);
    assert.ok(head && head.type === "text", `a block for ${name}`);
    assert.ok(words(head.lines[0]!).length > 20);
  }
  assert.ok(
    pageOf(world, "world:ledger#intox").tabs.find((x) => x.id === "intox")!.blocks.length > 0,
  );
});

test("a realm's Treasury tells what crosses its borders unseen, and why, and what its people's loves come to", () => {
  const p = politiesOf(world).living()[0]!,
    store = moneyStore(world, CONTRA_STORE)!,
    was = store.get(p.ref),
    row = new Array<number>(CONTRA.told + 1).fill(0);
  // Tin under its tariff, arms barred to its people.
  row.splice(0, 5, G.tin + 1, 450, CONTRA_CAUSES.indexOf("tariff") + 1, 320, 180);
  row.splice(5, 5, WARE_ARMS + 1, 600, CONTRA_CAUSES.indexOf("harm") + 1, 90, 500);
  try {
    store.set(p.ref, row);
    const tab = pageOf(world, `${p.ref}#treasury`).tabs.find((x) => x.id === "treasury")!,
      said = texts(tab.blocks);
    assert.match(said, /What crosses its borders unseen/);
    assert.match(said, /Tin/);
    assert.match(said, /its tariff on goods from abroad/i);
    assert.match(said, /bars arms to its people/i);
    // Every line of what its loves entail names a measure and its amount.
    for (const s of entailStats(world, p)) assert.ok(words(s.value).length > 0);
  } finally {
    if (was) store.set(p.ref, was);
    else store.drop(p.ref);
  }
});

test("an alliance compares its members on every system, in sections, each read only while open, of its members alone", () => {
  const a = [...alliancesOf(world)].sort((x, y) => y.members.length - x.members.length)[0];
  if (!a) return;
  const page = pageOf(world, `bloc:${a.head}`),
    ids = BLOC_SECTIONS.flatMap(([, tabs]) => tabs.map(([id]) => id));
  for (const id of ids) {
    const t = page.tabs.find((x) => x.id === id);
    assert.ok(t && t.later && !t.blocks.length && t.group, `${id}, later and sectioned`);
  }
  assert.ok(page.tabs.filter((t) => t.group === "Alliance").length >= 5);
  const members = new Set<string>(a.members.map((m) => m as string)),
    open = pageOf(world, `bloc:${a.head}#treasury`).tabs.find((x) => x.id === "treasury")!;
  assert.ok(open.blocks.length > 1);
  for (const b of open.blocks)
    if (b.type === "table")
      for (const r of b.rows) if (r.ref) assert.ok(members.has(r.ref.split("#")[0]!), r.ref);
});

test("who carries what: each ware's carriers share no more than its underworld captures, the greatest first, each linked to its group", () => {
  const under = underworldOf(world);
  for (const r of politiesOf(world).living()) {
    const captured = (under?.of(r.ref)?.captured ?? 0) / 1000;
    for (const c of carriedIn(world, r)) {
      const sum = c.carriers.reduce((s, x) => s + x.share, 0);
      assert.ok(
        (sum <= captured + 1e-9 && Math.abs(sum + c.loose - 1) < 1e-9) || !c.carriers.length,
      );
      for (let i = 1; i < c.carriers.length; i++)
        assert.ok(c.carriers[i - 1]!.share >= c.carriers[i]!.share);
    }
    for (const b of carryBlocks(world, r))
      if (b.type === "table") for (const row of b.rows) if (row.ref) assert.match(row.ref, /^mob:/);
  }
  assert.ok(worldCarryBlocks(world, politiesOf(world).living()).length <= 1);
});

test("a realm's most taken kinds and goods each say how its law stands on them and what they come to", () => {
  let said = 0;
  for (const r of politiesOf(world).living().slice(0, 40))
    for (const x of mostTaken(world, r.ref)) {
      assert.match(x.law, /^(legal|frowned on|forbidden|taxed|free|held under|shut from)/);
      assert.ok(x.means.length > 5);
      said++;
    }
  assert.ok(said > 0, "some realm takes something");
});
