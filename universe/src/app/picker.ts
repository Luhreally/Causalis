// The seed picker (Phase 65, asked for 2026-11-03: "i wanna be able to pick seeds the plausibly get to
// the target age i wanna see"): what kind of world, what age, and the seeds that get there. Two kinds of
// answer, kept apart on the screen and in the words: "Reached in year N" is a world run in full under
// these rules, and it does that, every time. "Plausibly" is a world read for what it holds, with no
// history run: what the age takes is all there, and it may still never come. Picking one runs the world
// to its year behind Phase 63's screen, and how long that takes is said before it starts.
import type { HostClient, SeedReading } from "../bridge/index.ts";
import {
  bakedWorlds,
  catalogueFor,
  phoneMinutesTo,
  runWords,
  type Baked,
  type CatalogueSeed,
  type UniverseCatalogue,
} from "../ui/index.ts";
import { AGE_LADDER } from "../view/index.ts";

/** How many worlds "plausibly" lists, and how many it will read to find them, before it is asked again. */
const SHOW = 5;
const READ_AT_A_GO = 16;
/** How many it will glance at, at most, before it tells what it has. */
const GLANCE_AT_A_GO = 120;

const AGES = AGE_LADDER.filter((a) => a.id !== "bands");
/** The ages past ours open in a world's greatest town, where they are seen (Phase 66). */
const PAST_OURS: ReadonlySet<string> = new Set(
  AGE_LADDER.slice(AGE_LADDER.findIndex((a) => a.id === "stars") + 1).map((a) => a.id),
);

const MEDIUM_WORDS: Readonly<Record<string, string>> = {
  land: "a people of the land",
  shore: "a people of the shore",
  water: "a people of the water",
};

