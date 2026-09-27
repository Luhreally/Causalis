// The observatory over the cluster (Phase 6 M56): the stars within reach of home — how
// many of each kind, the nearest — and a page for each star: its kind, distance, light
// and age, and its worlds.
import type { ClusterPlan, HostClient, SkyState, StarPage } from "../bridge/index.ts";
import { clusterWords, starWords } from "../view/index.ts";
import { WhyTree, el } from "./why.ts";
import { folder } from "./window.ts";

export class ClusterPanel {
  readonly element = el("div", "panel");
  private readonly where = el("span", "clock");
  readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly more = el("div");
  private readonly client: HostClient;
  private plan: ClusterPlan | null = null;
  private sky: SkyState = { programs: [], colonies: [] };
  private shown: number | null = null;
  private readonly why: WhyTree;
  /** Bumped on every change of page, so late answers are dropped. */
  private view = 0;
  onBack: () => void = () => {};
  onSelect: (index: number | null) => void = () => {};
  /** Out to the whole galaxy (M80), and down to a star's world, seen whole (M81). */
  onGalaxy: () => void = () => {};
  onVisit: (star: StarPage, index: number) => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The star's system");
    back.onclick = () => this.onBack();
    const galaxy = el("button", "speed", "The galaxy ›");
    galaxy.onclick = () => this.onGalaxy();
    bar.append(back, this.where, galaxy);
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
      el("p", "hint", "Tap a star to look at it. Drag to turn, pinch or scroll to zoom."),
    );
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  show(plan: ClusterPlan): void {
    this.plan = plan;
    this.where.textContent = `The stars within ${plan.radius} light-years`;
    void this.select(null);
  }

  /** The cluster's page (null), or a star's. */
  /** The sky as it stands: its ships (the open page is redrawn when they change). */
  update(sky: SkyState): void {
    const changed = JSON.stringify(sky.ships ?? []) !== JSON.stringify(this.sky.ships ?? []);
    this.sky = sky;
    if (changed && !this.inspector.hidden) void this.select(this.shown);
  }

  async select(index: number | null): Promise<void> {
    const plan = this.plan;
    if (!plan) return;
    const view = ++this.view;
    this.shown = index;
    this.inspector.hidden = false;
    if (index === null) {
      this.title.textContent = "The neighbouring stars";
      this.facts.replaceChildren(...clusterWords(plan).map((w) => el("div", "fact", w)));
      const ships = this.sky.ships ?? [];
      this.more.replaceChildren(
        ...(ships.length
          ? [
              el("h3", undefined, "Ships and halls among the stars"),
              ...ships.map((v) => {
                const i = plan.stars.findIndex((x) => x.ref === v.star),
                  line = el(
                    "button",
                    "line",
                    `${v.distance.toFixed(1)} light-years: ${v.arrived ? `halls of ${v.people.toLocaleString("en")} since ${v.arrives}` : `a ship of ${v.people.toLocaleString("en")}, sailed ${v.departed}, arriving ${v.arrives}`}${v.realm ? ` — of ${v.realm}` : " — their own"}`,
                  );
                line.onclick = () => {
                  void this.select(i);
                  this.onSelect(i);
                };
                return line;
              }),
            ]
          : []),
        el("h3", undefined, "The nearest"),
        ...plan.stars.slice(0, 12).map((s, i) => {
          const line = el(
            "button",
            "line",
            `${s.distance.toFixed(1)} light-years — ${s.spectral === "white dwarf" ? "a white dwarf" : `a ${s.spectral} star`}${s.planets ? `, ${s.planets} world${s.planets > 1 ? "s" : ""}` : ""}${s.seas ? ` (${s.seas} with seas)` : ""}`,
          );
          line.onclick = () => {
            void this.select(i);
            this.onSelect(i);
          };
          return line;
        }),
      );
      return;
    }
    const s = plan.stars[index]!;
    const kind = starWords(s);
    this.title.textContent = `${kind[0]!.toUpperCase()}${kind.slice(1)} (${s.spectral})`;
    const back = el("button", "back", "‹ The stars");
    back.onclick = () => {
      void this.select(null);
      this.onSelect(null);
    };
    this.facts.replaceChildren(
      back,
      el(
        "div",
        "fact",
        `${s.distance.toFixed(1)} light-years from home: light from it takes ${s.distance.toFixed(1)} years to arrive`,
      ),
      el(
        "div",
        "fact",
        s.remnant
          ? `a star that has burned out: ${s.mass.toFixed(2)} of the Sun's mass left, ${s.ageGyr.toFixed(1)} billion years since it was born`
          : `${s.mass.toFixed(2)} of the Sun's mass, ${s.luminosity < 0.01 ? s.luminosity.toExponential(1) : s.luminosity.toFixed(2)} of its light, ${Math.round(s.temperature)} K at its face, ${s.ageGyr.toFixed(1)} billion years old`,
      ),
    );
    this.more.replaceChildren(el("p", "muted", "…"));
    const page = await this.client.query<StarPage>({ type: "galaxy.star", args: { ref: s.ref } });
    if (this.view !== view) return;
    const note = el("p", "note"),
      acts = el("div", "speeds");
    for (const [label, sign] of [
      ["Make it flare (3 years)", -1],
      ["Calm it (3 years)", 1],
    ] as const) {
      const b = el("button", "act", label);
      b.onclick = async () => {
        try {
          await this.client.command("act.flare", { star: s.ref, sign, years: 3 });
          note.textContent = "Done: it is in the chronicle, and its why is yours.";
        } catch (error) {
          note.textContent = (error as Error).message;
        }
      };
      acts.append(b);
    }
    const here = (this.sky.ships ?? []).filter((v) => v.star === s.ref),
      whyBox = el("div", "why");
    this.more.replaceChildren(
      ...here.flatMap((v) => [
        el("h3", undefined, v.arrived ? "Halls of home's people here" : "A ship bound here"),
        el(
          "div",
          "fact",
          v.arrived
            ? `${v.people.toLocaleString("en")} people, come down in ${v.arrives}${v.realm ? `, ruled by ${v.realm}` : ", their own"}`
            : `${v.people.toLocaleString("en")} aboard, sailed in ${v.departed}, arriving in ${v.arrives}`,
        ),
        whyBox,
      ]),
      el("h3", undefined, "Your hand on it"),
      acts,
      note,
      el("h3", undefined, page.worlds.length ? "Its worlds, outward" : "No worlds about it"),
      ...page.worlds.map((w, i) => {
        const line = el(
          "button",
          "line",
          `Go to ${String.fromCharCode(98 + i)} — ${w.a.toFixed(2)} AU: ${w.kind === "rocky" ? "a world of rock" : w.kind === "giant" ? "a gas giant" : "an ice giant"}, ${w.gravity.toFixed(2)} g, ${Math.round(w.temperature)} °C, ${w.air === "none" ? "airless" : `${w.air} air`}${w.water === "seas" ? ", seas" : w.water === "ice" ? ", ice" : ""} ›`,
        );
        line.onclick = () => this.onVisit(page, i);
        return line;
      }),
    );
    if (here[0]) void this.why.show(here[0].voyage, whyBox);
  }
}
