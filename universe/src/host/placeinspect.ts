// The town mode's own inspector, the host's part (asked 2026-11-25: "the ui and ux could be better ... there should be
// more detail"): one of a place's people, or one of its lots, read into the shape the mode's inspector lays out
// (bridge/placeinspect.ts): who and what first, in numbers with units, and the long sentences kept apart for whoever
// asks. Read of the place as kept, through the readers its pages use (host/inspect/place.ts, host/placeplan.ts): asking
// moves nothing, and nothing here is reckoned that the place does not reckon already.
import { DAY, type World } from "../kernel/index.ts";
import { CIVICS, FOODS, GOODS, MEMBERS, OCC } from "../rules/index.ts";
import { lifeOf, mixOf, homePlanet, kindBody } from "../sim/index.ts";
import {
  PLACE_AT,
  placeLotRef,
  placePersonRef,
  placedId,
  type MemberState,
  type WoundMember,
  type PlaceInspect,
  type PlaceInspectLot,
  type PlaceInspectPerson,
  type PlaceNamed,
  type PlaceThought,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { figureBody } from "./folk.ts";
import { skillLine, temperWords } from "./inspect/place.ts";
import {
  ACT,
  AT,
  BOUND_ARMS,
  BOUND_SITE,
  HAP,
  IDLE_WORTH,
  MOOD,
  MOOD_BASE,
  MOOD_UNHEEDING,
  NEED_WORDS,
  THOUGHT,
  enterPlace,
  hapTold,
  ordersOf,
  placeIndexOf,
  placeKind,
  placeLot,
  placeMate,
  placeMoodTerms,
  placePerson,
  placeSites,
  placeSkill,
  placeSkills,
  placeMember,
  hurtOf,
  woundTakes,
  gaitOf,
  tendedOf,
  placeTemper,
  tradeKind,
  pressOf,
  siteStage,
  workWorth,
  type Place,
  actWords,
  placeDayStrip,
  placeTies,
  regardWords,
  FRIEND_AT,
  RIVAL_AT,
} from "./place.ts";
import {
  ailWords,
  healthWords,
  TENDED_WORDS,
  lotWords,
  markWords,
  careWords,
  placeDay,
  placeNamed,
  placeWho,
  tradeWords,
  whyWords,
  OCCUPATION_WORK,
  SKILL_NAMES,
  placeDayRows,
} from "./placeplan.ts";
import { landEra, peopleBody } from "./village.ts";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const amount = (x: number) =>
  x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2);

/** What each of MOOD's bits is, said short, with its sign. */
const THOUGHT_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [MOOD.want]: ["🥣", "Gone hungry, cold or without rest"],
  [MOOD.ailing]: ["🤕", "Hurt or sick"],
  [MOOD.bereaved]: ["🕯️", "A death in the household"],
  [MOOD.pantry]: ["🫙", "A pantry with a week's food in it"],
  [MOOD.friend]: ["🤝", "A friend made in company"],
  [MOOD.home]: ["🏠", "A new home"],
  [MOOD.ordered]: ["📋", "Held to a trade by an order"],
  [MOOD.homeless]: ["🏚️", "Their home lost"],
};
/** What each kind of memory is, said short, with its sign (host/place.ts THOUGHT). */
const MEMORY_WORDS: Readonly<Record<number, readonly [string, string]>> = {
  [THOUGHT.born]: ["👶", "A child born to the household"],
  [THOUGHT.paired]: ["💞", "Paired"],
  [THOUGHT.friendDied]: ["🕯️", "Their friend died"],
  [THOUGHT.ofAge]: ["🎉", "Came of age, and took up work"],
  [THOUGHT.fire]: ["🔥", "Fought a fire"],
  [THOUGHT.games]: ["🎲", "Played at the games in the square"],
  [THOUGHT.feast]: ["🍖", "Feasted with the town"],
  [THOUGHT.quarrel]: ["💢", "Quarrelled with one they cannot abide"],
  [THOUGHT.brawl]: ["👊", "Came to blows"],
};
/** A mood in a word. */
export const moodWord = (m: number): string =>
  m >= 25 ? "Glad" : m >= -15 ? "Even" : m >= MOOD_UNHEEDING ? "Low" : "Too low to heed an order";

/** A building's sign, by its kind. */
const LOT_ICONS: Readonly<Record<string, string>> = {
  granary: "🌾",
  market: "🏪",
  smithy: "⚒️",
  kiln: "🏺",
  workshop: "🔨",
  factory: "🏭",
  temple: "⛪",
  shrine: "⛩️",
  hall: "🏛️",
  hospital: "⚕️",
  docks: "⚓",
  station: "🚉",
  offices: "🏢",
  academy: "🎓",
  walls: "🧱",
};

