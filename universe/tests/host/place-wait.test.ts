// What a town entered waits on (the tap after a fire waited 1.6 to 1.9 s for its inspector): the host's queue was held by
// a god-game page read the first time, a head's (its town's roles, the world's memory, every land's heart, every land's map
// refined to find whether each town's square stands on a bank). A world's spare moments now find each land's banks a land
// at a time (host/sites.ts banksNext), as they read the far peoples, and what they find is what the land's map would say.
import assert from "node:assert/strict";
import { test } from "node:test";
import { WATER } from "../../src/gen/index.ts";
import { populationContext, regionOf } from "../../src/sim/index.ts";
import { banksNext, landWater, townBankOf } from "../../src/host/sites.ts";
import { noTown, placeWorld } from "./worlds.ts";

test("a land's banks found in spare moments are what its map says, a land a call, and the reading ends", (t) => {
  const w = placeWorld(150),
    ctx = populationContext(w);
  // (A people of the water's has no banks to find: its towns stand in the sea.)
  if (ctx.medium === "water") return void noTown(t, "on a bank: its people live in the water");
  const lands = new Set(ctx.settlements.all().map((s) => s.cell)),
    done = new Set<number>();
  // (A land a call: forty of them, then each of those lands' towns read as the map reads it.)
  let calls = 0;
  for (; calls < 40 && banksNext(w); calls++) {
    const s = ctx.settlements.all().find((x) => !done.has(x.cell));
    if (s) done.add(s.cell);
  }
  assert.ok(calls > 0 && calls <= lands.size, `${calls} calls for ${lands.size} lands`);
  let read = 0;
  for (const s of ctx.settlements.all()) {
    if (!done.has(s.cell)) continue;
    const r = regionOf(ctx, s.cell),
      want =
        r.water[s.tile] === WATER.land
          ? null
          : (landWater(r, s.tile % r.size, Math.floor(s.tile / r.size), false).bank ?? null);
    assert.deepEqual(townBankOf(w, s.ref), want, s.ref);
    read++;
  }
  assert.ok(read > 0);
});
