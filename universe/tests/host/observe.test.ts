import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR } from "../../src/kernel/index.ts";
import type { HouseholdView, PersonPage } from "../../src/ui/people.ts";
import { rig, type Rig } from "./harness.ts";

type Village = { ref: string; name: string; population: number };

async function firstVillage(r: Rig): Promise<{ cell: number; village: Village }> {
  const map = await r.settle(
    r.client.query<{ cell: number; people: number }[]>({ type: "people.map" }),
  );
  for (const p of [...map].sort((a, b) => b.people - a.people || a.cell - b.cell)) {
    const vs = await r.settle(
      r.client.query<Village[]>({ type: "settlements", args: { cell: p.cell } }),
    );
    if (vs.length) return { cell: p.cell, village: vs[0]! };
  }
  throw new Error("no villages");
}

test("meeting families through the host never changes history, and they are kept in saves", async () => {
  const quiet = rig(),
    busy = rig();
  await quiet.settle(quiet.client.start("earth", "first light"));
  await busy.settle(busy.client.start("earth", "first light"));
  await quiet.settle(quiet.client.advance(240 * YEAR));
  await busy.settle(busy.client.advance(240 * YEAR));
  const { cell, village } = await firstVillage(busy);
  const met: HouseholdView[] = [];
  for (let i = 0; i < 4; i++)
    met.push(
      await busy.settle(
        busy.client.query<HouseholdView>({
          type: "observe.meet",
          args: { cell, village: village.ref },
        }),
      ),
    );
  assert.ok(met.every((h) => h.members.length >= 1 && h.village === village.name));
  const page = await busy.settle(
    busy.client.query<PersonPage>({
      type: "observe.person",
      args: { ref: met[0]!.members[0]!.ref },
    }),
  );
  assert.equal(page.name, met[0]!.members[0]!.name);
  assert.ok(page.bornIn.startsWith("the ") || page.bornBeforeChronicle);
  assert.ok(page.memories.length <= 3);
  if (page.life.some((l) => l.event && l.age >= 3))
    assert.ok(page.memories.length >= 1, "someone who lived through things remembers some of them");
  // Every line of a life that stands for an event can be asked why.
  for (const l of page.life.filter((l) => l.event).slice(0, 4)) {
    const node = await busy.settle(
      busy.client.query<{ claim: string; basis: string }>({
        type: "why",
        args: { ref: l.event, depth: 1 },
      }),
    );
    assert.notEqual(node.basis, "unknown", node.claim);
    assert.doesNotMatch(node.claim, /\(t=\d+\)/, "said in words");
  }

  await busy.settle(busy.client.save("main"));
  const before = await busy.settle(
    busy.client.query<{ households: HouseholdView[]; unmet: number }>({
      type: "observe.households",
      args: { village: village.ref },
    }),
  );
  assert.equal(before.households.length, 4);
  assert.equal(
    before.unmet,
    village.population - met.reduce((n, h) => n + h.members.filter((m) => m.alive).length, 0),
  );

  await quiet.settle(quiet.client.advance(260 * YEAR));
  await busy.settle(busy.client.advance(260 * YEAR));
  assert.deepEqual(
    await busy.settle(busy.client.query({ type: "hashes" })),
    await quiet.settle(quiet.client.query({ type: "hashes" })),
    "looking never changes history",
  );

  await busy.settle(busy.client.load("main"));
  assert.deepEqual(
    await busy.settle(
      busy.client.query({ type: "observe.households", args: { village: village.ref } }),
    ),
    before,
    "the families met are kept in the save",
  );
});
