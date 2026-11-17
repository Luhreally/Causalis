// A fight of the underworld watched in its town (asked for 2026-11-16: "why cant I click to watch gang wars yet either? like they
// recorded but i cant watch?"). Its words asked of the host (host/inspect/streetfight.ts), the town gone down to, its sides armed
// as the town's war arms its hosts (in their colours, with what they carry), and its scene drawn by view/streetfight.ts on a clock
// of its own: the world's clock held, the town's hour at night or dusk, those at their ease going in as it begins, a crowd come to
// the fallen after. The eye close and low, going from clash to clash; its sound low and tense; its colours graded cold. Nothing
// here writes to history.
import "./street-fight.css";
import { sound } from "./sound.ts";
import type { HostClient, StreetFight, VillagePlan } from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type Stage, type VillageScene } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import {
  SPOT_WORDS,
  isGun,
  crowdAbout,
  fallenBy,
  openYaw,
  streetAt,
  streetEye,
  streetScript,
  type StreetScript,
  type TownWar,
  type TownWarScene,
} from "../view/index.ts";

export type StreetFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly village: VillageScene;
  /** Down into a town of a land (a cut, its readying told). */
  readonly toTown: (cell: number, town: string) => Promise<void>;
  readonly plan: () => VillagePlan | null;
  readonly openPage: (ref: string) => void;
  /** The world's moment (seconds). */
  readonly now: () => number;
};

