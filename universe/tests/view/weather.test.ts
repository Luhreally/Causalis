import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR } from "../../src/kernel/index.ts";
import {
  downpourAt,
  seasonAt,
  seasonTiles,
  warmthAt,
  weatherAt,
  weatherGrain,
  wetShare,
} from "../../src/view/index.ts";
import type { FrameMessage, LandSky } from "../../src/bridge/index.ts";

// Phase 30 M162: a land's weather, day by day, from its climate, this year's rain and the god's.

const land = (o: Partial<LandSky> = {}): LandSky => ({
  cell: 17,
  warmth: 12,
  swing: 10,
  wet: 800,
  year: 1,
  sent: 0,
  acts: [],
  ...o,
});
/** The weather of every spell of a year (watched hour by hour). */
const year = (l: LandSky, from = 0) =>
  Array.from({ length: 365 * 6 }, (_, i) => weatherAt(l, from + i * (DAY / 6) + DAY / 12, 3600));

test("showers as often as a land's rain falls: the wet the oftener, a dry year the seldomer", () => {
  const wet = (l: LandSky) => year(l).filter((w) => w.rain + w.snow > 0).length / (365 * 6);
  const desert = wet(land({ wet: 120, warmth: 24 })),
    temperate = wet(land({ wet: 800 })),
    rainforest = wet(land({ wet: 2600, warmth: 26, swing: 2 })),
    drought = wet(land({ wet: 800, year: 0.6 }));
  assert.ok(desert < 0.06, `desert ${desert}`);
  assert.ok(desert < temperate && temperate < rainforest, `${desert} ${temperate} ${rainforest}`);
  assert.ok(rainforest > 0.35, `rainforest ${rainforest}`);
  assert.ok(drought < temperate * 0.8, `a dry year ${drought} against ${temperate}`);
  assert.ok(Math.abs(wetShare(land({ wet: 800 })) - temperate) < 0.12, "as wet as its share");
});

test("snow in a cold land's winter, rain in its summer; the air warmest by day", () => {
  const cold = land({ warmth: 2, swing: 14, wet: 900 }),
    all = year(cold),
    winter = all.filter((_, i) => i / 6 < 40 || i / 6 > 325),
    summer = all.filter((_, i) => i / 6 > 150 && i / 6 < 215);
  assert.ok(
    winter.some((w) => w.snow > 0),
    "it snows in winter",
  );
  assert.ok(
    summer.every((w) => w.snow === 0),
    "no snow in summer",
  );
  assert.ok(
    summer.some((w) => w.rain > 0),
    "it rains in summer",
  );
  assert.ok(
    winter.some((w) => /snow|Sleet/i.test(w.words)) &&
      winter.some((w) => w.icon === "❄️" || w.icon === "🌨️"),
  );
  // (Midwinter the coldest of the year, mid-afternoon the warmest of the day.)
  assert.ok(warmthAt(cold, 0) < warmthAt(cold, YEAR / 2) - 20);
  assert.ok(warmthAt(cold, 180 * DAY + 0.62 * DAY) > warmthAt(cold, 180 * DAY + 0.12 * DAY));
});

test("the god's rain pours down where it is sent, and none falls where it is withheld", () => {
  const sent = year(land({ wet: 300, warmth: 22, sent: 1 })),
    withheld = year(land({ wet: 2400, sent: -1 }));
  const raining = sent.filter((w) => w.rain > 0).length / sent.length;
  assert.ok(raining > 0.8, `rain in ${raining} of the spells`);
  assert.ok(sent.filter((w) => w.rain > 0).every((w) => w.words === "Rain sent by your hand"));
  assert.ok(
    sent.filter((w) => w.rain > 0).every((w) => w.cloud > 0.6),
    "under a grey sky",
  );
  const dry = withheld.filter((w) => w.rain + w.snow > 0).length / withheld.length;
  assert.ok(dry < 0.06, `withheld, still wet in ${dry}`);
  // (A dry haze by day.)
  const noon = weatherAt(land({ sent: -1 }), 100 * DAY + DAY / 2, 3600);
  assert.ok(noon.haze > 0.5 && noon.words.startsWith("Dry"), noon.words);
});

