import { test } from "node:test";
import assert from "node:assert/strict";
import { OCC } from "../../src/rules/index.ts";
import type { FieldYear, VillagePlan } from "../../src/bridge/index.ts";
import {
  CROP_HIGH,
  FAIR_YEAR,
  REAPERS_AT,
  STOOK_DAYS,
  STUBBLE,
  blightFires,
  blightedRow,
  burnSpot,
  cropsOf,
  cutPoint,
  fieldsNow,
  fieldsWords,
  momentOf,
  pulledOn,
  reapedAt,
  reapingOn,
  reapingsOf,
  restDay,
  rowNow,
  rowsOf,
  stookedOn,
  stooksOf,
  storesNow,
  townDay,
  villageSolids,
  wateredOn,
} from "../../src/view/index.ts";

// Phase 44 M206: the year in a town's fields. Its crop stands in its rows as its land's year has
// it — growing, gold, reaped row by row field after field through the harvest weeks, stubble —
// as tall and as green as its rain, its soil and the god's hand let it; its farmers reap at each
// field's front, carry water out in a dry year and pull a blight and burn it.

const DAY = 86_400,
  HOUR = 3_600,
  Y = 40 * 365;

/** A village of sixteen homes, twelve fields about it, its farmers; its year in the fields as given. */
function villageOf(year: Partial<FieldYear> = {}, over: Partial<VillagePlan> = {}): VillagePlan {
  return {
    ref: "vill:0:44",
    name: "Fieldham",
    population: 300,
    market: false,
    hand: false,
    districts: null,
    biome: 9,
    seed: 7,
    homes: Array.from({ length: 16 }, (_, k) => {
      const a = k * 2.399963,
        r = 16 + 8.5 * Math.sqrt(k);
      return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
    }),
    fields: Array.from({ length: 12 }, (_, k) => {
      const a = ((k - 5.5) / 12) * 2.6,
        r = 120 + (k % 3) * 45;
      return { x: r * Math.cos(a), z: r * Math.sin(a), w: 40, d: 25, yaw: a };
    }),
    pasture: { x: -150, z: 0, r: 60 },
    wild: 400,
    water: null,
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 0, z: -500 },
    era: "farm",
    people: Array.from({ length: 48 }, (_, i) => ({
      ref: `prsn:0:${i}`,
      name: `P${i} Field`,
      home: i % 16,
      age: 20 + ((i * 7) % 30),
      occupation: i % 4 === 3 ? OCC.crafter : OCC.farmer,
      child: false,
    })),
    life: {
      fed: 1,
      growing: false,
      war: false,
      unrest: 0,
      faith: null,
      talk: [],
      site: null,
      mourning: [],
      newborn: [],
      fields: {
        rain: 1,
        sent: 0,
        sentFrom: 0,
        gift: 0,
        giftFrom: 0,
        soil: 1,
        vermin: 0,
        heat: 1,
        why: [],
        ...year,
      },
    },
    ...over,
  };
}

/** The first working day on or after a day. */
const working = (plan: VillagePlan, day: number) => {
  while (restDay(plan, day)) day++;
  return day;
};

test("the year in the fields: a fair year as fair, a dry one parched, the god's hand seen from the days it began", () => {
  assert.deepEqual(fieldsNow({}, Y * DAY), FAIR_YEAR);
  const fair = fieldsNow(villageOf(), (Y + 150) * DAY);
  assert.ok(Math.abs(fair.growth - 1) < 1e-9 && fair.dry === 0 && fair.blight === 0);
  // A dry year: parched, short.
  const dry = fieldsNow(villageOf({ rain: 0.5 }), (Y + 150) * DAY);
  assert.ok(dry.dry > 0.8 && dry.growth < 0.6, JSON.stringify(dry));
  // The rain withheld this spring: the crop parching over the days after, not before.
  const from = (Y + 120) * DAY,
    withheld = villageOf({ sent: -1, sentFrom: from }),
    at = (d: number) => fieldsNow(withheld, from + d * DAY);
  assert.equal(at(-1).dry, 0);
  assert.ok(at(3).dry > 0 && at(3).dry < at(8).dry && at(12).rain < 0.5, `${at(12).rain}`);
  // (Withheld since a year before: history's rain has it already, not counted twice.)
  assert.equal(
    fieldsNow(villageOf({ rain: 0.45, sent: -1, sentFrom: (Y - 200) * DAY }), (Y + 150) * DAY).rain,
    0.45,
  );
  // Blighted: running through the rows over a fortnight; blessed; worn soil; vermin.
  const blighted = villageOf({ gift: -1, giftFrom: from });
  assert.ok(
    fieldsNow(blighted, from + 4 * DAY).blight < fieldsNow(blighted, from + 14 * DAY).blight,
  );
  assert.equal(fieldsNow(blighted, from + 20 * DAY).blight, 1);
  assert.ok(fieldsNow(villageOf({ gift: 1, giftFrom: from }), from + 10 * DAY).growth > 1.4);
  const worn = fieldsNow(villageOf({ soil: 0.5, vermin: 0.1 }), from);
  assert.ok(worn.worn > 0.7 && Math.abs(worn.growth - 0.45) < 1e-9);
});