export type StreetFilm = {
  play(event: string): Promise<boolean>;
  stop(): void;
  /** Whether the town shown is the film's: its war, hour and people are held by it. */
  readonly holds: boolean;
  /** The hour shown in the town, as a share of the day. */
  readonly hour: number;
  /** Whether those at their ease are indoors now (a clash begun). */
  readonly indoors: boolean;
  /** The film as it stands, as plain numbers (a gate or a test reads it). */
  state(): {
    event: string | null;
    kind: string | null;
    s: number;
    end: number;
    paused: boolean;
    drawn: readonly number[];
    fallen: readonly number[];
    told: readonly number[];
    won: number | null;
    figures: number;
    standing: number;
    posts: number;
    crowd: number;
    words: string;
  };
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const setText = (node: HTMLElement, text: string) => {
  if (node.textContent !== text) node.textContent = text;
};

/** How close and low the eye is on a clash (the rig's units, degrees), and how long it takes going from one to the next (s). */
const EYE_DISTANCE = 4.6,
  EYE_PITCH = -34,
  EYE_GOES = 1.3;

export function installStreetFilm(d: StreetFilmDeps): StreetFilm {
  const { hud, client, time, rig, village } = d;
  // Its chrome: a caption low down where a thumb does not rest — what, where, who has fallen — and its buttons.
  const ui = el("div", "street-film"),
    title = el("div", "street-title"),
    where = el("div", "street-where"),
    tally = el("div", "street-tally"),
    bar = el("div", "street-bar"),
    pause = el("button", "street-pause", "⏸"),
    again = el("button", "street-again", "↺"),
    page = el("button", "street-page", "Its page ›"),
    done = el("button", "street-done", "✕");
  pause.title = "Hold it still, or go on";
  again.title = "From its beginning";
  page.title = "Its page: who, what it cost, and what came of it";
  done.title = "Back to the town as it stands";
  bar.append(pause, again, page, done);
  ui.append(title, where, tally, bar);
  ui.hidden = true;
  hud.append(ui);

  let fight: StreetFight | null = null,
    script: StreetScript | null = null,
    slots = 0,
    s = 0,
    paused = false,
    scene: TownWarScene | null = null,
    eyeKey = "",
    heard: readonly number[] = [0, 0],
    crowd = 0,
    playing = false,
    session = 0;

  const stop = () => {
    if (!playing) return;
    playing = false;
    session++;
    village.warSceneOverride = null;
    village.war(null);
    village.battleAt(null);
    time.release("street fight");
    document.body.classList.remove("filming", "street-filming");
    ui.hidden = true;
    delete document.body.dataset.street;
    fight = null;
    script = null;
    scene = null;
    rig.halt();
  };

  const play = async (event: string): Promise<boolean> => {
    const f = await client
      .query<StreetFight | null>({ type: "underworld.fight", args: { event } })
      .catch(() => null);
    if (!f) return false;
    stop();
    const my = ++session;
    await d.toTown(f.cell, f.town);
    const p = d.plan();
    if (my !== session || !p || p.ref !== f.town) return false;
    // Its two sides armed as the town's war arms its hosts.
    const war: TownWar = {
      ref: f.event,
      sides: [0, 1].map((i) => {
        const x = f.sides[i]!;
        return {
          ref: x.ref,
          name: x.name,
          color: x.color,
          fields: x.men,
          arms: x.arms,
          host: x.host,
        };
      }) as unknown as TownWar["sides"],
      hosts: [],
      fight: null,
      fought: null,
      placed: null,
      eve: false,
      siege: false,
      burning: 0,
      words: "",
    };
    village.war(war);
    slots = 2 * village.warEach;
    fight = f;
    script = streetScript(f, p, slots);
    s = 0;
    paused = false;
    eyeKey = "";
    heard = [0, 0];
    crowd = 0;
    scene = streetAt(script, slots, 0);
    village.warSceneOverride = () => scene;
    time.hold("street fight");
    document.body.classList.add("filming", "street-filming");
    ui.hidden = false;
    document.body.dataset.street = f.kind;
    setText(title, f.title);
    setText(pause, "⏸");
    playing = true;
    return true;
  };

  pause.onclick = () => {
    paused = !paused;
    setText(pause, paused ? "▶" : "⏸");
  };
  again.onclick = () => {
    s = 0;
    heard = [0, 0];
    eyeKey = "";
    paused = false;
    setText(pause, "⏸");
  };
  page.onclick = () => {
    if (fight) d.openPage(fight.page);
  };
  done.onclick = () => stop();

  /** History's dead of a side, as many of its fallen figures have fallen by now. */
  const told = (f: StreetFight, sc: StreetScript, by: readonly number[]): number[] =>
    [0, 1].map((i) =>
      sc.falls[i]! > 0 ? Math.round((f.sides[i]!.fallen * by[i]!) / sc.falls[i]!) : 0,
    );

  d.stage.onUpdate((dt) => {
    if (!playing || !fight || !script) return;
    const p = d.plan();
    // (Gone from the town: the film is over.)
    if (!p || p.ref !== fight.town) return stop();
    if (!paused) s = Math.min(script.end, s + dt);
    scene = streetAt(script, slots, s);
    // The eye close and low on the clash now, from one to the next.
    const eye = streetEye(script, s),
      key = eye ? `${Math.round(eye.at.x / 4)}:${Math.round(eye.at.z / 4)}` : "";
    if (eye && key !== eyeKey && !rig.steering) {
      eyeKey = key;
      rig.flyTo(
        {
          target: { x: eye.at.x * VILLAGE_METRE, y: 0.12, z: eye.at.z * VILLAGE_METRE },
          distance: EYE_DISTANCE,
          pitch: EYE_PITCH,
          // (From down the open street off it, so no block stands between.)
          yaw: openYaw(
            p,
            eye.at,
            (EYE_DISTANCE / VILLAGE_METRE) * Math.cos((EYE_PITCH * Math.PI) / 180),
          ),
        },
        EYE_GOES,
      );
    }
    // Its sound: a man down, low and near; iron or a shot where a clash begins.
    const by = fallenBy(script, s);
    for (const side of [0, 1])
      if (by[side]! > heard[side]!)
        sound.cue("thud", 0.55, undefined, { far: 14, pan: side ? 0.3 : -0.3 });
    const begun = script.clashes.find((c) => c.from <= s && c.from > s - dt);
    if (begun) {
      const gun = fight.sides.some((x) => isGun(x.host?.arm));
      sound.cue(gun ? "gun" : "clash", 0.45, undefined, { far: 20, pan: 0 });
    }
    heard = by;
    // After the last of it: a crowd come to the fallen where the last clash was.
    const last = script.clashes[script.clashes.length - 1];
    if (last && s >= script.quiet + 2 && !crowd) {
      const people = crowdAbout(p, last.spot, d.now());
      village.battleAt(null, people);
      crowd = people.length;
    } else if (s < script.quiet && crowd) {
      village.battleAt(null);
      crowd = 0;
    }
    // Its words: what and where now; who has fallen, as history counts them; after, what it cost and what came of it.
    const hour = script.hour >= 0.8 ? "as night fell" : "at dusk",
      n = told(fight, script, by),
      a = fight.sides[0],
      b = fight.sides[1];
    setText(
      where,
      s >= script.quiet
        ? `${fight.words.cost}. ${fight.words.effect}.`
        : eye
          ? `Year ${fight.year}, ${hour} in ${fight.townName}: ${eye.why === "post" ? "soldiers going into its quarter, street by street" : SPOT_WORDS[eye.why]}`
          : `Year ${fight.year}, ${hour} in ${fight.townName}. ${fight.words.what}.`,
    );
    setText(
      tally,
      `${a.name}: ${n[0]} fallen  ·  ${b.name}: ${n[1]} fallen${fight.others && s >= script.quiet ? `  ·  ${fight.others} caught between` : ""}`,
    );
  });

  return {
    play,
    stop,
    get holds() {
      return playing;
    },
    get hour() {
      return script?.hour ?? 0.9;
    },
    get indoors() {
      return playing && !!script && script.clashes.some((c) => c.from - 2 <= s);
    },
    state() {
      const sc = script,
        f = fight,
        by = sc ? fallenBy(sc, s) : [0, 0],
        live = scene?.soldiers.filter((q) => q.size > 0.5 && q.doing !== "fallen").length ?? 0;
      return {
        event: f?.event ?? null,
        kind: f?.kind ?? null,
        s,
        end: sc?.end ?? 0,
        paused,
        drawn: sc?.drawn ?? [0, 0],
        fallen: by,
        told: f && sc ? told(f, sc, by) : [0, 0],
        won: f?.won ?? null,
        figures: sc?.figures.length ?? 0,
        standing: live,
        posts: scene?.tents.length ?? 0,
        crowd,
        words: `${where.textContent ?? ""} | ${tally.textContent ?? ""}`,
      };
    },
  };
}
