// Lives L1 and L2 on the page: a figure's card, the chip and pin at their home (where the god's
// hand is laid), and the wealth lens's pick of two realms to set side by side.
import { LEADER_ICON, type Leader } from "../bridge/index.ts";
import { el } from "./why.ts";

/** A figure's card: name, title, deed and home, each name a link to its page. */
export function drawLeaderCard(
  into: HTMLElement,
  l: Leader,
  short: boolean,
  ctx: {
    open: (ref: string) => void;
    home?: (l: Leader) => void;
    rule?: (l: Leader) => void;
  },
): void {
  const card = el("div", "leader-card");
  card.dataset.ref = l.ref;
  if (!short) {
    const name = el("button", "leader-name", `${LEADER_ICON[l.kind]} ${l.name}`);
    name.onclick = () => ctx.open(l.ref);
    const why = l.why;
    const did = why ? el("button", "leader-did", l.did) : el("div", "leader-did", l.did);
    if (why) did.onclick = () => ctx.open(why);
    const where =
      l.town && l.townName ? `Lives in ${l.townName}` : "History keeps no home for them.";
    card.append(name, el("div", "leader-title", l.title), did);
    if (l.wants) card.append(el("div", "leader-wants", l.wants));
    card.append(el("div", "leader-where", where));
  }
  const home = ctx.home;
  if (l.town && home) {
    const go = el("button", "act leader-go", "🏠 Go to their home");
    go.onclick = () => home(l);
    card.append(go);
  }
  // (One who rules now can be ruled as: nothing is recorded until something is done, Lives L4.)
  const rule = ctx.rule;
  if (rule && l.ref.startsWith("rule:") && l.title.startsWith("Ruler")) {
    const b = el("button", "act leader-rule", "👑 Rule as them");
    b.onclick = () => rule(l);
    card.append(b);
  }
  // (One of a court can be taken as themself, within their own station: 2026-11-13.)
  if (rule && l.ref.startsWith("court:")) {
    const b = el("button", "act leader-rule leader-role", "🎭 Act as them");
    b.onclick = () => rule(l);
    card.append(b);
  }
  into.append(card);
}

/** The wealth lens's pick of two realms, to set side by side on one page. */
export function drawWealthCompare(
  into: HTMLElement,
  args: { realms: readonly { ref: string; short: string }[]; a: string; b: string },
  open: (ref: string) => void,
): void {
  const box = el("div", "wealth-compare");
  const pick = (chosen: string): HTMLSelectElement => {
    const s = el("select");
    for (const r of args.realms) {
      const o = el("option", undefined, r.short);
      o.value = r.ref;
      s.append(o);
    }
    s.value = chosen;
    return s;
  };
  const left = pick(args.a),
    right = pick(args.b);
  const go = el("button", "act", "⚖️ Set them side by side");
  go.onclick = () => {
    if (left.value !== right.value) open(`compare:${left.value}|${right.value}`);
  };
  box.append(left, right, go);
  into.append(box);
}

/**
 * The chip at a figure's home once the hand is laid there: who they are, the line that says
 * what the hand can do, and Possess, their page and close.
 */
export class LeaderChip {
  onPossess: () => void = () => {};
  onRule: ((l: Leader) => void) | null = null;
  onPage: (ref: string) => void = () => {};
  onClose: () => void = () => {};
  private readonly box: HTMLDivElement;
  private words: HTMLDivElement | null = null;
  private possess: HTMLButtonElement | null = null;
  /** The line as it says now, and the line busy(null) gives back (null: none kept). */
  private line = "";
  private kept: string | null = null;

  constructor(hud: HTMLElement) {
    this.box = el("div", "leader-chip");
    this.box.hidden = true;
    hud.append(this.box);
  }

  get shown(): boolean {
    return !this.box.hidden;
  }

  show(l: Leader, note: string): void {
    const line = l.cannot ?? note;
    const acts = el("div", "leader-chip-acts");
    this.possess = null;
    if (!l.cannot && l.as) {
      const possess = el("button", "leader-possess", "🫳 Possess them");
      possess.addEventListener("click", () => this.onPossess());
      this.possess = possess;
      acts.append(possess);
    }
    if (this.onRule && l.ref.startsWith("rule:") && !l.cannot) {
      const rule = el("button", "leader-rule", "👑 Rule");
      rule.addEventListener("click", () => this.onRule?.(l));
      acts.append(rule);
    }
    const page = el("button", "leader-page", "📄 Their page");
    page.addEventListener("click", () => this.onPage(l.ref));
    const close = el("button", "leader-close", "✕");
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      this.hide();
      this.onClose();
    });
    acts.append(page, close);
    this.words = el("div", "leader-chip-words", line);
    this.line = line;
    this.kept = null;
    this.box.replaceChildren(
      el("div", "leader-chip-head", `🏠 The home of ${l.name}`),
      el("div", "leader-chip-title", l.title),
      this.words,
      acts,
    );
    this.box.hidden = false;
  }

  /** Possess disabled and the line says `words`; null: Possess and the line as they were. */
  busy(words: string | null): void {
    if (words === null) {
      if (this.kept !== null) this.setLine(this.kept);
      this.kept = null;
      if (this.possess) this.possess.disabled = false;
      return;
    }
    if (this.kept === null) this.kept = this.line;
    this.setLine(words);
    if (this.possess) this.possess.disabled = true;
  }

  /** The line says `words`. */
  say(words: string): void {
    this.kept = null;
    this.setLine(words);
  }

  hide(): void {
    this.box.hidden = true;
    this.kept = null;
  }

  private setLine(words: string): void {
    this.line = words;
    if (this.words) this.words.textContent = words;
  }
}

/** The pin over a figure's home on the screen: their name, tapped to see the card. */
/** How near the screen's side a pin's middle comes, and how near its top its foot (CSS px: under the world's bar). */
const PIN_SIDE = 90,
  PIN_TOP = 240;

export class HomePin {
  onTap: () => void = () => {};
  private readonly pin: HTMLButtonElement;
  private named: string | null = null;

  constructor(hud: HTMLElement) {
    this.pin = el("button", "home-pin");
    this.pin.hidden = true;
    this.pin.addEventListener("click", () => this.onTap());
    hud.append(this.pin);
  }

  /**
   * Shown at `at` (CSS pixels, its foot on the point) with `name`; null hides it. A column whose top
   * stands past the screen, as among spires, has its pin on the column where it comes into sight.
   */
  place(at: { x: number; y: number } | null, name: string): void {
    if (at === null) {
      this.pin.hidden = true;
      return;
    }
    this.pin.hidden = false;
    if (this.named !== name) {
      this.pin.textContent = `🏠 ${name}`;
      this.named = name;
    }
    const x = Math.max(PIN_SIDE, Math.min(innerWidth - PIN_SIDE, at.x)),
      y = Math.max(PIN_TOP, Math.min(innerHeight, at.y));
    this.pin.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}