test("the crop through its year: sprouting after the sowing, grown by midsummer, reaped row by row back and forth, stubble, then turned in", () => {
  const plan = villageOf(),
    { crop } = cropsOf(plan),
    k = crop.indexOf("grain"),
    g = crop.indexOf("greens"),
    r = reapingsOf(plan)[k]!,
    n = rowsOf(plan.fields[k]!),
    row = (j: number, d: number, h = 12) => rowNow(plan, k, j, (Y + d) * DAY + h * HOUR, FAIR_YEAR);
  assert.ok(k >= 0 && g >= 0 && n >= 6);
  assert.equal(row(0, 40).high, 0, "bare in the winter");
  assert.ok(row(0, 100).high > 0 && row(0, 100).high < CROP_HIGH.grain / 2, "sprouting");
  assert.ok(Math.abs(row(0, 190).high - CROP_HIGH.grain) < 1e-6, "grown");
  assert.equal(rowNow(plan, g, 0, (Y + 280) * DAY, FAIR_YEAR).high, 0, "the greens lifted");
  // Its reaping: the first row cut from its one side, the second back from the other.
  let day = working(plan, Y + r.from);
  const mid = rowNow(plan, k, 0, day * DAY + 13 * HOUR, FAIR_YEAR);
  assert.ok(
    mid.from > 0 && mid.from < 1 && mid.to === 1 && mid.stubble === STUBBLE,
    JSON.stringify(mid),
  );
  const share = (t: number) => reapedAt(plan, k, t);
  for (let t = day * DAY; t < (Y + r.to) * DAY; t += 3 * HOUR)
    assert.ok(share(t + 3 * HOUR) >= share(t));
  // (Through a whole row at least, on a later day: the next row cut back the other way.)
  while (share(day * DAY + 18 * HOUR) * n < 1.5) day++;
  const back = rowNow(plan, k, 1, day * DAY + 18 * HOUR, FAIR_YEAR);
  assert.ok(back.from === 0 && back.to < 1, JSON.stringify(back));
  // Reaped: stubble, then turned in.
  const done = row(0, r.to + 2);
  assert.ok(done.high === 0 && done.stubble === STUBBLE);
  assert.equal(row(0, 330).stubble, 0);
  // (None reaped on a day of rest.)
  const rest = Array.from({ length: r.to - r.from }, (_, i) => Y + r.from + i).find((d) =>
    restDay(plan, d),
  );
  if (rest !== undefined) assert.equal(share(rest * DAY + 9 * HOUR), share(rest * DAY + 17 * HOUR));
  // A dry year stands it short, and a blight withers the rows it takes.
  const dry = fieldsNow(villageOf({ rain: 0.5 }), (Y + 190) * DAY);
  assert.ok(rowNow(plan, k, 0, (Y + 190) * DAY, dry).high < 0.75 * CROP_HIGH.grain);
  const blight = { ...FAIR_YEAR, blight: 1 },
    taken = Array.from({ length: n }, (_, j) => j).filter((j) => blightedRow(plan, k, j, 1));
  assert.ok(taken.length > 0 && taken.length < n);
  for (const j of taken) assert.ok(rowNow(plan, k, j, (Y + 190) * DAY, blight).blighted);
});

test("its grain fields reaped one after another through the harvest weeks, none left over, a few at once", () => {
  const plan = villageOf(),
    reaped = reapingsOf(plan),
    { crop } = cropsOf(plan);
  reaped.forEach((r, k) => assert.equal(!!r, crop[k] === "grain"));
  for (let d = Math.ceil(0.6 * 365); d < Math.ceil(0.78 * 365); d++) {
    const n = reapingOn(plan, Y + d).length;
    assert.ok(n >= 1 && n <= 4, `day ${d}: ${n} fields reaped`);
  }
  assert.equal(reapingOn(plan, Y + 200).length, 0);
  // (A foraging people's grounds are not reaped.)
  assert.ok(reapingsOf(villageOf({}, { era: "forage" })).every((r) => r === null));
});