test("the same land and moment, the same weather; told by the day or the season as the clock runs faster", () => {
  const l = land({ wet: 1400, warmth: 18 });
  for (const t of [3 * DAY, 40.3 * DAY, 211.7 * DAY])
    assert.deepEqual(weatherAt(l, t, 3600), weatherAt(l, t, 3600));
  assert.equal(weatherGrain(720), "spell");
  assert.equal(weatherGrain(3600), "spell");
  assert.equal(weatherGrain(DAY), "day");
  assert.equal(weatherGrain(30 * DAY), "season");
  // By the day: one sky the whole day, but for its turning into the next at the day's end.
  for (let d = 10; d < 40; d++) {
    const a = weatherAt(l, d * DAY + 0.05 * DAY, DAY),
      b = weatherAt(l, d * DAY + 0.75 * DAY, DAY);
    assert.equal(a.rain > 0, b.rain > 0, `day ${d}`);
    assert.ok(Math.abs(a.cloud - b.cloud) < 1e-9, `day ${d}`);
  }
  // By the season: no shower flickers by (only the god's rain falls), the sky as grey as the season.
  const season = Array.from({ length: 200 }, (_, i) => weatherAt(l, i * (YEAR / 60), YEAR));
  assert.ok(season.every((w) => w.rain === 0 && w.flash === 0));
  assert.ok(
    weatherAt(land({ sent: 1, warmth: 20 }), 5 * DAY, YEAR).rain > 0,
    "the god's rain falls at any pace",
  );
});

test("lightning in a warm land's storms, and only while the clock runs", () => {
  const l = land({ wet: 3000, warmth: 27, swing: 2, cell: 5 }),
    storms = year(l).filter((w) => w.words === "A thunderstorm");
  assert.ok(storms.length > 0, "storms come");
  let lit = 0;
  for (let i = 0; i < 2000; i++) {
    const t = i * (DAY / 6) + DAY / 12,
      w = weatherAt(l, t, 3600, i * 0.05);
    if (w.flash > 0) {
      lit++;
      assert.equal(w.words, "A thunderstorm");
    }
    assert.equal(weatherAt(l, t, 3600, null).flash, 0, "no flash while held");
  }
  assert.ok(lit > 0, "the storms flash");
});

test("the seasons on the ground: snow lies in a cold land's winter (on the hills first), the leaves turn and fall, still water freezes", () => {
  const cold = land({ warmth: 3, swing: 14, wet: 700 }),
    midwinter = 20 * DAY,
    midsummer = YEAR / 2 + 10 * DAY,
    autumn = 0.74 * YEAR;
  assert.ok(seasonAt(cold, midwinter).snow > 0.5, "snow lies in midwinter");
  assert.equal(seasonAt(cold, midsummer).snow, 0, "none in summer");
  assert.ok(seasonAt(cold, midwinter).ice > 0, "ice on still water");
  assert.equal(seasonAt(cold, midsummer).ice, 0);
  // (Late in autumn the hills are white while the lowland is not yet.)
  const late = 0.86 * YEAR;
  assert.ok(seasonAt(cold, late, 1500).snow > seasonAt(cold, late).snow, "the hills first");
  // The broad leaves: full in summer, turned in autumn, bare in winter; a hot land's never.
  const mild = land({ warmth: 10, swing: 10, wet: 800 });
  assert.equal(seasonAt(mild, midsummer).leaf, 1);
  assert.equal(seasonAt(mild, midsummer).turned, 0);
  assert.ok(seasonAt(mild, autumn).turned > 0.4 && seasonAt(mild, autumn).leaf > 0, "turned");
  assert.ok(seasonAt(mild, midwinter).leaf < 0.2, "bare");
  const hot = land({ warmth: 26, swing: 2, wet: 2400 });
  for (let d = 0; d < 365; d += 30) {
    const s = seasonAt(hot, d * DAY);
    assert.deepEqual([s.snow, s.leaf, s.turned, s.ice], [0, 1, 0, 0]);
  }
  // (A cold desert: too dry for snow to lie.)
  assert.equal(seasonAt(land({ warmth: -6, swing: 14, wet: 20 }), midwinter).snow, 0);
  // (Unless the god sends its snows: then they lie as on a wet land.)
  assert.ok(seasonAt(land({ warmth: -6, swing: 14, wet: 20, sent: 1 }), midwinter).snow > 0.8);
});

