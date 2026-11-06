// How a person is, read off the world (B1, classic 49): what they feel, what they are doing and how their body is, each
// a true reading of that person or a plain saying that history keeps none. A ruler holds no mood: what history keeps is
// how many hold their rule rightful, and a page says so. Nothing is kept, nothing drawn, and the same reading is on the
// bar and on their page. A person's body is what their page's own Body line says; their age is against what their people live.
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { bandOf, moodAt, REIGN } from "../../rules/index.ts";
import {
  courtOf,
  handOf,
  healthOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
  type Polity,
} from "../../sim/index.ts";
import type {
  BarReading,
  BarReadings,
  BarTone,
  Block,
  Line,
  PageModel,
} from "../../bridge/index.ts";
import { courtFigure, heirWhy, wantWords } from "../court.ts";
import { sicknessValue } from "./sickness.ts";

const pct = (x: number) => Math.round(x * 100);
/** Old: their people's chance of dying in a year at that age is at least this. */
const OLD_DIES = 0.07;
/** What one at court holds in place of a mood. */
const WANT = "What they want",
  NO_MOOD = "History keeps no mood for them.";
const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");
const read = (
  glyph: string,
  label: string,
  short: string,
  words: string,
  tone: BarTone,
): BarReading => ({ glyph, label, short, words, tone });

/** A stat of their page, in words. */
function statOf(page: PageModel, label: string): string | null {
  const s = page.stats.find((x) => x.label === label);
  return s ? plain(s.value) : null;
}

/** A line of their page's first facts. */
function factOf(page: PageModel, label: string): string | null {
  for (const t of page.tabs)
    if (t.id === "overview")
      for (const b of t.blocks)
        if (b.type === "facts") {
          const r = b.rows.find((x) => x.label === label);
          if (r) return plain(r.value);
        }
  return null;
}

/** The land their page goes to, for what is in the air there. */
function landOfPage(world: World, page: PageModel): number {
  const p = page.place;
  if (p?.scale === "village")
    return populationContext(world).settlements.get(p.town as Ref)?.cell ?? -1;
  return p?.scale === "region" ? p.cell : -1;
}

/** Their body: their page's own Body line, their age against what their people live, and a sickness in their land. */
function healthOfPage(world: World, page: PageModel): BarReading {
  const body = factOf(page, "Body"),
    age = Number(statOf(page, "Age")),
    life = populationContext(world).life,
    // (What their age is to their people: their own chance of dying in a year, which is what takes a ruler too.)
    dies = Number.isFinite(age) ? life.mortality[bandOf(Math.max(0, age), life)]! : 0,
    land = landOfPage(world, page),
    sick = land >= 0 ? sicknessValue(world, land) : 0,
    store = land >= 0 ? healthOf(world) : null,
    sickness = sick > 0 ? store?.get(store.land(land)?.last?.sickness as Ref)?.name : undefined,
    whole = body === null || body === "Whole",
    aged = dies >= OLD_DIES,
    ofAge = Number.isFinite(age)
      ? ` ${age}: at that age ${(dies * 100).toFixed(dies < 0.1 ? 1 : 0)} in a hundred of their people die in a year.`
      : " History keeps no years for them.",
    air =
      sick > 0
        ? ` ${sickness ? sickness[0]!.toUpperCase() + sickness.slice(1) : "A sickness"} has been in their land these last years.`
        : "";
  if (!whole) return read("🩹", "Health", "hurt", `${body}.${ofAge}${air}`, aged ? "bad" : "poor");
  const told = `${body === null ? "History keeps no body for them" : "Whole in body"}.${ofAge}${air}`;
  if (sick > 0) return read("🤒", "Health", "sick", told, "poor");
  if (aged) return read("🧓", "Health", "old", told, "poor");
  return read("💚", "Health", "whole", told, Number.isFinite(age) ? "good" : "plain");
}

/** The war a realm is in now, the newest first; null: at peace. */
export function warOfRealm(world: World, r: Polity) {
  const all = warsOf(world).fighting(r.ref);
  for (let i = all.length - 1; i >= 0; i--) if (all[i]!.ended === null) return all[i]!;
  return null;
}

