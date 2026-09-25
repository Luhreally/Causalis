import { test } from "node:test";
import assert from "node:assert/strict";
import { lintBoundaries, lintDeterminism } from "../tools/lint-rules.ts";

const rules = (file: string, text: string) => lintDeterminism(file, text).map((v) => v.rule);
const bounds = (file: string, text: string) => lintBoundaries(file, text).map((v) => v.rule);

test("determinism: engine-dependent Math is caught, exact Math is not", () => {
  assert.deepEqual(rules("src/sim/a.ts", "export const a = Math.sin(1);"), ["math"]);
  assert.deepEqual(rules("src/sim/a.ts", "export const a = Math.random();"), ["math"]);
  assert.deepEqual(rules("src/sim/a.ts", 'export const a = Math["pow"](2, 3);'), ["math"]);
  assert.deepEqual(
    rules("src/sim/a.ts", "export const a = Math.sqrt(2) + Math.floor(1.5) + Math.imul(3, 4);"),
    [],
  );
});

test("determinism: ** is allowed only for literal integer powers", () => {
  assert.deepEqual(rules("src/sim/a.ts", "export const a = 2 ** 32;"), []);
  assert.deepEqual(rules("src/sim/a.ts", "export const f = (x: number) => x ** 2;"), ["math"]);
  assert.deepEqual(rules("src/sim/a.ts", "let x = 2; x **= 3;"), ["math"]);
});

test("determinism: clocks, platform and weak collections are caught", () => {
  assert.deepEqual(rules("src/kernel/a.ts", "export const t = Date.now();"), ["global"]);
  assert.deepEqual(rules("src/kernel/a.ts", "export const t = performance.now();"), ["global"]);
  assert.deepEqual(rules("src/kernel/a.ts", "export const m = new WeakMap();"), ["global"]);
  assert.deepEqual(rules("src/kernel/a.ts", "export const w = { Date };"), ["global"]);
});

test("determinism: names that merely look like globals are not caught", () => {
  assert.deepEqual(rules("src/kernel/a.ts", "export const o = { Date: 1, self: 2 }; o.Date;"), []);
  assert.deepEqual(
    rules("src/kernel/a.ts", "export let m: WeakMap<object, number> | null = null;"),
    [],
  );
  assert.deepEqual(rules("src/kernel/a.ts", "export type T = typeof performance;"), []);
  assert.deepEqual(rules("src/kernel/a.ts", "export class C { self = 1; window() {} }"), []);
});

test("determinism: sort needs a comparator and locale is caught", () => {
  assert.deepEqual(rules("src/sim/a.ts", "export const s = [3, 1].sort();"), ["sort"]);
  assert.deepEqual(rules("src/sim/a.ts", "export const s = [3, 1].sort((a, b) => a - b);"), []);
  assert.deepEqual(rules("src/sim/a.ts", 'export const c = "a".localeCompare("b");'), ["locale"]);
});

test("boundaries: allowed imports go through index.ts", () => {
  assert.deepEqual(
    bounds("src/sim/pop/cells.ts", 'import { a } from "../../kernel/index.ts";'),
    [],
  );
  assert.deepEqual(bounds("src/sim/pop/cells.ts", 'import { a } from "./ledger.ts";'), []);
  assert.deepEqual(bounds("src/sim/pop/cells.ts", 'import { a } from "../econ/market.ts";'), []);
  assert.deepEqual(bounds("src/sim/a.ts", 'import { a } from "../kernel/rng.ts";'), ["index"]);
});

test("boundaries: forbidden directions, packages and platforms are caught", () => {
  assert.deepEqual(bounds("src/sim/a.ts", 'import { a } from "../render/index.ts";'), ["boundary"]);
  assert.deepEqual(bounds("src/kernel/a.ts", 'import { a } from "../sim/index.ts";'), ["boundary"]);
  assert.deepEqual(bounds("src/ui/a.ts", 'import type { A } from "../sim/index.ts";'), [
    "boundary",
  ]);
  assert.deepEqual(bounds("src/sim/a.ts", 'import * as pc from "playcanvas";'), ["package"]);
  assert.deepEqual(bounds("src/render/a.ts", 'import * as pc from "playcanvas";'), []);
  assert.deepEqual(bounds("src/kernel/a.ts", 'import { readFileSync } from "node:fs";'), [
    "platform",
  ]);
  assert.deepEqual(bounds("src/kernel/a.ts", 'import { a } from "./b";'), ["extension"]);
  assert.deepEqual(bounds("src/kernel/a.ts", 'import { a } from "../../tools/x.ts";'), ["outside"]);
});
