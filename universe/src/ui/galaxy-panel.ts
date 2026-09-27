// The whole galaxy (Phase 8 M80): what it is — its arms, its breadth, where home lies in it
// — and, where it is tapped, the stars there (the real ones, the brightest first); a page
// for each star, its worlds listed, and any world gone to, to see it whole.
import type { ClusterStar, GalaxyPlan, HostClient, StarPage } from "../bridge/index.ts";
import { starWords } from "../view/index.ts";
import { el } from "./why.ts";
import { folder } from "./window.ts";

const KIND = (k: string) =>
  k === "rocky" ? "a world of rock" : k === "giant" ? "a gas giant" : "an ice giant";

const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);

const ly = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)} thousand light-years` : `${Math.round(n)} light-years`;

export class GalaxyPanel {
  readonly element = el("div", "panel");
  readonly inspector = el("section", "inspector");
  private readonly where = el("span", "clock");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly more = el("div");
  private readonly client: HostClient;
  private plan: GalaxyPlan | null = null;
  private found: ClusterStar[] = [];
  /** Bumped on every change of page, so late answers are dropped. */
  private view = 0;
  onBack: () => void = () => {};
  /** A star picked (to ring it where it lies), and a world of it gone to. */
  onStar: (star: ClusterStar | null) => void = () => {};
  onVisit: (star: StarPage, index: number) => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The stars around");
    back.onclick = () => this.onBack();
    bar.append(back, this.where);
    this.inspector.append(folder(this.inspector, this.title), this.title, this.facts, this.more);
    this.element.append(
      bar,
      this.inspector,
      el(
        "p",
        "hint",
        "Tap anywhere on the galaxy to find the stars there. Drag to turn, pinch or scroll to zoom.",
      ),
    );
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** The galaxy's own page. */
  show(plan: GalaxyPlan): void {
    this.plan = plan;
    this.view++;
    this.where.textContent = "The galaxy";
    this.title.textContent = "The galaxy";
    this.inspector.hidden = false;
    this.facts.replaceChildren(
      el("div", "fact", `A disk ${ly(2 * plan.radius)} across, with ${plan.arms} spiral arms`),
      el("div", "fact", `Home lies ${ly(plan.homeRadius)} out from its middle`),
      el(
        "div",
        "fact",
        `Most of its stars within ${ly(plan.scale)} of the middle, old ones in the bulge, young ones along the arms`,
      ),
    );
    this.more.replaceChildren(el("p", "muted", "Tap a part of it to find the stars there."));
  }

  /** The stars found about a spot (light-years from home). */
  async near(x: number, y: number): Promise<void> {
    const view = ++this.view;
    this.title.textContent = `${ly(Math.hypot(x, y))} from home`;
    this.facts.replaceChildren(el("p", "muted", "Looking…"));
    this.more.replaceChildren();
    this.inspector.hidden = false;
    const found = await this.client.query<ClusterStar[]>({ type: "galaxy.near", args: { x, y } });
    if (this.view !== view) return;
    this.found = found;
    const back = el("button", "back", "‹ The galaxy");
    back.onclick = () => this.plan && this.show(this.plan);
    this.facts.replaceChildren(
      back,
      el(
        "div",
        "fact",
        found.length
          ? `${found.length} of the brightest stars there`
          : "No stars there worth the name",
      ),
    );
    this.more.replaceChildren(
      ...found.map((s) => {
        const line = el(
          "button",
          "line",
          `${cap(starWords(s))} (${s.spectral}), ${ly(s.distance)} from home — ${s.planets ? `${s.planets} world${s.planets === 1 ? "" : "s"}${s.seas ? `, ${s.seas} with seas` : ""}` : "no worlds"}`,
        );
        line.onclick = () => void this.star(s);
        return line;
      }),
    );
  }

  /** A star's page: what it is, and its worlds to go to. */
  async star(s: ClusterStar): Promise<void> {
    const view = ++this.view;
    this.onStar(s);
    this.title.textContent = `${cap(starWords(s))} (${s.spectral})`;
    const back = el("button", "back", "‹ The stars there");
    back.onclick = () => {
      this.view++;
      this.onStar(null);
      this.title.textContent = "The stars there";
      this.facts.replaceChildren(
        el("div", "fact", `${this.found.length} of the brightest stars there`),
      );
      this.more.replaceChildren(
        ...this.found.map((f) => {
          const line = el(
            "button",
            "line",
            `${cap(starWords(f))} (${f.spectral}), ${ly(f.distance)} from home`,
          );
          line.onclick = () => void this.star(f);
          return line;
        }),
      );
    };
    this.facts.replaceChildren(
      back,
      el(
        "div",
        "fact",
        `${ly(s.distance)} from home: its light left it ${ly(s.distance).replace("light-", "")} ago`,
      ),
      el(
        "div",
        "fact",
        s.remnant
          ? `a star that has burned out: ${s.mass.toFixed(2)} of the Sun's mass left`
          : `${s.mass.toFixed(2)} of the Sun's mass, ${s.luminosity < 0.01 ? s.luminosity.toExponential(1) : s.luminosity.toFixed(2)} of its light, ${Math.round(s.temperature)} K at its face, ${s.ageGyr.toFixed(1)} billion years old`,
      ),
    );
    this.more.replaceChildren(el("p", "muted", "…"));
    const page = await this.client.query<StarPage>({ type: "galaxy.star", args: { ref: s.ref } });
    if (this.view !== view) return;
    this.more.replaceChildren(
      el("h3", undefined, page.worlds.length ? "Its worlds, outward" : "No worlds about it"),
      ...page.worlds.map((w, i) => {
        const line = el(
          "button",
          "line",
          `Go to ${String.fromCharCode(98 + i)} — ${w.a.toFixed(2)} AU: ${KIND(w.kind)}, ${w.gravity.toFixed(2)} g, ${Math.round(w.temperature)} °C${w.water === "seas" ? ", seas" : w.water === "ice" ? ", ice" : ""} ›`,
        );
        line.onclick = () => this.onVisit(page, i);
        return line;
      }),
    );
  }
}
