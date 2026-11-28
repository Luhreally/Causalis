// Live a Line, fetched when it is first asked for (as the town mode is: app/townlazy.ts). Until then the god game's page
// carries none of it but this, which fetches the mode's chunk (app/line.ts) and hands it the way in it was asked by (the
// world's first cells, or a line of the tree of life). The chunk shows its own loading screen.
import { PlaceLoading } from "../ui/place-loading.ts";
import type { LineDeps, LineFlow } from "./line.ts";

export function lazyLine(d: Omit<LineDeps, "Loading">): {
  readonly on: boolean;
  open(from?: string | null): Promise<void>;
} {
  let real: LineFlow | null = null;
  return {
    get on() {
      return !!real?.on;
    },
    async open(from = null) {
      real ??= (await import("./line.ts")).installLine({ ...d, Loading: PlaceLoading });
      await real.enter(from);
    },
  };
}
