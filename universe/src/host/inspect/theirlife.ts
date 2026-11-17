// A realm's Culture tab, read as a life (asked 2026-11-16: "make the culture tab have more life or fun facts or some lol"): a short
// portrait of its people in plain words, what is most striking about it against the other realms of its world, a day in their life,
// words in their tongue, their feasts and games, their works, and the years their culture came to be. Every line is a reading of
// what the world keeps (./lifeways.ts and the stores named there); a line with nothing behind it in this realm is left out.
import { YEAR, hashString, type World } from "../../kernel/index.ts";
import type { Block, Item, Line, Portrait, Span, Stat } from "../../bridge/index.ts";
import { tonguePersonName } from "../../gen/index.ts";
import {
  G,
  GAMES,
  GAME_WORDS,
  GOODS,
  KEEPING_MEANS,
  LEISURE,
  renownWords,
  tableWords,
  type Game,
  type KeepingMean,
  type Sense,
} from "../../rules/index.ts";
import {
  DEITIES,
  cropReading,
  exchangeReading,
  housesOf,
  kindName,
  languagesOf,
  loreOf,
  marketsOf,
  populationContext,
  type Polity,
} from "../../sim/index.ts";
import { orgWords, principleName } from "../../causal/index.ts";
import { orgRef } from "../groups.ts";
import { houseRef } from "../family.ts";
import { firstSense, lifeOf, worldLives, type Life } from "./lifeways.ts";
import { firstsNow } from "./alerts.ts";
import { godNamed } from "./peoples.ts";
import { memoryOf, songFor, songRef } from "./memory.ts";
import { knownFor, knownLine } from "./board.ts";
import { lineageLook, wareLook } from "./ware-looks.ts";
import { faithLink, landLink, languageLink, realmLink, townLink } from "./names.ts";
import { bare, claimOf, count, item, link, many, sentence, stat, yearAt } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`,
  cap = sentence,
  lower = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

/** The days a people works a year, by its holy and feast days (rules/leisure.ts daysWorked's own count). */
export function workDays(holy: number, feasts: number): number {
  return Math.max(0, Math.round(365 - LEISURE.rest - Math.max(0, holy) - Math.max(0, feasts)));
}

/** How a people of each first sense is said, first. */
const SENSE_LEAD: Readonly<Record<Sense, string>> = {
  sight: "A people who see before all else",
  hearing: "A people who hear before they see",
  smell: "A people who smell before they see",
  echo: "A people who find their way by echoes",
  electric: "A people who feel the currents of things",
};
/** What each makes of its works, said as they make them (rules/art.ts SENSE_ARTS). */
const ART_DO: Readonly<Record<Sense, string>> = {
  sight: "they carve and paint",
  hearing: "they sing rather than carve",
  smell: "they make scents rather than pictures",
  echo: "they build halls that answer rather than paint",
  electric: "they weave currents rather than paint",
};
/** How each means of keeping is done, said after "keep their food by". */
const KEEP_BY: Readonly<Record<KeepingMean, string>> = {
  drying: "drying it in the sun",
  frost: "laying it by in the frost",
  salt: "salting it",
  smoke: "smoking it",
  ferment: "fermenting it",
  spice: "cooking it hot with what grows about them",
};
/** Why a people plays each game: what gamesOf (rules/leisure.ts) reads it from. */
export const GAME_WHY: Readonly<Record<Game, string>> = {
  throwing: "they have hands to throw and catch with",
  wrestling: "their sexes' bodies differ enough to try each other's strength",
  races: "they go on legs",
  swimming: "they live in the water",
  flying: "they have wings",
  riding: "they ride their beasts",
  board: "they reckon and write",
  war: "they prize valour",
};

/** What a realm's people sow, and its picture (null: they sow nothing). */
function cropOf(world: World, r: Polity) {
  const ctx = populationContext(world),
    c = world.hasStore("life.crops") ? cropReading(world, ctx, r.seat) : null;
  if (!c) return null;
  const s = c.lineage ? ctx.generated.life.species.find((x) => x.ref === c.lineage) : undefined;
  return { ...c, thumb: s ? lineageLook(world, s) : null };
}
/** The beast a realm's seat keeps, and its picture (null: none). */
function beastOf(world: World, r: Polity) {
  const ctx = populationContext(world),
    x = world.hasStore("life.exchange") ? exchangeReading(world, ctx, r.seat) : null;
  if (!x?.beast) return null;
  const s = ctx.generated.life.species.find((y) => y.ref === x.beast!.ref);
  return { ...x, beast: x.beast, thumb: s ? lineageLook(world, s) : null };
}

/** The means that keep the most of their food (at least a third of their fullest), best first. */
function keptBy(l: Life): KeepingMean[] {
  if (!l.table) return [];
  return KEEPING_MEANS.filter((m) => l.table!.means[m] >= 0.3).sort(
    (a, b) => l.table!.means[b] - l.table!.means[a],
  );
}

/** The games most of a realm's people play. */
export function gamesPlayed(l: Life): Game[] {
  return l.rest ? GAMES.filter((g) => l.rest!.games[g] >= 0.5) : [];
}

/** How far a renowned people's works are known, after "and" (rules/art.ts renownWords, from a quarter of renown up). */
function fameWords(renown: number): string {
  return renown < 0.5
    ? "their works are known across their realm"
    : renown < 0.75
      ? "their works are known far beyond it"
      : "the world comes to see their works";
}

// —— Their life: the portrait ————————————————————————————————————————————————————————————————————————

/** A realm's people in a few plain sentences (null: nothing is kept of how they live). */
export function portraitBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r),
    sense = firstSense(world),
    line: Span[] = [],
    say = (...xs: Span[]) => line.push(...xs);
  if (!l.people) return null;
  // Their sense and their works.
  if (l.art)
    say(
      `${SENSE_LEAD[sense]}: ${ART_DO[sense]}${l.art.stuff !== "what the land gives" ? `, in ${l.art.stuff}` : ""}${l.art.renown >= 0.25 ? `, and ${fameWords(l.art.renown)}` : ""}. `,
    );
  else say(`${SENSE_LEAD[sense]}. `);
  // What they eat and how they keep it.
  if (l.table) {
    const crop = cropOf(world, r),
      beast = beastOf(world, r),
      t = l.table,
      most = t.grain >= t.meat && t.grain >= t.wild ? "grain" : t.meat >= t.wild ? "meat" : "wild",
      herd = beast
        ? `the flesh and milk of the ${beast.beast.name}`
        : "the flesh and milk of their flocks",
      bread: Span = crop ? link(crop.name, crop.lineage) : "their grain";
    say("They live on ");
    if (most === "grain") say(bread);
    else if (most === "meat") say(herd);
    else say("what they gather and hunt");
    if (most !== "meat" && t.meat >= 0.15) say(` and ${herd}`);
    if (most !== "grain" && t.grain >= 0.15) say(" and ", bread);
    const keep = keptBy(l);
    say(
      keep.length
        ? `, and keep their food by ${keep
            .slice(0, 2)
            .map((m) => KEEP_BY[m])
            .join(" and ")}. `
        : ", and eat it before it spoils. ",
    );
  }
  // What they wear.
  if (l.dress) {
    const d = l.dress,
      parts: string[] = [
        d.need < 0.15
          ? d.coat <= 0.4
            ? "Their own coat keeps them warm"
            : "They dress light for the warmth"
          : d.need < 0.45
            ? "They dress against a cool season"
            : "They wrap up warm against the cold",
      ],
      stuff = (
        [
          ["wool", d.wool],
          ["hides", d.hides],
          ["woven fibre", d.fibre],
        ] as const
      ).find(([, x]) => x >= 0.5);
    if (stuff) parts.push(`in ${stuff[0]}`);
    if (d.display >= 0.35) parts.push(`${d.need < 0.15 ? "but" : "and"} bright for show`);
    else if (d.display < 0.1) parts.push("plainly");
    if (d.dyed >= 0.5) parts.push("in dyed colours");
    say(`${parts.join(", ")}. `);
  }
  // How long they work and rest.
  if (l.rest)
    say(
      `They work ${workDays(l.rest.holy, l.rest.feasts)} days a year, ${l.rest.hours.toFixed(1)} hours a day, and feast ${Math.round(l.rest.feasts)}. `,
    );
  // Their faith and their old.
  if (l.faith) say("They hold to ", faithLink(world, l.faith.ref), `, ${DEITIES[l.faith.tenet]}. `);
  if (l.old) {
    const keepers = (
        [
          ["their kin", l.old.kin],
          ["the temple's alms", l.old.temple],
          ["what they put by", l.old.savings],
          ["a pension", l.old.pension],
        ] as const
      )
        .filter(([, x]) => x > 0.01)
        .sort((a, b) => b[1] - a[1]),
      first = keepers[0];
    if (first)
      say(
        `Their old are kept by ${first[0]}${l.old.neglected >= 0.25 ? `, though ${pc(l.old.neglected)} are kept by no one` : ""}.`,
      );
  }
  return line.length ? { type: "text", title: "Their life", lines: [line] } : null;
}

// —— Did you know? ——————————————————————————————————————————————————————————————————————————————————

/** A fact worth telling: its line, the page it opens, and how striking it is. */
type Fact = { readonly score: number; readonly line: Line; readonly ref: string | null };

/** A number a realm can be set against its world by. */
type Metric = {
  readonly icon: string;
  readonly of: (l: Life) => number | null;
  /** Said of the realm that has the most and the least ("the most feast days of any realm"); null: never told. */
  readonly hi: string | null;
  readonly lo: string | null;
  readonly say: (v: number, l: Life) => string;
  /** Its middle, said (absent: as `say` says it). */
  readonly mid?: (v: number) => string;
  readonly ref: (l: Life) => string | null;
  /** Set against other faiths, not other realms (its value is its faith's). */
  readonly faith?: true;
};

const THIS_YEAR = (world: World) => Math.floor(world.now / YEAR);

function metricsOf(world: World): readonly Metric[] {
  const now = THIS_YEAR(world),
    lives = (l: Life) => `cell:0:${l.r.seat}#lives`,
    years = (v: number) => many(Math.round(v), "year", "years");
  return [
    {
      icon: "🎉",
      of: (l) => l.rest?.feasts ?? null,
      hi: "the most feast days of any realm",
      lo: "the fewest feast days of any realm",
      say: (v) => `${Math.round(v)} a year`,
      ref: lives,
    },
    {
      icon: "🕯️",
      of: (l) => l.rest?.holy ?? null,
      hi: "the most holy days of any realm",
      lo: "the fewest holy days of any realm",
      say: (v) => `${Math.round(v)} a year`,
      ref: lives,
    },
    {
      icon: "⏳",
      of: (l) => l.rest?.hours ?? null,
      hi: "the longest working day of any realm",
      lo: "the shortest working day of any realm",
      say: (v) => `${v.toFixed(1)} hours`,
      ref: lives,
    },
    {
      icon: "🍞",
      of: (l) => (l.temple ? l.temple.relief : null),
      hi: "their faith's temples fed the hungry more than any other faith's",
      lo: null,
      say: (v) => `${count(v)} grain last year`,
      ref: (l) => l.faith?.ref ?? null,
      faith: true,
    },
    {
      icon: "📜",
      of: (l) => (l.temple ? l.temple.teaching : null),
      hi: "their faith's temples teach more of the young than any other faith's",
      lo: "their faith's temples teach the fewest of the young",
      say: (v) => `${pc(v)} of those they reach`,
      ref: (l) => l.faith?.ref ?? null,
      faith: true,
    },
    {
      icon: "🎓",
      of: (l) => l.learned,
      hi: "the most learned people of any realm",
      lo: null,
      say: (v) => `${(v * 100).toFixed(2)}% learned past their letters`,
      ref: (l) => `cell:0:${l.r.seat}#people`,
    },
    {
      icon: "📖",
      of: (l) => l.voice?.readers ?? null,
      hi: "more of their people read than in any other realm",
      lo: "fewer of their people read than in any other realm",
      say: (v) => pc(v),
      ref: (l) => `${l.r.ref}#culture`,
    },
    {
      icon: "🗣️",
      of: (l) => l.voice?.free ?? null,
      hi: "word moves more freely than in any other realm",
      lo: "the seat holds its people's word tighter than any other",
      say: (v) => `${pc(v)} free`,
      ref: (l) => `${l.r.ref}#culture`,
    },
    {
      icon: "🏛️",
      of: (l) => l.art?.renown ?? null,
      hi: "the most renowned works of any realm",
      lo: null,
      say: (v) => `${pc(v)} of the renown there can be, ${renownWords(v)}`,
      mid: (v) => `${pc(v)}`,
      ref: (l) => (l.art ? `cell:0:${l.art.cell}#people` : null),
    },
    {
      icon: "🖼️",
      of: (l) => l.art?.works ?? null,
      hi: "more works kept than any other realm",
      lo: null,
      say: (v) => `${count(v)} years of work`,
      ref: (l) => (l.art ? `cell:0:${l.art.cell}#people` : null),
    },
    {
      icon: "🧂",
      of: (l) => l.table?.kept ?? null,
      hi: "they keep their food better than any other realm",
      lo: "their food spoils sooner than any other realm's",
      say: (v) => `their means spare ${pc(v)} of its spoiling`,
      ref: lives,
    },
    {
      icon: "🥩",
      of: (l) => l.table?.meat ?? null,
      hi: "the most flesh and milk at their table of any realm",
      lo: "the least flesh and milk at their table of any realm",
      say: (v) => `${pc(v)} of what they eat`,
      ref: lives,
    },
    {
      icon: "🌿",
      of: (l) => l.table?.wild ?? null,
      hi: "they live off the wild more than any other realm",
      lo: null,
      say: (v) => `${pc(v)} of what they eat`,
      ref: lives,
    },
    {
      icon: "👘",
      of: (l) => l.dress?.display ?? null,
      hi: "they dress for show more than any other realm",
      lo: "they dress more plainly than any other realm",
      say: (v) => `clothes show who one is ${pc(v)}`,
      ref: lives,
    },
    {
      icon: "🧥",
      of: (l) => l.dress?.need ?? null,
      hi: "they wrap up warmer than any other realm",
      lo: "they need the least of their clothes of any realm",
      say: (v) => `${pc(v)} of the warmth clothes can give`,
      ref: lives,
    },
    {
      icon: "🩺",
      of: (l) => l.care?.healers ?? null,
      hi: "the most healers of any realm",
      lo: "the fewest healers of any realm",
      say: (v) => `${v.toFixed(1)} in a thousand`,
      ref: lives,
    },
    {
      icon: "👵",
      of: (l) => (l.old ? 1 - l.old.neglected : null),
      hi: "they keep their old better than any other realm",
      lo: "they leave more of their old unkept than any other realm",
      say: (v) => `${pc(v)} of their frail kept`,
      ref: lives,
    },
    {
      icon: "👑",
      of: (l) => l.roles?.rule ?? null,
      hi: "more bearers among those who rule than in any other realm",
      lo: "fewer bearers among those who rule than in any other realm",
      say: (v) => pc(v),
      ref: lives,
    },
    {
      icon: "⚖️",
      of: (l) => l.law?.written ?? null,
      hi: "their law is written more than any other realm's",
      lo: null,
      say: (v) => `${pc(v)} written`,
      ref: (l) => `${l.r.ref}#laws`,
    },
    {
      icon: "🤝",
      of: (l) => l.folk?.kin ?? null,
      hi: "they count themselves one with their seat more than any other realm",
      lo: "they count themselves one with their seat less than any other realm",
      say: (v) => `${pc(v)} kin to it`,
      ref: (l) => `${l.r.ref}#culture`,
    },
    {
      icon: "⚔️",
      of: (l) => (l.wars > 0 ? l.wars : null),
      hi: "they have fought more wars than any other realm",
      lo: null,
      say: (v) => many(v, "war", "wars"),
      ref: (l) => `${l.r.ref}#wars`,
    },
    {
      icon: "🏰",
      of: (l) => now - l.r.founded,
      hi: "the oldest realm standing",
      lo: "the youngest realm standing",
      say: (v, l) => `${years(v)} old, founded in year ${l.r.founded}`,
      mid: (v) => `${years(v)} old`,
      ref: (l) => l.r.ref,
    },
    {
      icon: "🏯",
      of: (l) => (l.crown ? now - l.crown.since : null),
      hi: "the oldest ruling house of any realm",
      lo: null,
      say: (v, l) => `the ${l.crown!.name}, ${years(v)} in the seat's family`,
      mid: years,
      ref: (l) => `${l.r.ref}#houses`,
    },
    {
      icon: "🪑",
      of: (l) => now - l.r.ruler.since,
      hi: "the longest-reigning ruler of any realm",
      lo: null,
      say: (v, l) => `${l.r.ruler.name}, ${years(v)}`,
      mid: years,
      ref: (l) => `rule:${l.r.ref}`,
    },
    {
      icon: "💡",
      of: (l) => (l.lore > 0 ? l.lore : null),
      hi: "their seat knows more than any other realm's",
      lo: null,
      say: (v) => many(v, "thing known", "things known"),
      ref: (l) => `${l.r.ref}#lore`,
    },
    {
      icon: "⛪",
      of: (l) => (l.groups.length ? l.groups.length : null),
      hi: "more groups of faith, learning and party than any other realm",
      lo: null,
      say: (v) => many(v, "group", "groups"),
      ref: (l) => `${l.r.ref}#groups`,
    },
  ];
}

