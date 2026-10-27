// A battle watched (Phase 37 M186): the bar over a battle seen near — back to its land, which
// battle it is and when, its own clock (paused, half, its own pace, twice, four times; again from
// the start), its page — and under it the two hosts, each in its colour with what it fought with,
// how many of it stand and how many have fallen as the battle goes (so many men to a figure); and
// the battle's course, a line drawn back and forth to see any moment of it, what is told now
// under it. The one followed named (Phase 55 M227–M228): who he was, where from, how he came out of
// it, what he bore and who made it.
import type { BattleNear } from "../bridge/index.ts";
import { BATTLE_LENGTH, BATTLE_SPEEDS, MOMENTS } from "../view/index.ts";
import { el } from "./why.ts";

/** One who fought, named (Phase 55 M227–M228), as his card tells him. */
export type ManCard = {
  readonly name: string;
  /** His page. */
  readonly page: string;
  /** Which host he fought in (0 the attacker's). */
  readonly side: 0 | 1;
  /** Where he came from (null: not known), and his age that day. */
  readonly from: string | null;
  readonly age: number;
  /** How he came out of it: "Fell in the battle". */
  readonly fate: string;
  /** What he bore ("a chert-tipped spear"), who made it ("Ana Talinor, a knapper of Elmstead"), and its page (null: none told). */
  readonly arm: string | null;
  readonly maker: string | null;
  readonly armPage: string | null;
};

/** What he bore and who made it, told: "Bore a chert-tipped spear, made by Ana Talinor, a knapper of Elmstead". */
export function boreWords(m: ManCard): string | null {
  return m.arm ? `Bore ${m.arm}${m.maker ? `, made by ${m.maker}` : ""}` : null;
}

/** A speed as its button says it. */
const SPEED_WORDS = ["❚❚", "½×", "1×", "2×", "4×"] as const;

type SideCard = {
  readonly box: HTMLElement;
  readonly name: HTMLElement;
  readonly kit: HTMLElement;
  /** The men who rose with it, where more fell than its host had (hidden: none). */
  readonly risen: HTMLElement;
  readonly tally: HTMLElement;
  /** Its wounded who lived, and of them the maimed: hidden until the battle is over (or none). */
  readonly hurt: HTMLElement;
  readonly bar: HTMLElement;
  ref: string;
  fielded: number;
  /** Its wounded who lived, and of them the maimed (Phase 55 M224). */
  wounded: number;
  maimed: number;
};

export class BattlePanel {
  readonly element = el("div", "panel battle-panel");
  private readonly title = el("span", "clock battle-title");
  private readonly speeds = el("div", "speeds battle-speeds");
  private readonly buttons: HTMLButtonElement[];
  private readonly again = el("button", "speed", "↺ Again");
  private readonly page = el("button", "speed", "📜 Its page");
  private readonly back = el("button", "speed", "‹ The land");
  private readonly sides: [SideCard, SideCard];
  private readonly course = el("div", "battle-course");
  private readonly fill = el("div", "battle-fill");
  private readonly told = el("div", "battle-told");
  private readonly each = el("div", "battle-each");
  /** The one followed, told (empty: none), with the button that traces their weapon beside it. */
  private readonly followed = el("div", "battle-followed");
  private readonly followedWords = el("span", "battle-followed-words");
  private readonly weapon = el("button", "speed battle-weapon", "🔍 Their weapon, traced");
  /** Who the one followed is, where the battle's roll names him (Phase 55 M227–M228). */
  private readonly man = el("div", "battle-man");
  private manShown: ManCard | null = null;
  /** Whether each side has a host design to trace its weapon to (a beast's own claws have none). */
  private traceable: readonly [boolean, boolean] = [false, false];
  private shown = "";
  onBack: () => void = () => {};
  onPage: () => void = () => {};
  onAgain: () => void = () => {};
  /** A speed chosen (its index among BATTLE_SPEEDS). */
  onSpeed: (i: number) => void = () => {};
  /** A moment of the battle chosen on its course (its seconds). */
  onScrub: (s: number) => void = () => {};
  /** A side's realm, to open its page. */
  onSide: (ref: string) => void = () => {};
  /** The weapon of the one followed, traced: the page of what they fought with. */
  onWeapon: () => void = () => {};
  /** The page of the one followed, named, or of the arm he bore (Phase 55 M227–M228). */
  onMan: (ref: string) => void = () => {};