/** What rule stands over a land, for one who holds no mood of their own. */
function ruleOver(world: World, page: PageModel): BarReading {
  const land = landOfPage(world, page),
    r = land >= 0 ? politiesOf(world).of(land) : undefined,
    o = r && r.ended === null ? orderOf(world)?.of(r.ref) : undefined;
  if (o)
    return read(
      "😶",
      "Mood",
      "none",
      `History keeps no mood for them. Of the rule over them, ${pct(o.legitimacy)} in a hundred hold it rightful.`,
      "plain",
    );
  return read(
    "😶",
    "Mood",
    "no mood",
    "History keeps no mood for them. They belong to no realm: their villages rule themselves.",
    "plain",
  );
}

function rulerRead(world: World, page: PageModel, r: Polity): BarReadings {
  const o = orderOf(world)?.of(r.ref),
    c = courtOf(world)?.of(r.ref),
    living = r.ended === null,
    p = o ? pct(o.legitimacy) : 0,
    mood = !living
      ? read(
          "🕯️",
          "Mood",
          "gone",
          "Their realm has fallen: history does not say where they went.",
          "plain",
        )
      : o
        ? read(
            "⚖️",
            "Standing",
            `${p}`,
            `History keeps no mood for a ruler. It keeps their standing: ${p} in a hundred hold their rule rightful.`,
            o.legitimacy < REIGN.wordLine ? "bad" : p < 50 ? "poor" : "good",
          )
        : read("😶", "Mood", "none", "History keeps no mood for them.", "plain");
  let doing: BarReading;
  const plotter = c?.plot ? c.figures.find((f) => f.id === c.plot!.by) : undefined,
    war = living ? warOfRealm(world, r) : null,
    foe = war ? politiesOf(world).get(war.attacker === r.ref ? war.defender : war.attacker) : null,
    regent = c && c.regent !== null ? c.figures.find((f) => f.id === c.regent) : undefined;
  if (!living)
    doing = read(
      "🕯️",
      "Doing",
      "gone",
      `Their realm fell in year ${r.ended}: they ruled it to the end.`,
      "plain",
    );
  else if (plotter)
    doing = read(
      "🗡️",
      "Doing",
      "plot",
      `${plotter.name} has moved against them: ${pct(c!.plot!.odds)} in a hundred it takes the seat within the year.`,
      "bad",
    );
  else if (war)
    doing = read(
      "⚔️",
      "Doing",
      "war",
      `At war with ${foe ? realmName(foe) : "a realm now gone"}, since year ${war.declared}.`,
      "poor",
    );
  else if (regent)
    doing = read(
      "🪑",
      "Doing",
      "regent",
      `A child on the seat: ${regent.name} holds it for them.`,
      "plain",
    );
  else
    doing = read(
      "👑",
      "Doing",
      "rules",
      `Ruling ${r.members.length === 1 ? "one land" : `${r.members.length.toLocaleString("en-US")} lands`} at peace, since year ${r.ruler.since}.`,
      "good",
    );
  return { mood, doing, health: healthOfPage(world, page) };
}

function courtRead(world: World, ref: string, page: PageModel): BarReadings | null {
  const at = courtFigure(world, ref);
  if (!at) return null;
  const { r, c, f, gone } = at;
  if (!f || !c)
    return {
      mood: read("🕯️", "Mood", "gone", "History keeps no mood for one gone from a court.", "plain"),
      doing: read(
        "🕯️",
        "Doing",
        "gone",
        gone ? `Gone from the court of ${realmName(r)} in year ${gone.year}.` : "Gone from court.",
        "plain",
      ),
      health: healthOfPage(world, page),
    };
  const rival = f.id === c.rival,
    heir = f.id === c.heir,
    plots = c.plot?.by === f.id;
  return {
    mood: rival
      ? read("🔥", WANT, "seat", `${NO_MOOD} ${wantWords(world, r, c, f)}`, "poor")
      : heir
        ? read(
            "⏳",
            WANT,
            "follow",
            `${NO_MOOD} They stand to follow. ${heirWhy(world, r, c, f)}`,
            "plain",
          )
        : read("🗣️", WANT, "say", `${NO_MOOD} ${wantWords(world, r, c, f)}`, "plain"),
    doing: plots
      ? read(
          "🗡️",
          "Doing",
          "plot",
          `Moving against ${r.ruler.name}: ${pct(c.plot!.odds)} in a hundred it takes the seat within the year.`,
          "bad",
        )
      : f.id === c.regent
        ? read("🪑", "Doing", "regent", `Holding the seat for ${r.ruler.name}.`, "plain")
        : read(
            "🏛️",
            "Doing",
            "court",
            `At court since year ${f.since}, with ${pct(f.sway)} in a hundred of the realm's sway.`,
            "plain",
          ),
    health: healthOfPage(world, page),
  };
}

