// The first piece of the observatory (docs/architecture §31): the clock and its
// speeds, the god's first act, and an inspector for the selected cell whose every
// fact can be asked "why?". Panels read through queries and subscriptions and act
// only through commands; nothing here is rebuilt under the pointer — sections are
// updated in place, and an opened why-tree stays open.
import type { HostClient, Status } from "../bridge/index.ts";
import { CLASS_COLORS, CLASS_NAMES } from "../view/index.ts";
import { WhyTree, el } from "./why.ts";
import { eventWords, speedWords, when } from "./words.ts";

const DAY = 86_400;
const YEAR = 365 * DAY;
export const SPEEDS = [0, DAY, 30 * DAY, YEAR];

type Cell = {
  cell: number;
  ref: string;
  people: number[];
  price: number;
  lastFlood: string | null;
  recent: { id: string; t: number; type: string }[];
};

function rgb(c: readonly [number, number, number]): string {
  return `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
}

export class SandboxPanel {
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly clock = el("span", "clock");
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly inspector = el("section", "inspector");
  private readonly title = el("h2");
  private readonly facts = el("div", "facts");
  private readonly whyBox = el("div", "why");
  private readonly history = el("ol", "history");
  private readonly bless = el("button", "act", "Bless this cell (+100 people)");
  private readonly note = el("p", "note");
  private selected: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private whyFor: string | null = null;
  onClose: () => void = () => {};

  constructor(root: HTMLElement, client: HostClient, initialSpeed: number) {
    this.client = client;
    this.why = new WhyTree(client);
    const bar = el("header", "bar");
    bar.append(el("strong", "brand", "Causalis Universe"), this.clock);
    const speeds = el("div", "speeds");
    for (const s of SPEEDS) {
      const b = el("button", "speed", s === 0 ? "❚❚" : speedWords(s).replace(" a second", "/s"));
      b.setAttribute("aria-label", s === 0 ? "Pause" : speedWords(s));
      b.onclick = () => this.setSpeed(s);
      speeds.append(b);
      this.speedButtons.push(b);
    }
    bar.append(speeds);
    root.append(bar);

    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.select(null);
      this.onClose();
    };
    this.bless.onclick = () => void this.blessSelected();
    this.inspector.append(
      close,
      this.title,
      this.facts,
      this.bless,
      this.note,
      el("h3", undefined, "Why is it like this?"),
      this.whyBox,
      el("h3", undefined, "What happened here"),
      this.history,
    );
    this.inspector.hidden = true;
    root.append(this.inspector);

    const hint = el(
      "p",
      "hint",
      "Tap a cell to look closer. Drag to turn, pinch or scroll to zoom.",
    );
    root.append(hint);
    client.onStatus((s) => this.status(s));
    this.markSpeed(initialSpeed);
  }

  private setSpeed(s: number): void {
    this.client.setSpeed(s);
    this.markSpeed(s);
  }

  private markSpeed(s: number): void {
    SPEEDS.forEach((v, i) => this.speedButtons[i]!.classList.toggle("on", v === s));
  }

  private status(s: Status): void {
    this.clock.textContent = `${when(s.t)} · ${s.speed === 0 ? "paused" : speedWords(Math.max(0, s.achieved))}`;
  }

  select(cell: number | null): void {
    this.selected = cell;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.whyFor = null;
    this.inspector.hidden = cell === null;
    if (cell === null) return;
    this.title.textContent = `Cell ${cell}`;
    this.note.textContent = "";
    this.whyBox.replaceChildren(el("p", "muted", "…"));
    this.unsubscribe = this.client.subscribe<Cell>({ type: "cell", args: { cell } }, 400, (v) =>
      this.show(v),
    );
  }

  private show(v: Cell): void {
    if (v.cell !== this.selected) return;
    const rows = v.people.map((n, k) => {
      const row = el("div", "fact"),
        dot = el("span", "dot");
      dot.style.background = rgb(CLASS_COLORS[k]!);
      row.append(dot, el("span", undefined, `${n.toLocaleString()} ${CLASS_NAMES[k]}`));
      return row;
    });
    rows.push(el("div", "fact", `Land costs ${v.price.toFixed(2)}`));
    this.facts.replaceChildren(...rows);
    this.history.replaceChildren(
      ...[...v.recent]
        .reverse()
        .map((e) => el("li", undefined, `${eventWords(e.type)}, ${when(e.t)}`)),
    );
    if (!v.recent.length) this.history.replaceChildren(el("li", "muted", "Nothing yet."));
    const subject = v.lastFlood ?? v.recent.at(-1)?.id ?? null;
    if (subject && subject !== this.whyFor) {
      this.whyFor = subject;
      void this.why.show(subject, this.whyBox);
    } else if (!subject)
      this.whyBox.replaceChildren(el("p", "muted", "No flood has reached this cell yet."));
  }

  private async blessSelected(): Promise<void> {
    if (this.selected === null) return;
    this.bless.disabled = true;
    try {
      const receipt = await this.client.command("toy.bless", { cell: this.selected, people: 100 });
      this.note.textContent = `Your act is logged (${receipt.id}); the people arrive at ${when(receipt.t)}.`;
    } catch (error) {
      this.note.textContent = (error as Error).message;
    } finally {
      this.bless.disabled = false;
    }
  }
}
