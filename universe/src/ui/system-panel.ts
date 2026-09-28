// The observatory over the home star's system (Phase 5 M46, M54): the star's page — its
// light and age, who has reached the sky, and its worlds and their moons listed — a page
// for each body, its orbit and its ground, why it is so and the halls set down on it, and
// a page for each colony, with the why of its founding. Another star's system is shown by
// it too (Phase 10 M95): its star and its worlds, without the home's sky or hand.
import type { HostClient, SkyState, SystemPlan } from "../bridge/index.ts";
import { bodyFacts, routeWords } from "../view/index.ts";
import { WhyTree, el } from "./why.ts";
import { folder } from "./window.ts";

const KIND_WORDS: Readonly<Record<string, string>> = {
  home: "the home world",
  rocky: "a world of rock",
  giant: "a gas giant",
  "ice giant": "an ice giant",
  moon: "a moon",
};

type Colony = SkyState["colonies"][number];

/** The sky of a star no one of ours has reached. */
const NO_SKY: SkyState = { programs: [], colonies: [] };

export class SystemPanel {
  readonly element = el("div", "panel");
  private readonly where = el("span", "clock");
  readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly more = el("div");
  private readonly why: WhyTree;
  private readonly client: HostClient;
  private plan: SystemPlan | null = null;
  private sky: SkyState = { programs: [], colonies: [] };
  /** Whether the system shown is another star's. */
  private foreign = false;
  private readonly back = el("button", "speed", "‹ The world");
  private readonly stars = el("button", "speed", "The stars ›");
  /** What the page shows: the star (null), a body, or a colony's land. */
  private page:
    { kind: "star" } | { kind: "body"; index: number } | { kind: "colony"; cell: number } = {
    kind: "star",
  };
  onBack: () => void = () => {};
  onSelect: (index: number | null) => void = () => {};
  /** Out to the stars around. */
  onStars: () => void = () => {};
  /** Down to a world of the system, to see it whole (M81). */
  onVisit: (index: number) => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.why = new WhyTree(client);
    this.client = client;
    const bar = el("header", "bar");
    this.back.onclick = () => this.onBack();
    this.stars.onclick = () => this.onStars();
    bar.append(this.back, this.where, this.stars);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.inspector.hidden = true;
      this.onSelect(null);
    };
    this.inspector.append(
      close,
      folder(this.inspector, this.title),
      this.title,
      this.facts,
      this.more,
    );
    this.element.append(
      bar,
      this.inspector,
      el("p", "hint", "Tap a world to look at it. Drag to turn, pinch or scroll to zoom."),
    );
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** Show a system — the home star's, or (`foreign`) another's: the star's page, its worlds listed. */
  show(plan: SystemPlan, foreign = false): void {
    this.plan = plan;
    this.foreign = foreign;
    this.where.textContent = foreign ? "Another star's system" : "The star's system";
    // (Back from another star's leads to the stars about it.)
    this.back.textContent = foreign ? "‹ The stars around" : "‹ The world";
    this.stars.hidden = foreign;
    this.select(null);
  }

  /** The sky as it stands: who flies, and the colonies (the open page is redrawn, unless it is a colony's why). */
  update(sky: SkyState): void {
    const changed = JSON.stringify(sky) !== JSON.stringify(this.sky);
    this.sky = sky;
    if (!changed || this.inspector.hidden) return;
    if (this.page.kind === "star") this.select(null);
    else if (this.page.kind === "body") this.select(this.page.index);
  }

  /** Open a body's page, or (null) the star's. */
  select(index: number | null): void {
    const plan = this.plan;
    if (!plan) return;
    this.inspector.hidden = false;
    const sky = this.foreign ? NO_SKY : this.sky;
    if (index === null) {
      this.page = { kind: "star" };
      const s = plan.star;
      this.title.textContent = `A ${s.spectral} star`;
      this.facts.replaceChildren(
        el(
          "div",
          "fact",
          `${s.luminosity >= 0.1 ? s.luminosity.toFixed(2) : s.luminosity.toPrecision(2)} times the Sun's light; ${s.mass.toFixed(2)} of its mass; ${Math.round(s.temperature)} K at its face`,
        ),
        el("div", "fact", `${s.ageGyr.toFixed(1)} billion years old`),
        el(
          "div",
          "fact",
          `its frost line ${plan.frostLine.toFixed(1)} AU out: rock inside it, ice and gas beyond`,
        ),
      );
      const flying = sky.programs;
      this.more.replaceChildren(
        ...(this.foreign
          ? []
          : this.acts("Your hand on the star", [
              ["Make it flare (3 years)", "act.flare", { star: s.ref, sign: -1, years: 3 }],
              ["Calm it (3 years)", "act.flare", { star: s.ref, sign: 1, years: 3 }],
            ])),
        ...(flying.length
          ? [
              el("h3", undefined, "In the sky"),
              ...flying.map((p) =>
                el(
                  "div",
                  "fact",
                  `${p.name}: a satellite in ${p.satellite}${p.crew !== null ? `, a crew in ${p.crew}` : ""}${p.station !== null ? `, a station in ${p.station}` : ""}${p.colonies ? `, ${p.colonies} colon${p.colonies > 1 ? "ies" : "y"}` : ""}`,
                ),
              ),
            ]
          : []),
        el("h3", undefined, "Its worlds, outward"),
        ...plan.bodies
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b.kind !== "moon")
          .sort((x, y) => x.b.a - y.b.a)
          .map(({ b, i }) => {
            const moons = plan.bodies.filter((m) => m.around === i).length,
              settled = sky.colonies.filter(
                (c) => c.body === i || plan.bodies[c.body]!.around === i,
              ).length,
              line = el(
                "button",
                "line",
                `${b.designation} — ${KIND_WORDS[b.kind]}${moons ? `, ${moons} moon${moons > 1 ? "s" : ""}` : ""}${settled ? ` · ${settled} settled` : ""}`,
              );
            line.onclick = () => {
              this.select(i);
              this.onSelect(i);
            };
            return line;
          }),
      );
      return;
    }
    this.page = { kind: "body", index };
    const b = plan.bodies[index]!,
      star = el("button", "back", "‹ The star");
    star.onclick = () => {
      this.select(null);
      this.onSelect(null);
    };
    this.title.textContent = `${b.designation}: ${KIND_WORDS[b.kind]}`;
    // (The home world is the first of the home star's; another star's first is a world to visit.)
    const home = index === 0 && !this.foreign,
      way = this.foreign ? null : routeWords(plan, index, plan.star.mass);
    const visit = el("button", "act", home ? "‹ Back to the world" : `Go to ${b.designation} ›`);
    visit.onclick = () => (home ? this.onBack() : this.onVisit(index));
    this.facts.replaceChildren(
      star,
      visit,
      ...bodyFacts(b, plan.star).map((f) => el("div", "fact", f)),
      ...(way ? [el("div", "fact", way)] : []),
    );
    const moons = plan.bodies.map((m, i) => ({ m, i })).filter(({ m }) => m.around === index),
      // Its own halls, and those on its moons.
      halls = sky.colonies.filter((c) => c.body === index || plan.bodies[c.body]!.around === index);
    this.more.replaceChildren(
      ...(home
        ? this.acts("Your hand on the world", [
            ["Warm it (50 years)", "act.warm", { sign: 1, years: 50 }],
            ["Cool it (50 years)", "act.warm", { sign: -1, years: 50 }],
          ])
        : []),
      ...(halls.length
        ? [
            el("h3", undefined, "Its halls"),
            ...halls.map((c) => {
              const line = el(
                "button",
                "line",
                `${c.body === index ? "" : `on ${plan.bodies[c.body]!.designation}: `}${c.people.toLocaleString("en")} people, since ${c.founded}${c.realm ? ` — of ${c.realm}` : " — their own"}`,
              );
              line.onclick = () => this.showColony(c);
              return line;
            }),
          ]
        : []),
      ...(b.because.length
        ? [
            el("h3", undefined, "Why is it like this?"),
            ...b.because.map((w) => el("div", "fact", w)),
          ]
        : []),
      ...(moons.length
        ? [
            el("h3", undefined, "Its moons"),
            ...moons.map(({ m, i }) => {
              const line = el(
                "button",
                "line",
                `${m.designation} — ${bodyFacts(m, plan.star)[2]}${sky.colonies.some((c) => c.body === i) ? " · settled" : ""}`,
              );
              line.onclick = () => {
                this.select(i);
                this.onSelect(i);
              };
              return line;
            }),
          ]
        : []),
    );
  }

  /** Buttons for great acts, each a logged command; the answer said beneath them. */
  private acts(title: string, list: readonly [string, string, unknown][]): HTMLElement[] {
    const note = el("p", "note"),
      row = el("div", "speeds");
    for (const [label, type, args] of list) {
      const b = el("button", "act", label);
      b.onclick = async () => {
        try {
          await this.client.command(type, args);
          note.textContent = "Done: it is in the chronicle, and its why is yours.";
        } catch (error) {
          note.textContent = (error as Error).message;
        }
      };
      row.append(b);
    }
    return [el("h3", undefined, title), row, note];
  }

  /** A colony's page: its people, how they fare, who rules them, and why they are there. */
  private showColony(c: Colony): void {
    const plan = this.plan;
    if (!plan) return;
    this.page = { kind: "colony", cell: c.cell };
    const body = plan.bodies[c.body]!,
      back = el("button", "back", `‹ ${body.designation}`);
    back.onclick = () => {
      this.select(c.body);
      this.onSelect(c.body);
    };
    this.title.textContent = `The halls on ${body.designation}`;
    this.facts.replaceChildren(
      back,
      el("div", "fact", `${c.people.toLocaleString("en")} people`),
      el(
        "div",
        "fact",
        c.fed >= 1000 ? "fed" : `hungry: ${Math.round(c.fed / 10)} in a hundred of what they need`,
      ),
      el(
        "div",
        "fact",
        c.realm
          ? `ruled by ${c.realm}${c.founder && c.founder !== c.realm ? `; founded by ${c.founder}` : ""}`
          : `their own${c.founder ? `; founded by ${c.founder} in ${c.founded}` : ""}`,
      ),
    );
    const whyBox = el("div", "why");
    this.more.replaceChildren(el("h3", undefined, "Why are they there?"), whyBox);
    if (c.event) void this.why.show(c.event, whyBox);
  }
}
