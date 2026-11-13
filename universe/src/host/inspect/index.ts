// Every thing's page (Phase 10 M91, docs/architecture §31): the router from a ref — any
// ref, and the few names that are not refs (a far star, another star's world, one under
// the god's hand) — to its page, and its place for "go to it". Pure reads of the world as
// it stands (the observer ledger aside, which history never reads): asking never moves it.
import { meansPage, measurePage } from "./means.ts";
import { canPage } from "./can.ts";
import { lifeElsewherePage, lifePage } from "./lifepage.ts";
import { parseRef, type World } from "../../kernel/index.ts";
import {
  splitPageRef,
  type Line,
  type PageModel,
  type Place,
  type Tip,
} from "../../bridge/index.ts";
import type { QueryHandler } from "../host.ts";
import { landOfRef, landPage, spotPage } from "./land.ts";
import { agentPage, householdPage, memoryPage, personPage, townPage } from "./settled.ts";
import { shipPage } from "../starfight.ts";
import { battlePage, realmPageModel, relationPage, starWarPage, warPage } from "./realm.ts";
import { allianceOfLand, envoyPage, matchPage } from "./ties.ts";
import { allianceComparePage, alliancesPage, blocPage, leaguePage } from "./alliance.ts";
import { busPage, roadPage } from "./road.ts";
import { askPage } from "./asks.ts";
import { boardPage, dearPage } from "./board.ts";
import { designPage, faithPage, goodPage, languagePage } from "./culture.ts";
import { agePage, depositPageModel, lineagePage, platePageModel } from "./life.ts";
import { bodyPage, foreignWorldPage, starPageModel } from "./sky.ts";
import { civilizationPage } from "./starfolk.ts";
import { folkOnePage, peoplesPage } from "./natives.ts";
import { filledPage } from "../filling.ts";
import { runPage, tradePage } from "../trade.ts";
import { nationPage, nationsPage } from "../nations.ts";
import { actPage, decisionPage, eventPage, unknownPage } from "./history.ts";
import { chroniclePage, ledgerPage } from "./world.ts";
import { statsPage } from "./stats.ts";
import { traitPage } from "./folk.ts";
import {
  goodKindPage,
  matterGuidePage,
  principlePage,
  reactionPage,
  substancePage,
} from "./matter.ts";
import { groundReading } from "./ground.ts";
import { madePage, thingPage } from "./things.ts";
import { cladePage, treePage } from "./tree.ts";
import { alertsOf, breakdownOf, logPage, type Counted } from "./alerts.ts";
import { answersOf } from "./answers.ts";
import { comparePage } from "./compare.ts";
import { crumbsOf } from "./crumbs.ts";
import { DEEP_LENSES, lensReading, type DeepLens } from "../lenses.ts";
import { conceptPage, withConcepts } from "./concepts.ts";
import { withBarBlock } from "./barread.ts";
import { sicknessPage } from "./sickness.ts";
import { housePage } from "./credit.ts";
import { buildingPage, lotPage, wallsPage } from "./fabric.ts";
import { homePage, homeThingPage } from "./home.ts";
import { withLiving } from "./living.ts";
import { campPage } from "./camp.ts";
import { beastPage, herdPage } from "./herds.ts";
import { healerPage } from "./wounds.ts";
import { armPage, armsPage } from "./arm.ts";
import { elementPage } from "./element.ts";
import { levyManPage, townsfolkPage } from "./townsfolk.ts";
import { seatPage, withKin } from "./kin.ts";
import { rulerPage, withLeaderPage } from "./leaders.ts";
import { courtPage } from "./court.ts";
import { songPage, stonePage } from "./memory.ts";
import { casePage } from "./justice.ts";
import { namedPage, type NamesArg } from "../names.ts";
import { lawPage } from "../lanes.ts";