/** One of a place's people, read for the mode's inspector (null: no one of it by that number). */
export function inspectPerson(world: World, place: Place, id: number): PlaceInspectPerson | null {
  const i = placeIndexOf(place, id),
    r = i >= 0 ? placePerson(world, place, id) : null;
  if (!r) return null;
  const p = place.people,
    life = lifeOf(world),
    child = r.age < life.adulthood,
    who = placeWho(world, place),
    me = who(i),
    named = placeNamed(world, place),
    nameOf = (j: number, words: string): PlaceNamed => ({
      id: p.id[j]!,
      ref: who(j).ref,
      name: who(j).name,
      words,
    }),
    age = (j: number) => Math.floor((place.t / DAY - p.born[j]!) / 365),
    worth = workWorth(world, place, i),
    serves = Math.cbrt(Math.max(worth, IDLE_WORTH)),
    doing =
      r.act === ACT.abed && r.eta > 0
        ? `Being brought home to lie abed, at ${lotWords(place, r.to)}`
        : `${cap(actWords(place.people, i))}${r.eta > 0 ? `, walking to ${lotWords(place, r.to)}` : r.act === ACT.sleep || r.act === ACT.eat ? "" : ` at ${lotWords(place, r.at)}`}`;
  // Their mood's reasons: what bears on it now, each by how much and for how long (host/place.ts moodTerms).
  const terms = placeMoodTerms(world, place, i),
    thoughts: PlaceThought[] = [
      ...terms.map((x) => ({
        icon: (x.thought ? MEMORY_WORDS[x.thought] : THOUGHT_WORDS[x.bit])?.[0] ?? "•",
        words: (x.thought ? MEMORY_WORDS[x.thought] : THOUGHT_WORDS[x.bit])?.[1] ?? "",
        size: Math.round(x.size),
        days: x.days,
      })),
      { icon: "🙂", words: "At ease, as most are", size: MOOD_BASE, days: null },
    ].sort((a, b) => Math.abs(b.size) - Math.abs(a.size)),
    to = MOOD_BASE + terms.reduce((n, x) => n + x.size, 0);
  // (Their portrait: their own people's figure, in their land's clothes, as their town draws them.)
  const kind = placeKind(world, place, i)?.kind ?? 0,
    mix = kind > 0 ? mixOf(world) : null,
    body = mix
      ? figureBody(kindBody(homePlanet(world).generated, mix, kind), null)
      : peopleBody(world);
  const temper = placeTemper(place, i),
    marks: string[] = [],
    mark = (x: number, high: string, low: string) => {
      if (x >= 0.62) marks.push(high);
      else if (x <= 0.38) marks.push(low);
    };
  mark(temper.kin, "close to kin", "their own person");
  mark(temper.bidden, "biddable", "wilful");
  mark(temper.sociable, "fond of company", "solitary");
  mark(temper.thrifty, "thrifty", "open-handed");
  mark(temper.bold, "bold", "timid");
  const skill = r.occupation === OCC.dependent ? null : placeSkill(place, i),
    mate = placeMate(place, i),
    mi = mate ? placeIndexOf(place, mate.id) : -1,
    fi = p.friend[i] ? placeIndexOf(place, p.friend[i]!) : -1,
    pantry = r.pantry.reduce((a, b) => a + b, 0),
    members = r.household.length + 1;
  const lived = place.log
    .filter((x) => x.id === id || ((x.what === HAP.born || x.what === HAP.paired) && x.a === id))
    .slice(-8)
    .reverse()
    .map(
      (x) =>
        `${cap(placeDay(x.t))}: ${
          x.id === id
            ? hapTold(place, x, named)
            : x.what === HAP.born
              ? `${named(x.id) ?? "a child"} was born to them`
              : `paired with ${named(x.id) ?? "another"}`
        }`,
    );
  return {
    kind: "person",
    id,
    ref: placePersonRef(place.town, id),
    page: me.ref,
    name: me.name,
    portrait: {
      kind: "person",
      ref: me.ref,
      age: r.age,
      span: body?.span ?? 70,
      occupation: r.occupation,
      child,
      era: landEra(world, place.cell),
      body,
    },
    age: Math.floor(r.age),
    trade: tradeWords(r.occupation, child).replace(/^an? /, ""),
    bound:
      p.bound[i] === BOUND_ARMS
        ? "under arms"
        : p.bound[i] === BOUND_SITE
          ? "a site's crew"
          : p.bound[i] === 255
            ? `put at ${lotWords(place, r.work)}`
            : p.bound[i]
              ? tradeWords(p.bound[i]! - 1, false).replace(/^an? /, "")
              : null,
    now: doing,
    why: whyWords(world, place, i),
    at: r.at,
    to: r.to,
    mood: p.mood[i]!,
    moodWord: moodWord(p.mood[i]!),
    breakAt: MOOD_UNHEEDING,
    thoughts,
    needs: NEED_WORDS.map((w, q) => ({
      name: cap(w),
      level: r.needs[q]!,
      press: pressOf(r.needs[q]!),
    })),
    serves,
    health: p.health[i]!,
    healthWords: p.health[i] ? (healthWords(world, place, i) ?? ailWords(place, i)) : null,
    mark: markWords(world, place, i),
    lack: Math.floor(p.lack[i]! / 144),
    skill: skill
      ? `${cap(skill.words)} at ${OCCUPATION_WORK[r.occupation] ?? "their work"} · ${skill.hours.toLocaleString("en-US")} h`
      : null,
    skillWords: skillLine(world, place, i),
    skills: child
      ? []
      : placeSkills(world, place, i).map((x, k) => ({
          name: SKILL_NAMES[k]!,
          hours: x.hours,
          level: x.level,
          words: x.words,
          fit: x.fit,
          passion: x.passion,
          own: k === tradeKind(r.occupation),
        })),
    ...healthGear(world, place, i, r),
    day: placeDayStrip(world, place, i),
    dayRows: placeDayRows(world, place),
    taught: p.taught[i]
      ? `${SKILL_NAMES[p.taught[i]! - 1]}: what their household taught them as they grew (two hundred hours of it when they came of age)`
      : null,
    temper: marks.length ? cap(marks.join(", ")) : "Much as most of their people",
    temperWords: temperWords(place, i),
    home: {
      lot: r.home,
      words: cap(lotWords(place, r.home)),
      ref: placeLotRef(place.town, r.home),
    },
    work:
      r.occupation === OCC.dependent
        ? null
        : {
            lot: r.work,
            words: `${cap(lotWords(place, r.work))}${r.craft ? `, ${r.craft}` : ""}`,
            ref: placeLotRef(place.town, r.work),
          },
    holds: r.carry ? `${amount(r.carry.amount)} of ${GOODS[r.carry.good]!.name}` : null,
    pantry:
      pantry > 0 ? `${Math.round((pantry * 30) / members)} days' food for its ${members}` : "Bare",
    household: r.household
      .map((k) => placeIndexOf(place, k))
      .filter((j) => j >= 0)
      .map((j) =>
        nameOf(
          j,
          `${age(j)}, ${tradeWords(p.sexOcc[j]! & 15, age(j) < life.adulthood).replace(/^an? /, "")}`,
        ),
      ),
    mate: mi >= 0 ? nameOf(mi, mate!.promised ? "promised" : "paired") : null,
    friend: fi >= 0 ? nameOf(fi, "friend") : null,
    ...tiesOf(place, i, nameOf),
    life: lived,
    prose: [
      `Mood ${p.mood[i]! > 0 ? "+" : ""}${p.mood[i]}, going a quarter of the way each day to ${Math.round(to)}, where what bears on it now puts it. It moves what their work is worth to them by ${Math.round(p.mood[i]! / 4)} in a hundred; below ${MOOD_UNHEEDING} they heed no order to change their work.`,
      worth > 0
        ? `Each need presses as its fullness cubed. A need is served when it presses harder than the next hour's work is worth to them (${Math.round(worth * 100)}% by day; less in the dark) and than rest is worth (${Math.round(IDLE_WORTH * 100)}%): the mark on each bar.`
        : `Each need presses as its fullness cubed. They keep no trade, so a need is served when it presses harder than rest is worth (${Math.round(IDLE_WORTH * 100)}%): the mark on each bar.`,
      ...(p.health[i] ? [careWords(place)] : []),
    ],
  };
}

