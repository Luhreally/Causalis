// A realm among the stars coming apart, watched (Phase 72): from the stars around, its worlds in its colour at its greatest, and year by
// year each one going dark as history has it, the bar running. A card then tells what those cut off have lost and offers the fleet sent
// to take one back, if there was one. The world's clock is held all the while, and nothing here writes to history.
import "./film.css";
import "./nation.css";
import type { HostClient, NationFall } from "../bridge/index.ts";
import type { Stage } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";

/** How a star is drawn in the film: its colour, and how large; `flash` is how lately it broke. */
export type FilmMark = {
  readonly star: string;
  readonly color: readonly [number, number, number];
  readonly seat: boolean;
  readonly dark: boolean;
  readonly flash: number;
};

export type NationFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  /** Out to the stars around. */
  readonly toStars: () => Promise<void>;
  /** Draw these on the stars' map. */
  readonly show: (marks: readonly FilmMark[]) => void;
  /** Done: the map back as it is now. */
  readonly done: () => void;
  readonly openPage: (ref: string) => void;
  readonly watchFleet: (id: string) => void;
  /** Whether another film is playing. */
  readonly busy: () => boolean;
};

export type NationFilm = {
  /** Play a realm's coming apart (false: it holds nothing to show). `auto`: the card closes by itself, as the Director's eye wants. */
  play(ref: string, auto?: boolean): Promise<boolean>;
  skip(): void;
  readonly playing: boolean;
  state(): { year: number; held: number; words: string; card: boolean; name: string | null };
};

/** The film's seconds at most, however many years it covers; and how long a world's going is seen to flash. */
const SECONDS = 22,
  MIN_SECONDS = 9,
  FLASH_SECONDS = 1.1;

export function installNationFilm(d: NationFilmDeps): NationFilm {
  const ui = document.createElement("div"),
    year = document.createElement("div"),
    words = document.createElement("div"),
    skip = document.createElement("button"),
    card = document.createElement("div");
  ui.className = "colony-film nation-film";
  ui.hidden = true;
  year.className = "film-year";
  words.className = "nation-film-words";
  skip.className = "film-skip";
  skip.textContent = "Skip ›";
  card.className = "nation-card";
  card.hidden = true;
  ui.append(year, skip, words, card);
  d.hud.append(ui);

  let plan: NationFall | null = null,
    at = 0,
    seconds = SECONDS,
    playing = false,
    cardShown = false,
    held = 0,
    auto = false,
    cardAt = 0,
    finish: (() => void) | null = null;

  const yearNow = () =>
    plan ? Math.round(plan.from + (plan.to - plan.from) * Math.min(1, at / seconds)) : 0;

  const draw = () => {
    if (!plan) return;
    const k = plan.from + (plan.to - plan.from) * Math.min(1, at / seconds),
      span = plan.to - plan.from,
      flashYears = (span * FLASH_SECONDS) / seconds,
      marks: FilmMark[] = [];
    held = 0;
    for (const w of plan.worlds) {
      // (Not yet its own, this year.)
      if (k < w.since) continue;
      const gone = w.left !== null && k >= w.left;
      if (!gone) held++;
      marks.push({
        star: w.star,
        color: plan.color,
        seat: false,
        dark: gone,
        flash: gone ? Math.max(0, 1 - (k - w.left!) / Math.max(0.001, flashYears)) : 0,
      });
    }
    d.show(marks);
    year.textContent = `YEAR ${yearNow()}`;
    words.textContent = `${plan.name}: ${held === 1 ? "1 world" : `${held} worlds`} held`;
  };

  const end = () => {
    if (!playing) return;
    playing = false;
    cardShown = false;
    card.hidden = true;
    ui.hidden = true;
    document.body.classList.remove("filming");
    d.time.release("film");
    d.done();
    const f = finish;
    finish = null;
    f?.();
  };

  const showCard = () => {
    if (!plan || cardShown) return;
    cardShown = true;
    cardAt = 0;
    const p = plan,
      title = document.createElement("h2");
    title.textContent = p.fellYear
      ? `${p.name} has fallen`
      : `${p.name}: ${held === 1 ? "1 world" : `${held} worlds`} of ${p.greatest} at the most`;
    const lines: HTMLElement[] = [title],
      say = (text: string) => {
        const e = document.createElement("p");
        e.textContent = text;
        lines.push(e);
      };
    const gone = p.worlds.filter((w) => w.left !== null).length;
    say(
      gone
        ? `At its greatest, in year ${p.greatestYear}, it held ${p.greatest} worlds. ${gone === 1 ? "One" : gone} went ${gone === 1 ? "its" : "their"} own way, one at a time${p.fellYear ? `, the last in year ${p.fellYear}` : ""}.`
        : `It holds ${held === 1 ? "its one world" : `all ${held} of its worlds`} yet.`,
    );
    if (p.fleetWords) say(p.fleetWords);
    if (p.lost.length) {
      const h = document.createElement("h3");
      h.textContent = "What those cut off have lost";
      lines.push(h);
      for (const l of p.lost.slice(0, 2)) say(l);
    } else if (gone)
      say("Those cut off could all make what they need: none has fallen into the dark.");
    const acts = document.createElement("div");
    acts.className = "nation-card-acts";
    if (p.fleet) {
      const b = document.createElement("button");
      b.className = "act nation-fleet";
      b.textContent = "▶ The fleet sent to take one back";
      const id = p.fleet;
      b.onclick = () => {
        end();
        d.watchFleet(id);
      };
      acts.append(b);
    }
    const page = document.createElement("button");
    page.className = "act nation-page";
    page.textContent = "Its page";
    page.onclick = () => {
      const ref = p.ref;
      end();
      d.openPage(ref);
    };
    const close = document.createElement("button");
    close.className = "act nation-close";
    close.textContent = "Back to the stars";
    close.onclick = () => end();
    acts.append(page, close);
    card.replaceChildren(...lines, acts);
    card.hidden = false;
    words.textContent = "";
  };

  skip.onclick = () => {
    if (cardShown) end();
    else {
      at = seconds;
      draw();
      showCard();
    }
  };

  d.stage.onUpdate((dt) => {
    if (!playing || !plan) return;
    if (cardShown) {
      cardAt += dt;
      if (auto && cardAt > 7) end();
      return;
    }
    at += dt;
    draw();
    if (at >= seconds + 1.5) showCard();
  });

  return {
    async play(ref, isAuto = false) {
      if (playing || d.busy()) return false;
      const p = await d.client.query<NationFall | null>({ type: "nation.fall", args: { ref } });
      if (!p || !p.worlds.length) return false;
      plan = p;
      at = 0;
      seconds = Math.max(MIN_SECONDS, Math.min(SECONDS, (p.to - p.from) * 0.4));
      playing = true;
      auto = isAuto;
      cardShown = false;
      card.hidden = true;
      d.time.hold("film");
      await d.toStars();
      document.body.classList.add("filming");
      ui.hidden = false;
      draw();
      return new Promise<boolean>((resolve) => {
        finish = () => resolve(true);
      });
    },
    skip: () => skip.click(),
    get playing() {
      return playing;
    },
    state: () => ({
      year: yearNow(),
      held,
      words: words.textContent ?? "",
      card: cardShown,
      name: plan?.name ?? null,
    }),
  };
}
