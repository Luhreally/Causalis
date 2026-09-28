// Every thing's page (Phase 10 M91, docs/architecture §31): the router from a ref — any
// ref, and the few names that are not refs (a far star, another star's world, one under
// the god's hand) — to its page, and its place for "go to it". Pure reads of the world as
// it stands (the observer ledger aside, which history never reads): asking never moves it.
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
import { battlePage, realmPageModel, relationPage, starWarPage, warPage } from "./realm.ts";
import { designPage, faithPage, goodPage, languagePage } from "./culture.ts";
import { agePage, depositPageModel, lineagePage, platePageModel } from "./life.ts";
import { bodyPage, civilizationPage, foreignWorldPage, starPageModel } from "./sky.ts";
import { actPage, decisionPage, eventPage, unknownPage } from "./history.ts";
import { chroniclePage, ledgerPage } from "./world.ts";
import { statsPage } from "./stats.ts";
import { traitPage } from "./folk.ts";
import { goodKindPage, principlePage, reactionPage, substancePage } from "./matter.ts";
import { groundReading } from "./ground.ts";
import { thingPage } from "./things.ts";
import { alertsOf, breakdownOf, logPage, type Counted } from "./alerts.ts";
import { answersOf } from "./answers.ts";
import { comparePage } from "./compare.ts";
import { crumbsOf } from "./crumbs.ts";
import { DEEP_LENSES, lensReading, type DeepLens } from "../lenses.ts";
import { conceptPage, withConcepts } from "./concepts.ts";

/** The page a ref's kind is built by (the tab it asked for, if any). */
function build(world: World, ref: string, tab: string | null): PageModel {
  if (ref === "world:chronicle") return chroniclePage(world, tab ?? undefined);
  if (ref === "world:ledger") return ledgerPage(world, tab ?? undefined);
  if (ref === "world:log") return logPage(world, tab ?? undefined);
  if (ref === "world:stats") return statsPage(world, tab ?? undefined);
  if (ref.startsWith("compare:")) return comparePage(world, ref);
  if (ref.startsWith("concept:")) return conceptPage(world, ref);
  if (ref.startsWith("trait:")) return traitPage(world, ref);
  // Matter (Phase 15 M122): substances, reactions, principles, goods the world over.
  if (ref.startsWith("subst:")) return substancePage(world, ref);
  if (ref.startsWith("rxn:")) return reactionPage(world, ref);
  if (ref.startsWith("prin:")) return principlePage(world, ref);
  if (ref.startsWith("good:")) return goodKindPage(world, ref);
  if (ref.startsWith("thing:")) return thingPage(world, ref);
  if (ref.startsWith("gstar:")) return starPageModel(world, ref);
  if (ref.includes("/")) return foreignWorldPage(world, ref);
  if (ref.startsWith("agent:")) return agentPage(world, ref);
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
      return realmPageModel(world, ref);
    case "rel":
      return relationPage(world, ref);
    case "war":
      return warPage(world, ref, t);
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
export function pageOf(world: World, ref: string): PageModel {
  const { ref: base, tab } = splitPageRef(ref);
  let page: PageModel;
  try {
    page = withConcepts(tidy(build(world, base, tab)));
  } catch {
    return unknownPage(world, base, true);
  }
  const crumbs = crumbsOf(world, base);
  if (crumbs.length) page = { ...page, crumbs };
  return tab && !page.tab ? { ...page, tab } : page;
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
  return pageOf(world, ref).place;
}

/**
 * A thing in a few words, for a tooltip (Phase 10 M93): its icon and name, the line under
 * its name and its first numbers — its page's, in plain words.
 */
export function tipOf(world: World, ref: string, lens?: string): Tip {
  const p = pageOf(world, ref),
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

export { battlePage };
