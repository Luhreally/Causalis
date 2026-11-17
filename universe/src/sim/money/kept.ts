// What Round B keeps (money and the state), and what the older systems read of it. Each system keeps one store of fixed rows of
// whole numbers, a land's or a realm's, last reckoned only (a faded sum where it needs the past), hashed by a running digest of every
// row set and dormant while it holds nothing. This file reaches only the kernel, so the economy, the realms and the order can read
// it without a circle.
import { Hasher, dmath, type StateStore, type World } from "../../kernel/index.ts";
import { TREASURY, insuredGain } from "../../rules/index.ts";

/** A realm's ref as a whole number a row can hold (its serial: refs are "kind:space:serial"). */
export function refNumber(ref: string): number {
  const n = Number(ref.split(":").at(-1));
  return Number.isFinite(n) ? n : 0;
}

/** How much of the way toward a target a pace a year goes in `span` years. */
export const stepped = (pace: number, span: number) => 1 - dmath.pow(1 - pace, span);

/**
 * A realm reckons what it lays on trade and what it forbids (its tariff and sanctions, its bar and excise) once in this many
 * years, in its turn (by its ref's number and the year), and moves as far as those years would have moved it: a law of that
 * kind is argued and passed over years, not each one. What it takes, and what slips past it, stand as last reckoned between.
 * A realm not yet reckoned reckons at once.
 */
export const LAWS_EVERY = 5;
/** Whether a realm reckons its laws on trade this year (LAWS_EVERY). */
export const lawTurn = (p: { readonly ref: string }, year: number): boolean =>
  (refNumber(p.ref) + year) % LAWS_EVERY === 0;

/** Fold whole numbers into a running digest (two 32-bit words). */
function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

