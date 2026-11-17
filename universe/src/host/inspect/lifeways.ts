// A realm's life as its people live it (asked 2026-11-16: "make the culture tab have more life or fun facts or some lol"): one
// reading of what the world already keeps of each realm (its lands' table, dress, rest, care and roles rows; its ways; its works,
// learning, temples, word and law; its crop and herds; its houses and groups), summed over its lands by their people, and the same
// for every realm standing beside it, so a realm can be set against its world. Nothing here is kept in the world and nothing is
// drawn: every word is a store's value read, and a reading with nothing behind it in a realm is left out. Read once a page is read,
// and kept for the world's moment (the world's realms read together, a few rows a land).
import { YEAR, type World } from "../../kernel/index.ts";
import {
  GAMES,
  KEEPING_MEANS,
  SENSE_ARTS,
  WAY_TRAITS,
  gamesIn,
  type Game,
  type KeepingMean,
  type Sense,
} from "../../rules/index.ts";
import {
  BAR_STORE,
  CARE_ROW,
  CARE_STORE,
  DRESS_ROW,
  DRESS_STORE,
  LAW_ROW,
  LAW_STORE,
  LEISURE_ROW,
  LEISURE_STORE,
  OLD_ROW,
  OLD_STORE,
  ROLE_ROW,
  ROLES_STORE,
  SHARE,
  SHARES_STORE,
  TABLE,
  TABLE_STORE,
  academyOf,
  artOf,
  barredOf,
  beliefOf,
  cultureOf,
  homePlanet,
  housesOf,
  kindName,
  loreOf,
  moneyStore,
  orgsOf,
  politiesOf,
  populationContext,
  realmFolk,
  societyStore,
  templeOf,
  voiceOf,
  warsOf,
  type Faith,
  type Org,
  type Polity,
} from "../../sim/index.ts";

/** The kinds of group that are a people's culture: its faith's orders and sects, its learned, its lodges and parties. */
export const CULTURE_GROUPS: ReadonlySet<string> = new Set([
  "confraternity",
  "sect",
  "hidden sect",
  "lodge",
  "party",
  "monastic order",
  "learned society",
]);

/** A realm's life, read: each part null where none of its lands keeps it. Shares 0 … 1, days and hours as days and hours. */
export type Life = {
  readonly r: Polity;
  readonly people: number;
  /** What they eat (shares of their food) and how far each means keeps it; what all of them spare of its spoiling. */
  readonly table: {
    readonly grain: number;
    readonly meat: number;
    readonly wild: number;
    readonly means: Readonly<Record<KeepingMean, number>>;
    readonly kept: number;
  } | null;
  /** The warmth they need of clothes, their own coat's, what clothes are made of, how far they show who one is, dyed. */
  readonly dress: {
    readonly need: number;
    readonly coat: number;
    readonly wool: number;
    readonly hides: number;
    readonly fibre: number;
    readonly display: number;
    readonly dyed: number;
  } | null;
  /** Their working day (hours), holy and feast days a year, the share of their people who play each game. */
  readonly rest: {
    readonly hours: number;
    readonly holy: number;
    readonly feasts: number;
    readonly games: Readonly<Record<Game, number>>;
  } | null;
  /** Healers in a thousand, the share tended when sick, by the temple's alms, by the realm, near a hospital. */
  readonly care: {
    readonly healers: number;
    readonly access: number;
    readonly alms: number;
    readonly publicCare: number;
    readonly hospitals: number;
  } | null;
  /** Of their frail, the share kept by kin, the temple, savings, a pension; kept by no one. */
  readonly old: {
    readonly kin: number;
    readonly temple: number;
    readonly savings: number;
    readonly pension: number;
    readonly neglected: number;
  } | null;
  /** A bearer's work beyond the home against another's; what the fields ask of strength; bearers among those who rule. */
  readonly roles: {
    readonly norm: number;
    readonly strength: number;
    readonly rule: number;
  } | null;
  /** Their ways (WAY_TRAITS order, 0 … 1). */
  readonly ways: readonly number[] | null;
  /** The share of their people learned past their letters. */
  readonly learned: number | null;
  /** Their works: all their lands' kept and made a year (work-years), the renown of their most renowned land and its makers. */
  readonly art: {
    readonly works: number;
    readonly made: number;
    readonly renown: number;
    readonly court: number;
    readonly clergy: number;
    readonly form: string;
    readonly stuff: string;
    readonly cell: number;
  } | null;
  readonly voice: ReturnType<typeof voiceOf>;
  readonly folk: { readonly kin: number; readonly nation: number } | null;
  readonly faith: Faith | null;
  readonly temple: ReturnType<typeof templeOf>;
  readonly law: { readonly written: number; readonly courts: number } | null;
  /** How far it forbids what calms, wakes and eases (null: it weighs none). */
  readonly barred: number | null;
  /** The wars it fought, and its fallen in those of the last thirty years. */
  readonly wars: number;
  readonly fallen: number;
  /** The house that holds its seat, and its oldest great house (each since the year it rose). */
  readonly crown: { readonly name: string; readonly since: number; readonly event: string } | null;
  readonly eldest: { readonly name: string; readonly since: number; readonly event: string } | null;
  /** How many great houses it has; the share of what its seat hands out as favours. */
  readonly houses: number;
  readonly favours: number | null;
  /** The share of wealth its richest tenth holds, as its lands keep it (null: none kept). */
  readonly top: number | null;
  /** Its people's groups of faith, learning and party. */
  readonly groups: readonly Org[];
  /** Whether its seat writes, and how many things its seat knows. */
  readonly writes: boolean;
  readonly lore: number;
  /** Its seat land's share fed in its leanest month (0 … 1). */
  readonly leanest: number;
};

