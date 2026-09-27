// A window's fold (art track A1 and the phone's screen): a button beside the close box
// that folds an inspector to its title bar, so the world behind it shows, and unfolds it
// again; the window unfolds on its own when it is given something new to show.
import { el } from "./why.ts";

/** The fold button for an inspector whose heading is `title`; append it beside the close box. */
export function folder(inspector: HTMLElement, title: HTMLElement): HTMLButtonElement {
  const b = el("button", "fold", "_");
  const set = (folded: boolean) => {
    inspector.classList.toggle("folded", folded);
    b.textContent = folded ? "▢" : "_";
    b.setAttribute("aria-label", folded ? "Unfold this window" : "Fold this window");
  };
  set(false);
  b.onclick = () => set(!inspector.classList.contains("folded"));
  // Unfolded by something new to show — a title that says something else — not by the
  // same page drawn again (the sky's pages redraw as its worlds turn).
  let shown = title.textContent;
  new MutationObserver(() => {
    if (title.textContent === shown) return;
    shown = title.textContent;
    set(false);
  }).observe(title, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  return b;
}
