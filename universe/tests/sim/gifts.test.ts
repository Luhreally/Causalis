// The god's gifts in a body held (rules/gifts.ts; asked for 2026-11-21): a sprint from the body, and each gift that changes
// the world going through the command log — a blow that does no harm, one felled at a touch, one healed, a bolt called
// down at a place, flight — told by the hand, a wonder seen that a people may found a faith on, replayed bit for bit from
// a save. One town, a smith and the folk about him.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type World,
} from "../../src/kernel/index.ts";
import {
  POSSESS_EVENTS,
  agentById,
  handOf,
  makePopulationWorld,
  omenOf,
  populationContext,
  type Agent,
  type TakeArgs,
} from "../../src/sim/index.ts";
import {
  FLIGHT,
  GAIT,
  GIFT_ACT,
  GIFT_BIT,
  HAND_ACT,
  HAND_MARK,
  POSSESS_HZ,
  ageShare,
  bidLetters,
  gaitStep,
  handOffers,
  sprintTop,
  wonderStrength,
  type Gift,
  type HandBid,
} from "../../src/rules/index.ts";
import { cradleCell } from "../cradle.ts";

const seed = seedFromText("first light"),
  HOME = cradleCell("first light"),
  build = () => makePopulationWorld(seed);

function laid(year = 245): { world: World; smith: Agent; folk: Agent[] } {
  const world = build();
  world.runTo(year * YEAR);
  const v = populationContext(world).settlements.inProvince(HOME)[0]!;
  world.submit("hand.lay", { village: v.ref });
  world.runTo(year * YEAR + 1);
  const w = handOf(world).resting!,
    grown = (a: Agent) => year - a.birthYear >= 20 && year - a.birthYear < 45,
    smith = w.agents.find((a) => grown(a) && a.occupation === 4) ?? w.agents.find(grown)!,
    folk = w.agents.filter((a) => a !== smith && grown(a)).slice(0, 6);
  return { world, smith, folk };
}

function take(smith: Agent, folk: readonly Agent[]): TakeArgs {
  return {
    agent: smith.id,
    at: { x: 0, z: 0, yaw: 0, task: -1, pace: 1.25 },
    trade: "smith",
    form: "sickle",
    near: folk.map((a, i) => ({
      id: a.id,
      x: i < 2 ? 0.4 + i : -12 + i,
      z: i < 2 ? 1.6 : 6 - 2 * i,
      yaw: Math.PI,
      task: -1,
      pace: 1.25,
      ways: [0, i < 2 ? 0.4 + i : -12 + i, i < 2 ? 1.6 : 6 - 2 * i, Math.PI, -1],
    })),
    solids: [0, 14, 0, 1, 0, 3, 2],
    places: [{ kind: "forge", x: 0, z: 9, yaw: 0 }],
    roofs: 8,
  };
}

const go = (mx: number, mz: number, act = 0, run = false, rise = false): HandBid => ({
  mx,
  mz,
  run,
  act,
  ...(rise ? { rise } : {}),
});
const steps = (n: number, b: HandBid) => Array.from({ length: n }, () => b);
const mask = (...g: Gift[]) => g.reduce((m, x) => m | GIFT_BIT[x], 0);
/** Bids a second at a time with the gifts given, as the page sends them (strokes: in the first second, at its steps). */
function send(
  world: World,
  bids: HandBid[],
  gifts = 0,
  smites?: { when: number; kind: number; x: number; z: number }[],
): void {
  for (let i = 0; i < bids.length; i += POSSESS_HZ) {
    const second = bids.slice(i, i + POSSESS_HZ);
    while (second.length < POSSESS_HZ) second.push(go(0, 0));
    const p = handOf(world).resting!.possessed;
    if (!p) return;
    const c = world.submit("possess.input", {
      step: p.local.step,
      steps: second.map(bidLetters).join(""),
      ...(gifts ? { gifts } : {}),
      ...(smites && i === 0 ? { smites } : {}),
    });
    world.runTo(c.t);
  }
}
function release(world: World): void {
  const p = handOf(world).resting!.possessed;
  if (!p) return;
  world.runTo(world.submit("possess.release", { step: p.local.step, steps: "" }).t);
}
const local = (world: World) => handOf(world).resting!.possessed!.local;
const typesOf = (world: World) => world.events.all().map((e) => e.type);

