// The observatory over a region: where it is on the world, its lenses, and an
// inspector for a tile — ground, weather, water, soil, ore — with its why.
import type { HostClient } from "../bridge/index.ts";
import { REGION_LENSES, REGION_LENS_NAMES, type RegionLens } from "../view/index.ts";
import { WhyTree, el } from "./why.ts";

type TileFacts = {
  tile: number;
  x: number;
  y: number;
  tileKm: number;
  elevation: number;
  temperature: number;
  precipitation: number;
  biome: string;
  water: string;
  fertility: number;
  parent: string;
  deposit: { ref: string; kind: string; richness: number; process: string } | null;
  sea: boolean;
};

function soilWords(f: number): string {
  if (f >= 0.8) return "rich soil";
  if (f >= 0.55) return "good soil";
  if (f >= 0.3) return "thin soil";
  if (f > 0.05) return "poor soil";
  return "barren ground";
}

export class RegionPanel {
  readonly element = el("div", "panel");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly where = el("span", "clock");
  private readonly lensButtons = new Map<RegionLens, HTMLButtonElement>();
  private readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly whyBox = el("div", "why");
  private center = 0;
  private selected: number | null = null;
  onBack: () => void = () => {};
  onLens: (lens: RegionLens) => void = () => {};
  onClose: () => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The world");
    back.onclick = () => this.onBack();
    bar.append(back, this.where);
    const lenses = el("div", "speeds");
    for (const l of REGION_LENSES) {
      const b = el("button", "speed", REGION_LENS_NAMES[l]);
      b.onclick = () => {
        this.markLens(l);
        this.onLens(l);
      };
      lenses.append(b);
      this.lensButtons.set(l, b);
    }
    bar.append(lenses);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.select(null);
      this.onClose();
    };
    this.inspector.append(
      close,
      this.title,
      this.facts,
      el("h3", undefined, "Why is it like this?"),
      this.whyBox,
    );
    this.inspector.hidden = true;
    this.element.append(
      bar,
      this.inspector,
      el("p", "hint", "Tap the land to look at a place. Drag to turn, pinch or scroll to zoom."),
    );
    root.append(this.element);
    this.markLens("land");
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  show(center: number, lat: number, lon: number, sizeKm: number): void {
    this.center = center;
    this.where.textContent = `${Math.round(sizeKm)} km around ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
    this.select(null);
  }

  private markLens(lens: RegionLens): void {
    for (const [l, b] of this.lensButtons) b.classList.toggle("on", l === lens);
  }

  /** Show a village: its name, its people, its founding, and why it is there. */
  async selectVillage(ref: string): Promise<void> {
    this.selected = -1;
    this.inspector.hidden = false;
    const v = await this.client.query<{ name: string; population: number; founded: number }>({
      type: "settlement",
      args: { ref },
    });
    if (this.selected !== -1) return;
    this.title.textContent = v.name;
    this.facts.replaceChildren(
      el("div", "fact", `A village of ${v.population.toLocaleString()}`),
      el("div", "fact", `Founded in year ${v.founded}`),
    );
    void this.why.show(ref, this.whyBox);
  }

  async select(tile: number | null): Promise<void> {
    this.selected = tile;
    this.inspector.hidden = tile === null;
    if (tile === null) return;
    const f = await this.client.query<TileFacts>({
      type: "tile",
      args: { center: this.center, tile },
    });
    if (this.selected !== tile) return;
    this.title.textContent = f.sea
      ? "The sea"
      : f.water
        ? `${f.biome[0]!.toUpperCase()}${f.biome.slice(1)}, by ${f.water}`
        : f.biome[0]!.toUpperCase() + f.biome.slice(1);
    const rows = [
      f.elevation >= 0
        ? `${Math.round(f.elevation)} m above the sea`
        : `${Math.round(-f.elevation)} m deep`,
      `${f.temperature.toFixed(0)} °C on average`,
      f.sea ? "" : `${Math.round(f.precipitation)} mm of rain a year`,
      f.sea || f.water
        ? ""
        : `${soilWords(f.fertility)[0]!.toUpperCase()}${soilWords(f.fertility).slice(1)}`,
      f.deposit
        ? `${f.deposit.richness.toLocaleString()} units of ${f.deposit.kind} (${f.deposit.process})`
        : "",
      `A ${Math.round(f.tileKm * 1000)} m square of ground`,
    ].filter(Boolean);
    this.facts.replaceChildren(...rows.map((r) => el("div", "fact", r)));
    void this.why.show(f.deposit?.ref ?? f.parent, this.whyBox);
  }
}
