// A landing on a world of natives, as a page and a film read it (Phase 70, first slice): who came and what they carried,
// who met them and with what, what it cost each side, and who holds the ground now, told in words true both ways. A pure
// read of rules/landfall.ts's fight on what history holds of the arrival. Nothing here enters history: the page says so.
import { DAY, type World } from "../kernel/index.ts";
import { CLADES, partWords, type BodyPlan } from "../rules/index.ts";
import {
  STAGE_WORDS,
  civilizationsNear,
  clusterOf,
  folkArms,
  folkOf,
  homePlanet,
  landfallsOf,
  peopleWords,
  politiesOf,
  realmName,
  lanesOf,
  starSitesOf,
  type Folk,
  type FolkStage,
  type Landfall,
} from "../sim/index.ts";
import type { Block, LandfallPlan, LandfallRow } from "../bridge/index.ts";
import { lifeHere } from "./biochem.ts";
import { figureBody } from "./folk.ts";
import { comer, folkFigure } from "./natives.ts";
import { PEOPLE_COLORS } from "./peoples.ts";
import type { QueryHandler } from "./host.ts";
import { stat } from "./inspect/words.ts";

const many = (n: number) => Math.round(n).toLocaleString("en");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How many, in plain words: nobody can count a host to the last one from this far. */
function some(n: number, what: string, one: string): string {
  return n === 1 ? `one ${one}` : `${many(n)} ${what}`;
}

/** Who holds the ground now, and what the fight left there: true of what history holds, whichever way it went. */
function leaves(
  who: string,
  name: string,
  l: Landfall,
  burns: boolean,
  place: string,
): { holds: "comers" | "natives"; words: string; left: string } {
  const f = l.fight,
    gone = burns ? "burned" : "pulled down";
  if (f.won)
    return {
      holds: "comers",
      words: l.stay
        ? `${cap(who)} hold the ground. ${cap(place)} of the ${name} was ${gone}, and those who lived went from it.`
        : `${cap(who)} took the ground and have since gone from that world. ${cap(place)} of the ${name} was ${gone} all the same.`,
      left: gone,
    };
  return {
    holds: "natives",
    words: l.stay
      ? `The ${name} hold their ground. ${cap(who)} went back to what they came down in, and have not come out among them since.`
      : `The ${name} hold their ground. ${cap(who)} went back to their ships, and are gone from that world now.`,
    left: "held",
  };
}

/** A landing as the film and the pages read it. */
export function landfallPlan(world: World, f: Folk, l: Landfall): LandfallPlan {
  const a = l.arrival,
    fight = l.fight,
    who = comer(world, a),
    star = clusterOf(world).find((s) => s.ref === f.star)!,
    civIndex = a.civ ? civilizationsNear(world).findIndex((c) => c.ref === a.civ) : -1,
    color =
      civIndex >= 0
        ? PEOPLE_COLORS[civIndex % PEOPLE_COLORS.length]!
        : ([0.86, 0.9, 0.96] as const),
    site = a.kind === "home" && a.cell !== null ? starSitesOf(world)?.get(a.cell) : undefined,
    // (A ship sent through the lanes to look holds no land: its realm is told by what it was, Phase 68.)
    visit = a.visit !== undefined ? lanesOf(world)?.visits[a.visit] : undefined,
    realm = site
      ? politiesOf(world).get(site.realm)
      : visit
        ? politiesOf(world).get(visit.realm)
        : undefined,
    home = homePlanet(world).generated.life.people?.body,
    ape = CLADES.find((x) => x.id === "ape")!.body as unknown as BodyPlan,
    stage = a.found as FolkStage,
    camp = stage === "camps",
    burns = f.means.burns,
    place = camp ? "the camp" : stage === "villages" ? "the village" : "the town",
    armPart = l.comers.parts.find((p) => p.role === "arm")!,
    guard = l.comers.parts.find((p) => p.role === "guard")!,
    mount = l.comers.parts.find((p) => p.role === "mount")!,
    natArm = l.natives.parts.find((p) => p.role === "arm")!,
    arms = folkArms(f, stage),
    armed = natArm.id === "spear" || natArm.id === "sword" || natArm.id === "club",
    ships = l.ships === 1 ? "A ship" : `${many(l.ships)} ships`,
    flesh = l.comers.flesh,
    made = l.comers.made,
    carry = partWords(armPart),
    host =
      made > 0
        ? `${many(made)} made soldiers and ${many(flesh)} of their own, with ${carry}`
        : `${many(flesh)} of their own, with ${carry}`,
    came = `${ships} of ${who.name}${realm ? `, sent by ${realmName(realm)},` : ""} came after ${many(l.years)} years on the way. They put down ${host}.`,
    men = fight.fielded[1],
    met = `Some ${many(men)} of the ${f.name} came against them, of ${many(l.natives.people)} in all, with ${arms.join("; ") || "nothing made"}.`,
    fled = Math.max(
      0,
      men - fight.crossed - Math.max(0, fight.dead[1] - fight.crossed * fight.killedShare),
    ),
    dead = fight.dead,
    costC =
      dead[0] > 0
        ? `${some(dead[0], "of those who came fell", "of those who came fell")}`
        : "none of those who came fell",
    costN = `${some(dead[1], `of the ${f.name} died`, `of the ${f.name} died`)}${fight.won ? `, and ${some(Math.round(fled), "fled", "fled")}` : ""}`,
    cost = `It cost them this: ${costC}; ${costN}.`,
    left = leaves(who.name, f.name, l, burns, place),
    how =
      fight.how === "broke crossing"
        ? `They broke crossing the fire, ${Math.round(fight.off)} metres of it, before any could reach those who came.`
        : fight.how === "broke at the hand"
          ? "They got through to the hand, and there they broke."
          : fight.how === "overrun"
            ? `They came through the fire, ${some(fight.crossed, "of them struck on the way", "struck on the way")}, and those who came broke at the hand.`
            : "Neither broke. Those who came could not finish what they could not reach the end of, and went back.",
    figure = who.figure ?? figureBody(home ?? ape, null);
  return {
    id: `landfall:${f.ref}:${l.n}`,
    star: f.star,
    index: f.planet,
    n: l.n,
    year: a.year,
    nowYear: Math.floor(world.now / (365 * DAY)),
    kind: a.kind,
    who: who.name,
    whoRef: l.ref,
    sentBy: realm ? realmName(realm) : null,
    color,
    figure,
    natives: f.name,
    nativesRef: f.ref,
    stage,
    stageWords: STAGE_WORDS[stage],
    camp,
    nativeFigure: folkFigure(f, star),
    gravity: f.gravity,
    ships: l.ships,
    flesh,
    made,
    years: l.years,
    distance: l.distance,
    arm: armPart.id,
    armWords: carry,
    guard: guard.id,
    mount: mount.id,
    nativeArm: natArm.id,
    nativeArmWords: arms[0] ?? "nothing made",
    nativeHolds: armed,
    people: l.natives.people,
    won: fight.won,
    how: fight.how,
    fielded: fight.fielded,
    dead: fight.dead,
    crossed: fight.crossed,
    killedShare: fight.killedShare,
    comerKilledShare: fight.comerKilledShare,
    brokeShare: fight.brokeShare,
    off: fight.off,
    nativeOff: fight.nativeOff,
    fire: fight.fire,
    frames: fight.frames,
    rout: fight.rout,
    burns,
    terms: fight.terms.map((t) => t.words),
    landers: l.ships === 1 ? "A ship of theirs comes" : `${many(l.ships)} ships of theirs come`,
    cameWords: came,
    metWords: met,
    howWords: how,
    costWords: cost,
    holds: left.holds,
    holdsWords: left.words,
    endWords: `${how} ${cost} ${left.words}`,
    stay: l.stay,
  };
}