test("a sprint is the body's: a young man's the fastest, an old one's slower, a wounded or laden one's slower, an alien's by its kind", () => {
  const young = sprintTop({ age: 24, adulthood: 16, kind: 1 }),
    old = sprintTop({ age: 70, adulthood: 16, kind: 1 }),
    lame = sprintTop({ age: 24, adulthood: 16, kind: 1, lame: 1 }),
    shell = sprintTop({ age: 24, adulthood: 16, kind: 0.75 / 1.25 }),
    child = sprintTop({ age: 6, adulthood: 16, kind: 1 });
  assert.equal(young, GAIT.prime);
  assert.ok(old < young * 0.6 && old > young * 0.4, `old ${old}`);
  assert.ok(lame < young * 0.5);
  assert.ok(shell < young * 0.7);
  assert.ok(child < young * 0.8 && child > young * 0.5);
  // Breath: a sprint spends it in about GAIT.breath seconds, slowing to a jog; a walk gives it back.
  let g = { wind: 1, y: 0 },
    first = 0,
    last = 0;
  const o = {
    dt: 1 / POSSESS_HZ,
    walk: 1.6,
    top: young,
    health: 1,
    load: 1,
    sprint: true,
    moving: true,
    age: 1,
    swift: false,
    wings: false,
    rise: false,
  };
  for (let k = 0; k < GAIT.breath * POSSESS_HZ; k++) {
    const r = gaitStep(g, o);
    if (!k) first = r.pace;
    last = r.pace;
    g = r.gait;
  }
  assert.ok(g.wind < 0.01, `spent: ${g.wind}`);
  assert.ok(
    Math.abs(first - young) < 0.05 && Math.abs(last - young * GAIT.spent) < 0.05,
    `${first} ${last}`,
  );
  for (let k = 0; k < 10 * POSSESS_HZ; k++) g = gaitStep(g, { ...o, sprint: false }).gait;
  assert.ok(g.wind > 0.3 && g.wind < 0.4, `a walk gives it back: ${g.wind}`);
  // Hurt and laden, the slower; old, out of breath the sooner; Swift, never, and faster than the body.
  assert.ok(gaitStep({ wind: 1, y: 0 }, { ...o, health: 0.3 }).pace < young * 0.7);
  assert.ok(gaitStep({ wind: 1, y: 0 }, { ...o, load: 0.72 }).pace < young * 0.75);
  assert.ok(
    gaitStep({ wind: 1, y: 0 }, { ...o, age: ageShare(70, 16) }).gait.wind <
      gaitStep({ wind: 1, y: 0 }, o).gait.wind,
  );
  const swift = gaitStep({ wind: 0.2, y: 0 }, { ...o, swift: true });
  assert.ok(swift.pace > young * 1.5 && swift.gait.wind === 1);
});

test("held at a sprint he runs his body's top and tires; a walk is as it was", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const top = handOf(world).resting!.possessed!.scene.top!;
  assert.ok(top > 3 && top <= GAIT.prime * 1.05, `his top ${top}`);
  const x0 = local(world).bodies[0]!.z;
  send(world, steps(2 * POSSESS_HZ, go(0, -31, 0, true)));
  const ran = (x0 - local(world).bodies[0]!.z) / 2;
  assert.ok(ran > 4, `a sprint ${ran.toFixed(2)} m/s (the old run was 3.4)`);
  assert.ok(local(world).gait!.wind < 1, "breath spent");
  send(world, steps(4 * POSSESS_HZ, go(0, 0)));
  assert.ok((local(world).gait?.wind ?? 1) > 0.4, "got back standing");
});

test("unbreakable: the blows land and do no harm; strength: one that lands fells at once", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const gifts = mask("unbreakable", "strength"),
    start = local(world).bodies[0]!.strength;
  // Blows at whoever stands before him, a second at a time, turning to those who come at him.
  for (let k = 0; k < 20 && handOf(world).resting!.possessed; k++) {
    const l = local(world),
      a = l.bodies[0]!,
      b = l.bodies
        .filter((x) => x !== a && x.doing !== "down" && x.doing !== "dead")
        .sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
    if (!b) break;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 1,
      m = (v: number) => (v / d) * 31;
    send(
      world,
      [go(m(dx), m(dz), d < 1.4 ? HAND_ACT.strike : 0), ...steps(19, go(m(dx), m(dz)))],
      gifts,
    );
  }
  const l = local(world),
    felled = l.deeds.filter((d) => d.kind === "struck" && d.gift === "strength");
  assert.ok(felled.length >= 1, "felled at a touch");
  assert.equal(l.bodies[0]!.strength, start, "no blow took anything from him");
  assert.equal(l.ended, "");
  release(world);
  const types = typesOf(world);
  assert.ok(types.includes(POSSESS_EVENTS.struck.type));
  const e = world.events.all().find((x) => x.type === POSSESS_EVENTS.struck.type)!;
  assert.equal((e.data as { gift?: string }).gift, "strength");
});

