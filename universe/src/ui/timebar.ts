// The clock's bar (asked for 2026-10-24): the date, how fast the world goes, and the speeds of
// the scale watched, shown in the bar of whichever scale is up — one clock that goes with the
// eye from a town's street out to the galaxy, its speeds those of the scale (view/time.ts).
// Every call to set the clock's speed goes through it — a window's, a machine's driving the
// page — so what it lights is what runs.
import type { HostClient, Status } from "../bridge/index.ts";
import { LAPSE, TIME_LADDERS, TimeState, speedLabel, type TimeScale } from "../view/index.ts";
import { el } from "./why.ts";
import { clockWords, speedWords, when } from "./words.ts";

const DAY = 86_400;

export class TimeBar {
  /** The date and the speeds, as one piece of a scale's bar. */
  readonly element = el("span", "timebar");
  private readonly clock = el("span", "clock");
  /** The weather where the eye is on the ground (Phase 30 M162): its sign and the air's warmth. */
  private readonly weatherMark = el("span", "weather-mark");
  private readonly speeds = el("div", "speeds");
  /** What goes with the date at every scale (the world's stage: Phase 31 M167). */
  private readonly besides = el("span", "beside-date");
  private readonly state: TimeState;
  private readonly send: (speed: number) => void;
  /** Whether the date is drawn each frame by the page (else as the host reports it). */
  private readonly framed: boolean;
  private buttons: HTMLButtonElement[] = [];
  private built: TimeScale | null = null;
  private sent = -1;
  private status: Status | null = null;
  /** When the speed asked for last changed (whether the world keeps up is judged after it). */
  private askedAt = 0;
  private shown = "";

  constructor(client: HostClient, scale: TimeScale, framed = false) {
    this.state = new TimeState(scale);
    this.framed = framed;
    this.send = client.setSpeed.bind(client);
    // (Every call to set the speed, through the bar.)
    client.setSpeed = (speed: number) => {
      this.state.choose(speed);
      this.apply();
    };
    this.speeds.setAttribute("role", "group");
    this.speeds.setAttribute("aria-label", "Speed");
    this.weatherMark.hidden = true;
    this.besides.hidden = true;
    this.element.append(this.weatherMark, this.clock, this.besides, this.speeds);
    client.onStatus((s) => {
      this.status = s;
      if (!this.framed) this.tick(s.t);
    });
  }

  get scale(): TimeScale {
    return this.state.scale;
  }

  /** Whether the clock stands: paused by the viewer, or held by something waiting on them. */
  get stopped(): boolean {
    return this.state.stopped;
  }

  /** The speed the world is asked to run at now (0 while stopped). */
  get speed(): number {
    return this.state.speed;
  }

  /** The speed the scale runs at when it runs, paused or not (how finely the weather is told). */
  get pace(): number {
    return this.state.speedAt();
  }

  /** Whether a town is watched growing rather than living its day (faster than days a second). */
  get lapse(): boolean {
    return this.state.speed >= LAPSE;
  }

  /** Shown in a scale's bar (in its slot), at that scale's speeds. */
  at(scale: TimeScale, slot: HTMLElement): void {
    this.state.scale = scale;
    if (this.element.parentElement !== slot) slot.append(this.element);
    this.apply();
  }

  /**
   * The weather shown by the date (an empty sign: none, off the ground), told in full on a hover;
   * after it, the signs of the god's acts on the land (Phase 30 M163).
   */
  weather(icon: string, warmth: number | null, words: string, marks = ""): void {
    const text = icon
      ? `${icon}${warmth === null ? "" : ` ${Math.round(warmth)}°`}${marks ? ` · ${marks}` : ""}`
      : "";
    if (this.weatherMark.textContent !== text) this.weatherMark.textContent = text;
    this.weatherMark.hidden = !text;
    if (this.weatherMark.title !== words) {
      this.weatherMark.title = words;
      this.weatherMark.setAttribute("aria-label", words);
    }
  }

  /** Shown beside the date, at every scale (the world's stage: Phase 31 M167). */
  beside(item: HTMLElement): void {
    if (item.parentElement !== this.besides) this.besides.replaceChildren(item);
    this.besides.hidden = false;
  }

  /** Pause, or go on. */
  toggle(): void {
    this.state.toggle();
    this.apply();
  }

  /** The scale's i-th speed (0 pauses); false where its ladder has no such. */
  pick(i: number): boolean {
    if (!this.state.pick(i)) return false;
    this.apply();
    return true;
  }

  /** Held still by `who` (a window waiting on the viewer) until it lets go. */
  hold(who: string): void {
    this.state.hold(who);
    this.apply();
  }

  release(who: string): void {
    this.state.release(who);
    this.apply();
  }

  /** Run no faster than `speed` for `who` (a battle drawn near, M203), until it lets go or a speed is chosen. */
  cap(who: string, speed: number): void {
    this.state.cap(who, speed);
    this.apply();
  }

  uncap(who: string): void {
    if (!this.state.capped(who)) return;
    this.state.uncap(who);
    this.apply();
  }

  capped(who: string): boolean {
    return this.state.capped(who);
  }

  /** The date: to the minute while a day is watched, else to the day; and how fast it goes. */
  tick(t: number): void {
    const rate = this.state.stopped ? "paused" : this.status ? this.rate(this.status) : "",
      text = `${this.state.speedAt() < DAY ? clockWords(t) : when(t)}${rate ? ` · ${rate}` : ""}`;
    if (text === this.shown) return;
    this.shown = text;
    this.clock.textContent = text;
  }

  /** How fast the world goes ("8 years/s"), and where it cannot keep up, that it is its fastest. */
  private rate(s: Status): string {
    const asked = this.state.speed,
      got = Math.max(0, s.achieved),
      words = speedWords(got).replace(" a second", "/s");
    return got < asked * 0.7 && performance.now() - this.askedAt > 2500
      ? `${words}, its fastest`
      : words;
  }

  /** The speed sent where it changed; the scale's speeds drawn, the one running lit. */
  private apply(): void {
    const speed = this.state.speed;
    if (speed !== this.sent) {
      this.sent = speed;
      this.askedAt = performance.now();
      this.send(speed);
    }
    if (this.built !== this.state.scale) this.build();
    const lit = this.state.lit;
    this.buttons.forEach((b, i) => {
      b.classList.toggle("on", i === lit);
      b.setAttribute("aria-pressed", String(i === lit));
    });
    // (Drawn again at once; where the page draws it each frame, on the next.)
    this.shown = "";
    if (!this.framed && this.status) this.tick(this.status.t);
  }

  private build(): void {
    const scale = this.state.scale;
    this.built = scale;
    this.buttons = [0, ...TIME_LADDERS[scale].speeds].map((s, i) => {
      const b = el("button", "speed", s === 0 ? "❚❚" : speedLabel(s));
      b.setAttribute("aria-label", s === 0 ? "Pause" : speedWords(s));
      b.title = s === 0 ? "Pause (Space)" : `${speedWords(s)} (${i})`;
      b.onclick = () => this.pick(i);
      return b;
    });
    this.speeds.replaceChildren(...this.buttons);
  }
}