test("its reapers at the front of a field being reaped, going on along its rows with it; its stooks behind them", () => {
  const plan = villageOf(),
    ground = villageSolids(plan),
    k = reapingsOf(plan).findIndex((r) => r),
    day = working(plan, Y + reapingsOf(plan)[k]!.from + 1),
    town = townDay(plan, day, ground),
    at = town.roles.flatMap((r, i) => (r.kind === "reap" && r.place === k ? [i] : []));
  assert.ok(at.length >= 2, `${at.length} reaping field ${k}`);
  // Through the working day, its cutters right at its front, and the front gone on.
  let seen = 0;
  for (let h = 8.5; h < 17.5; h += 0.25) {
    const t = day * DAY + h * HOUR;
    for (const i of at) {
      const m = momentOf(plan, i, t),
        seat = town.roles[i]!.seat;
      if (m.task !== "reap" || seat > 1) continue;
      const p = cutPoint(plan, k, t, seat === 0 ? 0.5 : 1.5, seat === 0 ? -1 : 1)!;
      assert.ok(
        Math.hypot(m.x - p.x, m.z - p.z) < 2.5,
        `a reaper ${Math.hypot(m.x - p.x, m.z - p.z).toFixed(1)} m off the front`,
      );
      seen++;
    }
  }
  assert.ok(seen >= 10, `${seen} seen at the front`);
  assert.ok(reapedAt(plan, k, day * DAY + 17 * HOUR) > reapedAt(plan, k, day * DAY + 9 * HOUR));
  // Stooks behind them, more in a rich year than a poor; none before its reaping.
  const t = day * DAY + 16 * HOUR,
    stooks = stooksOf(plan, k, t, FAIR_YEAR),
    poor = stooksOf(plan, k, t, { ...FAIR_YEAR, growth: 0.5 });
  assert.ok(stooks.length > poor.length && poor.length > 0, `${stooks.length} / ${poor.length}`);
  assert.equal(stooksOf(plan, k, (Y + 150) * DAY, FAIR_YEAR).length, 0);
});

test("so many reap at each field's front, the rest carry in the sheaves of the fields reaped, their stooks thinning over the days after", () => {
  const plan = villageOf(),
    ground = villageSolids(plan),
    reaped = reapingsOf(plan);
  // (A working day with fields being reaped, and others reaped with their stooks standing.)
  let day = -1;
  for (let d = Math.ceil(0.6 * 365); d < Math.ceil(0.78 * 365) && day < 0; d++)
    if (!restDay(plan, Y + d) && reapingOn(plan, Y + d).length && stookedOn(plan, Y + d).length)
      day = Y + d;
  assert.ok(day > 0, "no day with fields being reaped and others reaped");
  const town = townDay(plan, day, ground),
    stooked = stookedOn(plan, day);
  for (const k of reapingOn(plan, day)) {
    const n = town.roles.filter((r) => r.kind === "reap" && r.place === k).length;
    assert.ok(n >= 2 && n <= REAPERS_AT, `${n} reaping field ${k}`);
  }
  const carters = town.roles.flatMap((r, i) => (r.kind === "cart" ? [i] : []));
  assert.ok(carters.length >= 1, "no one carrying in the sheaves");
  for (const i of carters) assert.ok(stooked.includes(town.roles[i]!.place));
  // Through the day: sheaves taken up in the reaped fields and carried in.
  let taking = 0,
    carrying = 0;
  for (let h = 8; h < 17.5; h += 0.1)
    for (const i of carters) {
      const m = momentOf(plan, i, day * DAY + h * HOUR),
        f = plan.fields[town.roles[i]!.place]!;
      if (m.why === "Taking up sheaves from the stooks") {
        assert.ok(
          Math.hypot(m.x - f.x, m.z - f.z) < Math.hypot(f.w, f.d) / 2 + 2,
          "taking up sheaves out of the field",
        );
        taking++;
      }
      if (m.why?.startsWith("Carrying the sheaves in")) carrying++;
    }
  assert.ok(taking > 0 && carrying > 0, `${taking} taking up, ${carrying} carrying`);
  // A field's stooks carried in over the days after its reaping, the first stood the first gone.
  const k = reaped.findIndex((r) => r),
    r = reaped[k]!,
    at = (d: number, h: number) => stooksOf(plan, k, (Y + r.to + d) * DAY + h * HOUR, FAIR_YEAR),
    all = at(0, 7),
    later = at(3, 12);
  assert.ok(all.length > 0 && at(1, 12).length < all.length && later.length < at(1, 12).length);
  assert.deepEqual(later, all.slice(all.length - later.length));
  assert.equal(at(STOOK_DAYS - 1, 18).length, 0, "all carried in");
  assert.equal(at(STOOK_DAYS, 12).length, 0);
});

