import type {
  BrushKind,
  BrushPreview,
  BrushState,
  BrushStrokeArgs,
  HostClient,
} from "../bridge/index.ts";
import { el } from "./why.ts";

const CHOICES: readonly [BrushKind, string][] = [
  ["raise", "Raise land"],
  ["lower", "Lower land"],
  ["water", "Add water"],
  ["drain", "Drain water"],
  ["life", "Seed life"],
  ["ore", "Seed ore"],
  ["lightning", "Lightning"],
  ["claim", "Claim land"],
];

export class GodBrushes {
  readonly button = el("button", "brush-toggle", "🖌 Brushes");
  readonly panel = el("section", "brush-panel");
  private readonly kind = el("select");
  private readonly radius = el("select");
  private readonly strength = el("select");
  private readonly ore = el("select");
  private readonly realm = el("select");
  private readonly status = el(
    "div",
    "brush-status",
    "One finger paints. Two fingers move the camera.",
  );
  private readonly undo = el("button", "brush-undo", "Undo stroke");
  private readonly apply = el("button", "brush-apply", "Apply stroke");
  private readonly history = el("div", "brush-history");
  private readonly cursor = el("div", "brush-cursor");
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private cells = new Set<number>();
  private pending: BrushStrokeArgs | null = null;
  private drawing = false;
  private busy = false;
  state: BrushState | null = null;
  private readonly client: HostClient;
  private readonly pick: (x: number, y: number) => number | null;
  private readonly hold: (on: boolean) => void;
  onArmed: (() => void) | null = null;
  onOpen: ((ref: string) => void) | null = null;
  onCast: (() => Promise<void>) | null = null;