/** The middle of some numbers. */
function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b),
    m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** How far a number lies out from the others: in their spread from their middle (0: no spread to read). */
function spreadOf(xs: readonly number[], mid: number): number {
  const dev = xs.map((x) => Math.abs(x - mid)),
    mad = median(dev) * 1.4826;
  if (mad > 1e-9) return mad;
  const mean = dev.reduce((a, b) => a + b, 0) / Math.max(1, dev.length);
  return mean > 1e-9 ? mean : 0;
}

/** How the fewest realms a comparison is made among. */
const AMONG = 3;

/** A realm's numbers against its world's: the most and the least, the far from the middle. */
function comparedFacts(world: World, l: Life): Fact[] {
  const lives = [...worldLives(world).values()],
    out: Fact[] = [];
  for (const m of metricsOf(world)) {
    const v = m.of(l);
    if (v === null || !Number.isFinite(v)) continue;
    // (Against other faiths: one value a faith, its realms' alike.)
    const others: number[] = [];
    if (m.faith) {
      const seen = new Set<string>([l.faith?.ref ?? ""]);
      for (const x of lives) {
        if (!x.faith || seen.has(x.faith.ref)) continue;
        seen.add(x.faith.ref);
        const w = m.of(x);
        if (w !== null && Number.isFinite(w)) others.push(w);
      }
    } else
      for (const x of lives) {
        if (x.r.ref === l.r.ref) continue;
        const w = m.of(x);
        if (w !== null && Number.isFinite(w)) others.push(w);
      }
    if (others.length + 1 < AMONG) continue;
    const all = [...others, v],
      mid = median(all),
      spread = spreadOf(all, mid);
    // (Too near the middle to be worth saying: within a tenth of it, or of no spread at all.)
    if (spread <= 0 || Math.abs(v - mid) < 0.1 * Math.abs(mid)) continue;
    const z = Math.min(6, Math.abs(v - mid) / spread),
      eps = 1e-9 * Math.max(1, Math.abs(v)),
      top = others.every((w) => v > w + eps),
      bottom = others.every((w) => v < w - eps),
      among = m.faith ? "faith" : "realm",
      midWords = (m.mid ?? ((x: number) => m.say(x, l)))(mid);
    let phrase: string | null = null,
      score = 0;
    if (top && m.hi) {
      phrase = m.hi;
      score = z + 1;
    } else if (bottom && m.lo) {
      phrase = m.lo;
      score = z + 0.8;
    } else if (z >= 1.5 && others.length >= 6) {
      // (Second or third of all its world, where the words take a rank: "the second-longest working day of any realm".)
      const above = others.filter((w) => w > v + eps).length,
        below = others.filter((w) => w < v - eps).length,
        rank = v > mid ? above : below,
        words = v > mid ? m.hi : m.lo;
      if (
        rank >= 1 &&
        rank <= 2 &&
        words &&
        /^the (most|fewest|least|longest|shortest|oldest|youngest)\b/.test(words)
      ) {
        phrase = `the ${rank === 1 ? "second" : "third"}-${words.slice(4)}`;
        score = z * 0.6;
      }
    }
    if (!phrase || score < 1.2) continue;
    out.push({
      score,
      ref: m.ref(l),
      line: [`${m.icon} ${cap(phrase)}: ${m.say(v, l)} (the middle ${among}: ${midWords}).`],
    });
  }
  return out;
}