const TIE_HOW = {
  household: "of their household",
  work: "works beside them",
  street: "of their street",
} as const;
/** Whom one of a place's people knows, named, and the count of them said (N8, host/place.ts placeTies). */
function tiesOf(
  place: Place,
  i: number,
  nameOf: (j: number, words: string) => PlaceNamed,
): Pick<PlaceInspectPerson, "ties" | "tiesWords"> {
  const ties = placeTies(place, i),
    friends = ties.filter((t) => t.regard >= FRIEND_AT).length,
    rivals = ties.filter((t) => t.regard <= RIVAL_AT).length;
  return {
    ties: ties.map((t) => ({
      ...nameOf(
        t.j,
        `${regardWords(t.regard)}, ${TIE_HOW[t.how]} (${t.regard > 0 ? "+" : ""}${t.regard})`,
      ),
      regard: t.regard,
    })),
    tiesWords: ties.length
      ? `They know ${ties.length} well: ${friends === 1 ? "1 friend" : `${friends} friends`}, ${rivals === 1 ? "1 rival" : `${rivals} rivals`}. Each met at home, at work or about their street, and thought the better of as they are alike of temper.`
      : "They know no one well yet.",
  };
}

/** The fifths of a land's incomes a household's is of, said (0: the poorest). */
const FIFTH_WORDS = [
  "the poorest fifth",
  "the second fifth",
  "the middle fifth",
  "the fourth fifth",
  "the richest fifth",
];

