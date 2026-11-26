// A town's bills and what its stores take (town mode, N10 of the design review's order), drawn the same on its Work sheet
// and in a building's inspector: each good its land knows how to make, what the town holds of it and what its bill asks
// it to hold, with keys to raise and lower that, to make none, to put it first and to let it be; and for its market and
// its granary, a switch for each good, taken there or not. The keys give orders (place.bill, place.refuse); nothing here
// reckons what comes of them.
import type { PlaceBillRow, PlaceStoreTakes } from "../bridge/index.ts";
import { el } from "./why.ts";

const amount = (x: number) =>
  x >= 100 ? `${Math.round(x)}` : x >= 10 ? x.toFixed(1) : x.toFixed(2);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** What a bill asks, in a few words. */
function asks(r: PlaceBillRow): string {
  return r.until === null
    ? "no bill: its makers at their own making"
    : r.until === 0
      ? "make none"
      : `keep ${amount(r.until)} ${r.unit === "units" ? "" : "months' food "}by`;
}

/** The rows of a town's bills, each with its keys (orders given through `order`; `open` a building's page). */
export function billsEl(
  rows: readonly PlaceBillRow[],
  order: (type: string, args: Record<string, unknown>) => void,
  open: ((ref: string) => void) | null,
  orders: boolean,
): HTMLElement {
  const box = el("div", "place-bills");
  for (const r of rows) {
    const row = el("div", `place-bill${r.until !== null ? " billed" : ""}`),
      name = el(open && r.ref ? "button" : "span", "place-bill-name");
    name.append(
      el("span", "place-row-name", `${cap(r.name)}: ${amount(r.held)} held`),
      el(
        "span",
        "place-row-what",
        `${cap(asks(r))} · ${r.makers} ${r.makers === 1 ? "maker" : "makers"}, ${r.making} at it now · ${r.where}`,
      ),
    );
    if (open && r.ref) {
      const ref = r.ref;
      (name as HTMLButtonElement).onclick = () => open(ref);
    }
    row.append(name);
    if (orders) {
      const keys = el("span", "place-bill-keys"),
        key = (words: string, label: string, args: Record<string, unknown> | null) => {
          const b = el("button", "place-step", words);
          b.setAttribute("aria-label", `${cap(r.name)}: ${label}`);
          b.title = label;
          b.disabled = !args;
          if (args) b.onclick = () => order("place.bill", { good: r.good, ...args });
          keys.append(b);
        },
        // (From no bill, a key starts at what is held now, a step more or less.)
        from = r.until ?? Math.round(r.held / r.step) * r.step;
      key("−", `Keep ${amount(r.step)} less`, from > 0 ? { until: Math.max(0, from - r.step) } : null);
      key("+", `Keep ${amount(r.step)} more`, { until: from + r.step });
      key("⤒", "Put first among the bills", r.until !== null && r.order !== 0 ? { until: r.until, first: true } : null);
      key("×", "No bill: its makers at their own making", r.until !== null ? { until: null } : null);
      row.append(keys);
    }
    box.append(row);
  }
  return box;
}

/** One of its stores' switches, good by good: taken there, or not. */
export function takesEl(
  t: PlaceStoreTakes,
  order: (type: string, args: Record<string, unknown>) => void,
  orders: boolean,
): HTMLElement {
  const box = el("div", "place-takes");
  for (const g of t.goods) {
    const row = el("div", "place-take"),
      sw = el("button", "place-switch", g.takes ? "Takes ●" : "Not ○");
    sw.classList.toggle("on", g.takes);
    sw.disabled = !orders;
    const what = t.store === 0 ? "its market" : "its granary";
    sw.title = g.takes
      ? `${cap(g.name)} is carried to ${what}. Tap to keep it out: ${t.store === 0 ? "what is made of it stays where it was made" : "it goes to the market instead"}.`
      : `${cap(g.name)} is kept out of ${what}. Tap to let it be carried there.`;
    sw.setAttribute("aria-label", sw.title);
    sw.onclick = () => order("place.refuse", { store: t.store, good: g.good, on: g.takes });
    row.append(el("span", "place-row-name", `${cap(g.name)} · ${amount(g.held)} held`), sw);
    box.append(row);
  }
  return box;
}
