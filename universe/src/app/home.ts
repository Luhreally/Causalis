// A home looked into (Lives L6), the page's part: from a person's page, a home's page, a lot tapped, or the strip of a life lived; the town
// put away and the home built where the eye can see it whole, the roof lifting off, the clock held while it is looked at; anything in it
// tapped goes to its page, anyone in it to their page, to being possessed or to being lived as. Looking changes nothing: history moves
// only when Possess or Live is pressed.
import "./home.css";
import type { HomeInside, HostClient, VillagePlan } from "../bridge/index.ts";
import { townLots } from "../bridge/index.ts";
import { HomeScene, type OrbitRig, type Stage, type VillageScene } from "../render/index.ts";
import type { PageWindow, TimeBar } from "../ui/index.ts";
import { homeDrawn, type HomeFolk } from "../view/index.ts";
import type { Possession } from "./possess.ts";

export type HomeDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  readonly pages: PageWindow;
  readonly possession: Possession;
  readonly plan: () => VillagePlan | null;
  readonly scale: () => string;
  readonly goTown: (town: string) => Promise<void>;
  readonly reload: (ref: string) => Promise<void>;
  readonly now: () => number;
  /** A life taken up in someone of the town shown. */
  readonly live: (agent: number) => Promise<string | null>;
};

/** What to look into: a home by its number, the home of someone or of a household, in a town. */
export type HomeAsk = {
  readonly town: string;
  readonly n?: number;
  readonly person?: string;
  readonly household?: string;
};

export type HomeFlow = {
  open(ask: HomeAsk): Promise<string | null>;
  close(): void;
  /** A tap on the scene while a home is open (true: it was for the home). */
  tapped(x: number, y: number): boolean;
  readonly on: boolean;
};

/** A home of a village's ring, not of a lot of its plan (host/home.ts). */
const RING_HOME = 1_000_000,
  /** The eye's pitch: enough from above to see into its rooms over its low walls. */
  EYE_PITCH = -56;

/** The number of the home a place in the plan's homes is. */
export function homeNumber(plan: VillagePlan, k: number): number {
  const t = plan.town,
    h = plan.homes[k];
  if (!t || !h) return RING_HOME + k;
  const lots = townLots(t.family, t.seed, t.axis, t.lots, t.water);
  for (let p = 0; p < t.lots; p++)
    if (Math.hypot(lots.x[p]! - h.x, lots.z[p]! - h.z) < 0.5) return p;
  return RING_HOME + k;
}

