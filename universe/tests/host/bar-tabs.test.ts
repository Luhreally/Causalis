// The people bar's tabs and the god's acts on a town's many (asked 2026-11-16: "pin should be in pinned tab not just people im
// following"; "i can bless anyone. but i cant inspire and like those other options in town view"): pins kept in pin order, a group
// among them as it stands; the follow list whole, the pinned among it; the place's own apart; every act on a page of one of a
// town's many, with Live as them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { orgsOf, politiesOf, populationContext } from "../../src/sim/index.ts";
import { barOf } from "../../src/host/bar.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { orgRef } from "../../src/host/groups.ts";
import { townRoster } from "../../src/host/roster.ts";
import { tabOf } from "../../src/ui/people-bar.ts";
import { universeWorld } from "./worlds.ts";

test("the bar keeps pins in pin order, a group among them as it stands; the follow list whole; the place's own apart", () => {
  const world = universeWorld(EARTH, "first light", 100),
    [a, b] = politiesOf(world).living(),
    realm = politiesOf(world)
      .living()
      .find((r) => (orgsOf(world)?.of(r.ref)?.orgs.length ?? 0) > 0)!,
    g = orgsOf(world)!.of(realm.ref)!.orgs[0]!,
    group = orgRef(realm.ref, g.event),
    groupPage = pageOf(world, group);
  // (A group's page can be pinned.)
  assert.deepEqual(groupPage.pin, { ref: group, name: groupPage.title });
  const pins = [
      { ref: `rule:${b!.ref}`, name: b!.ruler.name },
      { ref: group, name: groupPage.title },
      { ref: `rule:${a!.ref}`, name: a!.ruler.name },
    ],
    read = barOf(world, {
      cell: a!.seat,
      town: null,
      pins,
      followed: [`rule:${a!.ref}`],
    }).people,
    pinned = read.filter((p) => tabOf(p) === "pinned"),
    followed = read.filter((p) => tabOf(p) === "followed"),
    here = read.filter((p) => tabOf(p) === "here");
  assert.deepEqual(
    pinned.map((p) => p.ref),
    [`rule:${b!.ref}`, group, `rule:${a!.ref}`],
    "exactly what was pinned, in pin order",
  );
  const kept = pinned[1]!;
  assert.equal(kept.gone, false, "a group kept stands as it is, not as one gone");
  assert.equal(kept.name, groupPage.title);
  assert.deepEqual(
    followed.map((p) => p.ref),
    [`rule:${a!.ref}`],
    "the one followed is in Followed, though pinned too",
  );
  assert.ok(
    here.every((p) => !pins.some((x) => x.ref === p.ref) && p.ref !== `rule:${a!.ref}`),
    "the place's own leave out those kept and followed",
  );
});

test("the page of one of a town's many hands the card their town, for every act and Live as them in one press", () => {
  const world = universeWorld(EARTH, "first light", 100),
    ctx = populationContext(world),
    town = ctx.provinces
      .all()
      .flatMap((p) => [...ctx.settlements.seenIn(p.cell)])
      .filter((s) => s.population > 40)[0]!,
    roster = townRoster(world, town.ref),
    ref = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((l) => roster.holder(l))
      .find((h) => h && !h.fates.length)!.ref,
    page = pageOf(world, ref),
    tool = page.tabs
      .flatMap((t) => t.blocks)
      .find((b) => b.type === "tool" && b.tool === "acts.god-person");
  assert.ok(tool && tool.type === "tool", "their page carries the god's acts");
  const args = tool.args as { kind: string; touch?: { town: string; name: string } };
  assert.equal(args.kind, "holder");
  assert.equal(args.touch?.town, town.ref, "their town, for the hand laid from them");
});
