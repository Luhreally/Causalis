import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { parseTownsfolkRef, seatRef, type VillagePlan } from "../../src/bridge/index.ts";
import { populationContext, warsOf } from "../../src/sim/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { villagePlan } from "../../src/host/village.ts";
import {
  LINE,
  PER_TERM,
  clearRosters,
  townRoster,
  type Holder,
  type Roster,
} from "../../src/host/roster.ts";
import { battleRoll } from "../../src/host/roll.ts";
import {
  battleMembers,
  bodyOf,
  familyLine,
  familyOf,
  kinCard,
  type Family,
} from "../../src/host/kin.ts";
import { BATTLE_HOUR, bodyFrameOf } from "../../src/host/wounds.ts";
import { planWords } from "../../src/host/inspect/kin.ts";
import { pageOf } from "../../src/host/inspect/index.ts";

// Phase 55 wave 5: anyone of a town's family and body, read from history without changing it — a
// line's holders as each other's kin, the rest of their kin by the keyed rule, their house the four
// lines a home holds, the blow that killed one fallen; the same on every asking, and nothing moved.

const HOUR = 3600;
const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  life = populationContext(world).life,
  grown = life.adulthood,
  towns = populationContext(world)
    .settlements.all()
    .filter((s) => s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .slice(0, 3);
/** Each town's line holders now, the first `most` of its lines. */
const holders = (town: string, population: number, most = 40): Holder[] => {
  const roster = townRoster(world, town),
    out: Holder[] = [];
  for (let k = 0; k < Math.min(most, Math.ceil(population / LINE)); k++) {
    const h = roster.holder(k);
    if (h) out.push(h);
  }
  return out;
};
const lineOf = (ref: string) => parseTownsfolkRef(ref)?.line ?? -1;

test("every line holder has a family, the same on every asking and after the rosters are folded again", () => {
  let n = 0;
  for (const s of towns) {
    const roster = townRoster(world, s.ref);
    for (const h of holders(s.ref, s.population)) {
      const f = familyOf(world, h.ref);
      assert.ok(f, h.ref);
      assert.equal(f.self.ref, h.ref);
      assert.equal(f.self.name, roster.nameOf(h));
      assert.equal(f.self.born, h.born);
      assert.deepEqual(familyOf(world, h.ref), f, `${h.ref} asked again`);
      n++;
    }
  }
  const one = holders(towns[0]!.ref, towns[0]!.population)[3]!,
    was = familyOf(world, one.ref);
  clearRosters();
  assert.deepEqual(familyOf(world, one.ref), was, "folded again");
  assert.ok(n >= 30, `${n} families read`);
});

test("kin in years that hold: parents grown before them, children born of grown parents, a spouse near in age", () => {
  for (const s of towns)
    for (const h of holders(s.ref, s.population)) {
      const f = familyOf(world, h.ref)!,
        self = f.self;
      for (const p of f.parents) assert.ok(p.born <= self.born - grown, `${h.ref}'s ${p.tie}`);
      for (const c of f.children) {
        assert.ok(c.born >= self.born + grown, `${h.ref}'s ${c.tie} born ${c.born}`);
        assert.ok(c.died === null || c.died >= c.born, `${h.ref}'s ${c.tie} dies after birth`);
        // (A father may die before his last is born, by a season; a mother not.)
        assert.ok(
          self.died === null || c.born <= self.died + (self.sex ? 1 : 0),
          `${h.ref}'s ${c.tie} born ${c.born}, after ${self.died}`,
        );
      }
      if (f.spouse) {
        assert.ok(Math.abs(f.spouse.born - self.born) <= 8, `${h.ref}'s ${f.spouse.tie}`);
        assert.notEqual(f.spouse.sex, self.sex);
      }
      for (const b of f.siblings) assert.ok(Math.abs(b.born - self.born) <= 40, `${h.ref}'s sib`);
      assert.ok(f.parents.length >= 1, `${h.ref} has no parents told`);
      assert.ok(
        f.line.some((k) => k.ref === h.ref),
        `${h.ref} not in their own line`,
      );
    }
});

/** The holder of a line before `h`: the one before in his term, else the last of the term before (as the roster folds them). */
const predOf = (roster: Roster, h: Holder): Holder | null => {
  const tau = Math.floor((h.n - 1) / PER_TERM),
    r = (h.n - 1) % PER_TERM;
  if (r > 0) return roster.holderOf(h.line, h.n - 1);
  let last: Holder | null = null;
  for (let q = 0; tau > 0 && q < PER_TERM; q++) {
    const x = roster.holderOf(h.line, (tau - 1) * PER_TERM + q + 1);
    if (!x) break;
    last = x;
    if (x.died === null) break;
  }
  return last;
};

test("the line passes to a child where the one before was old enough, else to a brother or sister", () => {
  let child = 0,
    sib = 0;
  for (const s of towns) {
    const roster = townRoster(world, s.ref);
    for (const h of holders(s.ref, s.population, 24)) {
      let b: Holder | null = h;
      for (let back = 0; back < 4 && b; back++) {
        const a = predOf(roster, b);
        if (!a) break;
        const f = familyOf(world, b.ref)!,
          gap = b.born - a.born,
          told = f.line.find((k) => k.ref === a.ref);
        assert.ok(told, `${b.ref}'s line names ${a.ref}`);
        // (One who died over a year before the next was born was not their parent.)
        const gone = told.died !== null && told.died < b.born - 1;
        if (gap >= grown && gap <= 50 && !gone) {
          assert.ok(
            f.parents.some((p) => p.ref === a.ref),
            `${a.ref} (born ${a.born}) ${b.ref}'s parent (born ${b.born})`,
          );
          child++;
        } else if (Math.abs(gap) < grown) {
          assert.ok(
            f.siblings.some((p) => p.ref === a.ref),
            `${a.ref} (born ${a.born}) a sibling of ${b.ref} (born ${b.born})`,
          );
          sib++;
        }
        b = a;
      }
    }
  }
  assert.ok(child >= 3 && sib >= 1, `${child} passed to a child, ${sib} to a sibling`);
});

test("the roof: the holders of the four lines the town draws in one home", () => {
  let checked = 0;
  for (const s of towns.slice(0, 2)) {
    const plan: VillagePlan = villagePlan(world, s.ref as Ref, undefined, 480),
      plain = plan.people.filter((p) => p.folk && !p.trade && !p.healer);
    for (const p of plain.slice(0, 24)) {
      const f = familyOf(world, p.ref)!,
        under = new Set(f.house.map((k) => k.ref)),
        mates = plain.filter(
          (q) => q.ref !== p.ref && Math.floor(lineOf(q.ref) / 4) === Math.floor(lineOf(p.ref) / 4),
        );
      for (const q of mates) {
        assert.ok(under.has(q.ref), `${q.ref} under ${p.ref}'s roof`);
        assert.equal(q.home, p.home, `${q.ref} drawn at ${p.ref}'s home`);
      }
      checked += mates.length;
    }
  }
  assert.ok(checked >= 4, `${checked} housemates checked`);
});

/** The largest recent battle's roll. */
const recent = [...warsOf(world).all()]
  .flatMap((w) => w.battles)
  .filter((b) => b.fell && b.year >= Y - 6)
  .sort((p, q) => q.year - p.year || (p.event < q.event ? -1 : p.event > q.event ? 1 : 0));
const rolls = recent.slice(0, 4).map((b) => battleRoll(world, b.event, 360)!);

test("one fallen: killed at the battle's hour by a blow to a member of his plan; his widow and children live on", () => {
  const frame = bodyFrameOf(world);
  let told = 0,
    widowed = 0;
  for (const roll of rolls)
    for (const e of [...roll.attacker.fell, ...roll.defender.fell].slice(0, 40)) {
      const read = bodyOf(world, e.ref)!,
        d = read.death!;
      assert.ok(d, `${e.ref} fell without a death blow`);
      assert.equal(d.at, (roll.year + 1) * YEAR + BATTLE_HOUR * HOUR, e.ref);
      assert.ok(frame.members.includes(d.member), `${e.ref} killed by a blow to ${d.member}`);
      assert.equal(d.event, roll.event);
      // (Told from the turn, though watched fought at its hour the morning after: not before.)
      const turn = (roll.year + 1) * YEAR;
      assert.ok(!/^Killed/.test(kinCard(world, e.ref, turn - 1).body ?? ""), "killed before");
      assert.match(kinCard(world, e.ref, turn).body ?? "", /^Killed by a blow to /);
      assert.match(kinCard(world, e.ref, d.at).body ?? "", /^Killed by a blow to /);
      // (In the battle as it is fought: as its blows so far leave him, not yet as its end does.)
      const during = (struck: { member: "arm-l"; lost: boolean; fell: boolean }[]) =>
        kinCard(world, e.ref, d.at + 600, { event: roll.event, struck }).body ?? "";
      assert.ok(!/^Killed/.test(during([])), `${e.ref} killed before his blow`);
      assert.match(
        during([{ member: "arm-l", lost: true, fell: false }]),
        /^Lost (his|her) left arm this day/,
      );
      // (Not yet struck down in it: his family told as it was before it; struck down, as it is after.)
      const family = (fell: boolean) =>
        kinCard(world, e.ref, d.at + 600, {
          event: roll.event,
          struck: [{ member: "trunk", lost: false, fell }],
        }).family ?? "";
      assert.ok(!/^Fell /.test(family(false)), `${e.ref} told fallen before his blow`);
      assert.match(family(true), /^Fell /);
      assert.match(kinCard(world, e.ref, d.at).family ?? "", /^Fell /);
      assert.deepEqual(bodyOf(world, e.ref), read, `${e.ref} asked again`);
      const f: Family | null = familyOf(world, e.ref);
      assert.ok(f, e.ref);
      if (f.spouse && f.spouse.died === null) {
        assert.match(familyLine(f), / (widow|widower) /, e.ref);
        widowed++;
      }
      told++;
    }
  assert.ok(told >= 20, `${told} fallen read`);
  assert.ok(widowed >= 1, "no fallen man left a widow");
});

test("where history struck a battle's named men: the blow that killed each fallen, each hurt man's wound", () => {
  // (A member is cut off on the field only where history says so: one a healer took off later was
  // struck there, not severed.)
  let fell = 0,
    hurt = 0;
  for (const roll of rolls) {
    const struck = battleMembers(world, roll.event, 360);
    for (const e of [...roll.attacker.fell, ...roll.defender.fell]) {
      const s = struck[e.ref];
      assert.ok(s, `${e.ref} fell, struck nowhere`);
      assert.deepEqual(s, { member: bodyOf(world, e.ref)!.death!.member, cut: false }, e.ref);
      fell++;
    }
    for (const e of [...roll.attacker.hurt, ...roll.defender.hurt]) {
      const s = struck[e.ref],
        w = bodyOf(world, e.ref)!.wounds.find((x) => x.event === roll.event);
      assert.ok(s && w, `${e.ref} hurt, struck nowhere`);
      assert.deepEqual(s, { member: w.member, cut: w.how === "cut off" }, e.ref);
      hurt++;
    }
    assert.deepEqual(battleMembers(world, roll.event, 360), struck);
  }
  assert.ok(fell >= 20 && hurt >= 10, `${fell} fallen, ${hurt} hurt`);
  assert.deepEqual(battleMembers(world, "ev:none"), {});
});

test("one of the levy known by the roll alone: his kin given by the keyed rule, said plainly", () => {
  let n = 0;
  for (const roll of rolls)
    for (const e of [...roll.attacker.stood, ...roll.attacker.fell].filter((x) =>
      x.ref.startsWith("lv:"),
    )) {
      const f = familyOf(world, e.ref);
      assert.ok(f, e.ref);
      assert.equal(f.self.name, e.name);
      assert.match(f.kept, /roll alone/);
      assert.ok(f.parents.length === 2, `${e.ref}'s parents`);
      assert.deepEqual(familyOf(world, e.ref), f);
      if (++n >= 12) break;
    }
  assert.ok(n >= 1, "no man of the levy on the rolls looked at");
});

test("a maker and the healer: their kin by their seat, said plainly; their pages tell them", () => {
  let n = 0;
  for (const s of towns) {
    const plan: VillagePlan = villagePlan(world, s.ref as Ref, undefined, 480);
    for (const p of plan.people.filter((q) => q.trade || q.healer).slice(0, 3)) {
      const ref = p.healer ? `heal:${s.ref}` : seatRef(s.ref, p.trade!.kind, p.trade!.seat),
        f = familyOf(world, ref);
      assert.ok(f, ref);
      assert.equal(f.self.name, p.name, ref);
      assert.match(f.kept, /seat/);
      const page = pageOf(world, ref);
      assert.equal(page.title, p.name);
      assert.ok(page.tabs.some((t) => t.id === "family") && page.tabs.some((t) => t.id === "body"));
      n++;
    }
  }
  assert.ok(n >= 1, "no maker or healer drawn");
});

test("one met: their household's family; a Body tab beside it", () => {
  const plan: VillagePlan = villagePlan(world, towns[0]!.ref as Ref, undefined, 480),
    met = plan.people.find((p) => !p.folk && p.ref.startsWith("prsn:"));
  assert.ok(met, "no one met drawn");
  const card = kinCard(world, met.ref),
    page = pageOf(world, met.ref);
  assert.ok(card.family !== null && card.body !== null, met.ref);
  assert.ok(
    page.tabs.some((t) => t.id === "body"),
    `${met.ref} has no Body tab`,
  );
});

test("a line holder's page: their family's and body's lines, a Family tab and a Body tab of their plan", () => {
  const frame = bodyFrameOf(world),
    h = holders(towns[0]!.ref, towns[0]!.population)[5]!,
    page = pageOf(world, h.ref),
    ids = page.tabs.map((t) => t.id);
  assert.ok(
    ids.indexOf("family") >= 1 && ids.indexOf("body") === ids.indexOf("family") + 1,
    ids.join(),
  );
  const body = page.tabs.find((t) => t.id === "body")!.blocks.find((b) => b.type === "body");
  assert.ok(body && body.type === "body");
  assert.deepEqual(
    body.members.map((m) => m.member),
    frame.members,
  );
  const overview = page.tabs.find((t) => t.id === "overview")!.blocks[0]!;
  assert.ok(overview.type === "facts" && overview.rows.some((r) => r.label === "Family"));
  assert.equal(planWords(frame), "a head, a chest, two arms, two hands, two legs and two eyes");
});

test("a soldier's body inspection carries his recorded armor and weapon and opens on the large figure", () => {
  const battle = warsOf(world)
    .all()
    .flatMap((w) => w.battles)
    .find((b) => b.year < Y)!;
  assert.ok(battle);
  const roll = battleRoll(world, battle.event, 360)!,
    man = [...roll.attacker.stood, ...roll.attacker.hurt, ...roll.attacker.fell][0]!;
  assert.ok(man);
  const page = pageOf(world, man.ref),
    body = page.tabs.find((t) => t.id === "body")!;
  assert.equal(body.blocks[0]!.type, "body");
  const portrait = page.portrait;
  assert.ok(portrait?.kind === "person" && portrait.equipment);
  assert.equal(portrait.equipment.year, battle.year);
  assert.ok(portrait.equipment.guardWords && portrait.equipment.armWords);
  assert.ok(body.blocks.some((b) => b.type === "facts" && b.rows.some((r) => r.label === "Armor")));
  assert.equal(
    JSON.stringify(world.domainHashes()),
    before,
    "looking at armor cannot change history",
  );
});

test("an alien people's plan is their own", () => {
  const alien = ALIEN.build(seedFromText("alien 9")),
    frame = bodyFrameOf(alien),
    earth = bodyFrameOf(world);
  assert.notDeepEqual(frame.members, earth.members);
  assert.match(planWords(frame), /on each side/);
});

test("looking moves nothing", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
