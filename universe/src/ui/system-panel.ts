// The observatory over the home star's system (Phase 5 M46): the star's page — its
// light and age, and its worlds and their moons listed — and a page for each body, its
// orbit and its ground, and why it is so.
import type { SystemPlan } from "../bridge/index.ts";
import { bodyFacts } from "../view/index.ts";
import { el } from "./why.ts";

const KIND_WORDS: Readonly<Record<string, string>> = {
  home: "the home world",
  rocky: "a world of rock",
  giant: "a gas giant",
  "ice giant": "an ice giant",
  moon: "a moon",
};

export class SystemPanel {
  readonly element = el("div", "panel");
  private readonly where = el("span", "clock");
  readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly more = el("div");
  private plan: SystemPlan | null = null;
  onBack: () => void = () => {};
  onSelect: (index: number | null) => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The world");
    back.onclick = () => this.onBack();
    bar.append(back, this.where);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.inspector.hidden = true;
      this.onSelect(null);
    };
    this.inspector.append(close, this.title, this.facts, this.more);
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

  /** Show a system: the star's page, its worlds listed. */
  show(plan: SystemPlan): void {
    this.plan = plan;
    this.where.textContent = `The star's system`;
    this.select(null);
  }

  /** Open a body's page, or (null) the star's. */
  select(index: number | null): void {
    const plan = this.plan;
    if (!plan) return;
    this.inspector.hidden = false;
    if (index === null) {
      const s = plan.star;
      this.title.textContent = `A ${s.spectral} star`;
      this.facts.replaceChildren(
        el(
          "div",
          "fact",
          `${s.luminosity.toFixed(2)} times the Sun's light; ${s.mass.toFixed(2)} of its mass; ${Math.round(s.temperature)} K at its face`,
        ),
        el("div", "fact", `${s.ageGyr.toFixed(1)} billion years old`),
        el(
          "div",
          "fact",
          `its frost line ${plan.frostLine.toFixed(1)} AU out: rock inside it, ice and gas beyond`,
        ),
      );
      this.more.replaceChildren(
        el("h3", undefined, "Its worlds, outward"),
        ...plan.bodies
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b.kind !== "moon")
          .sort((x, y) => x.b.a - y.b.a)
          .map(({ b, i }) => {
            const moons = plan.bodies.filter((m) => m.around === i).length,
              line = el(
                "button",
                "line",
                `${b.designation} — ${KIND_WORDS[b.kind]}${moons ? `, ${moons} moon${moons > 1 ? "s" : ""}` : ""}`,
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
    const b = plan.bodies[index]!,
      star = el("button", "back", "‹ The star");
    star.onclick = () => {
      this.select(null);
      this.onSelect(null);
    };
    this.title.textContent = `${b.designation}: ${KIND_WORDS[b.kind]}`;
    this.facts.replaceChildren(star, ...bodyFacts(b, plan.star).map((f) => el("div", "fact", f)));
    const moons = plan.bodies.map((m, i) => ({ m, i })).filter(({ m }) => m.around === index);
    this.more.replaceChildren(
      el("h3", undefined, "Why is it like this?"),
      ...b.because.map((w) => el("div", "fact", w)),
      ...(moons.length
        ? [
            el("h3", undefined, "Its moons"),
            ...moons.map(({ m, i }) => {
              const line = el("button", "line", `${m.designation} — ${bodyFacts(m, plan.star)[2]}`);
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
}
