// The god's toolbox for a province (docs/architecture §3.1, §31): pick an act —
// the rain, the harvest, health, inspiration — which way, and for how long; see
// what it will touch before confirming; afterwards it is listed with the acts done
// there, each opening its why. An act is a command: it forks the world from the
// moment it is done, and the history that follows is the simulation's own.
import type { HostClient } from "../bridge/index.ts";
import { el } from "./why.ts";

type ActKind = "rain" | "harvest" | "plague" | "inspire";

type Choice = {
  kind: ActKind;
  sign: 1 | -1;
  /** The button: "Withhold the rain". */
  label: string;
  /** What it will do, for the confirmation: "the rain over this land will fail". */
  effect: string;
  /** Whether it lasts some years. */
  lasting: boolean;
};

const CHOICES: readonly Choice[] = [
  {
    kind: "rain",
    sign: -1,
    label: "Withhold the rain",
    effect: "the rain over this land will fail",
    lasting: true,
  },
  {
    kind: "rain",
    sign: 1,
    label: "Send rain",
    effect: "rain will fall here in abundance",
    lasting: true,
  },
  {
    kind: "harvest",
    sign: 1,
    label: "Bless the harvest",
    effect: "fields, flocks and the wild will give more",
    lasting: true,
  },
  {
    kind: "harvest",
    sign: -1,
    label: "Blight the harvest",
    effect: "fields, flocks and the wild will give less",
    lasting: true,
  },
  {
    kind: "plague",
    sign: -1,
    label: "Send a plague",
    effect: "sickness will take many lives here",
    lasting: true,
  },
  { kind: "plague", sign: 1, label: "Heal the sick", effect: "fewer here will die", lasting: true },
  {
    kind: "inspire",
    sign: 1,
    label: "Inspire",
    effect: "the people will learn the next way of life they lack",
    lasting: false,
  },
];

type ActLine = { kind: ActKind; sign: number; event: string; active: boolean; claim: string };

export class HandView {
  private readonly client: HostClient;
  /** Show why something is so. */
  onWhy: (ref: string) => void = () => {};

  constructor(client: HostClient) {
    this.client = client;
  }

  /** The toolbox for a peopled province, with the acts already done there. */
  async show(into: HTMLElement, cell: number): Promise<void> {
    const done = await this.client.query<ActLine[]>({ type: "acts", args: { cell } });
    const tools = el("div", "tools"),
      confirm = el("div", "confirm");
    confirm.hidden = true;
    for (const c of CHOICES) {
      const b = el("button", "tool", c.label);
      b.onclick = () => this.ask(confirm, c, cell, () => void this.show(into, cell));
      tools.append(b);
    }
    const parts: HTMLElement[] = [el("h3", undefined, "Your hand"), tools, confirm];
    for (const a of done) {
      const line = el("button", a.active ? "line act-line" : "line", a.claim);
      line.onclick = () => this.onWhy(a.event);
      parts.push(line);
    }
    into.replaceChildren(...parts);
  }

  /** Say what the act will do and for how long; do it only when confirmed. */
  private ask(into: HTMLElement, c: Choice, cell: number, done: () => void): void {
    into.hidden = false;
    let years = 3;
    const words = el("p", "note"),
      say = () =>
        (words.textContent = `${c.lasting ? `For ${years} year${years === 1 ? "" : "s"}, ` : ""}${c.effect}. What follows is theirs, and history will remember it was your hand.`);
    const spans = el("div", "speeds");
    if (c.lasting)
      for (const n of [1, 3, 5]) {
        const b = el(
          "button",
          n === years ? "speed on" : "speed",
          `${n} year${n === 1 ? "" : "s"}`,
        );
        b.onclick = () => {
          years = n;
          for (const x of spans.children) x.classList.toggle("on", x === b);
          say();
        };
        spans.append(b);
      }
    const go = el("button", "act", c.label),
      cancel = el("button", "speed", "Cancel");
    cancel.onclick = () => {
      into.hidden = true;
      into.replaceChildren();
    };
    go.onclick = async () => {
      go.disabled = true;
      try {
        await this.client.command(`act.${c.kind}`, { cell, sign: c.sign, years });
        done();
      } catch (error) {
        words.textContent = (error as Error).message;
        go.disabled = false;
      }
    };
    say();
    into.replaceChildren(words, ...(c.lasting ? [spans] : []), go, cancel);
  }
}
