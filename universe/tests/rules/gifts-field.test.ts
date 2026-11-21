// The god's gifts on a soldier held (rules/gifts.ts in rules/fight.ts): his sprint by his body and what he bears, blows
// that do no harm, foes felled at a touch, one healed where he lies, a bolt called down among the foe, flight out of
// reach, none going for one unseen; and none of it where no gift is on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIGHT_DRAWS,
  FIGHT_TOLD,
  GAIT,
  GIFT_ACT,
  GIFT_BIT,
  HAND_ACT,
  copyFight,
  fieldHealTarget,
  fightAloft,
  fightBody,
  fightOffers,
  fightWorld,
  soldierTop,
  stepFight,
  type FightScene,
  type FightSide,
  type FightWorld,
  type Gift,
  type HandBid,
  type LocalDraw,
} from "../../src/rules/index.ts";

const drawOf =
  (k: number): LocalDraw =>
  (subject, step, purpose, n = 0) => {
    let h =
      (Math.imul(subject ^ 0x9e3779b9, 0x85ebca6b) ^
        Math.imul(step + 0x632be5ab, 0xc2b2ae35) ^
        Math.imul(purpose * 31 + n + k * 7919, 0x27d4eb2f)) >>>
      0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
const side = (guard = 0.3, mounted = false): FightSide => ({
  blow: "edge",
  cuts: true,
  looses: "none",
  reload: 0,
  guard,
  shock: 0.5,
  might: 1,
  mounted,
  figures: 10,
  before: 0,
});
const scene: FightScene = {
  cohesion: true,
  sides: [side(), side()],
  from: 20,
  length: 150,
  meet: 0,
  flanks: true,
};
/** He (a defender) at the middle, foes close before him, his own about him. */
function field(): FightWorld {
  const bodies = [fightBody(0, 1, { x: 0, z: 0, yaw: -Math.PI / 2 }, 1, false)];
  for (let i = 0; i < 6; i++) {
    bodies.push(fightBody(1 + i, 0, { x: -1.2, z: (i - 3) * 0.9, yaw: Math.PI / 2 }, 1, false));
    bodies.push(fightBody(10 + i, 1, { x: 1.5, z: (i - 3) * 1.1, yaw: -Math.PI / 2 }, 1, false));
  }
  return fightWorld(bodies);
}
const bid = (act = 0, mx = 0, mz = 0, run = false, rise = false): HandBid => ({
  mx,
  mz,
  run,
  act,
  ...(rise ? { rise } : {}),
});
const mask = (...g: Gift[]) => g.reduce((m, x) => m | GIFT_BIT[x], 0);
const run = (f: FightWorld, n: number, b: (k: number) => HandBid, gifts = 0, draw = drawOf(1)) => {
  if (gifts) f.gifts = gifts;
  else delete f.gifts;
  for (let k = 0; k < n && !f.ended; k++) stepFight(scene, f, b(k), draw);
};

test("a soldier's sprint is his body's under what he bears; mounted, his horse's", () => {
  const me = fightBody(0, 1, { x: 0, z: 0, yaw: 0 }, 1, false),
    plain = soldierTop(scene, me),
    armoured = soldierTop({ ...scene, sides: [side(), side(1)] }, me),
    horsed = soldierTop({ ...scene, sides: [side(), side(0.3, true)] }, me);
  assert.ok(plain < GAIT.prime && plain > GAIT.prime * 0.85, `${plain}`);
  assert.ok(armoured < plain * 0.8, "full armour the slower");
  assert.ok(horsed > plain * 1.5, "a horse the faster");
  assert.ok(soldierTop(scene, me, true) === GAIT.prime, "the god's strength: no load");
  // Held at a sprint he goes at his top and spends his breath.
  const f = field();
  f.bodies[0]!.x = 30;
  run(f, 20, () => bid(0, 31, 0, true));
  assert.ok(f.bodies[0]!.x - 30 > plain * 0.9, `ran ${f.bodies[0]!.x - 30} m in a second`);
  assert.ok(f.gait!.wind < 1);
});

/** He alone among foes, his own far off. */
function lone(): FightWorld {
  const bodies = [fightBody(0, 1, { x: 0, z: 0, yaw: -Math.PI / 2 }, 1, false)];
  for (let i = 0; i < 4; i++) {
    bodies.push(fightBody(1 + i, 0, { x: -1, z: (i - 1.5) * 0.8, yaw: Math.PI / 2 }, 1, false));
    bodies.push(fightBody(10 + i, 1, { x: 40, z: i * 1.5, yaw: -Math.PI / 2 }, 1, false));
  }
  return fightWorld(bodies);
}

test("unbreakable: the blows on him land and do no harm; strength: one that lands fells", () => {
  // (Every blow lands, and kills where it may.)
  const lands: LocalDraw = (_s, _step, purpose) =>
      purpose === FIGHT_DRAWS.hit || purpose === FIGHT_DRAWS.kill ? 0 : 0.5,
    plain = lone(),
    warded = lone();
  run(plain, 40, () => bid(), 0, lands);
  run(warded, 400, () => bid(), mask("unbreakable"), lands);
  assert.ok(plain.ended === "dead" || plain.ended === "down", "left to them, he falls");
  assert.equal(warded.bodies[0]!.hurt, 0, "no blow took anything from him");
  assert.notEqual(warded.bodies[0]!.doing, "down");
  assert.ok(
    warded.wonders!.some((w) => w.kind === "warded"),
    "blows fell on him",
  );
  assert.ok(warded.told.length > 0);
  // Strength: each he fells, felled at a touch (a wonder); without it, none so.
  const a = field(),
    b = field();
  run(a, 600, (k) => bid(k % 12 === 0 ? HAND_ACT.strike : 0), mask("strength"));
  run(b, 600, (k) => bid(k % 12 === 0 ? HAND_ACT.strike : 0));
  const mine = (f: FightWorld) => f.deeds.filter((d) => d.by === 0);
  assert.ok(mine(a).length > 0 && mine(a).every((d) => d.gift === "strength"));
  assert.ok(a.wonders!.some((w) => w.kind === "felled"));
  assert.ok(mine(b).every((d) => d.gift === undefined));
  assert.equal(b.wonders, undefined, "no gift, no wonder");
});

test("a healing touch raises one of his struck down; a bolt called down strikes among the foe, never him", () => {
  const f = field(),
    near = f.bodies[7]!;
  near.doing = "down";
  near.hurt = 1;
  near.x = 0.8;
  near.z = 0;
  f.deeds.push({ step: 0, by: 1, id: near.id, place: 1, striker: 0, dead: false, lost: false });
  f.gifts = mask("healing");
  assert.equal(fieldHealTarget(f), 7);
  assert.equal(fightOffers(scene, f)[4]?.kind, "heal");
  stepFight(scene, f, bid(GIFT_ACT.heal), drawOf(2));
  assert.notEqual(near.doing, "down");
  assert.equal(near.hurt, 0);
  assert.ok(!f.deeds.some((d) => d.id === near.id), "his fall no longer counted");
  assert.equal(FIGHT_TOLD[f.told[0]], "healed");
  // A bolt among the foe before him.
  const g = field(),
    lift = g.lift[0];
  g.gifts = mask("smite");
  stepFight(scene, g, bid(), drawOf(3), true, [{ kind: 0, x: -1.2, z: 0 }]);
  const struck = g.deeds.filter((d) => d.gift === "lightning");
  assert.ok(
    struck.length >= 1 && struck.every((d) => g.bodies.find((b) => b.id === d.id)!.side === 0),
  );
  assert.notEqual(g.bodies[0]!.doing, "down");
  assert.ok(g.lift[0] < lift, "the foe's heart sinks");
  // Without Smite on, a stroke sent does nothing.
  const h = field();
  stepFight(scene, h, bid(), drawOf(3), true, [{ kind: 0, x: -1.2, z: 0 }]);
  assert.equal(h.deeds.length, 0);
});

test("flight lifts him out of every blow's reach; unseen, none goes for him", () => {
  const f = field();
  run(f, 40, () => bid(0, 0, 0, false, true), mask("wings", "unbreakable"));
  assert.ok(fightAloft(f));
  assert.ok(f.wonders!.some((w) => w.kind === "flew"));
  const o = fightOffers(scene, f)[0]!;
  assert.ok(!o.can && o.why === "reach", "no blow by hand from up there");
  const before = f.wonders!.filter((w) => w.kind === "warded").length;
  run(f, 200, () => bid(0, 0, 0, false, true), mask("wings", "unbreakable"));
  assert.equal(f.wonders!.filter((w) => w.kind === "warded").length, before, "none reached him");
  // Unseen: those of the other side do not go for him.
  const u = copyFight(field());
  run(u, 100, () => bid(), mask("unseen"));
  assert.ok(u.bodies.filter((b) => b.side === 0).every((b) => b.foe !== 0));
});

test("the ground shaken throws the foe off their blows; rain wets their bows; under Command his own go for his foe", () => {
  const q = field();
  q.gifts = mask("smite");
  stepFight(scene, q, bid(), drawOf(4), true, [{ kind: 2, x: -1.2, z: 0 }]);
  const thrown = q.bodies.filter((b) => b.side === 0 && b.ready >= q.step + 30);
  assert.ok(thrown.length >= 5, `${thrown.length} thrown off their blows`);
  // Rain on archers: their next loosing waits two reloads.
  const archers = {
      ...scene,
      sides: [{ ...side(), looses: "arrows" as const, reload: 4 }, side()] as [
        FightSide,
        FightSide,
      ],
    },
    r = field();
  for (const b of r.bodies) if (b.side === 0) b.loaded = 0;
  r.gifts = mask("smite");
  stepFight(archers, r, bid(), drawOf(4), true, [{ kind: 3, x: -1.2, z: 0 }]);
  assert.ok(r.bodies.filter((b) => b.side === 0).every((b) => b.loaded >= r.step + 100));
  // Command: his own about him take his foe as theirs.
  const c = field();
  c.gifts = mask("command");
  run(c, 30, (k) => bid(k % 12 === 0 ? HAND_ACT.strike : 0), mask("command"));
  const me = c.bodies[0]!;
  assert.ok(me.foe >= 0, "he goes for one");
  const own = c.bodies.filter(
    (b, i) => i > 0 && b.side === me.side && b.doing !== "down" && b.doing !== "dead",
  );
  assert.ok(
    own.some((b) => b.foe === me.foe),
    "one of his own goes for whom he goes for",
  );
  const left = field();
  run(left, 30, (k) => bid(k % 12 === 0 ? HAND_ACT.strike : 0));
  const sharing = (f: FightWorld) =>
    f.bodies.filter((b, i) => i > 0 && b.side === 1 && b.foe === f.bodies[0]!.foe).length;
  assert.ok(sharing(c) > sharing(left), `${sharing(c)} with him against ${sharing(left)}`);
  // Without it, a stroke sent does nothing: their blows as they were.
  const n = field();
  stepFight(scene, n, bid(), drawOf(4), true, [{ kind: 2, x: -1.2, z: 0 }]);
  assert.ok(n.bodies.filter((b) => b.side === 0).every((b) => b.ready < n.step + 30));
});