/** The first sense of a world's people (sight where none is known). */
export function firstSense(world: World): Sense {
  return (homePlanet(world).generated.life.people?.body.senses[0] ?? "sight") as Sense;
}

/** A sum weighed by people: add values, read their mean (null where none was added). */
class Weighed {
  private n = 0;
  private readonly sums: number[];
  constructor(size: number) {
    this.sums = new Array<number>(size).fill(0);
  }
  add(w: number, values: readonly number[]): void {
    if (w <= 0) return;
    this.n += w;
    for (let i = 0; i < this.sums.length; i++) this.sums[i]! += w * (values[i] ?? 0);
  }
  mean(): number[] | null {
    return this.n > 0 ? this.sums.map((s) => s / this.n) : null;
  }
}

function readLife(world: World, r: Polity, warsOfRealm: { wars: number; fallen: number }): Life {
  const ctx = populationContext(world),
    table = societyStore(world, TABLE_STORE),
    dress = societyStore(world, DRESS_STORE),
    rest = societyStore(world, LEISURE_STORE),
    care = societyStore(world, CARE_STORE),
    old = societyStore(world, OLD_STORE),
    roles = societyStore(world, ROLES_STORE),
    shares = moneyStore(world, SHARES_STORE),
    culture = world.hasStore("culture.ways") ? cultureOf(world) : null,
    sums = {
      table: new Weighed(10),
      dress: new Weighed(8),
      rest: new Weighed(3 + GAMES.length),
      care: new Weighed(5),
      old: new Weighed(5),
      roles: new Weighed(3),
      ways: new Weighed(WAY_TRAITS.length),
      learned: new Weighed(1),
      top: new Weighed(1),
    };
  let people = 0,
    works = 0,
    made = 0,
    best: { renown: number; cell: number; a: NonNullable<ReturnType<typeof artOf>> } | null = null;
  for (const c of r.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    if (n <= 0) continue;
    people += n;
    const t = table?.get(c),
      d = dress?.get(c),
      s = rest?.get(c),
      k = care?.get(c),
      o = old?.get(c),
      ro = roles?.get(c);
    if (t) sums.table.add(n, t);
    if (d) sums.dress.add(n, d);
    if (s) {
      const on = new Set(gamesIn(s[LEISURE_ROW.games]!));
      sums.rest.add(n, [
        s[LEISURE_ROW.hours]! / 10,
        s[LEISURE_ROW.holy]!,
        s[LEISURE_ROW.feasts]!,
        ...GAMES.map((g) => (on.has(g) ? 1 : 0)),
      ]);
    }
    if (k)
      sums.care.add(n, [
        k[CARE_ROW.healers]! / 10,
        k[CARE_ROW.access]! / 1000,
        k[CARE_ROW.alms]! / 1000,
        k[CARE_ROW.publicCare]! / 1000,
        k[CARE_ROW.hospitals]! / 1000,
      ]);
    if (o)
      sums.old.add(
        n,
        [OLD_ROW.kin, OLD_ROW.temple, OLD_ROW.savings, OLD_ROW.pension, OLD_ROW.neglected].map(
          (i) => o[i]! / 1000,
        ),
      );
    if (ro)
      sums.roles.add(
        n,
        [ROLE_ROW.norm, ROLE_ROW.strength, ROLE_ROW.rule].map((i) => ro[i]! / 1000),
      );
    const ways = culture?.get(c)?.traits;
    if (ways) sums.ways.add(n, ways);
    const ac = academyOf(world, c);
    if (ac) sums.learned.add(n, [ac.learned]);
    const top = shares?.get(c);
    if (top) sums.top.add(n, [top[SHARE.top]! / 1000]);
    const a = artOf(world, c);
    if (a && a.works > 0) {
      works += a.works;
      made += a.made;
      if (!best || a.renown > best.renown) best = { renown: a.renown, cell: c, a };
    }
  }
  const t = sums.table.mean(),
    d = sums.dress.mean(),
    s = sums.rest.mean(),
    k = sums.care.mean(),
    o = sums.old.mean(),
    ro = sums.roles.mean(),
    folk = realmFolk(ctx, r),
    beliefs = world.hasStore("belief.faiths") ? beliefOf(world) : null,
    faithRef = beliefs?.of(r.seat).faith ?? null,
    faith = faithRef ? (beliefs!.get(faithRef) ?? null) : null,
    law = societyStore(world, LAW_STORE)?.get(r.ref),
    houses = housesOf(world)?.of(r.ref),
    crown = houses?.houses.find((h) => h.crown) ?? null,
    eldest =
      [...(houses?.houses ?? [])].sort((a, b) => a.since - b.since || a.id - b.id)[0] ?? null,
    lore = world.hasStore("lore.known") ? loreOf(world) : null,
    barred = moneyStore(world, BAR_STORE)?.get(r.ref) ? barredOf(world, r.ref) : null;
  return {
    r,
    people,
    table: t
      ? {
          grain: t[TABLE.grain]! / 1000,
          meat: t[TABLE.meat]! / 1000,
          wild: t[TABLE.wild]! / 1000,
          means: Object.fromEntries(
            KEEPING_MEANS.map((m, i) => [m, t[TABLE.means + i]! / 1000]),
          ) as Record<KeepingMean, number>,
          kept: t[TABLE.kept]! / 1000,
        }
      : null,
    dress: d
      ? {
          need: d[DRESS_ROW.need]! / 1000,
          coat: d[DRESS_ROW.coat]! / 1000,
          wool: d[DRESS_ROW.wool]! / 1000,
          hides: d[DRESS_ROW.hides]! / 1000,
          fibre: d[DRESS_ROW.fibre]! / 1000,
          display: d[DRESS_ROW.display]! / 1000,
          dyed: d[DRESS_ROW.dyed]!,
        }
      : null,
    rest: s
      ? {
          hours: s[0]!,
          holy: s[1]!,
          feasts: s[2]!,
          games: Object.fromEntries(GAMES.map((g, i) => [g, s[3 + i]!])) as Record<Game, number>,
        }
      : null,
    care: k
      ? { healers: k[0]!, access: k[1]!, alms: k[2]!, publicCare: k[3]!, hospitals: k[4]! }
      : null,
    old: o ? { kin: o[0]!, temple: o[1]!, savings: o[2]!, pension: o[3]!, neglected: o[4]! } : null,
    roles: ro ? { norm: ro[0]!, strength: ro[1]!, rule: ro[2]! } : null,
    ways: sums.ways.mean(),
    learned: sums.learned.mean()?.[0] ?? null,
    art: best
      ? {
          works,
          made,
          renown: best.a.renown,
          court: best.a.court,
          clergy: best.a.clergy,
          form: best.a.form,
          stuff: best.a.stuff,
          cell: best.cell,
        }
      : null,
    voice: voiceOf(world, r.ref),
    folk: folk.weighed > 0 ? { kin: folk.kin, nation: folk.nation } : null,
    faith,
    temple: faith ? templeOf(world, faith) : null,
    law: law
      ? { written: law[LAW_ROW.written]! / 1000, courts: law[LAW_ROW.courts]! / 1000 }
      : null,
    barred,
    wars: warsOfRealm.wars,
    fallen: warsOfRealm.fallen,
    crown: crown ? { name: crown.name, since: crown.since, event: crown.event } : null,
    eldest: eldest ? { name: eldest.name, since: eldest.since, event: eldest.event } : null,
    houses: houses?.houses.length ?? 0,
    favours: houses ? houses.favours / 1000 : null,
    top: sums.top.mean()?.[0] ?? null,
    groups: (orgsOf(world)?.of(r.ref)?.orgs ?? []).filter((g) => CULTURE_GROUPS.has(kindName(g))),
    writes: !!lore?.get(r.seat, "writing"),
    lore: lore ? lore.of(r.seat).length : 0,
    leanest: (ctx.provinces.get(r.seat)?.leanest ?? 1000) / 1000,
  };
}

