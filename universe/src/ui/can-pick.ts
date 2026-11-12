// Pick a world to set beside this one (F5): any seed typed, or one of those run, kept or in the seed picker's list.
import { catalogueFor } from "./catalogue.ts";
import type { ToolContext } from "./tools.ts";
import { el } from "./why.ts";

/** Worlds worth setting beside any other, whatever came with this build. */
const OFFERED: readonly (readonly [string, string])[] = [
  ["earth", "first light"],
  ["alien", "vale 471"],
  ["alien", "kestrel 557"],
  ["alien", "quill 742"],
  ["alien", "cinder 671"],
  ["alien", "wren 113"],
];
const SIGN: Readonly<Record<string, string>> = { earth: "🌍", alien: "👽" };

export function drawCanPick(
  into: HTMLElement,
  args: Readonly<Record<string, unknown>>,
  ctx: ToolContext,
): void {
  const box = el("div", "can-pick"),
    here = String(args.universe ?? "alien"),
    asked = args.seed === null || args.seed === undefined ? "" : String(args.seed),
    // (Whose page sets them side by side: what can be done here, or how life began: B2.)
    to = String(args.to ?? "can"),
    form = el("div", "can-type"),
    input = el("input", "can-seed") as HTMLInputElement,
    go = el("button", "can-go", "Set beside"),
    choices = el("div", "can-universe"),
    chips = el("div", "can-chips");
  let universe = here;
  const open = (u: string, seed: string) => {
    const s = seed.trim();
    if (s) ctx.open(`${to}:${u}|${encodeURIComponent(s)}`);
  };
  input.type = "text";
  input.placeholder = "Any seed";
  input.value = asked;
  input.enterKeyHint = "go";
  input.setAttribute("aria-label", "A seed to set beside this world");
  input.onfocus = () => input.select();
  input.onkeydown = (e) => {
    if (e.key === "Enter") open(universe, input.value);
  };
  go.onclick = () => open(universe, input.value);
  for (const u of ["alien", "earth"]) {
    const b = el("button", u === universe ? "can-u on" : "can-u", SIGN[u]!);
    b.title = u === "earth" ? "A world of the Earth universe" : "An alien world";
    b.dataset.universe = u;
    b.onclick = () => {
      universe = u;
      for (const x of choices.children)
        x.classList.toggle("on", (x as HTMLElement).dataset.universe === u);
    };
    choices.append(b);
  }
  form.append(choices, input, go);
  const chip = (u: string, seed: string) => {
    const b = el("button", "can-chip", `${SIGN[u] ?? ""} ${seed}`);
    b.dataset.seed = seed;
    b.dataset.universe = u;
    b.onclick = () => open(u, seed);
    return b;
  };
  const seen = new Set<string>();
  const add = (u: string, seed: string) => {
    const key = `${u}|${seed}`;
    if (seen.has(key) || seen.size >= 12) return;
    seen.add(key);
    chips.append(chip(u, seed));
  };
  for (const [u, seed] of OFFERED) add(u, seed);
  box.append(form, chips);
  into.append(box);
  // (Worlds kept, and those run in full, as they come: the list stands without them.)
  void ctx.client
    .saves()
    .then((saves) => {
      for (const s of saves.slice(0, 3)) add(s.universe, s.seed);
    })
    .catch(() => {});
  void catalogueFor(ctx.client, here)
    .then((c) => {
      for (const s of (c.seeds ?? []).slice(0, 3)) add(here, s.seed);
    })
    .catch(() => {});
}