export function installHome(d: HomeDeps): HomeFlow {
  const scene = new HomeScene(d.stage),
    ui = document.createElement("div"),
    cap = document.createElement("div"),
    title = document.createElement("strong"),
    line = document.createElement("span"),
    out = document.createElement("div"),
    who = document.createElement("div"),
    acts = document.createElement("div"),
    page = document.createElement("button"),
    leave = document.createElement("button");
  ui.className = "home-hud";
  ui.hidden = true;
  cap.className = "home-cap";
  out.className = "home-out";
  who.className = "home-who";
  who.hidden = true;
  acts.className = "home-acts";
  page.className = "home-act home-page";
  page.textContent = "🏠 Its page";
  leave.className = "home-act home-leave";
  leave.textContent = "🚪 Back out";
  cap.append(title, line);
  acts.append(page, leave);
  ui.append(cap, out, who, acts);
  d.hud.append(ui);

  let inside: HomeInside | null = null,
    planNow: VillagePlan | null = null,
    /** The eye as it stood, to go back to. */
    was: {
      distance: number;
      pitch: number;
      yaw: number;
      target: { x: number; y: number; z: number };
    } | null = null,
    roam = false;

  /** Who is being played, by what the page wears (a life's own 🏠 Go in opens a home with one being lived). */
  const bodyNow = (): string =>
    /\b(possessing|living|ruling)\b/.exec(document.body.className)?.[1] ?? "";
  let bodyAt = "";

  const hourWords = (t: number): string => {
    const h = Math.floor((((t % 86_400) + 86_400) % 86_400) / 3600),
      m = Math.floor((((t % 3600) + 3600) % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const showWho = (f: HomeFolk): void => {
    const p = planNow?.people[f.index];
    if (!p) return;
    const words = document.createElement("p"),
      their = document.createElement("button"),
      take = document.createElement("button"),
      live = document.createElement("button");
    words.textContent = `${p.name.replace(/ of .*$/, "")}, ${p.age}${p.child ? ", a child" : p.role ? `, ${p.role}` : ""}. ${f.doing}.`;
    their.className = "home-act home-their";
    their.textContent = "📖 Their page";
    their.onclick = () => void d.pages.open(p.ref);
    take.className = "home-act home-take";
    take.textContent = "🖐 Possess";
    take.onclick = () => void body(p, "take", words);
    live.className = "home-act home-live";
    live.textContent = "🏡 Live as";
    live.onclick = () => void body(p, "live", words);
    who.replaceChildren(
      words,
      their,
      ...(p.ref.startsWith("agent:") || !planNow?.native ? [take, live] : []),
    );
    who.hidden = false;
  };

  /** Someone taken by the hand: laid on the town first if it is not; the home closed; pressing this is what moves history. */
  const body = async (
    p: VillagePlan["people"][number],
    how: "take" | "live",
    words: HTMLElement,
  ): Promise<void> => {
    const town = inside?.town;
    if (!town) return;
    words.textContent = `Laying your hand on ${inside?.townName ?? "the town"}…`;
    try {
      let id: number | null = p.ref.startsWith("agent:") ? Number(p.ref.slice(6)) : null;
      if (id === null) {
        const hand = await d.client.query<{ village: string } | null>({ type: "hand" }),
          name = p.name.replace(/ of .*$/, ""),
          named = () => d.client.query<number | null>({ type: "hand.named", args: { name } });
        if (hand?.village === town) id = await named();
        if (id === null) {
          if (hand) await d.client.command("hand.lift", {});
          await d.client.command("hand.lay", {
            village: town,
            as: { name, age: p.age, occupation: p.occupation, sex: p.sex ?? 0 },
          });
          id = await named();
        }
      }
      if (id === null) throw new Error(`${p.name} could not be found under your hand`);
      close();
      await d.reload(town);
      if (how === "live") {
        const why = await d.live(id);
        if (why) throw new Error(why);
        return;
      }
      const index = d.plan()?.people.findIndex((q) => q.ref === `agent:${id}`) ?? -1;
      if (index < 0) throw new Error(`${p.name} is not among those drawn`);
      const why = await d.possession.take(index);
      if (why) throw new Error(why);
    } catch (error) {
      if (inside) words.textContent = (error as Error).message;
    }
  };

  const close = (): void => {
    if (!inside) return;
    inside = null;
    planNow = null;
    scene.close();
    ui.hidden = true;
    who.hidden = true;
    document.body.classList.remove("homing");
    d.time.release("home");
    if (d.scale() === "village") d.village.visible = true;
    if (was) {
      d.rig.flyTo(
        { target: was.target, distance: was.distance, pitch: was.pitch, yaw: was.yaw },
        0.6,
      );
      was = null;
    }
    void roam;
  };

  const open = async (ask: HomeAsk): Promise<string | null> => {
    if (inside) close();
    d.pages.close();
    if (d.scale() !== "village" || d.plan()?.ref !== ask.town) await d.goTown(ask.town);
    const plan = d.plan();
    if (!plan || plan.ref !== ask.town) return "that town is not to be seen now";
    let n = ask.n ?? null;
    if (n === null) {
      const k = ask.person
        ? (plan.people.find((p) => p.ref === ask.person)?.home ?? -1)
        : ask.household
          ? plan.homes.findIndex((h) => h.household === ask.household)
          : -1;
      if (k < 0) return "no home of theirs is to be seen in this town";
      n = homeNumber(plan, k);
    }
    const t0 = performance.now(),
      got = await d.client.query<HomeInside | null>({
        type: "home.inside",
        args: { town: ask.town, n },
      });
    if (!got) return "no home stands there that is known";
    inside = got;
    planNow = plan;
    bodyAt = bodyNow();
    d.time.hold("home");
    const t = d.now(),
      drawn = homeDrawn(got, plan, t);
    scene.show(drawn, plan);
    const made = performance.now() - t0;
    Object.assign(state, {
      builtMs: Math.round(made),
      sceneMs: Math.round(scene.built),
      parts: drawn.parts.count,
    });
    d.village.visible = false;
    document.body.classList.add("homing");
    title.textContent = got.title;
    const here = drawn.folk.filter((f) => f.at === "in").length,
      all = drawn.folk.length;
    line.textContent = `${got.line}. At ${hourWords(t)}, ${
      all === 0
        ? "no one known"
        : here === 0
          ? "no one is in"
          : here === all
            ? all === 1
              ? "they are in"
              : "all are in"
            : `${here} of ${all} in`
    }${got.storey > 0 ? `, ${ordinal(got.storey)} floor of ${got.storeys}` : ""}.`;
    out.replaceChildren(
      ...drawn.folk
        .filter((f) => f.at === "out")
        .slice(0, 4)
        .map((f) => {
          const b = document.createElement("button");
          b.textContent = `${f.name.replace(/ of .*$/, "")}: ${f.doing}`;
          b.onclick = () => showWho(f);
          return b;
        }),
    );
    who.hidden = true;
    ui.hidden = false;
    was = {
      distance: d.rig.distance,
      pitch: d.rig.pitch,
      yaw: d.rig.yaw,
      target: { x: d.rig.target.x, y: d.rig.target.y, z: d.rig.target.z },
    };
    d.rig.flyTo(
      { target: { x: 0, y: 0, z: 0 }, distance: drawn.distance, pitch: EYE_PITCH, yaw: 0 },
      0.5,
    );
    return null;
  };

  const ordinal = (n: number): string => {
    const r = n % 100,
      e = r >= 11 && r <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
    return `${n}${e}`;
  };

  page.onclick = () => {
    if (inside) void d.pages.open(inside.ref);
  };
  leave.onclick = close;

  d.stage.onUpdate((dt) => {
    if (!inside) return;
    scene.update(dt);
    // (A page's own way to take a body, or to another scale: the eye is theirs now, not to go back from here.)
    if (d.scale() !== "village" || bodyNow() !== bodyAt) {
      was = null;
      close();
    }
  });

  const tapped = (x: number, y: number): boolean => {
    if (!inside) return false;
    const spot = scene.pick(x, y);
    if (!spot) {
      who.hidden = true;
      return true;
    }
    if (spot.kind === "thing") {
      who.hidden = true;
      void d.pages.open(`dwelt:${inside.town}:${inside.n}:${spot.n}`);
      return true;
    }
    const f = scene.drawn?.folk.find((x2) => x2.index === spot.n);
    if (f) showWho(f);
    return true;
  };

  const state: Record<string, unknown> = {};
  Object.assign((globalThis as unknown as { causalis: object }).causalis, {
    home: {
      open,
      close,
      tapped,
      state: () =>
        inside && {
          ...state,
          ref: inside.ref,
          title: inside.title,
          line: inside.line,
          state: inside.state,
          level: inside.level,
          coin: inside.coin,
          rooms: inside.dwelling.rooms.length,
          things: inside.dwelling.things.map((t) => t.way),
          folk: scene.drawn?.folk.map((f) => ({ name: f.name, at: f.at, doing: f.doing })) ?? [],
          lifted: scene.lifted,
          flying: d.rig.flying,
        },
      spots: () =>
        scene.drawn?.spots.flatMap((s) => {
          const at = scene.onScreen(s);
          return at
            ? [
                {
                  kind: s.kind,
                  n: s.n,
                  x: at.x,
                  y: at.y,
                  way: s.kind === "thing" ? inside?.dwelling.things[s.n]?.way : null,
                  shape: s.kind === "thing" ? inside?.dwelling.things[s.n]?.shape : null,
                },
              ]
            : [];
        }) ?? [],
    },
  });

  return {
    open,
    close,
    tapped,
    get on() {
      return !!inside;
    },
  };
}
