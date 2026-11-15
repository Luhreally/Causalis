// A world of another star entered (asked 2026-11-13: "i should lowkey be able to play the alien worlds too, like when in
// the galaxy its other species ... ik thats more compute and loading but its fine"). Three screens over the whole page:
// what entering means, asked before the home world is left (what will be found as it was seen, and what cannot be, said
// plainly); the making of the world, behind a screen that says what is being done; and its history run to the age its
// people were read at, a decade at a time, told as it goes and stopped where the viewer says. The world runs in the host,
// off the page: nothing here freezes it.
import { YEAR } from "../kernel/index.ts";
import type { EnterPlan, Entered, HostClient } from "../bridge/index.ts";

type Plan = Extract<EnterPlan, { ok: true }>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function list(head: string, lines: readonly string[], className: string): HTMLElement[] {
  const ul = el("ul", `enter-list ${className}`);
  for (const line of lines) ul.append(el("li", "", line));
  return [el("h3", "enter-sub", head), ul];
}

/**
 * Asked before going: what the world is, what will be as it was seen and what will not. Answers whether to go (the
 * screen gone by then, unless `kept` is asked: then it stays up, to say the home world is being kept).
 */
export function askEnter(
  parent: HTMLElement,
  plan: Plan,
  again: boolean,
  /** About how long its history's run takes on this device (minutes; est.). */
  minutes = 0,
): Promise<{ go: boolean; said: (words: string) => void; away: () => void }> {
  const screen = el("div", "jump-screen enter-screen enter-ask"),
    card = el("div", "jump-card enter-card"),
    head = el("h2", "jump-head", `Play the world of the ${plan.name}?`),
    what = el(
      "p",
      "enter-what",
      `A people of ${plan.kind}, ${plan.stageWords}. ${
        again
          ? "You have been here before: their world is taken up where you left it."
          : plan.mostYears > 0
            ? `Their world is made whole and its history run to that age, over some ${plan.lands.toLocaleString("en")} lands: ${minutes >= 1.5 ? `about ${Math.round(minutes)} minutes` : "about a minute"} here, told as it goes, and it can be taken up at any year on the way.`
            : "Their world is made whole, which takes a few moments."
      }`,
    ),
    buttons = el("div", "jump-buttons"),
    go = el("button", "enter-go", again ? "Go back to their world" : "Play their world"),
    stay = el("button", "enter-stay", "Not now"),
    said = el("p", "muted enter-said", "The home world is kept first, and waits for you.");
  buttons.append(go, stay);
  card.append(
    head,
    what,
    ...list("As it was seen", plan.kept, "enter-kept"),
    ...list("Not as it was seen", plan.fresh, "enter-fresh"),
    said,
    buttons,
  );
  screen.append(card);
  parent.append(screen);
  return new Promise((done) => {
    const away = () => screen.remove(),
      answer = (yes: boolean) => {
        go.disabled = stay.disabled = true;
        if (!yes) away();
        done({ go: yes, said: (words) => (said.textContent = words), away });
      };
    go.onclick = () => answer(true);
    stay.onclick = () => answer(false);
  });
}

/** Said where a world cannot be entered, and why. */
export function cannotEnter(parent: HTMLElement, why: string): void {
  const screen = el("div", "jump-screen enter-screen enter-no"),
    card = el("div", "jump-card enter-card"),
    buttons = el("div", "jump-buttons"),
    ok = el("button", "enter-stay", "Back");
  ok.onclick = () => screen.remove();
  buttons.append(ok);
  card.append(el("h2", "jump-head", "This world cannot be played"), el("p", "enter-what", why));
  card.append(buttons);
  screen.append(card);
  parent.append(screen);
}

