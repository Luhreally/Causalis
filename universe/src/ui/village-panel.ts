// The microscope's panel (docs/architecture §9, §31): the village watched, the time
// of day, the slow speeds a day is watched at, and an inspector for a watched
// person — who they are, what they are doing now, how hungry and tired, and their
// page with its whys. Watching is looking: it never changes what happens.
import type { HostClient } from "../bridge/index.ts";
import { ACTIVITY_WORDS, type Moment } from "../view/index.ts";
import { PeopleView } from "./people.ts";
import { WhyTree, el } from "./why.ts";

/** Speeds for watching a day go by: paused, ten minutes, an hour, a day a second. */
export const WATCH_SPEEDS = [0, 600, 3600, 86_400] as const;
const SPEED_WORDS = ["❚❚", "10 min/s", "1 hour/s", "1 day/s"];

const DAY = 86_400,
  YEAR = 365 * DAY;

/** "year 240, day 185, 07:40" */
export function clockWords(t: number): string {
  const year = Math.floor(t / YEAR),
    day = Math.floor((t % YEAR) / DAY),
    s = t % DAY,
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return `year ${year}, day ${day}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function needWords(m: Moment): string {
  const hunger = m.hunger > 0.8 ? "hungry" : m.hunger > 0.5 ? "getting hungry" : "fed",
    tired = m.tiredness > 0.8 ? "worn out" : m.tiredness > 0.55 ? "tired" : "rested";
  return `${hunger}, ${tired}`;
}

export class VillagePanel {
  readonly element = el("div", "panel");
  readonly inspector = el("section", "inspector");
  private readonly client: HostClient;
  private readonly why: WhyTree;
  private readonly people: PeopleView;
  private readonly title = el("strong", "brand");
  private readonly clock = el("span", "clock");
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly who = el("h2");
  private readonly now = el("div", "fact");
  private readonly page = el("div");
  private readonly whyBox = el("div", "why");
  private view = 0;
  onBack: () => void = () => {};
  onSpeed: (speed: number) => void = () => {};
  onClose: () => void = () => {};

  constructor(root: HTMLElement, client: HostClient) {
    this.client = client;
    this.why = new WhyTree(client);
    this.people = new PeopleView(client);
    this.people.onPerson = (ref) => void this.showPerson(ref);
    this.people.onWhy = (ref) => void this.why.show(ref, this.whyBox);
    const bar = el("header", "bar"),
      back = el("button", "speed", "‹ The land");
    back.onclick = () => this.onBack();
    bar.append(back, this.title, this.clock);
    const speeds = el("div", "speeds");
    WATCH_SPEEDS.forEach((s, i) => {
      const b = el("button", "speed", SPEED_WORDS[i]!);
      b.onclick = () => {
        this.markSpeed(s);
        this.onSpeed(s);
      };
      speeds.append(b);
      this.speedButtons.push(b);
    });
    bar.append(speeds);
    const close = el("button", "close", "×");
    close.setAttribute("aria-label", "Close");
    close.onclick = () => {
      this.inspector.hidden = true;
      this.onClose();
    };
    this.inspector.append(
      close,
      this.who,
      this.now,
      this.page,
      el("h3", undefined, "Why?"),
      this.whyBox,
    );
    this.inspector.hidden = true;
    this.element.append(
      bar,
      this.inspector,
      el(
        "p",
        "hint",
        "You are watching: nothing here changes what happens. Tap someone to look closer.",
      ),
    );
    root.append(this.element);
    this.visible = false;
  }

  set visible(on: boolean) {
    this.element.hidden = !on;
  }

  show(name: string, speed: number): void {
    this.title.textContent = name;
    this.inspector.hidden = true;
    this.markSpeed(speed);
  }

  tick(t: number): void {
    this.clock.textContent = clockWords(t);
  }

  markSpeed(speed: number): void {
    WATCH_SPEEDS.forEach((s, i) => this.speedButtons[i]!.classList.toggle("on", s === speed));
  }

  /** What the person looked at is doing now. */
  moment(m: Moment | null): void {
    if (!m) return;
    this.now.textContent = `Now ${ACTIVITY_WORDS[m.activity]}; ${needWords(m)}`;
  }

  async showPerson(ref: string): Promise<void> {
    const view = ++this.view;
    this.inspector.hidden = false;
    this.who.textContent = "…";
    const p = await this.people.person(this.page, ref);
    if (this.view !== view) return;
    this.who.textContent = p.name;
    void this.why.show(ref, this.whyBox);
  }
}