/** How a person is, from their own page and the world behind it. */
export function readingsOf(world: World, ref: string, page: PageModel): BarReadings | null {
  if (ref.startsWith("rule:")) {
    const r = politiesOf(world).get(ref.slice(5) as Ref);
    return r ? rulerRead(world, page, r) : null;
  }
  if (ref.startsWith("court:")) return courtRead(world, ref, page);
  const work = statOf(page, "Work"),
    gone = /^died/.test(statOf(page, "Age") ?? "") || page.icon === "🪦",
    doing = gone
      ? read("🕯️", "Doing", "gone", "No longer among their people.", "plain")
      : work
        ? read(
            "🛠️",
            "Doing",
            work === "a child" ? "child" : work,
            work === "a child" ? "A child, not yet at any work." : `Their work is as a ${work}.`,
            "plain",
          )
        : read("🛠️", "Doing", "untold", "History keeps no work for them.", "plain");
  // One under the god's hand holds a mood, as the hand moved it.
  if (ref.startsWith("agent:")) {
    const w = handOf(world).resting,
      a = w?.agents.find((x) => x.id === Number(ref.slice(6)));
    if (a) {
      const v = a.mood ? moodAt(a.mood.by, a.mood.at, world.now) : 0;
      return {
        mood:
          v > 0.05
            ? read(
                "🙂",
                "Mood",
                "glad",
                `Heartened: ${pct(v)} in a hundred, by what your hand did in someone there.`,
                "good",
              )
            : v < -0.05
              ? read(
                  "😠",
                  "Mood",
                  "sore",
                  `Sore: ${pct(-v)} in a hundred, by what your hand did in someone there.`,
                  "poor",
                )
              : read("😐", "Mood", "even", "Nothing your hand did has moved them.", "plain"),
        doing,
        health: healthOfPage(world, page),
      };
    }
  }
  return { mood: ruleOver(world, page), doing, health: healthOfPage(world, page) };
}

/** Whether a page's person is no longer among the living, as far as history says. */
export function goneOf(world: World, ref: string, page: PageModel): boolean {
  if (ref.startsWith("rule:")) {
    const r = politiesOf(world).get(ref.slice(5) as Ref);
    return !r || r.ended !== null;
  }
  if (ref.startsWith("court:")) {
    const at = courtFigure(world, ref);
    return !at?.f;
  }
  return /^died/.test(statOf(page, "Age") ?? "") || page.icon === "🪦" || page.icon === "🕯️";
}

/** Their page told how they are, and the way on and off the bar. */
export function withBarBlock(world: World, ref: string, page: PageModel): PageModel {
  if (page.kind !== "person" && page.kind !== "agent") return page;
  if (!/^(folk:town:|seat:|heal:|prsn:|agent:|rule:|court:)/.test(ref)) return page;
  const readings = readingsOf(world, ref, page);
  if (!readings) return page;
  const tool: Block = {
    type: "tool",
    tool: "bar.reading",
    args: { ref: page.ref, name: page.title, readings, gone: goneOf(world, ref, page) },
  };
  return {
    ...page,
    tabs: page.tabs.map((t) => (t.id === "overview" ? { ...t, blocks: [tool, ...t.blocks] } : t)),
  };
}

/** What year a world's clock reads. */
export const barYear = (world: World) => yearOfMoment(world.now);