/** The page a ref's kind is built by (the tab it asked for, if any). */
function build(
  world: World,
  ref: string,
  tab: string | null,
  only?: ReadonlySet<string>,
): PageModel {
  if (ref === "world:chronicle") return chroniclePage(world, tab ?? undefined);
  if (ref === "world:ledger") return ledgerPage(world, tab ?? undefined);
  if (ref === "world:log") return logPage(world, tab ?? undefined);
  if (ref === "world:peoples") return peoplesPage(world);
  if (ref === "world:filled") return filledPage(world);
  if (ref === "world:trade") return tradePage(world);
  if (ref === "world:nations") return nationsPage(world);
  // Every alliance at once (the alliances lens's list).
  if (ref === "world:alliances") return alliancesPage(world);
  if (ref.startsWith("nation:")) return nationPage(world, ref.slice("nation:".length));
  if (ref.startsWith("snat:")) return nationPage(world, ref);
  if (ref.startsWith("run:")) return runPage(world, ref);
  if (ref === "world:law") return lawPage(world);
  if (ref === "world:stats") return statsPage(world, tab ?? undefined);
  if (ref === "world:matter") return matterGuidePage(world, tab ?? undefined);
  // What a world can do, measured, and the age that makes it (Phase 65).
  if (ref === "world:means") return meansPage(world, tab ?? undefined);
  // What can be done here, and beside another world (F5).
  if (ref === "world:can") return canPage(world, tab ?? undefined);
  if (ref.startsWith("can:")) return canPage(world, "beside", ref.slice("can:".length));
  // How life began here, or on another world, and beside another (B2).
  if (ref === "world:life") return lifePage(world);
  if (ref.startsWith("lifewith:")) return lifePage(world, ref.slice("lifewith:".length));
  if (ref.startsWith("life:")) return lifeElsewherePage(world, ref);
  if (ref.startsWith("means:")) return measurePage(world, ref);
  // The tree of life (Phase 17 M129), and a line of it no living lineage is.
  if (ref === "world:tree") return treePage(world, tab ?? undefined);
  if (ref.startsWith("clade:")) return cladePage(world, ref);
  if (ref.startsWith("compare:")) return comparePage(world, ref);
  // Two alliances side by side.
  if (ref.startsWith("allyvs:")) return allianceComparePage(world, ref);
  if (ref.startsWith("concept:")) return conceptPage(world, ref);
  if (ref.startsWith("trait:")) return traitPage(world, ref);
  // Matter (Phase 15 M122): substances, reactions, principles, goods the world over.
  if (ref.startsWith("subst:")) return substancePage(world, ref);
  // An element (Phase 54 M223): what it is, and what on this world holds it.
  if (ref.startsWith("elem:")) return elementPage(world, ref);
  if (ref.startsWith("rxn:")) return reactionPage(world, ref);
  if (ref.startsWith("prin:")) return principlePage(world, ref);
  if (ref.startsWith("good:")) return goodKindPage(world, ref);
  // A town's price board, and where a good is cheap and dear (Markets, first slice).
  if (ref.startsWith("board:")) return boardPage(world, ref);
  if (ref.startsWith("dear:")) return dearPage(world, ref);
  if (ref.startsWith("thing:")) return thingPage(world, ref);
  // A tool hung on a smithy's rack, tapped there (Phase 51 M213).
  if (ref.startsWith("made:")) return madePage(world, ref);
  // A trooper's arm in a battle (Phase 53): what its host bore that day, traced from the ground.
  if (ref.startsWith("arm:")) return armPage(world, ref);
  // The arm one man bore in a battle (Phase 55 M228): his own, made by his seat's maker then.
  if (ref.startsWith("arms:")) return armsPage(world, ref);
  // A ship of a fleet drawn, its fate carried in its ref (Phase 67).
  if (ref.startsWith("ship:")) return shipPage(world, ref);
  if (ref.startsWith("gstar:")) return starPageModel(world, ref);
  // One of a people's town (Phase 69).
  if (ref.startsWith("folkone:")) return folkOnePage(world, ref);
  if (ref.includes("/")) return foreignWorldPage(world, ref);
  if (ref.startsWith("agent:")) return agentPage(world, ref);
  // A town's lots, its other buildings, its walls (Phase 25 M151).
  if (ref.startsWith("lot:")) return lotPage(world, ref);
  // A stone a town raised, and a song a people sing (T1).
  if (ref.startsWith("stone:")) return stonePage(world, ref);
  if (ref.startsWith("song:")) return songPage(world, ref);
  // What binds realms (D1).
  if (ref.startsWith("bloc:")) return blocPage(world, ref);
  if (ref.startsWith("league:")) return leaguePage(world, ref);
  if (ref.startsWith("match:")) return matchPage(world, ref);
  if (ref.startsWith("envoy:")) return envoyPage(world, ref);
  // A road and its gang, and what goes a line in a town (R1).
  if (ref.startsWith("road:")) return roadPage(world, ref);
  // What a town was asked (H1).
  if (ref.startsWith("ask:")) return askPage(world, ref);
  if (ref.startsWith("bus:")) return busPage(world, ref);
  // A town's case before whoever judges there (J1).
  if (ref.startsWith("case:")) return casePage(world, ref);
  // A home and what is in it (Lives L6).
  if (ref.startsWith("dwell:")) return homePage(world, ref);
  if (ref.startsWith("dwelt:")) return homeThingPage(world, ref);
  if (ref.startsWith("bldg:")) return buildingPage(world, ref);
  // A town's healer (Phase 55 M229).
  if (ref.startsWith("heal:")) return healerPage(world, ref);
  if (ref.startsWith("walls:")) return wallsPage(world, ref);
  // A band's camp on its land (Phase 28 M159).
  if (ref.startsWith("camp:")) return campPage(world, ref);
  // A land's creatures, and a beast people know (Z1).
  if (ref.startsWith("herd:")) return herdPage(world, ref);
  if (ref.startsWith("beast:")) return beastPage(world, ref);
  // One of a town's many kept by their line, and one of a battle's levy (Phase 55 M225).
  if (ref.startsWith("folk:town:")) return townsfolkPage(world, ref);
  if (ref.startsWith("lv:")) return levyManPage(world, ref);
  // A maker named for their seat at a trade (Phase 55 wave 5).
  if (ref.startsWith("seat:")) return seatPage(world, ref);
  // A realm's ruler (Lives L1).
  if (ref.startsWith("rule:")) return rulerPage(world, ref);
  // One of a realm's court (Lives L5).
  if (ref.startsWith("court:")) return courtPage(world, ref);
  const code = ref.slice(0, ref.indexOf(":")),
    t = tab ?? undefined;
  switch (code) {
    case "cell":
      return landPage(world, parseRef(ref as never).b, t);
    case "folk":
    case "ways":
      return landPage(world, landOfRef(ref), "people");
    case "regn":
      return landPage(world, landOfRef(ref), t);
    case "spot":
      return spotPage(world, parseRef(ref as never).b);
    case "town":
      return townPage(world, ref);
    case "hhold":
      return householdPage(world, ref);
    case "prsn":
      return personPage(world, ref);
    case "memo":
      return memoryPage(world, ref);
    case "pol":
      return realmPageModel(world, ref, only);
    case "rel":
      return relationPage(world, ref);
    case "war":
      return warPage(world, ref, t, only);
    case "swar":
      return starWarPage(world, ref);
    case "faith":
      return faithPage(world, ref);
    case "lang":
      return languagePage(world, ref);
    case "dsgn":
      return designPage(world, ref);
    case "mkt":
      return goodPage(world, ref);
    case "spec":
      return lineagePage(world, ref);
    case "depo":
      return depositPageModel(world, ref);
    case "plate":
      return platePageModel(world, ref);
    case "age":
      return agePage(world, ref);
    case "star":
      return starPageModel(world, ref);
    case "plnt":
    case "moon":
      return bodyPage(world, ref);
    case "civ":
      return civilizationPage(world, ref);
    case "sick":
      return sicknessPage(world, ref);
    case "house":
      return housePage(world, ref);
    case "ev":
      return eventPage(world, ref);
    case "dec":
      return decisionPage(world, ref);
    case "cmd":
      return actPage(world, ref);
    default:
      return unknownPage(world, ref);
  }
}

