import type {
  BrushKind,
  BrushPreview,
  BrushState,
  BrushStrokeArgs,
  HostClient,
} from "../bridge/index.ts";
import { el } from "./why.ts";

/** Each brush: its sign, its name, and what it does to the ground it is drawn over, in a player's words. */
const CHOICES: readonly [BrushKind, string, string, string][] = [
  [
    "raise",
    "⛰️",
    "Raise land",
    "Lifts the ground 250 m at each strength; it grows colder as it rises.",
  ],
  [
    "lower",
    "⬇️",
    "Lower land",
    "Sinks the ground 250 m at each strength; low coasts go under the sea.",
  ],
  ["water", "💧", "Add water", "Fills the ground with a lake; anyone living there may drown."],
  ["drain", "🏜️", "Drain water", "Dries lakes and rivers out of the ground."],
  ["life", "🌱", "Seed life", "Sows the plants and beasts of this world that can live there."],
  ["ore", "⛏️", "Seed ore", "Lays a rich lode of the ore you pick, for its people to find."],
  ["lightning", "⚡", "Lightning", "Strikes the ground: it can kill and burn homes."],
  ["claim", "🚩", "Claim land", "Gives the lands you paint to the realm you pick."],
];
const SIZES = ["Small", "Medium", "Large", "Huge"];
const STRENGTHS = ["Gentle", "Firm", "Strong", "Mighty"];
/** How long a gentle stroke waits for Undo before it lands (in frames that came, not wall time). */
const WAIT_MS = 2000;
/** How many of the world's spots a stroke reaches, in words. */
const spots = (n: number) => `${n} spot${n === 1 ? "" : "s"} of the world`;
/** The most marks a stroke's trail leaves on the screen. */
const TRAIL = 96;