test("a healing touch raises one struck down whole: no wound written back, told, and a sign of healing", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const victim = folk[0]!;
  let healed = false;
  for (let k = 0; k < 30 && handOf(world).resting!.possessed && !healed; k++) {
    const l = local(world),
      a = l.bodies[0]!,
      b = l.bodies.find((x) => x.id === victim.id)!,
      dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 1,
      m = (v: number) => (v / d) * 31,
      down = b.doing === "down" || b.doing === "dead";
    if (b.doing === "dead") break;
    send(
      world,
      [
        go(down || d > 1.2 ? m(dx) : 0, down || d > 1.2 ? m(dz) : 0, 0),
        ...steps(9, go(d > 1.2 ? m(dx) : 0, d > 1.2 ? m(dz) : 0)),
        go(0, 0, down && d < 3 ? GIFT_ACT.heal : d < 1.4 ? HAND_ACT.strike : 0),
        ...steps(9, go(0, 0)),
      ],
      mask("strength", "healing", "unbreakable"),
    );
    healed = local(world).deeds.some((x) => x.kind === "healed" && x.agent === victim.id);
  }
  const l = local(world),
    h = l.deeds.find((x) => x.kind === "healed" && x.agent === victim.id);
  assert.ok(h, `healed: ${JSON.stringify(l.deeds.map((d) => d.kind))}`);
  assert.ok(h.kind === "healed" && h.was === "down");
  assert.notEqual(l.bodies.find((b) => b.id === victim.id)!.doing, "down");
  // The healing touch is offered while the gift is on.
  assert.equal(handOffers(handOf(world).resting!.possessed!.scene, l)[4]?.act, GIFT_ACT.heal);
  release(world);
  const after = agentById(handOf(world).resting!, victim.id)!;
  assert.equal(after.struck, undefined, "the blow healed with them");
  assert.ok(typesOf(world).includes(POSSESS_EVENTS.healed.type));
  const wonder = world.events
    .all()
    .find(
      (e) =>
        e.type === POSSESS_EVENTS.wonder.type && (e.data as { tenet: string }).tenet === "healing",
    );
  assert.ok(wonder, "a wonder of healing, seen");
  const omen = omenOf(wonder.type, wonder.data)!;
  assert.equal(omen.tenet, "healing");
  assert.equal(omen.strength, wonderStrength((wonder.data as { seen: number }).seen));
});

test("a bolt called down at a place strikes down those it falls among, never him; flight lifts him out of reach", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const b = local(world).bodies.find((x) => x.id === folk[1]!.id)!;
  send(world, steps(POSSESS_HZ, go(0, 0)), mask("smite"), [{ when: 2, kind: 0, x: b.x, z: b.z }]);
  const l = local(world),
    smote = l.deeds.find((d) => d.kind === "smote");
  assert.ok(smote && smote.kind === "smote" && smote.struck >= 1 && smote.seen >= 1);
  assert.ok(l.deeds.some((d) => d.kind === "struck" && d.gift === "lightning"));
  assert.equal(l.bodies[0]!.doing, "hand", "not on him");
  // Without the gift held, a stroke sent does nothing.
  const n = l.deeds.length;
  send(world, steps(POSSESS_HZ, go(0, 0)), 0, [{ when: 0, kind: 0, x: 0, z: 0 }]);
  assert.equal(local(world).deeds.length, n);
  // Wings: rising, out of reach; nothing done by hand up there; set down safe.
  send(world, steps(2 * POSSESS_HZ, go(0, 0, 0, false, true)), mask("wings"));
  assert.ok(local(world).gait!.y > FLIGHT.clear);
  assert.ok(local(world).deeds.some((d) => d.kind === "flew"));
  const p = handOf(world).resting!.possessed!;
  assert.ok(handOffers(p.scene, p.local).every((o) => o.why === "aloft"));
  send(world, steps(4 * POSSESS_HZ, go(0, 0)), mask("wings"));
  assert.equal(local(world).gait?.y ?? 0, 0, "landed");
  assert.equal(local(world).ended, "");
  release(world);
  const types = typesOf(world);
  assert.ok(types.includes(POSSESS_EVENTS.smote.type));
  const tenets = world.events
    .all()
    .filter((e) => e.type === POSSESS_EVENTS.wonder.type)
    .map((e) => (e.data as { tenet: string }).tenet)
    .sort();
  assert.deepEqual(tenets, ["fire", "presence"], "one sign a thing shown, not one a deed");
});

