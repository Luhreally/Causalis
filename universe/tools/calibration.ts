// node tools/calibration.ts [years] [seed]
// The calibration report (docs/architecture §I.3, M34): on the Earth seed ("first
// light" under the Earthlike prior, as the app opens), the year each turning point of
// the chronicle first comes — sowing, the first state, writing, iron, coal, steam, the
// factory — and, century by century, how many people the planet holds, its realms and
// wars, its tongues, and the air; each against the band it should fall in.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { airOf, languagesOf, politiesOf, populationContext, warsOf } from "../src/sim/index.ts";
import { BANDS, TURNS, type Turn } from "./calibration-bands.ts";

const years = Number(process.argv[2] ?? 900),
  seed = process.argv[3] ?? "first light";

/** The year a turning point first came, found from the events of each year as it passes. */
export function watchTurns(): {
  seen: Map<Turn, number>;
  step: (world: ReturnType<typeof EARTH.build>, year: number) => void;
} {
  const seen = new Map<Turn, number>();
  return {
    seen,
    step(world, year) {
      const events = world.events.all(),
        start = (year - 1) * YEAR;
      for (let i = events.length - 1; i >= 0 && events[i]!.t >= start; i--) {
        const e = events[i]!,
          principle = (e.data as { principle?: string } | null)?.principle;
        for (const turn of TURNS)
          if (
            !seen.has(turn.id) &&
            (turn.event === e.type || (principle && turn.principle === principle))
          )
            seen.set(turn.id, year);
      }
    },
  };
}

export type Century = {
  year: number;
  people: number;
  realms: number;
  wars: number;
  languages: number;
  carbon: number;
  warming: number;
  /** Famines and lands that broke from their realms, this century. */
  famines: number;
  secessions: number;
};

/** The planet at a century's close: its people, realms, the wars of the century, tongues and air. */
export function century(world: ReturnType<typeof EARTH.build>, year: number): Century {
  const ctx = populationContext(world),
    langs = languagesOf(world),
    speakers = langs.speakers();
  let people = 0;
  for (const p of ctx.provinces.all()) people += p.total();
  const air = airOf(world).air,
    since = (year - 100) * YEAR,
    told = (type: string) => {
      let n = 0;
      const events = world.events.all();
      for (let i = events.length - 1; i >= 0 && events[i]!.t >= since; i--)
        if (events[i]!.type === type) n++;
      return n;
    };
  return {
    year,
    people,
    realms: politiesOf(world).living().length,
    wars: warsOf(world)
      .all()
      .filter((w) => w.declared > year - 100 && w.declared <= year).length,
    languages: langs.all().filter((l) => l.died === null && speakers.get(l.index)?.length).length,
    carbon: air.carbon,
    warming: air.warming,
    famines: told("people.famine"),
    secessions: told("polity.seceded"),
  };
}

if (import.meta.main) {
  const world = EARTH.build(seedFromText(seed)),
    turns = watchTurns(),
    centuries: Century[] = [],
    t0 = performance.now();
  for (let y = 1; y <= years; y++) {
    world.runTo(y * YEAR);
    turns.step(world, y);
    if (y % 100 === 0) {
      const c = century(world, y);
      centuries.push(c);
      console.log(
        `year ${y}: ${(c.people / 1e6).toFixed(1)}M people, ${c.realms} realms, ${c.wars} wars this century, ${c.languages} tongues, ${c.famines} famines, ${c.secessions} secessions, ${c.carbon.toFixed(0)} ppm (${c.warming.toFixed(2)} °C)  [${((performance.now() - t0) / 1000).toFixed(0)} s]`,
      );
    }
  }
  console.log("");
  let out = 0;
  for (const turn of TURNS) {
    const at = turns.seen.get(turn.id),
      [lo, hi] = turn.band,
      ok = at !== undefined ? at >= lo && at <= hi : years < lo;
    if (!ok) out++;
    console.log(
      `${ok ? "  " : "✗ "}${turn.name.padEnd(22)} ${at === undefined ? "not yet" : `year ${at}`}  (band ${lo}–${hi})`,
    );
  }
  for (const band of BANDS) {
    const c = centuries.find((x) => x.year === band.year);
    if (!c) continue;
    const v = band.measure(c),
      ok = v >= band.band[0] && v <= band.band[1];
    if (!ok) out++;
    console.log(
      `${ok ? "  " : "✗ "}${band.name.padEnd(22)} ${band.words(v)} at year ${band.year}  (band ${band.words(band.band[0])}–${band.words(band.band[1])})`,
    );
  }
  console.log(out ? `\n${out} outside their bands` : "\nall within their bands");
}