  constructor(
    parent: HTMLElement,
    client: HostClient,
    pick: (x: number, y: number) => number | null,
    hold: (on: boolean) => void,
  ) {
    this.client = client;
    this.pick = pick;
    this.hold = hold;
    this.panel.hidden = true;
    this.panel.setAttribute("aria-label", "God brushes");
    this.button.setAttribute("aria-expanded", "false");
    for (const [id, name] of CHOICES) this.kind.add(new Option(name, id));
    for (let n = 0; n <= 3; n++)
      this.radius.add(new Option(`${n + 1} cell${n ? " rings" : ""}`, String(n)));
    for (let n = 1; n <= 4; n++) this.strength.add(new Option(`${n}×`, String(n)));
    const close = el("button", "brush-close", "Done"),
      title = el("div", "brush-heading", "Shape the world");
    title.append(close);
    const controls = el("div", "brush-controls");
    for (const [text, input] of [
      ["Brush", this.kind],
      ["Size", this.radius],
      ["Strength", this.strength],
      ["Ore", this.ore],
      ["Realm", this.realm],
    ] as const) {
      const label = el("label", "", text);
      label.append(input);
      controls.append(label);
    }
    this.status.setAttribute("role", "status");
    const help = el(
      "p",
      "brush-help",
      "These brushes change globe cells, including from a town. Gentle strokes wait 2 seconds for Undo. Harmful strokes need Apply. Esc puts the brush down.",
    );
    const actions = el("div", "brush-actions");
    actions.append(this.undo, this.apply);
    this.panel.append(title, controls, help, this.status, actions, this.history);
    parent.append(this.button, this.panel, this.cursor);
    this.cursor.hidden = true;
    this.undo.hidden = this.apply.hidden = true;
    this.button.onclick = () => this.toggle();
    close.onclick = () => this.close();
    this.undo.onclick = () => this.cancel();
    this.undo.onpointerdown = () => this.cancel();
    this.apply.onclick = () => void this.commit(true);
    for (const control of [this.kind, this.radius, this.strength, this.ore, this.realm])
      control.onchange = () => {
        this.cancel();
        this.choices();
      };
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
    addEventListener("blur", () => this.cancel());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancel();
    });
    this.choices();
  }
  get armed(): boolean {
    return !this.panel.hidden;
  }
  private choices(): void {
    this.ore.parentElement!.hidden = this.kind.value !== "ore";
    this.realm.parentElement!.hidden = this.kind.value !== "claim";
  }
  async refresh(): Promise<void> {
    this.state = await this.client.query<BrushState>({ type: "brush.state" });
    const ore = this.ore.value,
      realm = this.realm.value;
    this.ore.replaceChildren(...this.state.ores.map((s) => new Option(s, s)));
    this.realm.replaceChildren(...this.state.realms.map((r) => new Option(r.name, r.ref)));
    if (ore) this.ore.value = ore;
    if (realm) this.realm.value = realm;
    this.history.replaceChildren();
    for (const s of this.state.strokes.slice(-3).reverse()) {
      const link = el(
        "button",
        "brush-record",
        `${CHOICES.find(([k]) => k === s.kind)?.[1] ?? s.kind}: ${s.cells.length} spots${s.dead ? `, ${s.dead} dead` : ""}`,
      );
      link.onclick = () => this.onOpen?.(s.event);
      this.history.append(link);
    }
  }
  toggle(): void {
    if (this.busy) return;
    if (this.armed) {
      this.close();
      return;
    }
    this.panel.hidden = false;
    this.button.setAttribute("aria-expanded", "true");
    document.body.classList.add("brushes-open");
    this.onArmed?.();
    void this.refresh().catch((e: Error) => {
      this.status.textContent = e.message;
    });
  }
  close(): void {
    this.cancel();
    this.panel.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("brushes-open");
  }
  start(x: number, y: number): boolean {
    if (!this.armed || this.busy) return false;
    this.cancel();
    this.hold(true);
    this.drawing = true;
    this.move(x, y);
    return true;
  }
  move(x: number, y: number): void {
    if (!this.drawing) return;
    const cell = this.pick(x, y);
    if (cell !== null && this.cells.size < 64) this.cells.add(cell);
    this.cursor.hidden = false;
    this.cursor.style.left = `${x}px`;
    this.cursor.style.top = `${y}px`;
    this.cursor.style.width = this.cursor.style.height = `${28 + Number(this.radius.value) * 14}px`;
    this.status.textContent = `${this.cells.size} stroke spot${this.cells.size === 1 ? "" : "s"}${this.cells.size === 64 ? " · stroke limit reached" : ""}`;
  }
  end(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.cursor.hidden = true;
    if (!this.cells.size) {
      this.cancel();
      this.status.textContent = "Touch this world's ground to paint.";
      return;
    }
    const seq = ++this.sequence;
    const pending: BrushStrokeArgs = {
      kind: this.kind.value as BrushKind,
      cells: [...this.cells].sort((a, b) => a - b),
      radius: Number(this.radius.value),
      strength: Number(this.strength.value),
      ore: this.ore.value,
      realm: this.realm.value,
    };
    this.pending = pending;
    this.status.textContent = "Checking this stroke…";
    this.undo.hidden = false;
    void this.client
      .query<BrushPreview>({ type: "brush.preview", args: pending })
      .then((p) => {
        if (seq !== this.sequence) return;
        if (p.atRisk || p.towns) {
          this.status.textContent = `${p.cells.length} cells. May kill up to ${p.atRisk} people and damage homes in ${p.towns} towns. Apply this stroke?`;
          this.apply.hidden = false;
        } else {
          this.status.textContent = `${p.cells.length} cells · applying in 2 seconds. Undo to cancel.`;
          this.timer = setTimeout(() => void this.commit(false), 2000);
        }
      })
      .catch((e: Error) => {
        if (seq === this.sequence) {
          this.cancel();
          this.status.textContent = e.message;
        }
      });
  }
  cancel(): void {
    ++this.sequence;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.cells.clear();
    this.drawing = false;
    this.cursor.hidden = true;
    this.undo.hidden = this.apply.hidden = true;
    this.hold(false);
    if (!this.busy) this.status.textContent = "One finger paints. Two fingers move the camera.";
  }
  private async commit(confirmed: boolean): Promise<void> {
    if (!this.pending || this.busy) return;
    const args = { ...this.pending, confirmed };
    this.busy = true;
    this.undo.hidden = this.apply.hidden = true;
    try {
      await this.client.command("act.brush", args);
      this.status.textContent = "Stroke recorded. Keeping your world…";
      await this.onCast?.();
      await this.refresh();
      this.status.textContent = "Stroke recorded and saved.";
    } catch (e) {
      this.status.textContent = (e as Error).message;
    } finally {
      this.busy = false;
      this.pending = null;
      this.cells.clear();
      this.timer = null;
      this.hold(false);
    }
  }
}