/** What one realm alone of its world does, or alone does not. */
function onlyFacts(world: World, l: Life): Fact[] {
  const lives = [...worldLives(world).values()];
  if (lives.length < AMONG) return [];
  const out: Fact[] = [],
    only = (
      icon: string,
      has: (x: Life) => boolean,
      yes: string,
      no: string | null,
      ref: string | null,
    ) => {
      const n = lives.filter(has).length,
        mine = has(l);
      if (mine && n === 1) out.push({ score: 4, ref, line: [`${icon} ${yes}.`] });
      else if (!mine && no && n === lives.length - 1 && lives.length >= 4)
        out.push({ score: 2.5, ref, line: [`${icon} ${no}.`] });
    };
  only(
    "✍️",
    (x) => x.writes,
    "The only realm whose seat writes",
    "The only realm whose seat does not yet write",
    `${l.r.ref}#lore`,
  );
  only(
    "🚫",
    (x) => (x.barred ?? 0) >= 0.5,
    "The only realm that forbids what calms, wakes and eases",
    null,
    `${l.r.ref}#treasury`,
  );
  only(
    "🍺",
    (x) => (x.table?.means.ferment ?? 0) >= 0.5,
    "The only realm whose people brew",
    null,
    `cell:0:${l.r.seat}#lives`,
  );
  only(
    "🎨",
    (x) => (x.dress?.dyed ?? 0) >= 0.5,
    "The only realm whose people wear dyed clothes",
    null,
    `cell:0:${l.r.seat}#lives`,
  );
  only(
    "🏥",
    (x) => (x.care?.hospitals ?? 0) >= 0.05,
    "The only realm whose people live near a hospital",
    null,
    `cell:0:${l.r.seat}#lives`,
  );
  for (const g of GAMES)
    only(
      "🏅",
      (x) => (x.rest?.games[g] ?? 0) >= 0.5,
      `The only realm whose people play ${GAME_WORDS[g]}, as ${GAME_WHY[g]}`,
      null,
      `cell:0:${l.r.seat}#lives`,
    );
  const kinds = new Set(l.groups.map((g) => kindName(g)));
  for (const k of kinds) {
    const first = l.groups.find((g) => kindName(g) === k)!;
    only(
      "🏛️",
      (x) => x.groups.some((g) => kindName(g) === k),
      `The only realm with a ${k}: ${orgWords(first.name, k)}`,
      null,
      orgRef(l.r.ref, first.event),
    );
  }
  return out;
}

