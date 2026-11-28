// The town mode fetched when it is first asked for (O1 of the design review's order): its chrome, its inspector, its
// people's bodies and its watching are a chunk of their own (app/townplace.ts and what only it reads), and the god game's
// page carries none of them until a town is entered. Until then the mode stands for itself here: not on, no town, a tap
// not its own. Asked to enter, it shows the loading screen (ui/place-loading.ts) at once, fetches the chunk, and the
// mode takes it from there, each step told as it is done.
import "./townload.css";
import { YEAR } from "../kernel/index.ts";
import { PlaceLoading } from "../ui/place-loading.ts";
import type { PlaceDeps, PlaceFlow } from "./townplace.ts";

export function lazyPlace(
  d: Omit<PlaceDeps, "loading">,
): PlaceFlow & { readonly loading: PlaceLoading } {
  const loading = new PlaceLoading(d.hud);
  let real: PlaceFlow | null = null,
    fetching: Promise<PlaceFlow> | null = null,
    turned = false;
  const load = (): Promise<PlaceFlow> =>
    (fetching ??= import("./townplace.ts").then((m) => (real = m.installPlace({ ...d, loading }))));
  loading.onCancel = () => {
    turned = true;
    loading.hide();
    void real?.leave();
  };
  /** The loading screen up for the town shown, before anything is fetched. */
  const shown = (): boolean => {
    const plan = d.plan();
    if (!plan || d.scale() !== "village" || plan.native) return false;
    const sky = d.weather();
    loading.show({
      name: plan.name,
      year: Math.floor((d.client.status?.t ?? 0) / YEAR),
      air:
        sky && sky.celsius !== null
          ? `${Math.round(sky.celsius)}° ${sky.words}`
          : (sky?.words ?? null),
      facts: [
        `${Math.round(plan.population).toLocaleString("en")} people`,
        plan.market ? "A market town" : `${plan.homes.length.toLocaleString("en")} homes`,
      ],
    });
    loading.step(0, false);
    return true;
  };
  const flow = {
    get loading() {
      return loading;
    },
    get on() {
      return real?.on ?? false;
    },
    get town() {
      return real?.town ?? null;
    },
    async toggle() {
      if (real?.on) return real.toggle();
      if (!real && !shown()) return;
      turned = false;
      const r = await load();
      loading.step(0, true);
      if (turned) return;
      return r.toggle();
    },
    leave: async () => real?.leave(),
    planQuery: (ref: string) => real?.planQuery(ref) ?? "village.plan",
    planRead: () => real?.planRead(),
    tapped: (x: number, y: number) => real?.tapped(x, y) ?? false,
    frame: () => real?.frame(),
    get told() {
      return real?.told ?? null;
    },
    pace: (seconds: number) => real?.pace(seconds),
    sheet: (tab: Parameters<PlaceFlow["sheet"]>[0]) => real?.sheet(tab),
    order: async (type: string, args: Record<string, unknown>) =>
      real ? real.order(type, args) : "the town mode is not entered",
    get noticed() {
      return real?.noticed ?? null;
    },
    lotAt: (lot: number) => real?.lotAt(lot) ?? null,
    wallsAt: () => real?.wallsAt() ?? null,
    get ran() {
      return real?.ran ?? "hand";
    },
    mode: async (mode: Parameters<PlaceFlow["mode"]>[0]) => real?.mode(mode),
    get watching() {
      return real?.watching ?? null;
    },
    get captioned() {
      return real?.captioned ?? null;
    },
    watchStay: (on: boolean) => real?.watchStay(on),
    watchNext: () => real?.watchNext(),
    inspect: (ref: string | null) => real?.inspect(ref),
    back: () => real?.back(),
    ahead: () => real?.ahead(),
    get following() {
      return real?.following ?? false;
    },
    get bubbles() {
      return real?.bubbles ?? { signs: 0, talks: 0, near: 0 };
    },
    get inspected() {
      return (
        real?.inspected ?? { ref: null, height: "peek", name: "", chosen: null, answered: null }
      );
    },
    inspectHeight: (h: "peek" | "half" | "full") => real?.inspectHeight(h),
    figurePx: () => real?.figurePx() ?? 0,
    reframe: () => real?.reframe(),
    uiCost: () => real?.uiCost() ?? { ms: 0, frames: 0, loaded: 0 },
    overlaid: () => real?.overlaid() ?? { lots: 0, spots: [] },
  } satisfies PlaceFlow & { readonly loading: PlaceLoading };
  return flow;
}
