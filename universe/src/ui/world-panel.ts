// A world in depth (Phase 8 M81): the page of any body of the star's system seen whole —
// what it is and why, whose halls stand on it, and what the ground is like where it is
// tapped. Back to the sky from it.
import type { SkyState, StarPage, SystemPlan, WorldGlobe } from "../bridge/index.ts";
import { bodyFacts, starWords } from "../view/index.ts";
import { el } from "./why.ts";
import { folder } from "./window.ts";
import { steerWords } from "./keys.ts";

const COVER_WORDS = ["bare ground", "sea", "ice"];

export class WorldPanel {
  readonly element = el("div", "panel");
  readonly inspector = el("section", "inspector");
  private readonly where = el("span", "clock");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly spot = el("div", "fact");
  private readonly more = el("div");
  private readonly back = el("button", "speed", "‹ The sky");
  onBack: () => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar"),
      back = this.back;
    back.onclick = () => this.onBack();
    bar.append(back, this.where);
    this.inspector.append(
      folder(this.inspector, this.title),
      this.title,
      this.facts,
      this.spot,
      this.more,
    );
    this.element.append(
      bar,
      this.inspector,
      el("p", "hint", `Tap the ground to see what it is like there. ${steerWords("round")}`),
    );
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** Show a world: its facts, its why and its halls (from the system's plan and the sky's state). */
  show(plan: SystemPlan, index: number, world: WorldGlobe, sky: SkyState): void {
    const b = plan.bodies[index]!;
    this.where.textContent = b.designation;
    this.title.textContent = `${b.designation}, seen whole`;
    this.inspector.hidden = false;
    this.facts.replaceChildren(...bodyFacts(b, plan.star).map((f) => el("div", "fact", f)));
    this.spot.textContent =
      world.kind === "giant" || world.kind === "ice giant"
        ? `No ground: bands of cloud, ${world.bands} of them${world.storm ? ", and a great storm" : ""}`
        : `${world.craters ? `Its face is cratered: no thick air wore the old strikes away. ` : ""}Tap the ground to look closer.`;
    const halls = sky.colonies.filter((c) => c.body === index);
    this.more.replaceChildren(
      ...(halls.length
        ? [
            el("h3", undefined, "Its halls"),
            ...halls.map((c) =>
              el(
                "div",
                "fact",
                `${c.people.toLocaleString("en")} people, since ${c.founded}${c.realm ? ` — of ${c.realm}` : " — their own"}`,
              ),
            ),
          ]
        : []),
      el("h3", undefined, "Why is it like this?"),
      ...b.because.map((w) => el("div", "fact", w)),
    );
  }

  /** Where the bar's back button leads, in words. */
  set backTo(words: string) {
    this.back.textContent = `‹ ${words}`;
  }

  /** Another star's world: what it is, from the star's page; its life and its people, as of `year`. */
  showForeign(star: StarPage, index: number, world: WorldGlobe, year: number): void {
    const w = star.worlds[index]!,
      letter = String.fromCharCode(98 + index),
      name = starWords(star);
    this.where.textContent = `${letter}, of ${name}`;
    this.title.textContent = `${letter}, seen whole`;
    this.inspector.hidden = false;
    const kind =
      w.kind === "rocky" ? "a world of rock" : w.kind === "giant" ? "a gas giant" : "an ice giant";
    this.facts.replaceChildren(
      el(
        "div",
        "fact",
        `${kind}, ${w.a.toFixed(2)} AU from ${name} ${star.distance.toFixed(0)} light-years from home`,
      ),
      el(
        "div",
        "fact",
        `${w.mass.toFixed(2)} times the home world's mass; gravity ${w.gravity.toFixed(2)} g`,
      ),
      el(
        "div",
        "fact",
        `${Math.round(w.temperature)} °C ${w.kind === "rocky" ? "on the ground" : "at the cloud tops"}; ${w.air === "none" ? "no air" : `${w.air} air (${w.pressure.toFixed(2)} bar)`}; ${w.water === "seas" ? "seas" : w.water === "ice" ? "water as ice" : "no water"}`,
      ),
    );
    this.spot.textContent =
      world.kind === "giant" || world.kind === "ice giant"
        ? `No ground: bands of cloud, ${world.bands} of them${world.storm ? ", and a great storm" : ""}`
        : `${world.craters ? "Its face is cratered: no thick air wore the old strikes away. " : ""}Tap the ground to look closer.`;
    const p = world.people,
      when = (y: number, what: string, done: string) =>
        y <= year
          ? `${done} in year ${y} of our chronicle`
          : `${what} in year ${y} of our chronicle`;
    this.more.replaceChildren(
      ...(world.living
        ? [
            el("h3", undefined, "Life"),
            el(
              "div",
              "fact",
              "Life greens its lands: seas about a star old enough for it, forests where rain falls, deserts where it does not, ice about the poles",
            ),
          ]
        : []),
      ...(p
        ? [
            el("h3", undefined, "A people of another star"),
            el("div", "fact", `The ${p.name} rose to thought here, a people of the ${p.medium}`),
            el(
              "div",
              "fact",
              when(p.electronics, "They will come to electronics", "They came to electronics") +
                (p.electronics <= year ? ": their cities' lights show on its night side" : ""),
            ),
            el("div", "fact", when(p.orbit, "They will reach orbit", "They reached orbit")),
            el(
              "div",
              "fact",
              when(p.stars, "They will set out for the stars", "They set out for the stars"),
            ),
            el(
              "div",
              "fact",
              p.heard !== null
                ? `Home first heard them in year ${p.heard}, their signals ${star.distance.toFixed(0)} years on the way`
                : "Home has not heard them yet",
            ),
          ]
        : [
            el(
              "p",
              "muted",
              "No one from home has walked here: what is seen is what its star, its mass and its orbit make of it.",
            ),
          ]),
    );
  }

  /** What the ground is like at a cell tapped. */
  cell(world: WorldGlobe, cell: number | null): void {
    if (cell === null || world.kind === "giant" || world.kind === "ice giant") return;
    const e = world.elevation[cell]!,
      t = world.temperature[cell]!,
      cover = COVER_WORDS[world.cover[cell]!] ?? "ground";
    this.spot.textContent = `Here: ${cover}, ${Math.round(t)} °C on average, ${e >= 0 ? `${(e / 1000).toFixed(1)} km above` : `${(-e / 1000).toFixed(1)} km below`} its mean ground`;
  }
}