test("a land's map in its winter: snow on its hills before its lowlands, ice on its lakes, the sea open", () => {
  // Four tiles: a lowland, a hill, a lake, the sea.
  const frame = {
      kind: "frame",
      view: "region",
      seq: 0,
      t: 0,
      meta: {},
      arrays: {
        elevation: new Float32Array([100, 1900, 100, -50]),
        water: new Uint8Array([0, 0, 3, 1]),
      },
    } as unknown as FrameMessage,
    colors = new Uint8Array([
      60, 140, 50, 255, 90, 120, 70, 255, 40, 90, 160, 255, 30, 70, 150, 255,
    ]),
    cold = land({ warmth: 2, swing: 12, wet: 600 }),
    late = seasonTiles(colors, frame, cold, 0.87 * YEAR),
    deep = seasonTiles(colors, frame, cold, 15 * DAY);
  assert.deepEqual([...colors.slice(0, 4)], [60, 140, 50, 255], "the colours given are left be");
  const white = (c: Uint8Array, i: number) => (c[i * 4]! + c[i * 4 + 1]! + c[i * 4 + 2]!) / 3;
  assert.ok(white(late, 1) > white(late, 0) + 20, "the hill white before the lowland");
  assert.ok(white(deep, 0) > 200 && white(deep, 1) > 200, "all white in deep winter");
  assert.ok(white(deep, 2) > white(colors, 2) + 40, "the lake frozen");
  assert.deepEqual([...deep.slice(12, 16)], [30, 70, 150, 255], "the sea open");
  assert.deepEqual(seasonTiles(colors, frame, cold, YEAR / 2), colors, "summer: as it is");
});

test("a downpour's span: heavy rain all through it, none heavy outside it; the god's rain pours", () => {
  const wet = land({ wet: 1800, warmth: 16, swing: 4 }),
    spell = DAY / 6,
    heavy = (t: number) => {
      const w = weatherAt(wet, t, 3600);
      return w.rain + w.snow;
    };
  let spans = 0;
  for (let k = 0; k < 365 * 6; k++) {
    // (The core of each spell, clear of the turnings either side of it.)
    const t = k * spell + spell * 0.45,
      d = downpourAt(wet, t, 3600);
    if (!d) {
      assert.ok(heavy(t) < 0.5, `light or dry at ${t}: ${heavy(t)}`);
      continue;
    }
    spans++;
    assert.ok(d.from <= t && t < d.to, "about the moment asked");
    // From the first heavy spell's start to the last's turning, it pours throughout.
    for (let u = d.from + spell * 0.09; u < d.to - spell * 0.09; u += spell / 8)
      assert.ok(heavy(u) >= 0.5 - 1e-9, `pouring at ${u}: ${heavy(u)}`);
    assert.deepEqual(downpourAt(wet, (d.from + d.to) / 2, 3600), d, "the same span throughout");
  }
  assert.ok(spans > 100, `${spans} spells in a downpour in a wet land's year`);
  // By the day (a day or so a second), a wet day is a downpour all day.
  const days = Array.from({ length: 365 }, (_, i) => downpourAt(wet, i * DAY + DAY / 2, DAY));
  assert.ok(days.some((d) => d && d.to - d.from >= DAY));
  // The god's rain: most spells pour; withheld, none.
  const sent = land({ sent: 1 }),
    poured = Array.from({ length: 600 }, (_, i) =>
      downpourAt(sent, i * spell + spell * 0.45, 3600),
    );
  assert.ok(poured.filter(Boolean).length > 450, `${poured.filter(Boolean).length} of 600`);
  assert.deepEqual(downpourAt(sent, 5 * DAY, 30 * DAY), { from: -Infinity, to: Infinity });
  assert.equal(
    Array.from({ length: 600 }, (_, i) =>
      downpourAt(land({ sent: -1 }), i * spell + spell * 0.45, 3600),
    ).filter(Boolean).length,
    0,
  );
  assert.equal(downpourAt(land(), 5 * DAY, 30 * DAY), null, "by the season, only the god's rain");
});