/** The landings on a people, as plans (kept for a year: a page and a panel may read it again and again). */
const PLANS = new Map<string, readonly LandfallPlan[]>();
export function landfallPlans(world: World, f: Folk): readonly LandfallPlan[] {
  const key = `${world.seed.text} ${f.ref} ${Math.floor(world.now / (365 * DAY))}`,
    known = PLANS.get(key);
  if (known) return known;
  const out = landfallsOf(world, f, lifeHere(world)).map((l) => landfallPlan(world, f, l));
  if (PLANS.size >= 32) PLANS.delete(PLANS.keys().next().value!);
  PLANS.set(key, out);
  return out;
}

/** One line for each landing on a people. */
export function landfallRows(world: World, f: Folk): readonly LandfallRow[] {
  return landfallPlans(world, f).map((p) => ({
    n: p.n,
    year: p.year,
    who: p.who,
    won: p.won,
    holds: p.holdsWords,
  }));
}

/** What a page tells of the landings on a people, and the way to watch each. */
export function landfallBlocks(world: World, f: Folk): Block[] {
  return landfallPlans(world, f).flatMap((p): Block[] => [
    {
      type: "facts",
      title: `Year ${p.year}: ${p.who} came down`,
      rows: [
        stat("Who came", p.cameWords),
        stat("Who met them", p.metWords),
        stat("How it went", p.howWords),
        stat("What it cost", p.costWords),
        ...(p.terms.length ? [stat("What told", p.terms.join(" "))] : []),
        stat("Who holds the ground", p.holdsWords),
      ],
    },
    {
      type: "tool",
      tool: "watch.landfall",
      args: { star: p.star, index: p.index, n: p.n, label: `⚔ Watch them come (year ${p.year})` },
    },
  ]);
}

/** The way history stands with it, for a page. */
export const LANDFALL_NOTE =
  "History holds that they came and whose ship it was. What passed on the ground is read from the numbers of both sides, the same every time, and moves nothing that follows. How many and how far are estimates.";

export const LANDFALL_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** A landing on a people's world (its place among them, the first by default). */
  "folk.landfall": (world, args) => {
    const a = args as { star: string; index: number; n?: number },
      parts = a.star.split(":"),
      s =
        clusterOf(world).find((x) => x.ref === a.star) ??
        clusterOf(world).find((x) => x.sector === Number(parts[1]) && x.k === Number(parts[2]));
    const f = s ? folkOf(world, s, a.index) : null;
    if (!f) return null;
    return landfallPlans(world, f)[a.n ?? 0] ?? null;
  },
};

void peopleWords;
