// Their own names (Phase 58): whether the pages tell things as the people where the eye stands call
// them, or as they are — a switch on the page window, remembered for the viewer, each kind of world
// its own: Earth's pages open as they are, another people's world as they call things.
import { el } from "./why.ts";

/** As they call things, or as they are. */
export type NamesMode = "theirs" | "real";

/** What a page is asked for with, as they call things (nothing: as it is, the pages as they were). */
export type NamesArgs = {
  readonly names?: { readonly as: "theirs"; readonly at: number | null };
};

/** Where the viewer's choice is kept, by the kind of world. */
const KEY = "causalis.names";

/**
 * The way a viewer opens a world: as a page's address asks (`?names=theirs`, `real`); else as they
 * last chose on such a world; else by the world — Earth's as it is, another people's as they call
 * things. A machine driving the page reads the pages as they were, unless it asks (`?names=auto`: as
 * a viewer would open it).
 */
export function namesMode(
  universe: string,
  asked: string | null,
  kept: string | null,
  machine: boolean,
): NamesMode {
  if (asked === "theirs" || asked === "real") return asked;
  if (machine && asked !== "auto") return "real";
  if (kept === "theirs" || kept === "real") return kept;
  return universe === "earth" ? "real" : "theirs";
}

/** The switch: the way things are told now, flipped from any page that names things, and kept. */
export class NamesSwitch {
  mode: NamesMode;
  /** The land the eye stands in (the land shown, or the town's): null on the globe. */
  standing: () => number | null = () => null;
  private readonly key: string;

  constructor(universe: string, search: string, machine: boolean) {
    this.key = `${KEY}.${universe === "earth" ? "earth" : "other"}`;
    let kept: string | null = null;
    try {
      kept = localStorage.getItem(this.key);
    } catch {
      kept = null;
    }
    this.mode = namesMode(universe, new URLSearchParams(search).get("names"), kept, machine);
  }

  /** What a page or a card is asked for with now. */
  args(): NamesArgs {
    return this.mode === "theirs" ? { names: { as: "theirs", at: this.standing() } } : {};
  }

  /** Told the other way, and kept for the viewer. */
  flip(): void {
    this.mode = this.mode === "theirs" ? "real" : "theirs";
    try {
      localStorage.setItem(this.key, this.mode);
    } catch {
      // (Kept for this visit only, where the browser keeps nothing.)
    }
  }

  /** The switch as a page's button: what it tells things as now, and a press to tell them the other way. */
  button(onFlip: () => void): HTMLButtonElement {
    const theirs = this.mode === "theirs",
      b = el(
        "button",
        `names-switch${theirs ? " on" : ""}`,
        theirs ? "🗣 As they call it" : "⚗️ As it is",
      );
    b.title = theirs
      ? "Things as the people here call them, in their own words: press to tell them as they are"
      : "Things as they are: press to tell them as the people here call them";
    b.setAttribute("aria-pressed", String(theirs));
    b.onclick = () => {
      this.flip();
      onFlip();
    };
    return b;
  }
}

/** Whether a page names things (a substance's or an element's, or links to one): where the switch shows. */
export function namesThings(ref: string, said: string): boolean {
  return (
    /^(subst|elem):/.test(ref) || said.includes('"ref":"subst:') || said.includes('"ref":"elem:')
  );
}