/** What a realm did first in all its world, and what came to it from elsewhere. */
function storyFacts(world: World, l: Life): Fact[] {
  const out: Fact[] = [],
    r = l.r,
    members = new Set(r.members),
    firsts = firstsNow(world).filter((f) => f.land !== null && members.has(f.land));
  for (const f of firsts.slice(0, 2))
    out.push({
      score: 3.5,
      ref: f.ref,
      line: [
        `🥇 First in all the world: ${lower(f.what.replace(/^\S+\s/, ""))}, in `,
        landLink(world, f.land!, true),
        `, year ${f.year}.`,
      ],
    });
  const crop = cropOf(world, r);
  if (crop?.came) {
    const e = world.events.get(crop.came);
    out.push({
      score: 1.3,
      ref: crop.came,
      line: [
        "🌾 Their crop, ",
        link(crop.name, crop.lineage),
        `, came to their seat from a land it meets${e ? `, in year ${yearAt(e.t)}` : ""}.`,
      ],
    });
  }
  const beast = beastOf(world, r);
  if (beast?.came) {
    const e = world.events.get(beast.came);
    out.push({
      score: 1.2,
      ref: beast.came,
      line: [
        "🐾 Their herds of ",
        link(beast.beast.name, beast.beast.ref),
        ` came to them from a land they meet${e ? `, in year ${yearAt(e.t)}` : ""}.`,
      ],
    });
  }
  return out;
}

