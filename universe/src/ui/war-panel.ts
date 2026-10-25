// A war watched unfolding (Phase 38 M193): the bar over the globe while a war of history is
// played again on a clock of its own — leave it, which war and its years, its clock (held, half,
// its own pace, twice, four times; again from its declaring), its page — and under it its two
// sides, each in its colour with the battles it won and its fallen mounting as the war goes; and
// its course, a line of its years drawn back and forth, each of its battles marked on it where its
// turn comes (in the colour of the side that won it), what is told now under it, and the battle
// told of a tap away, to be watched fought.
import type { Campaign, WarAge } from "../bridge/index.ts";
import {
  WAR_SPEEDS,
  campaignSpan,
  foughtAt,
  outcomeWords,
  warAgeSpan,
  type CampaignNow,
  type WarAgeNow,
} from "../view/index.ts";
import { el } from "./why.ts";

/** A speed as its button says it. */
const SPEED_WORDS = ["❚❚", "½×", "1×", "2×", "4×"] as const;

type SideCard = {
  readonly box: HTMLElement;
  readonly name: HTMLElement;
  readonly won: HTMLElement;
  readonly tally: HTMLElement;
  readonly bar: HTMLElement;
  ref: string;
};

const rgb = (c: readonly [number, number, number]) =>
  `rgb(${c.map((x) => Math.round(x * 255)).join(",")})`;