/**
 * One of a place's people's body and health (the Health tab) and what they have (the Gear tab): each member not whole and
 * how it is, their wound and its days, who tends them, what a wound left them with, what their land knows of care; what
 * they hold, what they work with, what a wound has them bear, their household's pantry and means. All read of the place.
 */
function healthGear(
  world: World,
  place: Place,
  i: number,
  r: NonNullable<ReturnType<typeof placePerson>>,
): Pick<PlaceInspectPerson, "body" | "healthRows" | "gear"> {
  const p = place.people,
    body: { member: WoundMember; words: string; state: MemberState }[] = [],
    at = (member: string, state: MemberState) => {
      if (body.some((x) => x.member === member)) return;
      body.push({
        member: member as WoundMember,
        words: cap(placeMember(world, place, i, member as never)),
        state,
      });
    };
  // (The wound now first: abed with it, or up with it bound and mending; then what an old one left.)
  const hurt = hurtOf(place, i);
  if (hurt.member && (p.health[i] === 1 || p.health[i] === 3))
    at(hurt.member, p.health[i] === 1 ? "abed" : "healing");
  const mark = p.mark[i]!,
    marked = MEMBERS[(mark & 15) - 1];
  if (mark && marked) at(marked, mark >> 4 === 2 ? "lame" : "scarred");
  const days = Math.ceil(p.ill[i]! / 144),
    takes = woundTakes(world, place, i),
    rows: [string, string][] = [
      ["How", p.health[i] ? (healthWords(world, place, i) ?? ailWords(place, i)) : "Well"],
    ];
  if (p.health[i] === 1 || p.health[i] === 2)
    rows.push(
      ["Abed", `${days} more ${days === 1 ? "day" : "days"}`],
      ["Tended", cap(TENDED_WORDS[tendedOf(place, i)])],
    );
  if (p.health[i] === 3) rows.push(["Mending", `${days} more ${days === 1 ? "day" : "days"}`]);
  rows.push(["Lasting", markWords(world, place, i) ?? "No mark of an old wound"]);
  if (takes.handling > 0 || takes.going > 0)
    rows.push([
      "Body",
      `${takes.handling > 0 ? `${Math.round(takes.handling * 100)}% of their handling taken` : "Hands whole"}; ${takes.going > 0 ? `a walk takes them ${gaitOf(takes.going).toFixed(1)}× as long` : "walks as anyone"}`,
    ]);
  if (p.lack[i]! >= 144) rows.push(["In want", `${Math.floor(p.lack[i]! / 144)} days`]);
  rows.push(["Care", careWords(place)]);
  const pantry = r.pantry.reduce((a, b) => a + b, 0),
    members = r.household.length + 1,
    gear: [string, string][] = [
      [
        "In hand",
        r.carry ? `${amount(r.carry.amount)} of ${GOODS[r.carry.good]!.name}` : "Nothing",
      ],
    ];
  if (r.craft) gear.push(["Makes", cap(r.craft)]);
  if (r.workKind) gear.push(["Works at", cap(lotWords(place, r.work))]);
  if (p.health[i] === 3 && hurt.member)
    gear.push([
      "Bound",
      `${cap(placeMember(world, place, i, hurt.member))}, in linen while it mends`,
    ]);
  if (mark >> 4 === 2 && marked)
    gear.push([
      "Bears",
      takes.going > 0 ? "A stick to walk with: a leg was left lame" : "A stiff limb, favoured",
    ]);
  gear.push(
    [
      "Pantry",
      pantry > 0 ? `${Math.round((pantry * 30) / members)} days' food for its ${members}` : "Bare",
    ],
    [
      "Means",
      `Their household is of ${FIFTH_WORDS[r.fifth] ?? "its land's"} incomes: ${Math.round(r.means)} of grain a year`,
    ],
  );
  return { body, healthRows: rows, gear };
}

