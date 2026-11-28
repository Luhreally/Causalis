// Live a Line, fetched when it is first asked for (as the town mode is: app/townlazy.ts). Until then the god game's page
// carries none of it: only this, which shows the loading screen at once, fetches the mode's chunk (app/line.ts), and
// hands it the way in it was asked by (the world's first cells, or a line of the tree of life).
import { YEAR } from "../kernel/index.ts";
import { PlaceLoading } from "../ui/index.ts";
import type { LineDeps, LineFlow } from "./line.ts";

export function lazyLine(d: Omit<LineDeps, "loading">): {
  readonly on: boolean;
  open(from?: string | null): Promise<void>;
} {
  const loading = new PlaceLoading(d.hud);
  let real: LineFlow | null = null,
    turned = false;
  loading.onCancel = () => {
    turned = true;
    loading.hide();
    if (real?.on) void real.wake();
    else d.time.release("line");
  };
  return {
    get on() {
      return real?.on ?? false;
    },
    async open(from = null) {
      if (real?.on) return;
      turned = false;
      const speed = d.client.status?.speed ?? null;
      // (The world held where it stands from the moment it is asked: nothing of it goes on while the mode comes.)
      d.time.hold("line");
      loading.show(
        {
          name: "Live a Line",
          year: Math.floor((d.client.status?.t ?? 0) / YEAR),
          air: "your world held still",
          facts: [from ? "A line of its tree of life" : "From its first cells", "Wake brings you back"],
        },
        ["The mode's own code", "Your world's first seas", "Your first cell"],
      );
      loading.step(0, false);
      try {
        real ??= (await import("./line.ts")).installLine({ ...d, loading });
        loading.step(0, true);
        if (turned) return;
        await real.enter(from, speed);
      } catch (error) {
        loading.hide();
        if (!real?.on) d.time.release("line");
        throw error;
      }
    },
  };
}