const count = (n: number) => n.toLocaleString("en-US");
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export class WarPanel {
  readonly element = el("div", "panel war-panel");
  private readonly title = el("span", "clock battle-title");
  private readonly speeds = el("div", "speeds battle-speeds");
  private readonly buttons: HTMLButtonElement[];
  private readonly again = el("button", "speed", "↺ Again");
  private readonly page = el("button", "speed", "📜 Its page");
  private readonly back = el("button", "speed", "‹ Leave the war");
  private readonly sides: [SideCard, SideCard];
  private readonly course = el("div", "war-course");
  private readonly fill = el("div", "battle-fill");
  private readonly told = el("div", "battle-told");
  private readonly when = el("div", "battle-each war-when");
  private readonly watch = el("button", "act war-watch", "⚔️ Watch this battle");
  private span = { from: 0, to: 1 };
  /** The battle told of now (its event; null: none yet). */
  private latest: string | null = null;
  /** The most of either side to fall in the whole war (each side's bar a share of it). */
  private most = 1;
  private total = 0;
  private shown = "";
  onBack: () => void = () => {};
  onPage: () => void = () => {};
  onAgain: () => void = () => {};
  /** A speed chosen (its index among WAR_SPEEDS). */
  onSpeed: (i: number) => void = () => {};
  /** A moment of the war chosen on its course (a year of the world's, fractional). */
  onScrub: (year: number) => void = () => {};
  /** A side's realm, to open its page. */
  onSide: (ref: string) => void = () => {};
  /** A battle of it, to be watched fought. */
  onBattle: (event: string) => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar");
    this.back.onclick = () => this.onBack();
    this.back.title = "Back to the world as it is now";
    this.page.onclick = () => this.onPage();
    this.page.title = "The war's page: why it was fought, its battles, its course, its hosts";
    this.again.onclick = () => this.onAgain();
    this.again.title = "The war again from its declaring";
    this.speeds.setAttribute("role", "group");
    this.speeds.setAttribute("aria-label", "The war's speed");
    this.buttons = WAR_SPEEDS.map((_, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.title = i === 0 ? "Hold the war still" : `The war at ${SPEED_WORDS[i]} its pace`;
      b.onclick = () => this.onSpeed(i);
      return b;
    });
    this.speeds.append(...this.buttons);
    const card = (side: 0 | 1): SideCard => {
      const box = el("button", `battle-side side-${side}`),
        name = el("span", "battle-side-name"),
        won = el("span", "battle-side-kit"),
        tally = el("span", "battle-side-tally"),
        track = el("span", "battle-side-track"),
        bar = el("span", "battle-side-bar");
      track.append(bar);
      box.append(name, won, tally, track);
      const c: SideCard = { box, name, won, tally, bar, ref: "" };
      box.onclick = () => c.ref && this.onSide(c.ref);
      return c;
    };
    this.sides = [card(0), card(1)];
    this.course.append(this.fill);
    this.course.setAttribute("role", "slider");
    this.course.setAttribute("aria-label", "The war's course");
    this.course.tabIndex = 0;
    // The course drawn back and forth: any moment of the war.
    const scrub = (e: PointerEvent) => {
      const r = this.course.getBoundingClientRect(),
        k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.onScrub(this.span.from + k * (this.span.to - this.span.from));
    };
    this.course.addEventListener("pointerdown", (e) => {
      this.course.setPointerCapture(e.pointerId);
      scrub(e);
    });
    this.course.addEventListener("pointermove", (e) => {
      if (this.course.hasPointerCapture(e.pointerId)) scrub(e);
    });
    this.watch.title =
      "Down to the field it was fought on, to watch it fought on a clock of its own; back to the war after";
    this.watch.onclick = () => this.latest && this.onBattle(this.latest);
    this.watch.hidden = true;
    const middle = el("div", "battle-middle");
    middle.append(this.told, this.course, this.when, this.watch);
    const sheet = el("div", "battle-sheet");
    sheet.append(this.sides[0].box, middle, this.sides[1].box);
    bar.append(this.back, this.title, this.speeds, this.again, this.page, sheet);
    this.element.append(bar);
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** Which war, its sides, its battles marked on its course. */
  show(c: Campaign): void {
    this.span = campaignSpan(c);
    this.title.textContent = `⚔️ ${c.title} · ${
      c.ended === null ? `year ${c.declared} on` : `years ${c.declared}–${c.ended}`
    }${c.civil ? ` · ${c.civil}` : ""}`;
    ([c.attacker, c.defender] as const).forEach((s, i) => {
      const card = this.sides[i]!;
      card.ref = s.ref;
      card.name.textContent = `${i === 0 ? "⚔️" : "🛡️"} ${cap(s.name)}`;
      card.box.style.setProperty("--side", rgb(s.color));
      card.box.title = `${s.name}: their realm's page`;
    });
    const fell = (i: 0 | 1) => c.battles.reduce((n, b) => n + b.fallen[i], 0);
    this.most = Math.max(1, fell(0), fell(1));
    this.total = c.battles.length;
    // Each battle where its turn comes, in the colour of the side that won it.
    for (const m of [...this.course.querySelectorAll(".war-mark")]) m.remove();
    const at = foughtAt(c),
      width = this.span.to - this.span.from;
    c.battles.forEach((b, i) => {
      const m = el("span", "battle-mark war-mark");
      m.style.left = `${((at[i]! - this.span.from) / width) * 100}%`;
      m.style.background = rgb(b.won ? c.attacker.color : c.defender.color);
      m.title = `Year ${b.year}: the battle at ${b.land} — ${outcomeWords(c, b)}; ${count(
        b.fallen[0] + b.fallen[1],
      )} fell`;
      this.course.append(m);
    });
    this.latest = null;
    this.shown = "";
  }

  /** The war now: its year, what is told, each side's battles won and fallen, the speed lit. */
  tally(now: CampaignNow, speed: number): void {
    const latest = now.fought.at(-1) ?? null,
      key = `${Math.round(now.year * 50)}|${now.fought.length}|${now.words}|${speed}`;
    if (key === this.shown) return;
    this.shown = key;
    const k = (now.year - this.span.from) / Math.max(1e-6, this.span.to - this.span.from);
    this.fill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
    this.course.setAttribute("aria-valuenow", `${Math.floor(now.year)}`);
    if (this.told.textContent !== now.words) this.told.textContent = now.words;
    const when = `Year ${Math.floor(now.year)} · ${now.fought.length} of ${
      this.total === 1 ? "its one battle" : `its ${this.total} battles`
    } fought`;
    if (this.when.textContent !== when) this.when.textContent = when;
    this.sides.forEach((card, i) => {
      const won = `${count(now.won[i]!)} ${i === 0 ? "won" : "held"}`,
        tally = `${count(now.fallen[i]!)} fallen`;
      if (card.won.textContent !== won) card.won.textContent = won;
      if (card.tally.textContent !== tally) card.tally.textContent = tally;
      card.bar.style.width = `${Math.min(1, now.fallen[i]! / this.most) * 100}%`;
    });
    this.latest = latest?.event ?? null;
    this.watch.hidden = !latest;
    if (latest) {
      const label = `⚔️ Watch the battle at ${latest.land} (year ${latest.year})`;
      if (this.watch.textContent !== label) this.watch.textContent = label;
    }
    this.buttons.forEach((b, i) => b.classList.toggle("on", i === speed));
  }
}

/**
 * The wars of an age watched unfolding together (M194): the bar over the globe — leave them, which
 * years, their clock, again from the first; and the age's course, a line of its years drawn back
 * and forth, each of its battles marked where its turn comes (in the colour of the side that won
 * it); what is told now, how many wars are under way, the battles fought and their fallen; the
 * latest battle and its war a tap away, watched.
 */