/** The most fun facts told. */
export const MOST_FACTS = 8;

/** Did you know? What is most striking about a realm against the others of its world (null: nothing stands out). */
export function didYouKnowBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r);
  if (!l.people) return null;
  const all = [...onlyFacts(world, l), ...storyFacts(world, l), ...comparedFacts(world, l)].sort(
      (a, b) => b.score - a.score,
    ),
    // (A weak fact, true but not striking, only where there are few strong ones.)
    strong = all.filter((f) => f.score >= 1),
    facts = (strong.length >= 3 ? strong : all).slice(0, MOST_FACTS);
  if (!facts.length) return null;
  return {
    type: "list",
    title: "Did you know?",
    items: facts.map((f) => item(f.line, f.ref)),
  };
}

// —— A day in their life —————————————————————————————————————————————————————————————————————————————

/** A row with its picture where one can be drawn. */
function withThumb(s: Stat, thumb: Portrait | null | undefined): Stat {
  return thumb ? { ...s, thumb } : s;
}

/** A day in their life: their hours, what they eat and wear, what they play, who keeps their sick and old (null: nothing kept). */
export function dayBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r),
    rows: Stat[] = [];
  if (l.rest)
    rows.push(
      stat(
        "Their working day",
        `${l.rest.hours.toFixed(1)} hours, ${workDays(l.rest.holy, l.rest.feasts)} days a year`,
      ),
    );
  if (l.table) {
    const t = l.table,
      crop = cropOf(world, r),
      beast = beastOf(world, r);
    if (t.grain >= 0.05)
      rows.push(
        withThumb(
          stat("Their staple", [
            crop ? link(crop.name, crop.lineage) : "their grain",
            `: ${pc(t.grain)} of what they eat`,
          ]),
          crop?.thumb,
        ),
      );
    if (t.meat >= 0.05)
      rows.push(
        withThumb(
          stat("From their herds", [
            "flesh and milk",
            ...(beast ? [" of the ", link(beast.beast.name, beast.beast.ref)] : []),
            `: ${pc(t.meat)}`,
          ]),
          beast?.thumb,
        ),
      );
    if (t.wild >= 0.05)
      rows.push(stat("From the wild", `what they gather and hunt: ${pc(t.wild)}`));
    const dishes = tableWords(t, t.means, populationContext(world).medium === "water");
    if (dishes.length) rows.push(stat("At their table", cap(dishes.join("; "))));
    const keep = keptBy(l);
    if (keep.length) rows.push(stat("They keep it by", keep.map((m) => KEEP_BY[m]).join(", ")));
  }
  if (l.dress) {
    const d = l.dress,
      stuff = [
        ["wool", d.wool],
        ["hides", d.hides],
        ["woven fibre", d.fibre],
      ] as const,
      made = stuff.filter(([, x]) => x >= 0.1).sort((a, b) => b[1] - a[1]),
      hides = made[0]?.[0] === "hides",
      thumb = made.length
        ? wareLook(world, r.seat, G.clothing, {
            key: hides ? "leather:coat" : "cloth:own:tunic",
            ref: null,
          })
        : null;
    rows.push(
      withThumb(
        stat(
          "They wear",
          `${made.map(([w, x]) => `${w} (${pc(x)})`).join(", ") || "what comes to hand"}; ${pc(d.need)} of the warmth clothes can give${d.display >= 0.35 ? ", and dress for show" : ""}${d.dyed >= 0.5 ? ", dyed" : ""}`,
        ),
        thumb,
      ),
    );
  }
  const games = gamesPlayed(l);
  if (games.length)
    rows.push(stat("When the work is done", cap(games.map((g) => GAME_WORDS[g]).join(", "))));
  if (l.care)
    rows.push(
      stat(
        "When they are sick",
        `${pc(l.care.access)} are tended by a healer (${l.care.healers.toFixed(1)} in a thousand of them heal)${l.care.alms >= 0.05 ? `; the temple's alms pay for ${pc(l.care.alms)}` : ""}${l.care.publicCare >= 0.05 ? `; their realm pays for ${pc(l.care.publicCare)}` : ""}`,
      ),
    );
  if (l.old) {
    const keepers = (
      [
        ["their kin", l.old.kin],
        ["the temple's alms", l.old.temple],
        ["what they put by", l.old.savings],
        ["a pension", l.old.pension],
      ] as const
    )
      .filter(([, x]) => x >= 0.01)
      .sort((a, b) => b[1] - a[1]);
    rows.push(
      stat(
        "When they are old",
        `${keepers.map(([w, x]) => `${w} keep ${pc(x)}`).join(", ") || "no one keeps them"}${l.old.neglected >= 0.01 ? `; no one keeps ${pc(l.old.neglected)}` : ""}`,
      ),
    );
  }
  if (l.roles)
    rows.push(stat("A bearer's work beyond the home", `${pc(l.roles.norm)} of another's`));
  return rows.length ? { type: "facts", title: "A day in their life", rows } : null;
}

