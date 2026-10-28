// The soldier's fight measured (Phase 61): battles laid as a town lays them before it (view/placed.ts,
// view/battle.ts newBattle), their hosts from a few hundred to several thousand and outnumbered up to
// eight to one either way, each taken at a second and fought out (rules/fight.ts) — left to itself,
// and with the god's hand in one of the beaten side's front rank fighting as a player would (at the
// nearest foe, a blow whenever one lands, his men rallied whenever he may). How often the fight goes
// history's way left to itself, how often the hand turns the day (sim/hand/fight.ts handDay: where his
// fight broke another side than the fight left alone), how often the side his fight broke is not the
// one the day was told against, when a side breaks, how many fall, and what a step costs.
//
//   node tools/probe-fight.ts [battles=40] [most=120] [second=30]
import {
  FIGHT_ACT,
  FIGHT_REACH,
  FIGHT_TAKES,
  FIGHT_TILT,
  HAND_ACT,
  copyFight,
  fightBody,
  fightDecided,
  fightLeaning,
  fightMights,
  fightOut,
  fightWorld,
  stepFight,
  type FightScene,
  type FightSide,
  type FightWorld,
  type HandBid,
  type LocalDraw,
} from "../src/rules/index.ts";
import { battleAt, fightShare, newBattle, type BattleField } from "../src/view/index.ts";
import type { BattleNear } from "../src/bridge/index.ts";
import { handDay } from "../src/sim/index.ts";

const battles = Number(process.argv[2] ?? 40),
  most = Number(process.argv[3] ?? 120),
  s0 = Number(process.argv[4] ?? 30);

/** A keyed draw of the probe's own (the sim's are the world's: this one stands in for them). */
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
let seed = 11;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const host = (name: string, fielded: number, fallen: number) => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2] as [number, number, number],
  arms: null,
  fielded,
  fallen,
  wounded: fallen * 2,
  host: { arm: "spear", guard: "shield", mount: "" },
  kit: "spears",
});
function nearOf(won: boolean, fa: number, fd: number, key: number): BattleNear {
  return {
    event: `ev:0:${key}`,
    war: "war:1",
    title: "The battle at the probe",
    cell: 1,
    land: "the probe",
    year: 300,
    attacker: host("A", fa, Math.round(fa * (won ? 0.06 : 0.12))),
    defender: host("D", fd, Math.round(fd * (won ? 0.12 : 0.06))),
    won,
    outcome: won ? "field" : "held",
    civil: null,
    hills: false,
    river: false,
    walls: 0,
    town: null,
    figure: null,
    plan: { seed: "probe", lineages: [], kindOfAge: 0 },
  } as unknown as BattleNear;
}

/**
 * The fight about the front rank's middle of `side` at second s0, as a taking lays it: the scene by
 * the day's tilt, and the field's figures still standing, he first, each side its share (view/fight.ts
 * fightShare).
 */
function takeAt(field: BattleField, side: 0 | 1, won: boolean) {
  const now = battleAt(field, s0),
    figures: [number, number] = [field.hosts[0].n, field.hosts[1].n],
    before: [number, number] = [0, 0];
  for (const t of field.troopers) if (t.falls !== null && t.falls < s0) before[t.side]++;
  const sideOf = (k: 0 | 1, mights: [number, number]): FightSide => ({
      blow: "point",
      cuts: false,
      looses: "none",
      reload: 0,
      guard: 0.3,
      shock: 0.5,
      might: mights[k],
      mounted: false,
      figures: figures[k],
      before: before[k],
    }),
    sceneAt = (tilt: number): FightScene => {
      const mights = fightMights(
        won ? 0 : 1,
        [figures[0] - before[0], figures[1] - before[1]],
        tilt,
      );
      return {
        sides: [sideOf(0, mights), sideOf(1, mights)],
        from: s0,
        length: 150,
        meet: field.meet,
        flanks: true,
      };
    },
    standing = now.troopers.filter((t) => {
      const f = field.troopers[t.id]!.falls;
      return f === null || f >= s0;
    }),
    // (He: of his side the one nearest the other's line, in the middle.)
    me = standing
      .filter((t) => t.side === side)
      .sort((a, b) => (side === 1 ? a.x - b.x : b.x - a.x) || Math.abs(a.z) - Math.abs(b.z))[0]!,
    near = fightShare(
      standing
        .filter((t) => t !== me)
        .sort(
          (a, b) =>
            (a.x - me.x) ** 2 + (a.z - me.z) ** 2 - (b.x - me.x) ** 2 - (b.z - me.z) ** 2 ||
            a.id - b.id,
        ),
      me.side,
    ),
    bodies = [me, ...near].map((t) =>
      fightBody(t.id, t.side, t, 0.85 + 0.3 * field.troopers[t.id]!.u, false),
    );
  return { sceneAt, start: fightWorld(bodies) };
}