/**
 * A thing's page, by its ref (`#tab` opens a tab: `war:0:3#attacker`). A thing that no
 * longer stands (a realm fallen, a town gone) still answers: what is known of it.
 */
export function pageOf(
  world: World,
  ref: string,
  names?: NamesArg,
  /** Asked only for its name, its place or its first numbers: where someone lives is not read for that. */
  brief = false,
  /** Only these tabs read, where a page's kind can leave the others out (a whole history is written from thousands of pages). */
  only?: ReadonlySet<string>,
): PageModel {
  const { ref: base, tab } = splitPageRef(ref);
  let page: PageModel;
  try {
    // (One of the town's people: their family and their body, Phase 55 wave 5.)
    page = withConcepts(
      tidy(
        withKin(
          world,
          base,
          brief
            ? withLeaderPage(world, base, build(world, base, tab, only))
            : withLiving(world, base, withLeaderPage(world, base, build(world, base, tab))),
        ),
      ),
    );
    // (How they are now, and the way on and off the people bar: B1.)
    if (!brief) page = withBarBlock(world, base, page);
  } catch {
    return unknownPage(world, base, true);
  }
  const crumbs = crumbsOf(world, base);
  if (crumbs.length) page = { ...page, crumbs };
  if (tab && !page.tab) page = { ...page, tab };
  // (Told as the people where one stands call things, where it is asked so: Phase 58. Asked
  // without, the page is as it was.)
  return names?.as === "theirs" ? namedPage(world, page, names.at ?? null) : page;
}

