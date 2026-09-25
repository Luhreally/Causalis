// The people of a village as the observer meets them (docs/architecture §14, §31):
// the families met so far with a way to meet another, and a person's page — who
// they are, where they came from, what they remember, the life they lived and the
// family they live with. Every line that stands for something in history opens its
// why.
import type { HostClient } from "../bridge/index.ts";
import { el } from "./why.ts";

export type PersonBrief = {
  ref: string;
  name: string;
  role: string;
  sex: string;
  age: number;
  grownUp: boolean;
  occupation: string;
  alive: boolean;
  diedYear: number | null;
  village: string | null;
};

export type HouseholdView = {
  ref: string;
  surname: string;
  village: string | null;
  metIn: number;
  members: PersonBrief[];
};

export type PersonPage = PersonBrief & {
  birthYear: number;
  bornIn: string;
  bornBeforeChronicle: boolean;
  livesIn: string;
  moves: { year: number; from: string; to: string; event: string }[];
  household: { ref: string; surname: string; members: PersonBrief[] };
  life: { year: number; age: number; words: string; event: string | null }[];
  memories: { ref: string; words: string }[];
  character: string[];
};

const ROLE_WORDS: Readonly<Record<string, string>> = {
  head: "",
  spouse: "",
  child: "child",
  elder: "elder",
};

/** "Lian, 44, farmer" — or "Lian, died in year 230" */
export function briefWords(p: PersonBrief): string {
  const first = p.name.split(" ")[0]!;
  if (!p.alive) return `${first}, died in year ${p.diedYear}`;
  const what = p.grownUp ? p.occupation : ROLE_WORDS[p.role] || "child";
  return `${first}, ${p.age}, ${what}`;
}

function sentence(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/** One who lives: "44, a farmer of Hirnmere". One who died: "A farmer of Hirnmere, died in year 230 aged 61". */
export function lifeWords(p: PersonBrief): string {
  const job = p.grownUp ? p.occupation : "child",
    where = p.village ? ` of ${p.village}` : "";
  const article = /^[aeiou]/.test(job) ? "an" : "a";
  return p.alive
    ? `${p.age}, ${article} ${job}${where}`
    : `${sentence(`${article} ${job}`)}${where}, who died in year ${p.diedYear} aged ${p.age}`;
}

export class PeopleView {
  private readonly client: HostClient;
  /** Open a person's page. */
  onPerson: (ref: string) => void = () => {};
  /** Show why something is so. */
  onWhy: (ref: string) => void = () => {};

  constructor(client: HostClient) {
    this.client = client;
  }

  /** The families met in a village, and a way to meet another. */
  async village(into: HTMLElement, cell: number, village: string): Promise<void> {
    into.replaceChildren(el("p", "muted", "…"));
    const met = await this.client.query<{ households: HouseholdView[]; unmet: number }>({
      type: "observe.households",
      args: { village },
    });
    const list = el("div", "families");
    for (const hh of met.households) list.append(this.family(hh));
    const meet = el(
      "button",
      "act",
      met.unmet > 0 ? "Meet a family" : "Everyone here has been met",
    );
    meet.disabled = met.unmet <= 0;
    meet.onclick = async () => {
      meet.disabled = true;
      try {
        const hh = await this.client.query<HouseholdView>({
          type: "observe.meet",
          args: { cell, village },
        });
        await this.village(into, cell, village);
        into.querySelector(`[data-household="${hh.ref}"]`)?.scrollIntoView({ block: "nearest" });
      } catch (error) {
        meet.textContent = (error as Error).message.replace(/^\w/, (c) => c.toUpperCase());
      }
    };
    into.replaceChildren(
      met.households.length
        ? list
        : el(
            "p",
            "muted",
            "You have met no one here yet. Families are met as they are: history decides who they are.",
          ),
      meet,
    );
  }

  private family(hh: HouseholdView): HTMLElement {
    const box = el("div", "family");
    box.dataset.household = hh.ref;
    box.append(el("div", "family-name", `The ${hh.surname} household`));
    const people = el("div", "people");
    for (const p of hh.members) {
      const b = el("button", p.alive ? "person" : "person gone", briefWords(p));
      b.onclick = () => this.onPerson(p.ref);
      people.append(b);
    }
    box.append(people);
    return box;
  }

  /** A person's page. Returns their name for the title. */
  async person(into: HTMLElement, ref: string): Promise<PersonPage> {
    into.replaceChildren(el("p", "muted", "…"));
    const p = await this.client.query<PersonPage>({ type: "observe.person", args: { ref } });
    const parts: HTMLElement[] = [el("div", "fact", sentence(lifeWords(p)))];
    parts.push(
      el(
        "div",
        "fact",
        p.bornBeforeChronicle
          ? `Born before the chronicle begins, in ${p.bornIn}`
          : `Born in year ${p.birthYear} in ${p.bornIn}`,
      ),
    );
    for (const m of p.moves)
      parts.push(this.line(`In year ${m.year}, moved from ${m.from} to ${m.to}`, m.event));
    if (p.moves.length && p.alive) parts.push(el("div", "fact", `Lives in ${p.livesIn}`));
    if (p.character.length) parts.push(el("div", "fact muted", sentence(p.character.join(", "))));
    if (p.memories.length) {
      parts.push(el("h3", undefined, "Remembers"));
      for (const m of p.memories) parts.push(this.line(m.words, m.ref));
    }
    if (p.life.length) {
      parts.push(el("h3", undefined, "Their life"));
      const life = el("div", "life");
      for (const l of p.life)
        life.append(
          this.line(
            `Year ${l.year}, ${l.age < 1 ? "in their first year" : `at ${l.age}`}: ${l.words.toLowerCase()}`,
            l.event,
          ),
        );
      parts.push(life);
    }
    if (p.household.members.length) {
      parts.push(el("h3", undefined, `The ${p.household.surname} household`));
      const people = el("div", "people");
      for (const m of p.household.members) {
        const b = el("button", m.alive ? "person" : "person gone", briefWords(m));
        b.onclick = () => this.onPerson(m.ref);
        people.append(b);
      }
      parts.push(people);
    }
    into.replaceChildren(...parts);
    return p;
  }

  /** A line of a life that opens the why of what it stands for. */
  private line(text: string, ref: string | null): HTMLElement {
    if (!ref) return el("div", "fact", text);
    const b = el("button", "line", text);
    b.onclick = () => this.onWhy(ref);
    return b;
  }
}
