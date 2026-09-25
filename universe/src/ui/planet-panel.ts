// The observatory over a planet (docs/architecture §31): what world this is, the
// lenses to look at it through, and an inspector for any place — its ground, its
// weather, its plate and its ores — where every fact can be asked "why?".
import type { HostClient } from "../bridge/index.ts";
import { LENSES, LENS_NAMES, type Lens } from "../view/index.ts";
import { WhyTree, el } from "./why.ts";

type Summary = {
  prior: string;
  star: { ref: string; spectral: string; mass: number; ageGyr: number };
  planet: {
    ref: string;
    mass: number;
    gravity: number;
    orbitAu: number;
    yearDays: number;
    dayHours: number;
    tilt: number;
    meanTemperature: number;
    plates: number;
  };
  deposits: number;
};

type Place = {
  cell: number;
  ref: string;
  lat: number;
  lon: number;
  elevation: number;
  temperature: number;
  seasonality: number;
  precipitation: number;
  biome: string;
  plate: { ref: string; index: number; continental: boolean };
  boundary: string;
  river: boolean;
  lake: boolean;
  deposit: { ref: string; kind: string; richness: number; process: string } | null;
};

function latLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}

export class PlanetPanel {
  readonly element = el("div", "panel");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly lensButtons = new Map<Lens, HTMLButtonElement>();
  private readonly world = el("span", "clock");
  private readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly whyBox = el("div", "why");
  private readonly closer = el("button", "act", "Look closer");
  private selected: number | null = null;
  onLens: (lens: Lens) => void = () => {};
  onClose: () => void = () => {};
  onCloser: (cell: number) => void = () => {};

  constructor(root: HTMLElement, client: HostClient, lens: Lens) {
    this.client = client;
    this.why = new WhyTree(client);
    const bar = el("header", "bar");
    bar.append(el("strong", "brand", "Causalis Universe"), this.world);
    const lenses = el("div", "speeds");
    for (const l of LENSES) {
      const b = el("button", "speed", LENS_NAMES[l]);
      b.onclick = () => this.setLens(l);
      lenses.append(b);
      this.lensButtons.set(l, b);
    }
    bar.append(lenses);
    this.element.append(bar);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.select(null);
      this.onClose();
    };
    this.closer.onclick = () => {
      if (this.selected !== null) this.onCloser(this.selected);
    };
    this.inspector.append(
      close,
      this.title,
      this.facts,
      this.closer,
      el("h3", undefined, "Why is it like this?"),
      this.whyBox,
    );
    this.inspector.hidden = true;
    root.append(this.element);
    this.element.append(
      this.inspector,
      el(
        "p",
        "hint",
        "Tap the world to look at a place. Drag to turn it, pinch or scroll to zoom.",
      ),
    );
    this.markLens(lens);
    void this.describe();
  }

  private async describe(): Promise<void> {
    const s = await this.client.query<Summary>({ type: "planet.summary" });
    const p = s.planet;
    this.world.textContent = `A ${s.star.spectral} star, ${s.star.ageGyr.toFixed(1)} billion years old · a world of ${p.mass.toFixed(2)} Earth masses, ${p.meanTemperature.toFixed(0)} °C on average, a ${Math.round(p.yearDays)}-day year · ${p.plates} plates, ${s.deposits} ore bodies`;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  private setLens(lens: Lens): void {
    this.markLens(lens);
    this.onLens(lens);
  }

  private markLens(lens: Lens): void {
    for (const [l, b] of this.lensButtons) b.classList.toggle("on", l === lens);
  }

  async select(cell: number | null): Promise<void> {
    this.selected = cell;
    this.inspector.hidden = cell === null;
    if (cell === null) return;
    const p = await this.client.query<Place>({ type: "cell", args: { cell } });
    if (this.selected !== cell) return;
    const high = p.elevation >= 0;
    this.title.textContent = p.biome[0]!.toUpperCase() + p.biome.slice(1);
    const rows = [
      latLon(p.lat, p.lon),
      high
        ? `${Math.round(p.elevation).toLocaleString()} m above the sea`
        : `${Math.round(-p.elevation).toLocaleString()} m under the sea`,
      `${p.temperature.toFixed(0)} °C on average, swinging ±${p.seasonality.toFixed(0)} °C with the seasons`,
      high ? `${Math.round(p.precipitation).toLocaleString()} mm of rain a year` : "",
      p.lake ? "A lake lies here." : p.river ? "A river runs through." : "",
      `On a ${p.plate.continental ? "continental" : "oceanic"} plate${p.boundary !== "none" ? `, near a ${p.boundary} boundary` : ""}`,
      p.deposit
        ? `${p.deposit.richness.toLocaleString()} units of ${p.deposit.kind} (${p.deposit.process})`
        : "",
    ].filter(Boolean);
    this.facts.replaceChildren(...rows.map((r) => el("div", "fact", r)));
    this.closer.hidden = !high;
    void this.why.show(p.deposit?.ref ?? p.ref, this.whyBox);
  }
}