/** A page without its empty lists and tables, nor the tabs left with nothing in them. */
function tidy(page: PageModel): PageModel {
  const tabs = page.tabs
    .map((t) => ({
      ...t,
      blocks: t.blocks.filter(
        (b) =>
          !(b.type === "list" && !b.items.length && !b.more) &&
          !(b.type === "composition" && !b.parts.length) &&
          !(b.type === "table" && !b.rows.length) &&
          !(b.type === "facts" && !b.rows.length) &&
          !(b.type === "chart" && b.points.length < 2) &&
          !(b.type === "series" && b.points.length < 2) &&
          !(b.type === "lines" && !b.series.some((x) => x.points.length > 1)) &&
          !(b.type === "bars" && !b.bars.length) &&
          !(b.type === "tally" && !b.rows.length) &&
          !(b.type === "timeline" && !b.rows.length),
      ),
    }))
    .filter((t) => t.blocks.some((b) => b.type !== "tool"));
  return { ...page, tabs: tabs.length ? tabs : page.tabs.slice(0, 1) };
}

/** Where a thing is to be seen, for "go to it". */
export function placeOf(world: World, ref: string): Place | null {
  return pageOf(world, ref, undefined, true).place;
}

/**
 * A thing in a few words, for a tooltip (Phase 10 M93): its icon and name, the line under
 * its name and its first numbers — its page's, in plain words.
 */
export function tipOf(world: World, ref: string, lens?: string, names?: NamesArg): Tip {
  const p = pageOf(world, ref, names, true),
    plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join(""),
    // (A concept is told by what it is, not by the kind of page it has.)
    what = p.kind === "concept" ? p.tabs[0]?.blocks.find((b) => b.type === "text") : undefined;
  // A land under one of the deeper lenses (Phase 12 M108): what makes its number, first.
  // (The ways lens reads one way at a time: "ways:valour".)
  const land = ref.startsWith("cell:0:") ? Number(ref.slice(7)) : NaN,
    [kind, way] = (lens ?? "").split(":"),
    reading =
      kind === "ground" && Number.isInteger(land)
        ? groundReading(world, land)
        : // (The alliances lens: the alliance a land stands in. D1.)
          kind === "blocs" && Number.isInteger(land)
          ? allianceOfLand(world, land)
          : kind && (DEEP_LENSES as readonly string[]).includes(kind) && Number.isInteger(land)
            ? lensReading(world, land, kind as DeepLens, way)
            : null;
  if (reading)
    return { ref, icon: p.icon, title: p.title, line: reading.line, stats: reading.stats };
  return {
    ref,
    icon: p.icon,
    title: p.title,
    line: what?.type === "text" && what.lines[0] ? plain(what.lines[0]) : plain(p.subtitle),
    stats: p.stats.slice(0, 3).map((s) => ({ label: s.label, value: plain(s.value) })),
  };
}

export const INSPECT_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** Any thing's page, by its ref. */
  page: (world, args) => pageOf(world, (args as { ref: string }).ref),
  /** Where a thing is to be seen. */
  place: (world, args) => placeOf(world, (args as { ref: string }).ref),
  /** A thing in a few words, for a tooltip. */
  tip: (world, args) => {
    const a = args as { ref: string; lens?: string };
    return tipOf(world, a.ref, a.lens);
  },
  /** What stands now and asks to be looked at (M96). */
  alerts: (world) => alertsOf(world),
  /** What one of the top bar's numbers is made of (M97). */
  "world.breakdown": (world, args) => breakdownOf(world, (args as { what: Counted }).what),
};

export { alertsOf, answersOf, breakdownOf, type Counted };
export { WORLD_STAGES, stageOf, worldFirstsNow } from "./stage.ts";

export { battlePage };