// —— Their words ——————————————————————————————————————————————————————————————————————————————————

/** Words in their tongue: its name, the god as they name it, their faith, towns, ruler, houses and given names (null: no tongue kept). */
export function wordsBlock(world: World, r: Polity): Block | null {
  if (!world.hasStore("culture.languages")) return null;
  const l = languagesOf(world).of(r.seat);
  if (!l) return null;
  const ctx = populationContext(world),
    rows: Stat[] = [stat("Their tongue", [languageLink(world, l.ref)])];
  rows.push(stat("Their name for the god", godNamed(world, l, new Map()).name));
  const f = lifeOf(world, r).faith;
  if (f) rows.push(stat("Their faith", [faithLink(world, f.ref)]));
  const towns = r.members
    .flatMap((c) => ctx.settlements.seenIn(c))
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .slice(0, 4);
  if (towns.length) {
    const line: Span[] = [];
    towns.forEach((t, i) => {
      if (i) line.push(", ");
      line.push(townLink(world, t.ref));
    });
    rows.push(stat("Their towns", line));
  }
  rows.push(stat("Their ruler", [link(r.ruler.name, `rule:${r.ref}`)]));
  const houses = housesOf(world)?.of(r.ref)?.houses ?? [];
  if (houses.length) {
    const line: Span[] = [];
    [...houses]
      .sort((a, b) => b.power - a.power || a.id - b.id)
      .slice(0, 3)
      .forEach((h, i) => {
        if (i) line.push(", ");
        line.push(link(h.name, houseRef(r.ref, h.event)));
      });
    rows.push(stat("Their great houses", line));
  }
  const names = (sex: number) =>
    [0, 1, 2].map((k) => tonguePersonName(l.standard, l.born * 17 + k, sex)).join(", ");
  rows.push(stat("Women are named", names(0)), stat("Men are named", names(1)));
  return { type: "facts", title: "Their words", rows };
}

// —— Feasts, holy days and games ————————————————————————————————————————————————————————————————————

/** The day of its year a faith keeps its feast (as its towns keep it: host/village.ts), from 1. */
export function feastDay(faith: string): number {
  return 31 + (hashString(`holy ${faith}`) % 230);
}

function ordinal(n: number): string {
  const t = n % 100,
    u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"}`;
}