/** On a world entered: whose it is, how it stands by what was read of them, and what is and is not as it was seen. */
export function aboutEntered(parent: HTMLElement, e: Entered, home: string): void {
  parent.querySelector(".enter-about")?.remove();
  const screen = el("div", "jump-screen enter-screen enter-about"),
    card = el("div", "jump-card enter-card"),
    buttons = el("div", "jump-buttons"),
    ok = el("button", "enter-stay", "Back");
  ok.onclick = () => screen.remove();
  buttons.append(ok);
  card.append(
    el("h2", "jump-head", `The world of the ${e.name}`),
    el(
      "p",
      "enter-what",
      `A people of ${e.kind}, ${e.distance.toFixed(0)} light-years from “${home}”. Seen from there ${e.stageWords}, in its year ${e.year.toLocaleString("en")}. ${
        e.arrived
          ? "Their history here was run to that age."
          : `Here, by this world's own rules, they have come as far as: ${e.age}.`
      }`,
    ),
    ...list("As it was seen", e.kept, "enter-kept"),
    ...list("Not as it was seen", e.fresh, "enter-fresh"),
    buttons,
  );
  screen.append(card);
  parent.append(screen);
}

/** The screen a world entered is made and run behind. */
export type EnterScreen = {
  /** What is being done now, and how far along (0 … 1; null: no telling). */
  say(head: string, done: string, share: number | null): void;
  /** The viewer's "Begin from here": set once pressed. */
  readonly stopped: () => boolean;
  /** Let the stop be pressed (while the world's history is being run), with what it does when pressed. */
  stoppable(on: (() => void) | null): void;
  away(): void;
};

export function enterScreen(parent: HTMLElement, name: string, back: () => void): EnterScreen {
  const screen = el("div", "jump-screen enter-screen enter-making"),
    card = el("div", "jump-card enter-card"),
    head = el("h2", "jump-head", `Making the world of the ${name}`),
    bar = el("div", "jump-bar"),
    fill = el("div", "jump-fill"),
    done = el("p", "jump-done", "Its star, its ground, its seas, its life."),
    left = el(
      "p",
      "muted jump-left",
      "It is made from what was seen of it from afar, and kept from here on under its own name.",
    ),
    buttons = el("div", "jump-buttons"),
    stop = el("button", "jump-stop", "Begin from here"),
    leave = el("button", "jump-back", "Back to the galaxy");
  bar.setAttribute("role", "progressbar");
  bar.append(fill);
  buttons.append(leave);
  card.append(head, bar, done, left, buttons);
  screen.append(card);
  parent.append(screen);
  let stopped = false,
    onStop: (() => void) | null = null;
  stop.onclick = () => {
    stopped = true;
    stop.disabled = true;
    onStop?.();
  };
  leave.onclick = back;
  return {
    say(h, d, share) {
      head.textContent = h;
      done.textContent = d;
      screen.dataset.share = share === null ? "" : share.toFixed(3);
      fill.style.width = `${((share ?? 0) * 100).toFixed(1)}%`;
    },
    stopped: () => stopped,
    stoppable(on) {
      onStop = on;
      if (on) buttons.prepend(stop);
      else stop.remove();
    },
    away: () => screen.remove(),
  };
}

/** How many years a turn of the run takes on before it is asked how far the world has come. */
const TURN_YEARS = 10;

/**
 * A world entered run to the age its people were read at: a decade at a time in the host, asked after each whether it
 * has come that far, told as it goes, and stopped where the viewer says or at the most years it is given. Answers what
 * the world says of itself there, and how long the run took (ms).
 */
export async function runToRead(
  client: HostClient,
  screen: EnterScreen,
  first: Entered,
): Promise<{ here: Entered; ms: number; years: number }> {
  const t0 = performance.now();
  let here = first,
    year = Math.floor((await client.query<{ t: number }>({ type: "now" })).t / YEAR);
  const say = (y: number) =>
    screen.say(
      `Running their history to the age they were seen in (${here.stageWords})`,
      `Year ${y.toLocaleString("en")} of their own count · ${here.age}`,
      here.mostYears > 0 ? Math.min(1, y / here.mostYears) : null,
    );
  screen.stoppable(() => client.stopJump());
  try {
    while (!here.arrived && year < here.mostYears && !screen.stopped()) {
      say(year);
      const to = Math.min(here.mostYears, year + TURN_YEARS),
        got = await client.jump(to * YEAR, (p) => say(Math.floor(p.t / YEAR)));
      year = Math.floor(got.t / YEAR);
      here = (await client.query<Entered | null>({ type: "enter.here" })) ?? here;
    }
  } finally {
    screen.stoppable(null);
  }
  return { here, ms: performance.now() - t0, years: year };
}
