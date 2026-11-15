// A world warmed or cooled by the god's hand (asked 2026-11-14: "heat or cool the world ... make more habitable land
// sometimes"), read for its pages and the globe: how far its ground has turned, how long is left, and what that has
// done to the land its people can live on and farm, against the world as it was made. Pure reads; nothing where no god
// has warmed the world.
import { yearOfMoment, type World } from "../../kernel/index.ts";
import { planetRef } from "../../gen/index.ts";
import {
  EVER,
  GROUND,
  biomeUnder,
  groundWarming,
  greatActsOf,
  homePlanet,
  livableFor,
  populationContext,
  provinceCapacity,
  support,
  warmDegrees,
  warmingAct,
} from "../../sim/index.ts";
import type { Block, Stat, WarmthMap } from "../../bridge/index.ts";
import { link, stat } from "./words.ts";

/** What the god's warming or cooling has come to on the home world. */
export type WarmthRead = {
  /** The degrees asked (signed), and the degrees the ground has turned so far. */
  readonly asked: number;
  readonly ground: number;
  readonly from: number;
  /** The year it lifts (null: laid for good); whether it has lifted already and the ground is easing back. */
  readonly until: number | null;
  readonly lifted: boolean;
  readonly event: string;
  /** Lands its people can live on, and the people its lands could feed, as the world was made and now. */
  readonly livable: { readonly made: number; readonly now: number };
  readonly feeds: { readonly made: number; readonly now: number };
  readonly opened: number;
  readonly closed: number;
};

const many = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const degrees = (d: number) => {
  const n = Math.abs(d),
    words = n === 1 ? "a degree" : n === 1.5 ? "a degree and a half" : `${n} degrees`;
  return d === 0 ? "not at all" : `${words} ${d > 0 ? "warmer" : "colder"}`;
};

const READ = new WeakMap<World, { key: string; read: WarmthRead }>();

/** The god's warming of the home world as it stands (null: none was ever laid, or its ground has eased all the way back). */
export function warmthRead(world: World): WarmthRead | null {
  if (!greatActsOf(world)?.all().length) return null;
  const planet = planetRef(0),
    a = warmingAct(world, planet);
  if (!a) return null;
  const ground = groundWarming(world, planet),
    lifted = world.now >= a.until;
  if (lifted && !ground) return null;
  const key = `${a.event}:${ground}:${lifted}`,
    kept = READ.get(world);
  if (kept?.key === key) return kept.read;
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    sows = ctx.provinces.all().some((p) => p.knowsCultivation);
  let made = 0,
    now = 0,
    opened = 0,
    closed = 0,
    fedMade = 0,
    fedNow = 0;
  for (let c = 0; c < g.offworld.base; c++) {
    const was = livableFor(ctx, c, 0),
      is = livableFor(ctx, c, ground);
    if (was) made++;
    if (is) now++;
    if (is && !was) opened++;
    if (was && !is) closed++;
    if (was) fedMade += support(provinceCapacity(ctx, c, 0), sows);
    if (is) fedNow += support(provinceCapacity(ctx, c, ground), sows);
  }
  const read: WarmthRead = {
    asked: a.sign * warmDegrees(a.strength),
    ground,
    from: yearOfMoment(a.from),
    until: a.until - a.from >= EVER ? null : yearOfMoment(a.until),
    lifted,
    event: a.event,
    livable: { made, now },
    feeds: { made: Math.round(fedMade), now: Math.round(fedNow) },
    opened,
    closed,
  };
  READ.set(world, { key, read });
  return read;
}

const TURNED = new WeakMap<World, { warm: number; turned: number[] }>();
/**
 * What the globe needs to draw a warmed world's ground: the degrees it has turned (0: as it was made), and, where the
 * asker does not have them for those degrees already, the spots whose biome has turned and what to (spot, biome, spot,
 * biome ...), by the rule the sim's own lands turn by.
 */
export function warmthMap(world: World, have?: number): WarmthMap {
  const warm = greatActsOf(world)?.all().length ? groundWarming(world, planetRef(0)) : 0;
  if (!warm || have === warm) return { warm };
  let kept = TURNED.get(world);
  if (kept?.warm !== warm) {
    const g = homePlanet(world).generated.fine,
      turned: number[] = [];
    for (let c = 0; c < g.grid.count; c++) {
      const b = biomeUnder(g, c, warm);
      if (b !== g.climate.biome[c]) turned.push(c, b);
    }
    TURNED.set(world, (kept = { warm, turned }));
  }
  return { warm, turned: kept.turned };
}

/** The god's warming of the world, on its page and on the act's: what was asked, how far the ground has come, what it did. */
export function warmthBlocks(world: World): Block[] {
  const r = warmthRead(world);
  if (!r) return [];
  const year = yearOfMoment(world.now),
    left = r.until === null ? null : r.until - year,
    turning = Math.abs(r.ground) < Math.abs(r.asked) && !r.lifted,
    change = (now: number, made: number) =>
      now === made
        ? "as many as before"
        : `${many(Math.abs(now - made))} ${now > made ? "more" : "fewer"} than as it was made`,
    rows: Stat[] = [
      stat(
        "Asked",
        `The whole world ${degrees(r.asked)}, ${r.until === null ? "for good" : `until year ${r.until}`}`,
      ),
      stat(
        "How long is left",
        r.lifted
          ? "It has lifted: the ground is easing back to what it was."
          : left === null
            ? "It does not lift."
            : `${many(Math.max(0, left))} year${left === 1 ? "" : "s"}`,
      ),
      stat(
        "Its ground now",
        `${degrees(r.ground)}${turning ? `: ice, woods and grass follow the air over ${GROUND.years} years` : ""}`,
      ),
      stat(
        "Lands that can be lived on",
        `${many(r.livable.now)}, ${change(r.livable.now, r.livable.made)} (${many(r.livable.made)}): ${many(r.opened)} opened, ${many(r.closed)} closed`,
      ),
      stat(
        "People its lands could feed",
        `${many(r.feeds.now)}, ${change(r.feeds.now, r.feeds.made)} (${many(r.feeds.made)})`,
      ),
    ];
  return [
    {
      type: "text",
      title: r.asked > 0 ? "🌡️ Warmed by the god's hand" : "❄️ Cooled by the god's hand",
      lines: [
        [
          link(`Laid in year ${r.from}`, r.event),
          ": its rain moves and its hot fields yield less at once; its ice, tundra, woods and deserts follow over a generation, by the rule that named them when the world was made. Land that thaws or greens can be lived on and farmed; land that freezes or dries cannot.",
        ],
      ],
    },
    { type: "facts", title: "What it has done", rows },
  ];
}