/** One of a place's lots (its square, its fields, its walls' site too), read for the mode's inspector. */
export function inspectLot(world: World, place: Place, lot: number): PlaceInspectLot {
  const r = placeLot(place, lot),
    p = place.people,
    who = placeWho(world, place),
    site = placeSites(world, place).find((x) => x.lot === lot),
    b = place.bldgs.lot.indexOf(lot),
    kind = lot === AT.walls ? "walls" : (r.kind ?? null),
    shut = b > 0 ? !!ordersOf(world, place.town)?.shut.includes(lot) : null,
    people: PlaceNamed[] = [];
  const add = (ids: readonly number[], words: string, most: number) => {
    for (const id of ids.slice(0, most)) {
      const j = placeIndexOf(place, id);
      if (j < 0 || people.some((x) => x.id === id)) continue;
      people.push({
        id,
        ref: who(j).ref,
        name: who(j).name,
        words: `${words}; ${actWords(p, j)}`,
      });
    }
  };
  add(r.working, "works here", 6);
  add(r.living, "lives here", 6);
  add(r.here, "here now", 4);
  const stock = r.stock
    .map((n, g) => ({ n, g }))
    .filter((x) => x.n > 0)
    .sort((a, c) => c.n - a.n)
    .slice(0, 8)
    .map(({ n, g }) => ({
      name: cap(GOODS[g]!.name),
      n,
      unit: FOODS.includes(g) ? "person-months" : "units",
    }));
  const name = cap(lotWords(place, lot)),
    years = b >= 0 && r.start ? Math.max(0, Math.floor(place.t / (365 * DAY)) - r.start) : null;
  return {
    kind: "lot",
    lot,
    ref: placeLotRef(place.town, lot),
    name,
    icon:
      lot === PLACE_AT.square
        ? "⛲"
        : lot === PLACE_AT.fields
          ? "🌾"
          : kind
            ? (LOT_ICONS[kind] ?? (CIVICS.some((c) => c.kind === kind) ? "🏢" : "🏠"))
            : "🏠",
    years,
    working: r.working.length,
    living: r.living.length,
    here: r.here.length,
    people,
    stock,
    shut,
    site: site
      ? {
          share: site.share,
          stage: siteStage(site.share, site.kind),
          hands: site.inHand ? site.crew.length : site.hands,
        }
      : null,
    words:
      (place.fire.length && place.t < place.fire[1]! && place.fire[0] === lot
        ? "🔥 Burning now: those who live within a cry of it, and any keeping the fire watch, turn out to fight it. "
        : "") +
      (lot === PLACE_AT.square
        ? "The town's square: where its people meet in company, and where those with no roof live."
        : lot === PLACE_AT.fields
          ? "Its fields and pastures outside the town, worked by its farmers and herders."
          : r.households.length
            ? `Home of ${r.households.length} ${r.households.length === 1 ? "household" : "households"}.`
            : kind
              ? `${shut ? "Its work is stopped by your order." : "Worked in by the town's own."}`
              : lot >= 0
                ? "No household lives here now."
                : ""),
  };
}

/** What a ref of the town's names, for its inspector: one of its people (by their page, or their roster's), or a lot. */
export function placeInspect(world: World, town: string, ref: string): PlaceInspect | null {
  const place = enterPlace(world, town);
  if (!place) return null;
  if (ref.startsWith("plcl:")) {
    const n = Number(ref.slice(ref.lastIndexOf(":") + 1));
    if (!Number.isInteger(n)) return null;
    return inspectLot(world, place, n === 999_999_999 ? AT.walls : n - 3);
  }
  let id = ref.startsWith("plc:") ? placedId(ref) : null;
  if (id === null) {
    // (One the god game names: found among the place's people by the page they are told by.)
    const who = placeWho(world, place);
    for (let i = 0; i < place.people.n && id === null; i++)
      if (who(i).ref === ref) id = place.people.id[i]!;
  }
  return id === null ? null : inspectPerson(world, place, id);
}

/** `place.inspect`: { ref: the town, of: what is inspected (a person's or a lot's ref) }. */
export function placeInspectQueries(): Readonly<Record<string, QueryHandler>> {
  return {
    "place.inspect": (world, args) => {
      const a = args as { ref: string; of: string };
      return typeof a?.ref === "string" && typeof a.of === "string"
        ? placeInspect(world, a.ref, a.of)
        : null;
    },
  };
}