export class GodBrushes {
  readonly button = el("button", "brush-toggle", "🖌 Brushes");
  readonly panel = el("section", "brush-panel");
  private readonly kind = el("select");
  private readonly radius = el("select");
  private readonly strength = el("select");
  private readonly ore = el("select");
  private readonly realm = el("select");
  private readonly help = el("p", "brush-help");
  private readonly status = el("div", "brush-status");
  private readonly undo = el("button", "brush-undo", "↩ Undo stroke");
  private readonly apply = el("button", "brush-apply", "Apply stroke");
  private readonly history = el("div", "brush-history");
  private readonly cursor = el("div", "brush-cursor");
  /** Where the finger has gone in this stroke, left on the ground until it lands or is undone. */
  private readonly trail = el("div", "brush-trail");
  private last: { x: number; y: number } | null = null;
  private undoFrame = 0;
  private sequence = 0;
  private cells = new Set<number>();
  private pending: BrushStrokeArgs | null = null;
  private drawing = false;
  private busy = false;
  state: BrushState | null = null;
  /** The scale the brushes are used at (a town's ground is all one spot of the world's). */
  place: () => string = () => "globe";
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
    this.panel.setAttribute("aria-label", "God's brushes");
    this.button.setAttribute("aria-label", "The god's brushes: shape the world by hand");
    this.button.title = "The god's brushes: shape the world by hand";
    this.button.setAttribute("aria-expanded", "false");
    for (const [id, sign, name] of CHOICES) this.kind.add(new Option(`${sign} ${name}`, id));
    SIZES.forEach((name, n) => this.radius.add(new Option(name, String(n))));
    STRENGTHS.forEach((name, n) => this.strength.add(new Option(name, String(n + 1))));
    const close = el("button", "brush-close", "Done"),
      title = el("div", "brush-heading"),
      name = el("span", "brush-title", "🖌️ Shape the world");
    close.setAttribute("aria-label", "Done: put the brush down");
    title.append(name, close);
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
    const actions = el("div", "brush-actions");
    actions.append(this.undo, this.apply);
    this.panel.append(title, controls, this.help, this.status, actions, this.history);
    this.trail.setAttribute("aria-hidden", "true");
    parent.append(this.button, this.panel, this.trail, this.cursor);
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
  /** How to paint, by the hand at hand: a finger on a phone, the mouse on a desk. */
  private howTo(): string {
    const touch = matchMedia("(pointer: coarse)").matches;
    return touch
      ? "Drag a finger over the ground to paint; two fingers move the view."
      : "Drag over the ground to paint; right-drag turns the view, the wheel zooms, Esc puts the brush down.";
  }
  private choices(): void {
    const kind = this.kind.value as BrushKind,
      what = CHOICES.find(([k]) => k === kind);
    this.ore.parentElement!.hidden = kind !== "ore";
    this.realm.parentElement!.hidden = kind !== "claim";
    // (Strength means nothing to a claim, a drain or a seeding of life: it is not offered there.)
    this.strength.parentElement!.hidden = kind === "claim" || kind === "drain" || kind === "life";
    this.panel.dataset.kind = kind;
    const place = this.place(),
      here =
        place === "village" || place === "camp"
          ? " Here, the town's whole ground is one spot of the world."
          : place === "region"
            ? " Here, one spot of the world is a wide patch of this land."
            : "";
    this.help.textContent = `${what?.[3] ?? ""}${here}`;
    if (!this.busy && !this.pending) this.status.textContent = this.idle();
  }
  /** Why this brush cannot be used here and now, if it cannot. */
  private cannot(): string | null {
    const kind = this.kind.value;
    if (kind === "claim" && this.state && !this.state.realms.length)
      return "No realm stands on this world yet: there is no one to claim land for.";
    if (kind === "ore" && this.state && !this.state.ores.length)
      return "This world's chemistry holds no ore to lay.";
    return null;
  }
  /** What the status says while nothing is drawn: how to paint, or why this brush cannot. */
  private idle(): string {
    return this.cannot() ?? this.howTo();
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
    const recent = this.state.strokes.slice(-3).reverse();
    if (recent.length)
      this.history.append(el("div", "brush-lately", "Lately (tap one for its page)"));
    for (const s of recent) {
      const what = CHOICES.find(([k]) => k === s.kind),
        link = el(
          "button",
          "brush-record",
          `${what ? `${what[1]} ${what[2]}` : s.kind}: ${s.cells.length} spot${s.cells.length === 1 ? "" : "s"}${s.dead ? `, ${s.dead} dead` : ""}`,
        );
      link.onclick = () => this.onOpen?.(s.event);
      this.history.append(link);
    }
    this.choices();
  }
  toggle(): void {
    if (this.busy) return;
    if (this.armed) {
      this.close();
      return;
    }
    this.panel.hidden = false;
    this.button.setAttribute("aria-expanded", "true");
    this.button.classList.add("on");
    document.body.classList.add("brushes-open");
    this.onArmed?.();
    this.choices();
    void this.refresh().catch((e: Error) => {
      this.status.textContent = e.message;
    });
  }
  close(): void {
    this.cancel();
    this.panel.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    this.button.classList.remove("on");
    document.body.classList.remove("brushes-open");
  }
  start(x: number, y: number): boolean {
    if (!this.armed || this.busy) return false;
    this.cancel();
    // (A brush that cannot be used here says so, and the finger moves the view instead.)
    if (this.cannot()) return false;
    this.hold(true);
    this.drawing = true;
    this.trail.replaceChildren();
    this.trail.className = `brush-trail ${this.kind.value}`;
    this.last = null;
    this.move(x, y);
    return true;
  }
  move(x: number, y: number): void {
    if (!this.drawing) return;
    const cell = this.pick(x, y),
      size = 28 + Number(this.radius.value) * 14;
    if (cell !== null && this.cells.size < 64) this.cells.add(cell);
    this.cursor.hidden = false;
    this.cursor.style.left = `${x}px`;
    this.cursor.style.top = `${y}px`;
    this.cursor.style.width = this.cursor.style.height = `${size}px`;
    // (A mark on the ground wherever the finger went over it, as far apart as a third of the
    // brush's breadth: the stroke is seen where it will land.)
    if (
      cell !== null &&
      this.trail.childElementCount < TRAIL &&
      (!this.last || Math.hypot(x - this.last.x, y - this.last.y) >= size / 3)
    ) {
      const mark = el("span", "brush-mark");
      mark.style.left = `${x}px`;
      mark.style.top = `${y}px`;
      mark.style.width = mark.style.height = `${size}px`;
      this.trail.append(mark);
      this.last = { x, y };
    }
    this.status.textContent =
      cell === null && !this.cells.size
        ? "Not on this world's ground: paint over the land or the sea."
        : `${this.cells.size} spot${this.cells.size === 1 ? "" : "s"} painted${this.cells.size === 64 ? " · as long as a stroke can be" : ""}`;
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
          this.status.textContent = `${spots(p.cells.length)}. May kill up to ${p.atRisk} people${p.towns ? ` and damage homes in ${p.towns} town${p.towns === 1 ? "" : "s"}` : ""}. Apply this stroke?`;
          this.apply.hidden = false;
          this.trail.classList.add("asks");
        } else {
          const spared = p.spared
            ? ` (${p.spared} capital${p.spared === 1 ? " is" : "s are"} left to ${p.spared === 1 ? "its realm" : "their realms"})`
            : "";
          this.status.textContent = `${spots(p.cells.length)}${spared} · lands in a moment. Undo to stop it.`;
          // Count responsive frames rather than wall time: a stalled renderer must not
          // consume the entire Undo window before the next input can be delivered.
          let elapsed = 0,
            last = performance.now();
          const tick = (now: number) => {
            if (seq !== this.sequence || !this.pending) return;
            elapsed += Math.max(0, Math.min(100, now - last));
            last = now;
            this.panel.style.setProperty("--brush-wait", String(Math.min(1, elapsed / WAIT_MS)));
            if (elapsed >= WAIT_MS) {
              this.undoFrame = 0;
              void this.commit(false);
            } else this.undoFrame = requestAnimationFrame(tick);
          };
          this.undoFrame = requestAnimationFrame(tick);
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
    cancelAnimationFrame(this.undoFrame);
    this.undoFrame = 0;
    this.pending = null;
    this.cells.clear();
    this.drawing = false;
    this.cursor.hidden = true;
    if (!this.busy) this.trail.replaceChildren();
    this.panel.style.removeProperty("--brush-wait");
    this.undo.hidden = this.apply.hidden = true;
    this.hold(false);
    if (!this.busy) this.status.textContent = this.idle();
  }
  private async commit(confirmed: boolean): Promise<void> {
    if (!this.pending || this.busy) return;
    const args = { ...this.pending, confirmed };
    this.busy = true;
    this.undo.hidden = this.apply.hidden = true;
    this.panel.style.removeProperty("--brush-wait");
    this.trail.classList.add("landed");
    try {
      await this.client.command("act.brush", args);
      this.status.textContent = "Stroke recorded. Keeping your world…";
      await this.onCast?.();
      await this.refresh();
      this.status.textContent = "Stroke recorded and saved.";
      this.history.querySelector(".brush-record")?.classList.add("fresh");
    } catch (e) {
      this.status.textContent = (e as Error).message;
    } finally {
      this.busy = false;
      this.pending = null;
      this.cells.clear();
      this.undoFrame = 0;
      this.hold(false);
      // (The marks fade once the ground itself has been redrawn under them.)
      const trail = this.trail;
      setTimeout(() => {
        if (!this.drawing && !this.pending) trail.replaceChildren();
      }, 900);
    }
  }
}