/** Their feasts, holy days and games, each from what it is read from (null: nothing kept). */
export function festivalsBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r),
    items: Item[] = [];
  if (l.faith)
    items.push(
      item(
        [
          "✨ ",
          link(`The feast of ${l.faith.name}`, l.faith.ref),
          `, on the ${ordinal(feastDay(l.faith.ref))} day of their year`,
        ],
        l.faith.ref,
      ),
    );
  const p = populationContext(world).provinces.get(r.seat);
  if (p && p.knowsCultivation && p.fed >= 900)
    items.push(
      item(
        populationContext(world).medium === "water"
          ? "🌾 Harvest home, once the beds are gathered: their seat is fed"
          : "🌾 Harvest home, once the grain is in: their seat is fed",
        `cell:0:${r.seat}`,
      ),
    );
  if (l.rest) {
    items.push(
      item(
        `🕯️ ${Math.round(l.rest.holy)} holy days a year, kept for ${l.faith ? DEITIES[l.faith.tenet] : "the old beliefs"}, as devout as they are`,
        `cell:0:${r.seat}#lives`,
      ),
      item(
        `🎉 ${Math.round(l.rest.feasts)} feast days a year, as much as their year leaves to spare`,
        `cell:0:${r.seat}#lives`,
      ),
    );
    for (const g of gamesPlayed(l))
      items.push(item(`🏅 ${cap(GAME_WORDS[g])}: ${GAME_WHY[g]}`, `cell:0:${r.seat}#lives`));
  }
  return items.length ? { type: "list", title: "Their feasts and games", items } : null;
}

// —— Their works ——————————————————————————————————————————————————————————————————————————————————

/** A good's picture as a land makes it, for its finest thing (null: none to draw). */
function goodThumb(world: World, cell: number, good: number): Portrait | null {
  if (good === G.pottery) return wareLook(world, cell, good, { key: "ware", ref: null });
  if (good === G.clothing)
    return wareLook(world, cell, good, { key: "cloth:own:tunic", ref: null });
  if (good === G.tools) {
    const metal = marketsOf(world).get(cell)?.toolMetalIn() ?? "stone";
    return wareLook(world, cell, good, { key: `tools:${metal}:axe`, ref: null });
  }
  return null;
}

/** The picture of what their works are made in. */
function stuffThumb(world: World, cell: number, stuff: string): Portrait | null {
  if (stuff === "fired clay") return goodThumb(world, cell, G.pottery);
  if (stuff === "woven cloth") return goodThumb(world, cell, G.clothing);
  if (stuff === "worked hide")
    return wareLook(world, cell, G.clothing, { key: "leather:coat", ref: null });
  return null;
}

/** The made goods a people's finest thing is told of, finest first by worth. */
const MADE = [G.machines, G.tools, G.clothing, G.pottery];

/** Their works: what they make and in what, how far known, what they sing of, the finest thing they make, their groups. */
export function worksBlocks(world: World, r: Polity): Block[] {
  const l = lifeOf(world, r),
    out: Block[] = [],
    rows: Stat[] = [];
  if (l.art) {
    rows.push(
      withThumb(
        stat("Their works", `${l.art.form}, in ${l.art.stuff}`),
        stuffThumb(world, l.art.cell, l.art.stuff),
      ),
      stat("Renown", [
        renownWords(l.art.renown),
        " (most in ",
        landLink(world, l.art.cell, true),
        ")",
      ]),
      stat("Works kept", `${count(l.art.works)} years of work, ${count(l.art.made)} made a year`),
    );
    if (l.art.court >= 0.05) rows.push(stat("Kept by those who rule", pc(l.art.court)));
    if (l.art.clergy >= 0.05) rows.push(stat("Kept by their faith", pc(l.art.clergy)));
  }
  // (The dearest of the made goods its lands made last year.)
  const markets = marketsOf(world);
  let finest: { good: number; cell: number; made: number } | null = null;
  for (const g of MADE) {
    let made = 0,
      most = 0,
      cell = r.seat;
    for (const c of r.members) {
      const x = markets.get(c)?.book("made", g) ?? 0;
      made += x;
      if (x > most) {
        most = x;
        cell = c;
      }
    }
    if (made >= 1) {
      finest = { good: g, cell, made };
      break;
    }
  }
  if (finest) {
    const g = GOODS[finest.good]!,
      metal = finest.good === G.tools ? markets.get(finest.cell)?.toolMetalIn() : null;
    rows.push(
      withThumb(
        stat("The finest thing they make", [
          `${g.name}${metal ? ` headed with ${metal}` : ""}, `,
          landLink(world, finest.cell, true),
          ` most: ${count(finest.made)} last year`,
        ]),
        goodThumb(world, finest.cell, finest.good),
      ),
    );
  }
  const seatTown = populationContext(world)
    .settlements.seenIn(r.seat)
    .find((t) => t.name === r.town);
  if (seatTown) {
    const known = knownFor(world, seatTown.ref);
    if (known.length)
      rows.push(
        stat("Their seat is known for", [townLink(world, seatTown.ref), ": ", ...knownLine(known)]),
      );
  }
  if (l.learned !== null && l.learned > 0)
    rows.push(
      stat("Learned past their letters", `${(l.learned * 100).toFixed(2)}% of their people`),
    );
  if (rows.length) out.push({ type: "facts", title: "Their works", rows });
  // What they sing of: their best-known songs.
  const deeds = [...(memoryOf(world).byRealm.get(r.ref) ?? [])]
    .sort((a, b) => b.worth - a.worth || b.year - a.year)
    .slice(0, 3);
  if (deeds.length)
    out.push({
      type: "list",
      title: "Their best-known songs",
      items: deeds.map((d) => {
        const s = songFor(world, d);
        return item(
          [link(s.title, songRef(d)), `, ${s.form}, of year ${d.year}`],
          songRef(d),
          d.year,
        );
      }),
    });
  if (l.groups.length)
    out.push({
      type: "list",
      title: "Their orders, sects, societies and parties",
      items: l.groups.map((g) =>
        item(
          [
            link(cap(orgWords(g.name, kindName(g))), orgRef(r.ref, g.event)),
            `, since year ${g.since}`,
          ],
          orgRef(r.ref, g.event),
          g.since,
        ),
      ),
    });
  return out;
}