  constructor(root: HTMLElement) {
    const bar = el("header", "bar");
    this.back.onclick = () => this.onBack();
    this.page.onclick = () => this.onPage();
    this.page.title = "The battle's page: who won, the fallen, the war it was of";
    this.again.onclick = () => this.onAgain();
    this.again.title = "The battle again from its beginning";
    this.speeds.setAttribute("role", "group");
    this.speeds.setAttribute("aria-label", "The battle's speed");
    this.buttons = BATTLE_SPEEDS.map((_, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.title = i === 0 ? "Hold the battle still" : `The battle at ${SPEED_WORDS[i]} its pace`;
      b.onclick = () => this.onSpeed(i);
      return b;
    });
    this.speeds.append(...this.buttons);
    // The two hosts, the course between them.
    const card = (side: 0 | 1): SideCard => {
      const box = el("button", `battle-side side-${side}`),
        name = el("span", "battle-side-name"),
        kit = el("span", "battle-side-kit"),
        risen = el("span", "battle-side-kit battle-side-risen"),
        tally = el("span", "battle-side-tally"),
        hurt = el("span", "battle-side-kit battle-side-hurt"),
        track = el("span", "battle-side-track"),
        bar = el("span", "battle-side-bar");
      track.append(bar);
      box.append(name, kit, risen, tally, hurt, track);
      const c: SideCard = {
        box,
        name,
        kit,
        risen,
        tally,
        hurt,
        bar,
        ref: "",
        fielded: 1,
        wounded: 0,
        maimed: 0,
      };
      box.onclick = () => c.ref && this.onSide(c.ref);
      return c;
    };
    this.sides = [card(0), card(1)];
    this.course.append(this.fill);
    this.course.setAttribute("role", "slider");
    this.course.setAttribute("aria-label", "The battle's course");
    this.course.tabIndex = 0;
    // The course drawn back and forth: any moment of the battle.
    const scrub = (e: PointerEvent) => {
      const r = this.course.getBoundingClientRect();
      this.onScrub(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * BATTLE_LENGTH);
    };
    this.course.addEventListener("pointerdown", (e) => {
      this.course.setPointerCapture(e.pointerId);
      scrub(e);
    });
    this.course.addEventListener("pointermove", (e) => {
      if (this.course.hasPointerCapture(e.pointerId)) scrub(e);
    });
    // (Marks where the hosts come on, charge, meet, and where the beaten break.)
    for (const at of [
      MOMENTS.advance,
      MOMENTS.charge,
      MOMENTS.melee,
      MOMENTS.rout,
      MOMENTS.after,
    ]) {
      const m = el("span", "battle-mark");
      m.style.left = `${(at / BATTLE_LENGTH) * 100}%`;
      this.course.append(m);
    }
    const middle = el("div", "battle-middle");
    this.followed.hidden = true;
    this.man.hidden = true;
    this.followed.append(this.man, this.followedWords, this.weapon);
    this.weapon.hidden = true;
    this.weapon.title = "Where what they fought with was made, from the ground to their hand";
    this.weapon.onclick = () => this.onWeapon();
    middle.append(this.told, this.course, this.each, this.followed);
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

  /** Which battle, its hosts, how many men a figure stands for. */
  show(near: BattleNear, per: number): void {
    this.title.textContent = `⚔️ ${near.title} · year ${near.year}${near.civil ? ` · ${near.civil}` : ""}${near.tip ? " · arms decided it" : ""}`;
    // (A beast's own claws are not made: no host design to trace them to.)
    this.traceable = [near.attacker.host !== null, near.defender.host !== null];
    ([near.attacker, near.defender] as const).forEach((s, i) => {
      const c = this.sides[i]!,
        rgb = `rgb(${s.color.map((x) => Math.round(x * 255)).join(",")})`;
      c.ref = s.ref;
      c.fielded = Math.max(1, s.fielded);
      c.name.textContent = `${i === 0 ? "⚔️" : "🛡️"} ${s.name[0]!.toUpperCase()}${s.name.slice(1)}`;
      // (A host not all armed so, its kit worn out and not made good: Phase 52 M217.)
      c.kit.textContent =
        s.armed !== undefined && s.armed < 0.995
          ? `${s.kit} · ${Math.round(s.armed * 100)}% so armed`
          : s.kit;
      // (The men who rose with it, where more fell than its host had in the field.)
      const risen = s.risen ?? 0,
        rose = i === 0 ? "levies sent after it" : "of its land's men, risen with it";
      c.risen.textContent = risen ? `+ ${risen.toLocaleString("en-US")} ${rose}` : "";
      c.risen.hidden = !risen;
      // (Its wounded who lived, and of them the maimed; told once the battle is over, in tally.)
      c.wounded = s.wounded ?? 0;
      c.maimed = s.maimed ?? 0;
      const maimed = c.maimed ? `, ${c.maimed.toLocaleString("en-US")} maimed` : "";
      c.hurt.textContent = `${c.wounded.toLocaleString("en-US")} wounded${maimed}`;
      c.hurt.hidden = true;
      c.box.style.setProperty("--side", rgb);
      c.box.title = risen
        ? `${s.name}: ${(s.fielded - risen).toLocaleString("en-US")} in its host, ${risen.toLocaleString("en-US")} ${rose} — their realm's page`
        : `${s.name}: ${s.fielded.toLocaleString("en-US")} in the field — their realm's page`;
    });
    this.each.textContent =
      per > 1
        ? `each figure stands for ${per.toLocaleString("en-US")} men`
        : "a figure for every one";
    this.shown = "";
  }

  /** Where its back button goes: "‹ The land", or "‹ The war" when watched from a war unfolding (M193). */
  backTo(words: string): void {
    this.back.textContent = words;
  }

  /** The one followed, told (empty: the hosts again); its side's weapon traced (null: none). */
  follow(words: string, side: 0 | 1 | null): void {
    if (this.followedWords.textContent !== words) this.followedWords.textContent = words;
    this.followed.hidden = !words;
    this.weapon.hidden = !words || side === null || !this.traceable[side];
  }

  /**
   * Who the one followed is (Phase 55 M227–M228; null: none named): his name (a tap to his page),
   * where he came from and his age, how he came out of it, what he bore and who made it.
   */
  named(m: ManCard | null): void {
    if (m === this.manShown) return;
    this.manShown = m;
    this.man.hidden = !m;
    if (!m) {
      this.man.replaceChildren();
      return;
    }
    const who = el("button", "link battle-man-name", m.name),
      bore = boreWords(m);
    who.title = "His page";
    who.onclick = () => this.onMan(m.page);
    const arm = bore ? el("button", "link battle-man-arm", bore) : null;
    if (arm && m.armPage) {
      const ref = m.armPage;
      arm.title = "His arm, from the ground to his hand";
      arm.onclick = () => this.onMan(ref);
    }
    this.man.replaceChildren(
      who,
      el("span", "battle-man-facts", `${m.from ? ` of ${m.from}` : ""}, ${m.age}: ${m.fate}`),
      ...(arm ? [arm] : []),
    );
  }

  /** The one followed as named on the card (null: none), for the look tools. */
  get manNamed(): ManCard | null {
    return this.man.hidden ? null : this.manShown;
  }

  /** Whether the button that traces their weapon is shown. */
  get weaponShown(): boolean {
    return !this.weapon.hidden;
  }

  /** The battle now: its moment, the men standing and fallen of each side, the speed lit. */
  tally(
    s: number,
    standing: readonly [number, number],
    fallen: readonly [number, number],
    words: string,
    speed: number,
  ): void {
    // (Whether the battle is over is in the key too, so its wounded are told the moment it is.)
    const over = s >= MOMENTS.after,
      key = `${Math.round(s * 4)}|${standing}|${fallen}|${words}|${speed}|${over}`;
    if (key === this.shown) return;
    this.shown = key;
    this.fill.style.width = `${(s / BATTLE_LENGTH) * 100}%`;
    this.course.setAttribute("aria-valuenow", `${Math.round(s)}`);
    if (this.told.textContent !== words) this.told.textContent = words;
    this.sides.forEach((c, i) => {
      const text = `${standing[i]!.toLocaleString("en-US")} stand · ${fallen[i]!.toLocaleString("en-US")} fallen`;
      if (c.tally.textContent !== text) c.tally.textContent = text;
      c.bar.style.width = `${Math.max(0, Math.min(1, standing[i]! / c.fielded)) * 100}%`;
      // (The wounded are told when the battle is over, and only where there were any.)
      c.hurt.hidden = !(c.wounded > 0 && over);
    });
    this.buttons.forEach((b, i) => b.classList.toggle("on", i === speed));
  }
}
