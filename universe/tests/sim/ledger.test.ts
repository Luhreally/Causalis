// The population's ledgers as a save keeps them (Phase 63): a band's deaths side by side, a year's
// people left out where its trades add up to them; read back as they were, from a save of before too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, chunkData, packList } from "../../src/kernel/index.ts";
import { HistoryStore } from "../../src/sim/population/stores.ts";

function filled(): HistoryStore {
  const s = new HistoryStore();
  for (const cell of [3, 9]) {
    for (let year = 0; year < 12; year++) {
      s.addBirths(cell, year, cell * year + 1);
      for (let band = 0; band < 10; band += 3)
        s.addDeaths(cell, year, band, cell + year * band + 1);
      s.addYear(cell, {
        year,
        population: 100 + cell + year,
        // (The first years' trades do not add up to their people: those keep them.)
        byOccupation: year < 2 ? [1, 2] : year < 4 ? [] : [100 + cell, year],
        fed: 1000 - year,
        settlements: 1,
      });
    }
    s.seal(cell);
  }
  return s;
}

const fingerprint = (s: HistoryStore) => {
  const h = new Hasher();
  s.hashInto(h);
  return h.hex();
};

test("a ledger comes back from its save as it was", () => {
  const s = filled(),
    saved = JSON.parse(JSON.stringify(s.save())) as { byBand: boolean },
    back = new HistoryStore();
  assert.equal(saved.byBand, true);
  back.load(saved);
  assert.equal(fingerprint(back), fingerprint(s));
  for (const cell of [3, 9]) {
    assert.deepEqual(back.yearsOf(cell), s.yearsOf(cell));
    for (let year = 0; year < 12; year++) {
      assert.equal(back.birthsIn(cell, year), s.birthsIn(cell, year));
      assert.equal(back.deathsIn(cell, year), s.deathsIn(cell, year));
      for (let band = 0; band < 10; band++)
        assert.equal(back.deathsIn(cell, year, band), s.deathsIn(cell, year, band));
    }
  }
  // Through the packed form a save writes.
  const again = new HistoryStore();
  again.load(
    chunkData({
      schema: 1,
      data: JSON.parse(JSON.stringify(packList([saved]))),
      hash: "",
      packed: true,
    }),
  );
  assert.equal(fingerprint(again), fingerprint(s));
  assert.deepEqual(again.save(), s.save());
});

test("a year's people are left out only where its trades give them", () => {
  const saved = filled().save() as { years: [number, { population?: number; year: number }[]][] },
    lines = saved.years[0]![1];
  assert.equal(lines[0]!.population, 103);
  assert.equal(lines[3]!.population, 106);
  assert.equal(lines[5]!.population, undefined);
});

test("a save of before keeps its deaths a year at a time, and its years whole", () => {
  const s = filled(),
    now = JSON.parse(JSON.stringify(s.save())) as {
      deaths: [number, number[]][];
      byBand?: boolean;
      years: [number, Record<string, unknown>[]][];
    },
    flat = (cell: number, n: number) => {
      const out = new Array<number>(n);
      for (let at = 0; at < n; at++) out[at] = s.deathsIn(cell, Math.floor(at / 10), at % 10);
      return out;
    };
  delete now.byBand;
  now.deaths = now.deaths.map(([cell, d]) => [cell, flat(cell, d.length)]);
  now.years = now.years.map(([cell]) => [cell, s.yearsOf(cell).map((y) => ({ ...y }))]);
  const back = new HistoryStore();
  back.load(now);
  assert.equal(fingerprint(back), fingerprint(s));
  assert.deepEqual(back.yearsOf(3), s.yearsOf(3));
});