// —— Their years ——————————————————————————————————————————————————————————————————————————————————

/** The knowings that are a people's culture, for its timeline: its letters, its reckoning, its calendar, its brews and cloth. */
const CULTURE_LORE: ReadonlySet<string> = new Set([
  "calendar",
  "writing",
  "mathematics",
  "astronomy",
  "philosophy",
  "medicine",
  "bureaucracy",
  "currency",
  "banking",
  "brewing",
  "loom",
  "dyeing",
  "pottery-wheel",
  "beekeeping",
  "printing",
]);

/** The event types of a realm's own culture, found in a bounded walk of its log. */
const CULTURE_EVENTS: ReadonlySet<string> = new Set([
  "town.temple",
  "money.prohibited",
  "order.law",
]);
/** How many of the latest events a timeline walks, at most. */
export const TIMELINE_WALK = 4000;
/** The most lines a timeline tells. */
export const TIMELINE_MOST = 14;

/** Their years: the firsts and the cultural events of a realm, oldest first, each opening its page (null: none). */
export function timelineBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r),
    members = new Set(r.members),
    places = new Set(r.members.map((c) => `cell:0:${c}`)),
    lines: { year: number; line: Line; ref: string | null; rank: number }[] = [],
    seen = new Set<string>(),
    add = (year: number, line: Line, ref: string | null, rank: number) => {
      if (ref && seen.has(ref)) return;
      if (ref) seen.add(ref);
      lines.push({ year, line, ref, rank });
    };
  add(r.founded, ["👑 The realm is founded at ", realmLink(world, r.ref)], r.event, 3);
  for (const f of firstsNow(world))
    if (f.land !== null && members.has(f.land))
      add(
        f.year,
        [
          `🥇 First in all the world: ${lower(f.what.replace(/^\S+\s/, ""))}, in `,
          landLink(world, f.land, true),
        ],
        f.ref,
        4,
      );
  if (world.hasStore("belief.faiths")) {
    if (l.faith && members.has(l.faith.seat))
      add(
        l.faith.founded,
        [
          "✨ ",
          faithLink(world, l.faith.ref),
          " is founded in ",
          landLink(world, l.faith.seat, true),
        ],
        l.faith.event,
        3,
      );
  }
  if (world.hasStore("culture.languages")) {
    const tongue = languagesOf(world).of(r.seat);
    if (tongue && members.has(tongue.home) && tongue.born > 0)
      add(
        tongue.born,
        ["🗣️ ", languageLink(world, tongue.ref), " is first spoken"],
        tongue.event,
        2,
      );
  }
  if (world.hasStore("lore.known"))
    for (const [id, k] of loreOf(world).of(r.seat))
      if (CULTURE_LORE.has(id))
        add(k.year, [`💡 Their seat comes to know ${lower(principleName(id, world))}`], k.event, 2);
  const crop = cropOf(world, r);
  if (crop?.tamed) {
    const e = world.events.get(crop.tamed);
    if (e)
      add(yearAt(e.t), ["🌾 Their ", link(crop.name, crop.lineage), " turns tame"], crop.tamed, 2);
  }
  if (crop?.came) {
    const e = world.events.get(crop.came);
    if (e)
      add(
        yearAt(e.t),
        ["🌾 ", link(crop.name, crop.lineage), " comes to their seat"],
        crop.came,
        2,
      );
  }
  if (l.temple && l.faith)
    add(
      l.temple.since,
      ["⛪ The temples of ", faithLink(world, l.faith.ref), " are kept"],
      null,
      1,
    );
  if (l.crown)
    add(
      l.crown.since,
      [`🏯 The ${l.crown.name} rise, who hold the seat now`],
      houseRef(r.ref, l.crown.event),
      2,
    );
  for (const g of l.groups)
    add(g.since, [`🏛️ ${cap(orgWords(g.name, kindName(g)))} forms`], orgRef(r.ref, g.event), 2);
  // (A bounded walk of the log's latest events, within the realm's years: its temples raised, its laws, what it forbade.)
  const events = world.events,
    from = r.founded * YEAR;
  for (let i = events.count - 1, n = 0; i >= 0 && n < TIMELINE_WALK; i--, n++) {
    const e = events.at(i);
    if (e.t < from) break;
    if (!CULTURE_EVENTS.has(e.type)) continue;
    if (!(e.place && places.has(e.place)) && !e.subjects.includes(r.ref)) continue;
    add(yearAt(e.t), [link(bare(claimOf(world, e.id)), e.id)], e.id, 1);
  }
  if (!lines.length) return null;
  const kept = [...lines]
    .sort((a, b) => b.rank - a.rank || b.year - a.year)
    .slice(0, TIMELINE_MOST)
    .sort((a, b) => a.year - b.year);
  return {
    type: "list",
    title: "Their years",
    items: kept.map((x) => item([`Year ${x.year}: `, ...x.line], x.ref, x.year)),
    ...(lines.length > kept.length ? { more: lines.length - kept.length } : {}),
  };
}