type Kept = { readonly key: string; readonly lives: ReadonlyMap<string, Life> };
const KEPT = new WeakMap<World, Kept>();

/** Every standing realm's life, read once for the world's moment. */
export function worldLives(world: World): ReadonlyMap<string, Life> {
  const key = `${world.now}:${world.events.count}`,
    kept = KEPT.get(world);
  if (kept?.key === key) return kept.lives;
  const wars = new Map<string, { wars: number; fallen: number }>(),
    now = Math.floor(world.now / YEAR),
    tally = (ref: string, fallen: number, recent: boolean) => {
      const w = wars.get(ref) ?? { wars: 0, fallen: 0 };
      w.wars++;
      if (recent) w.fallen += fallen;
      wars.set(ref, w);
    };
  for (const w of warsOf(world).all()) {
    const recent = (w.ended ?? now) >= now - 30;
    tally(w.attacker, w.fallen[0], recent);
    tally(w.defender, w.fallen[1], recent);
  }
  const lives = new Map<string, Life>();
  for (const r of politiesOf(world).living())
    lives.set(r.ref, readLife(world, r, wars.get(r.ref) ?? { wars: 0, fallen: 0 }));
  KEPT.set(world, { key, lives });
  return lives;
}

/** A realm's life: from the world's reading where it stands, else read alone (a realm fallen). */
export function lifeOf(world: World, r: Polity): Life {
  return worldLives(world).get(r.ref) ?? readLife(world, r, { wars: 0, fallen: 0 });
}

/** What a sense makes of works (rules/art.ts), for a people who make none yet. */
export function senseArt(sense: Sense): string {
  return SENSE_ARTS[sense];
}
