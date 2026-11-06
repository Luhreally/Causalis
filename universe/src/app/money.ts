// A town's money, read at a glance (Lives L6, Classic's Homes view): 💰 on the town's bar lays it over the town, each home the colour of what it can
// spend, with a legend and nothing else. A home tapped gives its page. Reading moves nothing. It asks the host only when turned on, and its layer costs
// nothing a frame; for one who never turns it on it costs nothing at all.
import "./money.css";
import type { HomeMoney, HostClient, VillagePlan } from "../bridge/index.ts";
import { MONEY_RAMP, tenureWords } from "../view/index.ts";
import type { VillageScene } from "../render/index.ts";
import type { PageWindow, VillagePanel } from "../ui/index.ts";
import type { Stage } from "../render/index.ts";

export type MoneyDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly village: VillageScene;
  readonly pages: PageWindow;
  readonly panel: VillagePanel;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly now: () => number;
};

export type MoneyFlow = {
  /** A tap on the town while it is on (true: it was for a home). */
  tapped(x: number, y: number): boolean;
  /** The town's plan read again (its year turned, or another town come to). */
  planNow(): void;
};

const coin = (n: number) => Math.round(n).toLocaleString("en-US");

export function installMoney(d: MoneyDeps): MoneyFlow {
  const ui = document.createElement("div"),
    title = document.createElement("strong"),
    ramp = document.createElement("div"),
    ends = document.createElement("div"),
    low = document.createElement("span"),
    high = document.createElement("span"),
    note = document.createElement("div");
  ui.className = "money-legend";
  ui.hidden = true;
  title.textContent = "What they have to spend";
  ramp.className = "money-ramp";
  for (const c of MONEY_RAMP) {
    const step = document.createElement("i");
    step.style.background = `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;
    ramp.append(step);
  }
  ends.className = "money-ends";
  ends.append(low, high);
  note.className = "money-note";
  ui.append(title, ramp, ends, note);
  d.hud.append(ui);

  let on = false,
    asked = 0,
    data: HomeMoney | null = null,
    watching: (() => void) | null = null,
    drawnMs = 0,
    shown = 0;

  const off = (): void => {
    on = false;
    asked++;
    data = null;
    d.village.moneyClear();
    ui.hidden = true;
    d.panel.moneyOn = false;
    watching?.();
    watching = null;
  };

  const read = async (): Promise<void> => {
    const plan = d.plan();
    if (!plan) return off();
    const ask = ++asked,
      got = await d.client.query<HomeMoney | null>({
        type: "home.money",
        args: { town: plan.ref },
      });
    if (!on || ask !== asked || d.plan()?.ref !== plan.ref) return;
    const t0 = performance.now();
    data = got;
    shown = got ? d.village.moneyShow(got, d.now()) : 0;
    drawnMs = performance.now() - t0;
    if (!got || !shown) {
      low.textContent = "No home stands here to reckon";
      high.textContent = "";
      note.hidden = true;
    } else {
      low.textContent = `${coin(got.lo)} coin`;
      high.textContent = `${coin(got.hi)} coin`;
      const words = tenureWords(got.tenure),
        ruins =
          got.ruins > 0 ? `Grey: ${got.ruins === 1 ? "a ruin" : `${coin(got.ruins)} ruins`}. ` : "";
      note.textContent = `${ruins}${words ?? ""}`;
      note.hidden = !note.textContent;
    }
    ui.hidden = false;
  };

  const toggle = (): void => {
    if (on) return off();
    on = true;
    d.panel.moneyOn = true;
    // (Only while it is on: leaving the town, or taking a body or a film up, puts it away.)
    watching = d.stage.onUpdate(() => {
      if (
        d.scale() !== "village" ||
        /\b(possessing|living|ruling|filming)\b/.test(document.body.className)
      )
        off();
    });
    void read();
  };
  d.panel.onMoney = toggle;

  Object.assign((globalThis as unknown as { causalis: object }).causalis, {
    money: {
      toggle,
      state: () => ({
        on,
        town: data?.town ?? null,
        homes: data?.n.length ?? 0,
        shown,
        drawnMs: Math.round(drawnMs * 10) / 10,
        counts: data?.counts ?? [],
        ruins: data?.ruins ?? 0,
        lo: data?.lo ?? 0,
        hi: data?.hi ?? 0,
        tenure: data?.tenure ?? null,
        legend: ui.hidden ? "" : ui.innerText,
      }),
      spots: () => (on ? d.village.moneySpots() : []),
    },
  });

  return {
    tapped: (x, y) => {
      if (!on) return false;
      const plan = d.plan(),
        n = d.village.moneyPick(x, y);
      if (!plan || n === null) return false;
      void d.pages.open(`dwell:${plan.ref}:${n}`);
      return true;
    },
    planNow: () => {
      if (!on) return;
      if (data && d.plan()?.ref !== data.town) d.village.moneyClear();
      void read();
    },
  };
}