test("gifts and strokes are refused where they are not; a wonder seen by none is no sign", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const second = steps(POSSESS_HZ, go(0, 0)).map(bidLetters).join("");
  assert.throws(
    () => world.submit("possess.input", { step: 0, steps: second, gifts: -1 }),
    /gifts/,
  );
  assert.throws(
    () =>
      world.submit("possess.input", {
        step: 0,
        steps: second,
        smites: [{ when: 30, kind: 0, x: 0, z: 0 }],
      }),
    /smiting/,
  );
  assert.equal(omenOf("hand.wonder", { tenet: "fire", seen: 0 }), null);
  assert.equal(omenOf("hand.wonder", { tenet: "fire", seen: 6 })!.strength, 0.5);
  assert.equal(omenOf("hand.wonder", { tenet: "fire", seen: 600 })!.strength, 0.9);
  release(world);
});

test("a world the gifts were used in replays from its command log, and its save continues bit for bit", () => {
  const { world, smith, folk } = laid(238);
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  const b = local(world).bodies.find((x) => x.id === folk[0]!.id)!;
  send(
    world,
    [...steps(POSSESS_HZ, go(0, 0, 0, false, true)), ...steps(2 * POSSESS_HZ, go(0, -31, 0, true))],
    mask("wings", "swift", "smite", "unbreakable"),
    [{ when: 5, kind: 1, x: b.x, z: b.z }],
  );
  const ruleset = rulesetId(world, "test"),
    held = saveWorld(world, ruleset);
  assert.deepEqual(verifyByReplay(held, build), { ok: true, problem: null });
  const loaded = loadWorld(held, build, ruleset).world;
  for (const w of [world, loaded]) {
    send(w, [go(0, 0, GIFT_ACT.heal), ...steps(POSSESS_HZ, go(20, 20, 0, true))], mask("healing"));
    release(w);
    w.runTo(240 * YEAR);
  }
  assert.deepEqual(
    loaded.checkpoints().map((c) => c.chain),
    world.checkpoints().map((c) => c.chain),
  );
  assert.deepEqual(verifyByReplay(saveWorld(world, ruleset), build), { ok: true, problem: null });
});

test("command: those near follow him, fallen in at his sides, and go their ways once it is put off", () => {
  const { world, smith, folk } = laid();
  world.runTo(world.submit("possess.take", take(smith, folk)).t);
  send(world, steps(2 * POSSESS_HZ, go(0, 0)), mask("command"));
  const following = local(world).bodies.filter((b) => b.doing === "follow");
  assert.ok(following.length >= 1 && following.length <= 8, `${following.length} follow him`);
  // Walked off, they come after him.
  const before = local(world).bodies.find((b) => b.doing === "follow")!;
  send(world, steps(3 * POSSESS_HZ, go(0, -31)), mask("command"));
  const after = local(world).bodies.find((b) => b.id === before.id)!,
    me = local(world).bodies[0]!;
  assert.ok(Math.hypot(after.x - me.x, after.z - me.z) < 10, "fallen in by him");
  // The gift put off: they go their ways again.
  send(world, steps(POSSESS_HZ, go(0, 0)));
  assert.equal(local(world).bodies.filter((b) => b.doing === "follow").length, 0);
  release(world);
});

test("unseen: a blow in a town is seen by none, and the one struck, not knowing by whom, does not answer it", () => {
  /** Blows at whoever stood nearest, a second at a time: those who saw one, those who came for him or fought him at any second. */
  const after = (gifts: number) => {
    const { world, smith, folk } = laid();
    world.runTo(world.submit("possess.take", take(smith, folk)).t);
    let most = 0,
      blows = 0;
    for (let k = 0; k < 10 && handOf(world).resting!.possessed; k++) {
      const l = local(world),
        a = l.bodies[0]!,
        b = l.bodies
          .filter((x) => x !== a && x.doing !== "down" && x.doing !== "dead")
          .sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0];
      if (!b) break;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz) || 1,
        m = (v: number) => (v / d) * 31;
      if (d < 1.4) blows++;
      send(
        world,
        [go(m(dx), m(dz), d < 1.4 ? HAND_ACT.strike : 0), ...steps(POSSESS_HZ - 1, go(0, 0))],
        gifts,
      );
      most = Math.max(
        most,
        local(world).bodies.filter(
          (x) => x.foe === a.id && (x.doing === "fight" || x.doing === "come"),
        ).length,
      );
    }
    const saw = local(world).bodies.filter((x) => x.marks & HAND_MARK.saw).length;
    release(world);
    return { most, blows, saw };
  };
  const seen = after(mask("unbreakable")),
    unseen = after(mask("unbreakable", "unseen"));
  assert.ok(seen.blows >= 1 && unseen.blows >= 1, `${seen.blows}, ${unseen.blows} blows`);
  assert.ok(seen.saw >= 1, `struck in sight, ${seen.saw} saw it`);
  assert.equal(unseen.saw, 0, "unseen, none saw it");
  assert.equal(unseen.most, 0, "none came for him");
});