export class WarAgePanel {
  readonly element = el("div", "panel war-panel war-age");
  private readonly title = el("span", "clock battle-title");
  private readonly speeds = el("div", "speeds battle-speeds");
  private readonly buttons: HTMLButtonElement[];
  private readonly again = el("button", "speed", "↺ Again");
  private readonly back = el("button", "speed", "‹ Leave the wars");
  private readonly course = el("div", "war-course");
  private readonly fill = el("div", "battle-fill");
  private readonly told = el("div", "battle-told");
  private readonly when = el("div", "battle-each war-when");
  private readonly acts = el("div", "war-acts");
  private readonly battle = el("button", "act war-watch", "⚔️ Watch this battle");
  private readonly war = el("button", "act war-watch", "▶ Watch its war");
  private span = { from: 0, to: 1 };
  private latest: { event: string; war: string } | null = null;
  private shown = "";
  onBack: () => void = () => {};
  onAgain: () => void = () => {};
  /** A speed chosen (its index among WAR_SPEEDS). */
  onSpeed: (i: number) => void = () => {};
  /** A moment of the age chosen on its course (a year, fractional). */
  onScrub: (year: number) => void = () => {};
  /** Its latest battle, to be watched fought; its war, to be watched unfolding. */
  onBattle: (event: string) => void = () => {};
  onWar: (ref: string) => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar");
    this.back.onclick = () => this.onBack();
    this.back.title = "Back to the world as it is now";
    this.again.onclick = () => this.onAgain();
    this.again.title = "Its wars again from its first year";
    this.speeds.setAttribute("role", "group");
    this.speeds.setAttribute("aria-label", "The wars' speed");
    this.buttons = WAR_SPEEDS.map((_, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.title = i === 0 ? "Hold the wars still" : `The wars at ${SPEED_WORDS[i]} their pace`;
      b.onclick = () => this.onSpeed(i);
      return b;
    });
    this.speeds.append(...this.buttons);
    this.course.append(this.fill);
    this.course.setAttribute("role", "slider");
    this.course.setAttribute("aria-label", "The age's course");
    this.course.tabIndex = 0;
    const scrub = (e: PointerEvent) => {
      const r = this.course.getBoundingClientRect(),
        k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.onScrub(this.span.from + k * (this.span.to - this.span.from));
    };
    this.course.addEventListener("pointerdown", (e) => {
      this.course.setPointerCapture(e.pointerId);
      scrub(e);
    });
    this.course.addEventListener("pointermove", (e) => {
      if (this.course.hasPointerCapture(e.pointerId)) scrub(e);
    });
    this.battle.title =
      "Down to the field it was fought on, to watch it fought; back to the wars after";
    this.battle.onclick = () => this.latest && this.onBattle(this.latest.event);
    this.war.title = "That war alone, from its declaring, on a clock of its own";
    this.war.onclick = () => this.latest && this.onWar(this.latest.war);
    this.acts.append(this.battle, this.war);
    this.acts.hidden = true;
    const middle = el("div", "battle-middle");
    middle.append(this.told, this.course, this.when, this.acts);
    const sheet = el("div", "battle-sheet");
    sheet.append(middle);
    bar.append(this.back, this.title, this.speeds, this.again, sheet);
    this.element.append(bar);
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  /** Which years, its battles marked on its course. */
  show(a: WarAge): void {
    this.span = warAgeSpan(a);
    this.title.textContent = `⚔️ The world's wars · years ${this.span.from}–${a.to}${
      a.wars.length ? ` · the bloodiest ${a.wars.length === 1 ? "one" : count(a.wars.length)}` : ""
    }`;
    for (const m of [...this.course.querySelectorAll(".war-mark")]) m.remove();
    const width = this.span.to - this.span.from;
    for (const c of a.wars) {
      const at = foughtAt(c);
      c.battles.forEach((b, i) => {
        if (at[i]! < this.span.from || at[i]! > this.span.to) return;
        const m = el("span", "battle-mark war-mark");
        m.style.left = `${((at[i]! - this.span.from) / width) * 100}%`;
        m.style.background = rgb(b.won ? c.attacker.color : c.defender.color);
        m.title = `Year ${b.year}: the battle at ${b.land} — ${outcomeWords(c, b)}; ${count(
          b.fallen[0] + b.fallen[1],
        )} fell`;
        this.course.append(m);
      });
    }
    this.latest = null;
    this.shown = "";
  }

  /** The age now: its year, what is told, its wars under way, its battles and fallen, the speed lit. */
  tally(now: WarAgeNow, speed: number): void {
    const key = `${Math.round(now.year * 20)}|${now.fought}|${now.under}|${now.words}|${speed}`;
    if (key === this.shown) return;
    this.shown = key;
    const k = (now.year - this.span.from) / Math.max(1e-6, this.span.to - this.span.from);
    this.fill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
    this.course.setAttribute("aria-valuenow", `${Math.floor(now.year)}`);
    if (this.told.textContent !== now.words) this.told.textContent = now.words;
    const wars = now.under === 1 ? "a war" : `${count(now.under)} wars`,
      battles = `${count(now.fought)} ${now.fought === 1 ? "battle" : "battles"}`,
      when = `Year ${Math.floor(now.year)} · ${wars} under way · ${battles} · ${count(now.fallen)} fallen`;
    if (this.when.textContent !== when) this.when.textContent = when;
    const l = now.latest;
    this.latest = l ? { event: l.battle.event, war: l.war.ref } : null;
    this.acts.hidden = !l;
    if (l) {
      const label = `⚔️ Watch the battle at ${l.battle.land} (year ${l.battle.year})`;
      if (this.battle.textContent !== label) this.battle.textContent = label;
    }
    this.buttons.forEach((b, i) => b.classList.toggle("on", i === speed));
  }
}