const KIND_WORDS: Readonly<Record<string, string>> = {
  rocky: "a rocky world",
  carbon: "a carbon world",
  sulfur: "a sulphur world",
  ammonia: "an ammonia world",
  methane: "a methane world",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const yearWords = (y: number) => y.toLocaleString("en");

/** Words with a capital to begin them, for the start of a line. */
const said = (words: string) => `${words[0]!.toUpperCase()}${words.slice(1)}`;

/** The middle of what a list of years holds. */
function middle(years: readonly number[]): number {
  const sorted = [...years].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export type PickerOptions = {
  readonly host: () => Promise<HostClient>;
  readonly go: (search: string) => void;
  readonly back: HTMLElement;
  /** The i-th seed of the worlds it reads through, in the order it reads them. */
  readonly seedAt: (i: number) => string;
  readonly kinds: readonly (readonly [string, string, string, string])[];
};

/** The picker's form. */
export function pickerForm(o: PickerOptions): HTMLElement {
  let kind: string = o.kinds[0]![0],
    target = "worlds",
    // (Each change of mind stops what was being read for the last.)
    asked = 0,
    readFrom = 0;
  const form = el("div", "title-form picker"),
    kinds = el("div", "choice-row pick-kinds"),
    ages = el("div", "pick-ages"),
    reached = el("div", "pick-reached"),
    plausible = el("div", "pick-plausible"),
    own = el("div", "pick-own"),
    ownRow = el("div", "seed-row"),
    ownSeed = el("input", "seed-input"),
    ownRead = el("button", "seed-roll pick-read", "Read"),
    ownSaid = el("div", "pick-own-said");
  let baked: readonly Baked[] = [],
    catalogue: UniverseCatalogue | null = null;
  /** What has been read of each seed (it holds every age, so another age asks nothing more of it). */
  const kept = new Map<string, SeedReading>();

  /** How long a world takes to reach a year here, in words, and a far year run ahead counted. */
  const timeTo = (
    seed: string,
    year: number,
    lands: number,
  ): { words: string; minutes: number; from: number } => {
    const from = baked
        .filter((b) => b.universe === kind && b.seed === seed)
        .reduce((most, b) => (b.year <= year && b.year > most ? b.year : most), 0),
      minutes = phoneMinutesTo(year, from, lands);
    return {
      words: `${runWords(minutes)} to open on a phone${from ? `, from year ${yearWords(from)} run ahead` : ""}`,
      minutes,
      from,
    };
  };

  /** Open a world at a year: told how long first, in the row itself. */
  const opener = (seed: string, year: number, words: string) => {
    const b = el("button", "begin pick-open", words);
    b.onclick = () =>
      o.go(
        `?universe=${kind}&seed=${encodeURIComponent(seed)}&year=${Math.max(1, year)}${PAST_OURS.has(target) ? "&past=1" : ""}`,
      );
    return b;
  };

  const targetName = () => AGES.find((a) => a.id === target)!.name;
  const toggled = (row: HTMLElement, more: () => HTMLElement) => {
    let open: HTMLElement | null = null;
    row.onclick = (e) => {
      if ((e.target as HTMLElement).closest("button.pick-open")) return;
      if (open) {
        open.remove();
        open = null;
        row.classList.remove("on");
      } else {
        open = more();
        row.append(open);
        row.classList.add("on");
      }
    };
  };

  /** A world run in full, as a row: the year it reached the age, how long to get there. */
  const runRow = (s: CatalogueSeed): HTMLElement => {
    const age = s.ages[target]!,
      // (An age past ours stays once come to: a year run ahead past it shows it too, and opens in moments.)
      ahead = PAST_OURS.has(target)
        ? baked
            .filter((b) => b.universe === kind && b.seed === s.seed && b.year >= age.year)
            .reduce<number | null>((low, b) => (low === null || b.year < low ? b.year : low), null)
        : null,
      opens = ahead ?? age.year,
      t =
        ahead !== null
          ? {
              words: `fetched, under a minute on a phone, and seen as it stands in year ${yearWords(ahead)}`,
              minutes: 0,
              from: ahead,
            }
          : timeTo(s.seed, age.year, s.lands),
      row = el("div", "pick-row pick-run");
    row.dataset.seed = s.seed;
    row.dataset.year = String(opens);
    row.append(
      el("span", "pick-seed", s.seed),
      el(
        "span",
        "pick-tag pick-tag-run",
        `Reached in ${catalogue?.status === "other rules" ? "about " : ""}year ${yearWords(age.year)}`,
      ),
      el(
        "small",
        undefined,
        `${age.name === targetName() ? "" : `As ${age.name}. `}${said(t.words)}.`,
      ),
    );
    toggled(row, () => {
      const more = el("div", "pick-more");
      const line = Object.entries(s.ages)
        .sort((a, b) => a[1].year - b[1].year)
        .map(([id, a]) => {
          const def = AGE_LADDER.find((x) => x.id === id);
          return `${def?.icon ?? ""} ${a.name} ${yearWords(a.year)}`;
        })
        .join(" · ");
      more.append(
        el(
          "p",
          "muted",
          said(
            `${KIND_WORDS[s.kind] ?? s.kind}, ${MEDIUM_WORDS[s.medium] ?? s.medium}, ${s.lands.toLocaleString("en")} lands. Run in full to year ${yearWords(s.end.year)}, where it stood at ${s.end.name}.`,
          ),
        ),
        el("p", "pick-ages-line", line),
      );
      if (s.falls.length)
        more.append(
          el(
            "p",
            "muted",
            `It fell: ${s.falls
              .map(
                (f) =>
                  `from ${AGE_LADDER.find((a) => a.id === f.from)?.name ?? f.from} in year ${yearWords(f.year)}${f.back ? `, coming back in ${yearWords(f.back)}` : ""}`,
              )
              .join("; ")}.`,
          ),
        );
      more.append(
        opener(s.seed, opens, `Open at year ${yearWords(opens)} ▶`),
        el(
          "p",
          "muted pick-time",
          ahead !== null ? `${said(t.words)}.` : `It runs there behind a screen: ${t.words}.`,
        ),
      );
      return more;
    });
    return row;
  };

  /** The years the worlds that did reach an age reached it in, among those of this universe. */
  const yearsOf = (id: string) =>
    (catalogue?.seeds ?? [])
      .map((s) => s.ages[id]?.year)
      .filter((y): y is number => y !== undefined);

  /** The year to open a world read as allowing an age: the middle of those that did, else the end of a run. */
  const yearToOpen = () => {
    const years = yearsOf(target);
    return years.length ? middle(years) : catalogue?.lastYear || 1500;
  };

  /** A world's reading of the target, as a row. */
  const readRow = (r: SeedReading): HTMLElement => {
    const at = r.ages.find((a) => a.id === target)!,
      year = yearToOpen(),
      t = timeTo(r.seed, year, r.lands),
      row = el("div", "pick-row pick-read-row");
    row.dataset.seed = r.seed;
    row.dataset.year = String(year);
    row.append(
      el("span", "pick-seed", r.seed),
      el("span", "pick-tag pick-tag-maybe", `Plausibly${at.hard ? ", a long shot" : ""}`),
      el("small", undefined, `Not run. To year ${yearWords(year)}: ${t.words}.`),
    );
    toggled(row, () => {
      const more = el("div", "pick-more");
      more.append(el("p", "muted", readingWords(r)), ...agesList(r));
      more.append(
        opener(r.seed, year, `Run it to year ${yearWords(year)} ▶`),
        el(
          "p",
          "muted pick-time",
          `Nothing has run this world: it may not be there by then, or ever. It runs there behind a screen: ${t.words}.`,
        ),
      );
      return more;
    });
    return row;
  };

  /** What a reading holds, in a line. */
  const readingWords = (r: SeedReading): string =>
    said(
      `${KIND_WORDS[r.kind] ?? r.kind}, ${MEDIUM_WORDS[r.medium] ?? r.medium}, ${r.lands.toLocaleString("en")} lands${r.world ? `, a pull of ${r.world.gravity.toFixed(2)} g` : ""}.`,
    );

  /** Each age a reading allows or shuts, and why. */
  const agesList = (r: SeedReading): HTMLElement[] => {
    let last = "";
    return r.ages
      .filter((a) => a.id !== "bands")
      .map((a) => {
        const line = el("p", `pick-age-line ${a.allowed ? "allowed" : "shut"}`),
          why = `${a.why}${a.hard ? ` ${a.hard}` : ""}`;
        line.dataset.age = a.id;
        line.append(
          el("b", undefined, `${a.allowed ? "✓" : "✗"} ${a.icon} ${a.name}`),
          el("span", undefined, !a.allowed && why === last ? " The same." : ` ${why}`),
        );
        last = why;
        return line;
      });
  };

  /** Read on through the seeds for worlds that allow the age, and list them apart from those run. */
  const readOn = async (n: number, found: number, status: HTMLElement, list: HTMLElement) => {
    const client = await o.host();
    const known = new Set((catalogue?.seeds ?? []).map((s) => s.seed));
    let looked = 0,
      glanced = 0,
      longShots = 0,
      shown = found;
    const t0 = performance.now();
    status.textContent = `Reading worlds for what they hold…`;
    delete status.dataset.seconds;
    while (looked < READ_AT_A_GO && glanced < GLANCE_AT_A_GO && shown < found + SHOW) {
      if (n !== asked) return;
      const seed = o.seedAt(readFrom++);
      if (known.has(seed)) continue;
      glanced++;
      const key = `${kind}:${seed}`;
      let r = kept.get(key);
      if (!r) {
        // (A glance first: most worlds show at once that they have no people, or nothing to burn.)
        if (!(await client.glanceOf(kind, seed, target))) continue;
        if (n !== asked) return;
        r = await client.readingOf(kind, seed);
        if (n !== asked) return;
        kept.set(key, r);
        looked++;
      }
      const at = r.ages.find((a) => a.id === target);
      if (at?.allowed) {
        // (A long shot or two, not a list of them: there may be better further on.)
        if (at.hard && ++longShots > 2) continue;
        list.append(readRow(r));
        shown++;
      }
      status.textContent = `Reading worlds… ${glanced} looked at, ${shown - found} allow it`;
    }
    const seconds = (performance.now() - t0) / 1000;
    status.dataset.seconds = seconds.toFixed(1);
    status.dataset.read = String(looked);
    status.dataset.glanced = String(glanced);
    status.textContent = shown
      ? `${glanced} worlds looked at in ${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} seconds, with no history run.`
      : `None of ${glanced} worlds looked at allows ${targetName()}.`;
    const further = el("button", "link pick-further", "Read further ›");
    further.onclick = () => {
      further.remove();
      void readOn(n, shown, status, list);
    };
    plausible.append(further);
  };

  /** Everything below the choices, for this kind and age. */
  const refresh = async () => {
    const n = ++asked,
      client = await o.host();
    readFrom = 0;
    reached.replaceChildren(el("p", "muted", "…"));
    plausible.replaceChildren();
    if (!catalogue || catalogueKind !== kind) {
      catalogue = await catalogueFor(client, kind);
      catalogueKind = kind;
    }
    if (n !== asked) return;
    const name = targetName(),
      run = (catalogue.seeds ?? [])
        .filter((s) => s.ages[target])
        .sort((a, b) => a.ages[target]!.year - b.ages[target]!.year);
    const earlier = catalogue.status === "other rules";
    reached.replaceChildren(
      el(
        "h3",
        undefined,
        earlier
          ? "Reached: run in full, on an earlier version"
          : "Reached: run in full, every year of it",
      ),
    );
    if (catalogue.status === "none")
      reached.append(el("p", "muted", "No worlds run in full came with this build."));
    else if (!run.length)
      reached.append(
        el(
          "p",
          "muted",
          `None of the ${catalogue.seeds.length} worlds run in full, to year ${yearWords(catalogue.lastYear)}, came to ${name}.`,
        ),
      );
    else
      reached.append(
        el(
          "p",
          "muted",
          earlier
            ? `${run.length} of ${catalogue.seeds.length} worlds came to ${name} when last run to year ${yearWords(catalogue.lastYear)}, on an earlier version of the rules. Read their years as close, not exact: a world may get there sooner, later, or not at all.`
            : `${run.length} of ${catalogue.seeds.length} worlds run to year ${yearWords(catalogue.lastYear)} came to ${name}. These do, every time, unless your hand changes them: the same seed makes the same history.`,
        ),
        ...run.map(runRow),
      );
    const stands = catalogue.agreement?.[target],
      list = el("div", "pick-list"),
      status = el("p", "muted pick-status");
    plausible.append(
      el("h3", undefined, "Plausibly: read, not run"),
      el(
        "p",
        "muted",
        `What ${name} takes is all there in these worlds: their pull, their stuffs, their bodies, the lands their people reach. Nothing has run them, and that is no promise.${
          stands
            ? ` Of the worlds run in full that a reading allowed it, ${stands.reached} of ${stands.allowed} had come to it by year ${yearWords(catalogue.lastYear)}${
                stands.clear !== stands.allowed
                  ? ` (${stands.clearReached} of ${stands.clear} where the reading saw nothing in the way)`
                  : ""
              }.`
            : ""
        }`,
      ),
      list,
      status,
    );
    await readOn(n, 0, status, list);
  };
  let catalogueKind = "";

  // A seed typed in: the same reading, and what its run did if it has had one.
  const readOwn = async () => {
    const seed = ownSeed.value.trim();
    if (!seed) return;
    ownSaid.replaceChildren(el("p", "muted", "Reading it…"));
    const client = await o.host(),
      t0 = performance.now(),
      r = await client.readingOf(kind, seed),
      ms = Math.round(performance.now() - t0),
      ran = catalogue?.seeds.find((s) => s.seed === seed);
    if (ownSeed.value.trim() !== seed) return;
    const said: HTMLElement[] = [];
    if (!r.peopled)
      said.push(el("p", "pick-age-line shut", `${r.words || "No people rise here."}`));
    else {
      said.push(el("p", "muted", readingWords(r)), ...agesList(r));
      const later = r.functions.filter((f) => f.later);
      if (later.length) {
        said.push(el("h4", "pick-later", "What its matter would allow, past any age yet told"));
        for (const f of later) {
          const line = el("p", `pick-age-line ${f.met ? "allowed" : "shut"}`);
          line.append(
            el("b", undefined, `${f.met ? "✓" : "✗"} ${f.icon} ${f.name}`),
            el("span", undefined, ` ${f.why}`),
          );
          said.push(line);
        }
      }
    }
    said.push(el("p", "muted pick-time", `Read in ${ms} ms, with no history run.`));
    if (ran) {
      const age = ran.ages[target],
        earlier = catalogue?.status === "other rules",
        how = earlier ? "run in full on an earlier version, so close, not exact" : "run in full";
      said.unshift(
        el(
          "p",
          `pick-tag ${age ? "pick-tag-run" : "pick-tag-shut"}`,
          age
            ? `Reached ${age.name} in ${earlier ? "about " : ""}year ${yearWords(age.year)}: ${how}`
            : `Never came to ${targetName()} by year ${yearWords(ran.end.year)}: ${how}`,
        ),
      );
      if (age) said.push(opener(seed, age.year, `Open at year ${yearWords(age.year)} ▶`));
    } else if (r.ages.find((a) => a.id === target)?.allowed) {
      const year = yearToOpen(),
        t = timeTo(seed, year, r.lands);
      said.unshift(el("p", "pick-tag pick-tag-maybe", `${targetName()}: plausibly. Not run.`));
      said.push(
        opener(seed, year, `Run it to year ${yearWords(year)} ▶`),
        el("p", "muted pick-time", `It may not be there by then, or ever: ${t.words}.`),
      );
    } else
      said.unshift(
        el("p", "pick-tag pick-tag-shut", `${targetName()}: this world does not allow it.`),
      );
    ownSaid.replaceChildren(...said);
  };

  for (const [id, icon, words, note] of o.kinds) {
    const b = el("button", "choice");
    b.append(
      el("span", "choice-icon", icon),
      el("span", "choice-words", words),
      el("small", undefined, note),
    );
    b.dataset.id = id;
    b.onclick = () => {
      kind = id;
      for (const k of kinds.children)
        k.classList.toggle("on", (k as HTMLElement).dataset.id === id);
      void refresh();
    };
    kinds.append(b);
  }
  kinds.firstElementChild!.classList.add("on");
  for (const a of AGES) {
    const b = el("button", "pick-age");
    b.dataset.id = a.id;
    b.append(el("span", "pick-age-icon", a.icon), el("span", undefined, a.name));
    b.classList.toggle("on", a.id === target);
    b.onclick = () => {
      target = a.id;
      for (const k of ages.children)
        k.classList.toggle("on", (k as HTMLElement).dataset.id === a.id);
      void refresh().then(() => {});
      // (On a phone, what it is asking for is down the page.)
      reached.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    ages.append(b);
  }
  ownSeed.maxLength = 60;
  ownSeed.spellcheck = false;
  ownSeed.placeholder = "a seed of your own";
  ownSeed.setAttribute("aria-label", "A seed of your own to read");
  ownRead.onclick = () => void readOwn();
  ownSeed.onkeydown = (e) => {
    if (e.key === "Enter") void readOwn();
  };
  ownRow.append(ownSeed, ownRead);
  own.append(el("h3", undefined, "Or read a seed of your own"), ownRow, ownSaid);
  const actions = el("div", "title-actions");
  actions.append(o.back);
  form.append(
    el("h2", undefined, "A world that gets there"),
    el("h3", undefined, "What kind of world"),
    kinds,
    el("h3", undefined, "The age you want to see"),
    ages,
    reached,
    plausible,
    own,
    actions,
  );
  void bakedWorlds().then((worlds) => {
    baked = worlds;
    void refresh();
  });
  return form;
}