/** A store of rows of whole numbers, each a land's (keyed by its cell) or a realm's (by its ref), of one fixed width. */
export class RowStore implements StateStore {
  readonly name: string;
  readonly width: number;
  private readonly rows = new Map<string, number[]>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;
  constructor(name: string, width: number) {
    this.name = name;
    this.width = width;
  }
  get(key: string | number): readonly number[] | undefined {
    return this.rows.get(String(key));
  }
  /** One number of a row (0 where it is not kept). */
  at(key: string | number, i: number): number {
    return this.rows.get(String(key))?.[i] ?? 0;
  }
  set(key: string | number, row: readonly number[]): void {
    const r = new Array<number>(this.width);
    for (let i = 0; i < this.width; i++) {
      const x = row[i] ?? 0;
      r[i] = Number.isFinite(x) ? Math.round(x) : 0;
    }
    const k = String(key);
    this.rows.set(k, r);
    fold(this.digest, [this.sets & 0xffff, k.length, ...r]);
    this.sets++;
  }
  drop(key: string | number): void {
    this.rows.delete(String(key));
  }
  keys(): string[] {
    return [...this.rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  get size(): number {
    return this.rows.size;
  }
  dormant(): boolean {
    return this.rows.size === 0 && this.sets === 0;
  }
  hashInto(h: Hasher): void {
    h.int(this.rows.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return {
      rows: this.keys().map((k) => [k, ...this.rows.get(k)!]),
      digest: [...this.digest],
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.rows.clear();
    const s = state as {
      rows?: (string | number)[][];
      digest?: [number, number];
      sets?: number;
    } | null;
    for (const r of s?.rows ?? []) {
      const [k, ...xs] = r;
      this.rows.set(
        String(k),
        xs.map((x) => Number(x)),
      );
    }
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

// —— The stores, and the place of each number in their rows ————————————————————————————————————————————————

/** 1. A land's goods' worth (thousandths of grain), by GOODS; and on what each rests, PRICE_BASES places in base 6, seven goods a number. */
export const GOODS_STORE = "money.goods";
/** 2. A realm's money. */
export const COIN_STORE = "money.coin";
export const COIN = {
  form: 0,
  good: 1,
  /** Metal in a coin, millionths of a unit of its metal. */
  fine: 2,
  /** Money in hand (its units), the price level (millionths of its units a grain's worth), velocity (hundredths). */
  stock: 3,
  level: 4,
  velocity: 5,
  /** Last year's change in prices (ten-thousandths), what passed through its markets (grain's worth), what money-making gave the treasury. */
  inflation: 6,
  made: 7,
  seigniorage: 8,
  /** The fineness when last told, the year its form began; the treasury's shortfall it was asked to meet. */
  toldFine: 9,
  since: 10,
  unmet: 11,
  /** The forms it has ever had (bits, by MONEY_FORMS). */
  forms: 12,
  /** The year rising prices were last told. */
  dearer: 13,
} as const;
/** 3. A realm's treasury (grain's worth a year; rates in thousandths). */
export const TREASURY_STORE = "money.treasury";
export const FISC = {
  /** Its four bases' size, rates and takings (TAX_BASES order). */
  base: 0,
  rate: 4,
  take: 8,
  /** What it spends: on arms, on clerks, on relief, on interest. */
  arms: 12,
  clerks: 13,
  relief: 14,
  interest: 15,
  /** What else came in: tariffs, money-making. */
  tariffs: 16,
  seigniorage: 17,
  /** What it keeps by it, its deficit, what it borrowed for it, and its burden on its people (thousandths of what they make). */
  reserve: 18,
  deficit: 19,
  borrowed: 20,
  burden: 21,
  /** How far each base is measured and refused (thousandths), TAX_BASES order. */
  measured: 22,
  resisted: 26,
  /** The bases it has ever laid (bits), the year it last told one. */
  laid: 30,
  /** What it took of what calms, wakes and eases: its excise, or its own trade's margin. */
  excise: 31,
  /** The burden its people have borne for a generation, faded in (thousandths of what its lands make, one over): rules TREASURY.custom. */
  custom: 32,
} as const;
/** 4. A realm's tariff and sanctions: its rate (thousandths) and its parts; up to three sanctions, each the realm's serial (one more) and how much it shuts. */
export const TARIFF_STORE = "money.tariffs";
export const DUTY = {
  rate: 0,
  parts: 1,
  imports: 6,
  revenue: 7,
  sanctions: 8,
  told: 14,
} as const;
/** 5. A land's market power: its crafters' guild and its workers' union (thousandths), its shops, the markup its makers ask. */
export const LABOUR_STORE = "money.labour";
export const GUILD = {
  guild: 0,
  union: 1,
  shops: 2,
  markup: 3,
  wage: 4,
  told: 5,
} as const;
/** 6. A realm's black market: the share smuggled (thousandths), the wedge, the worth that passed, what the treasury lost. */
export const SMUGGLE_STORE = "money.smuggling";
export const SMUGGLE = { share: 0, wedge: 1, worth: 2, lost: 3, border: 4, told: 5 } as const;
/** 7. A realm's pooled risk; and a land's usual harvest (its own row, keyed by its cell). */
export const COVER_STORE = "money.cover";
export const POOL = {
  insured: 0,
  loss: 1,
  pooled: 2,
  reserve: 3,
  paid: 4,
  premiums: 5,
  seaTrade: 6,
  swing: 7,
  told: 8,
} as const;
/** 8. A land's rent and how its income is shared: five fifths and its Gini, its top tenth (thousandths); its rent; holders. */
export const SHARES_STORE = "money.shares";
export const SHARE = { fifths: 0, gini: 5, top: 6, rent: 7, rentShare: 8, holders: 9 } as const;
/** 9. A land's bondage as Domar weighs it: the share of its people bound (thousandths), the gain, the hold, the open land, the law. */
export const BIND_STORE = "money.bind";
export const BIND = { share: 0, gain: 1, hold: 2, open: 3, law: 4, power: 5 } as const;

/** 10. A land's intoxicants: within reach and taken (thousandths, by INTOX_KINDS); who needs it, work lost, deaths a year (millionths), rites, pain eased. */
export const INTOX_STORE = "money.intox";
export const INTOX = {
  have: 0,
  use: 4,
  dependent: 8,
  lost: 9,
  deaths: 10,
  rites: 11,
  eased: 12,
} as const;
/** A realm's law on them and their trade: how far forbidden and its six parts; its excise and whether it holds the trade; what it took. */
export const BAR_STORE = "money.prohibition";
export const BAR = {
  barred: 0,
  parts: 1,
  excise: 7,
  monopoly: 8,
  revenue: 9,
  /** Its people's year's use and what its lands' life could give (users), the price of a user's year, what it bought from abroad. */
  demand: 10,
  supply: 11,
  price: 12,
  imported: 13,
  /** Its money metal paid out for it, faded (grain's worth), and the share of what passes through its markets. */
  drained: 14,
  drain: 15,
  /** Those who carry it organised, where it is forbidden (thousandths). */
  cartel: 16,
  told: 17,
} as const;

export const MONEY_STORES: readonly (readonly [string, number])[] = [
  [GOODS_STORE, 16],
  [COIN_STORE, 14],
  [TREASURY_STORE, 33],
  [TARIFF_STORE, 15],
  [LABOUR_STORE, 6],
  [SMUGGLE_STORE, 6],
  [COVER_STORE, 9],
  [SHARES_STORE, 10],
  [BIND_STORE, 6],
  [INTOX_STORE, 13],
  [BAR_STORE, 18],
];

/** One of Round B's stores on a world (null where it keeps none). */
export function moneyStore(world: World, name: string): RowStore | null {
  return world.hasStore(name) ? world.store<RowStore>(name) : null;
}

// —— What the older systems read ——————————————————————————————————————————————————————————————————————————

/** A land's crafters' guild (0 … 1): how far they ask as one (sim/economy reprice). */
export function guildOf(world: World, cell: number): number {
  return (moneyStore(world, LABOUR_STORE)?.at(cell, GUILD.guild) ?? 0) / 1000;
}
/** A land's workers' union (0 … 1), and the share of their trade's rent it wins them (thousandths). */
export function unionOf(world: World, cell: number): { union: number; wage: number } {
  const s = moneyStore(world, LABOUR_STORE);
  return {
    union: (s?.at(cell, GUILD.union) ?? 0) / 1000,
    wage: (s?.at(cell, GUILD.wage) ?? 0) / 1000,
  };
}
/** A realm's tariff on goods from abroad, as it binds (less what slips past it): a share of their worth. */
export function dutyOf(world: World, realm: string): number {
  const t = moneyStore(world, TARIFF_STORE)?.at(realm, DUTY.rate) ?? 0;
  if (!t) return 0;
  return (t / 1000) * (1 - smuggledOf(world, realm));
}
/** The share of what a realm bars or taxes that crosses its borders anyway (0 … 1). */
export function smuggledOf(world: World, realm: string): number {
  return (moneyStore(world, SMUGGLE_STORE)?.at(realm, SMUGGLE.share) ?? 0) / 1000;
}
/** How much of the trade between two realms either shuts by its own word (0 … 1), as it binds. */
export function sanctionBetween(world: World, a: string, b: string): number {
  const s = moneyStore(world, TARIFF_STORE);
  if (!s) return 0;
  const one = (x: string, y: string) => {
    const row = s.get(x),
      at = refNumber(y);
    if (!row) return 0;
    for (let k = 0; k < 3; k++)
      if (row[DUTY.sanctions + 2 * k] === at + 1)
        return (row[DUTY.sanctions + 2 * k + 1]! / 1000) * (1 - smuggledOf(world, x));
    return 0;
  };
  return Math.max(one(a, b), one(b, a));
}
/** How much more a realm's traders send by sea for the insurance its underwriters write (a share). */
export function insuredGainOf(world: World, realm: string): number {
  const s = moneyStore(world, COVER_STORE),
    row = s?.get(realm);
  if (!row) return 0;
  const insured = row[POOL.insured]! / 1000,
    loss = row[POOL.loss]! / 10_000;
  return insured * insuredGain(loss);
}
/** A realm's price rise last year (a share; 0 where it keeps none). */
export function inflationOf(world: World, realm: string): number {
  return (moneyStore(world, COIN_STORE)?.at(realm, COIN.inflation) ?? 0) / 10_000;
}
/** What a realm's treasury takes beyond the harvest's tithe, as a share of what its people make (0 … 1). */
export function taxBurden(world: World, realm: string): number {
  return (moneyStore(world, TREASURY_STORE)?.at(realm, FISC.burden) ?? 0) / 1000;
}
/**
 * What a realm's taxes beyond the tithe breed of grievance a year in its lands: what it takes beyond what its people have borne
 * for a generation, and a share of what they have (rules TREASURY.borne).
 */
export function taxGrievance(world: World, realm: string): number {
  const store = moneyStore(world, TREASURY_STORE),
    burden = (store?.at(realm, FISC.burden) ?? 0) / 1000,
    kept = store?.at(realm, FISC.custom) ?? 0,
    custom = kept ? (kept - 1) / 1000 : burden;
  return Math.max(0, burden - custom) + TREASURY.borne * Math.min(burden, custom);
}
/** What a realm's treasury takes in a year, all told (grain's worth; 0 where none is kept). */
export function revenueOf(world: World, realm: string): number {
  const row = moneyStore(world, TREASURY_STORE)?.get(realm);
  if (!row) return 0;
  let n = row[FISC.tariffs]! + row[FISC.seigniorage]! + (row[FISC.excise] ?? 0);
  for (let k = 0; k < 4; k++) n += row[FISC.take + k]!;
  return n;
}
/** What a realm's treasury goes short this year, not yet borrowed (grain's worth). */
export function deficitOf(world: World, realm: string): number {
  const row = moneyStore(world, TREASURY_STORE)?.get(realm);
  return row ? Math.max(0, row[FISC.deficit]! - row[FISC.borrowed]!) : 0;
}
/** Set down what a realm borrowed against its deficit (sim/finance). */
export function borrowedFor(world: World, realm: string, grain: number): void {
  const s = moneyStore(world, TREASURY_STORE),
    row = s?.get(realm);
  if (!s || !row) return;
  const next = [...row];
  next[FISC.borrowed] = row[FISC.borrowed]! + grain;
  s.set(realm, next);
}
/** A land's Gini (0 … 1; null where none is kept). */
export function giniOf(world: World, cell: number): number | null {
  const row = moneyStore(world, SHARES_STORE)?.get(cell);
  return row ? row[SHARE.gini]! / 1000 : null;
}
/** The share of a land's people its holders bind as Domar weighs it, and how far the realm's arms hold the bound (null: none kept). */
export function bindOf(world: World, cell: number): { share: number; hold: number } | null {
  const row = moneyStore(world, BIND_STORE)?.get(cell);
  return row ? { share: row[BIND.share]! / 1000, hold: row[BIND.hold]! / 1000 } : null;
}

/** A land's work lost to what its people take (a share of its crafts' work; below nothing where what wakes gives more than is lost). */
export function intoxLost(world: World, cell: number): number {
  return (moneyStore(world, INTOX_STORE)?.at(cell, INTOX.lost) ?? 0) / 1000;
}
/** The share of a land's people who need what they take (0 … 1). */
export function intoxDependent(world: World, cell: number): number {
  return (moneyStore(world, INTOX_STORE)?.at(cell, INTOX.dependent) ?? 0) / 1000;
}
/** The share of a land's people who die of what they take in a year. */
export function intoxDeaths(world: World, cell: number): number {
  return (moneyStore(world, INTOX_STORE)?.at(cell, INTOX.deaths) ?? 0) / 1e6;
}
/** How far a realm forbids intoxicants (0 … 1). */
export function barredOf(world: World, realm: string): number {
  return (moneyStore(world, BAR_STORE)?.at(realm, BAR.barred) ?? 0) / 1000;
}
/** How strongly a forbidden trade's carriers are organised in a realm (0 … 1). */
export function cartelOf(world: World, realm: string): number {
  return (moneyStore(world, BAR_STORE)?.at(realm, BAR.cartel) ?? 0) / 1000;
}
/** What a realm's treasury took of intoxicants this year (grain's worth). */
export function exciseOf(world: World, realm: string): number {
  return moneyStore(world, BAR_STORE)?.at(realm, BAR.revenue) ?? 0;
}