/** A player's bid: at the nearest foe, a blow when one lands, his men rallied when he may. */
function playerBid(scene: FightScene, f: FightWorld): HandBid {
  const me = f.bodies[0]!;
  if (me.doing === "flee") return { mx: 0, mz: 0, run: false, act: FIGHT_ACT.fly };
  let best = -1,
    bd = Infinity;
  for (let j = 1; j < f.bodies.length; j++) {
    const o = f.bodies[j]!;
    if (o.side === me.side || ["down", "dead", "gone", "flee"].includes(o.doing)) continue;
    const d = Math.hypot(o.x - me.x, o.z - me.z);
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  const rally = f.step - f.rallied >= FIGHT_TAKES.rally && f.broke < 0;
  if (best < 0) return { mx: 0, mz: 0, run: false, act: rally ? FIGHT_ACT.rally : 0 };
  const o = f.bodies[best]!,
    reach = FIGHT_REACH[scene.sides[me.side].blow];
  if (bd <= reach)
    return { mx: 0, mz: 0, run: false, act: rally ? FIGHT_ACT.rally : HAND_ACT.strike };
  return {
    mx: ((o.x - me.x) / bd) * 31,
    mz: ((o.z - me.z) / bd) * 31,
    run: bd > 6,
    act: rally ? FIGHT_ACT.rally : HAND_ACT.strike,
  };
}

let agree = 0,
  leant = 0,
  turned = 0,
  against = 0,
  played = 0,
  steps = 0,
  ms = 0,
  dead = 0,
  bodies = 0;
const breaks: number[] = [],
  figures: number[] = [],
  pers: number[] = [];
for (let k = 0; k < battles; k++) {
  const ratio = Math.exp((rnd() - 0.5) * 2 * Math.log(8)),
    base = 600 + rnd() * 3000,
    fa = Math.round(base * Math.sqrt(ratio)),
    fd = Math.round(base / Math.sqrt(ratio)),
    won = rnd() < 0.5,
    field = newBattle(nearOf(won, fa, fd, k), most, true),
    beaten: 0 | 1 = won ? 1 : 0;
  figures.push(field.hosts[0].n, field.hosts[1].n);
  pers.push(field.per);
  // Left to itself, the day leant as a taking leans it.
  const { sceneAt, start } = takeAt(field, beaten, won),
    t = performance.now(),
    { scene, idle: f } = fightLeaning(sceneAt, start, won ? 0 : 1, drawOf(k));
  ms += performance.now() - t;
  steps += f.step;
  if (scene.sides[0].might !== sceneAt(FIGHT_TILT).sides[0].might) leant++;
  const idle = fightDecided(f);
  {
    const d = idle;
    if (d.beaten === beaten) agree++;
    if (f.brokeAt >= 0) breaks.push(s0 + f.brokeAt / 20);
    dead += d.dead[0] + d.dead[1];
    bodies += f.bodies.length;
  }
  // The hand in the beaten side's front rank, played until it ends for him, then fought out.
  {
    const f = copyFight(start),
      draw = drawOf(k);
    while (!f.ended) stepFight(scene, f, playerBid(scene, f), draw);
    played += f.step;
    fightOut(scene, f, draw, 20000);
    const hand = fightDecided(f),
      near = nearOf(won, fa, fd, k),
      day = handDay(
        { won, fallen: [near.attacker.fallen, near.defender.fallen], fielded: [fa, fd] },
        idle,
        hand,
        field.per,
      );
    if (day.turned) turned++;
    // (His fight broke a side, and the day was told the other's way.)
    if (hand.beaten >= 0 && hand.beaten === (day.won ? 0 : 1)) against++;
  }
}
breaks.sort((a, b) => a - b);
const span = (xs: number[]) => `${Math.min(...xs)}–${Math.max(...xs)}`;
console.log(
  [
    `${battles} battles, ${most} figures a side at most (${span(figures)} laid, ${span(pers)} men a figure), taken at second ${s0}:`,
    `  left to itself, history's way ${agree}/${battles} (the day leant past FIGHT_TILT in ${leant}); the hand turns the day ${turned}/${battles} (held ${(played / battles / 20).toFixed(0)} s on average)`,
    `  the side his fight broke not the one the day was told against: ${against}/${battles}`,
    `  a side breaks at second ${breaks[0]?.toFixed(0)} … ${breaks.at(-1)?.toFixed(0)} (middle ${breaks[breaks.length >> 1]?.toFixed(0)})`,
    `  dead ${((100 * dead) / Math.max(1, bodies)).toFixed(1)}% of the bodies; ${((1000 * ms) / Math.max(1, steps)).toFixed(0)} µs a step (${(bodies / battles).toFixed(0)} bodies)`,
  ].join("\n"),
);