test("in a dry year its farmers carry water out to the nearest fields; under a blight they pull it and burn it; in a fair year neither", () => {
  const day = working(villageOf(), Y + 165),
    roles = (plan: VillagePlan) => townDay(plan, day, villageSolids(plan)).roles,
    fair = villageOf(),
    dry = villageOf({ rain: 0.45 }),
    blighted = villageOf({ gift: -1, giftFrom: (Y + 100) * DAY });
  assert.ok(!roles(fair).some((r) => r.kind === "water" || r.kind === "pull"));
  // Water: filled at the well, poured along the parched rows of the fields it is carried to.
  const watered = wateredOn(dry, day, fieldsNow(dry, day * DAY + 12 * HOUR)),
    carriers = roles(dry).flatMap((r, i) => (r.kind === "water" ? [i] : []));
  assert.ok(watered.length >= 1 && carriers.length >= 5, `${carriers.length} carrying water`);
  const tasks = new Map<string, number>();
  for (let h = 8; h < 17; h += 0.1)
    for (const i of carriers) {
      const m = momentOf(dry, i, day * DAY + h * HOUR);
      if (m.task) tasks.set(m.task, (tasks.get(m.task) ?? 0) + 1);
      if (m.task === "water")
        assert.ok(
          watered.some((k) => {
            const f = dry.fields[k]!;
            return Math.hypot(m.x - f.x, m.z - f.z) < Math.hypot(f.w, f.d) / 2 + 2;
          }),
          "watering out of the fields",
        );
    }
  assert.ok(
    (tasks.get("water") ?? 0) > 0 && (tasks.get("fill") ?? 0) > 0,
    JSON.stringify([...tasks]),
  );
  // A blight: pulled from the fields it took, burned at their corners by day.
  const year = fieldsNow(blighted, day * DAY + 12 * HOUR),
    pulled = pulledOn(blighted, day, year),
    pullers = roles(blighted).flatMap((r, i) => (r.kind === "pull" ? [i] : []));
  assert.ok(pulled.length >= 1 && pullers.length >= 5, `${pullers.length} pulling`);
  let pulling = 0;
  for (let h = 8; h < 17; h += 0.25)
    for (const i of pullers)
      if (momentOf(blighted, i, day * DAY + h * HOUR).task === "pull") pulling++;
  assert.ok(pulling > 0);
  const fires = blightFires(blighted, day * DAY + 11 * HOUR, year);
  assert.deepEqual(
    fires.map((f) => f.field),
    pulled,
  );
  for (const f of fires) assert.deepEqual({ x: f.x, z: f.z }, burnSpot(blighted.fields[f.field]!));
  assert.equal(blightFires(blighted, day * DAY + 20 * HOUR, year).length, 0, "out by night");
});

test("the year in the fields told with the stores: parched, blighted, reaping", () => {
  assert.equal(fieldsWords(villageOf(), (Y + 150) * DAY), null);
  const dry = villageOf({ rain: 0.5, sent: -1, sentFrom: (Y - 30) * DAY });
  assert.match(
    fieldsWords(dry, (Y + 150) * DAY)!,
    /parched: the rain at 50% of its usual, the god withholding it/,
  );
  const blighted = villageOf({ gift: -1, giftFrom: (Y + 100) * DAY });
  assert.match(fieldsWords(blighted, (Y + 150) * DAY)!, /blight running through the crop/);
  const reaping = villageOf(),
    day = Y + reapingsOf(reaping).find((r) => r)!.from;
  assert.match(fieldsWords(reaping, day * DAY + 12 * HOUR)!, /being reaped/);
  const told = storesNow(blighted, (Y + 150) * DAY + 12 * HOUR);
  assert.equal(told.fields?.sign, "🥀 Blight");
});
