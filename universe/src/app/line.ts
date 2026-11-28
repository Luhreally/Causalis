// Live a Line (asked 2026-11-27, the owner's defaults approved): the world's life lived by hand from its first cell, a
// mode of its own fetched only when it is entered (app/linelazy.ts). Entered from the planet's bar (Begin as a cell) or
// from a line of the tree of life (Live this line), it holds the world's clock where it stands, puts the god game's chrome
// and scenes away, and plays the world's own first seas (the genesis's drop: view/drop.ts) with one cell of them held by
// the stick (view/drop-held.ts). What the cell can do is read off its world (view/line.ts); which daughter it lives on in
// is the player's to choose at each division; the deep clock goes on by what the line gathers, and each step of the dawn
// opens no earlier than the world's own date for it. Wake puts everything back as it was, the clock let go from the
// moment it was held: nothing of the world has moved, and its hash is the same (the line is kept beside it in
// readings.saga, never hashed: host/saga.ts). A guide is built in (ui/line-guide.ts): a welcome, lessons that tick
// themselves off, Show me, a ? on each panel, and What now?.
import "./line.css";
import type { GenesisPlan, HostClient } from "../bridge/index.ts";
import { MicroScene, type OrbitRig, type Stage } from "../render/index.ts";
import { LineCreature, type LineBody } from "./line-creature.ts";
import { LineBand } from "./line-band.ts";
import type { CampNear } from "../bridge/index.ts";
import { DepthLayer, type Beyond } from "../render/line-depth.ts";
import { CellJuice } from "../render/line-juice.ts";
import { LineSound } from "./line-sound.ts";
import { el } from "../ui/index.ts";
import type { PlaceLoading } from "../ui/place-loading.ts";
import { YEAR } from "../kernel/index.ts";
import { LineHud } from "../ui/line-hud.ts";
import { LineGuide } from "../ui/line-guide.ts";
import { cellPicture } from "../ui/line-cell.ts";
import { beastPicture } from "../ui/line-beast.ts";
import { LinePages, fact, para, type LinePage } from "../ui/line-pages.ts";
import {
  FIELD_W,
  STEP,
  arise,
  lightAt,
  newDrop,
  roundDrop,
  roundOf,
  worth,
  type DropState,
} from "../view/index.ts";
import {
  aboutHeld,
  clearAbout,
  divideHeld,
  foodOf,
  heldCell,
  holdDrop,
  preyOf,
  ENGULF,
  lookOf,
  stepHeld,
  threatOf,
  type DropHand,
} from "../view/drop-held.ts";
import {
  GENERATIONS,
  cellDone,
  cellGates,
  cellOffers,
  cellSpan,
  clockOn,
  daughtersOf,
  firstTraits,
  lineAt,
  mediumOf,
  myWords,
  reynoldsOf,
  smallWords,
  swimSpeed,
  wayOf,
  whatNow,
  PARTS,
  partEffects,
  type PartId,
  type Daughter,
  type Gates,
  sizeTier,
  type LineFacts,
  type LineRung,
  type Traits,
} from "../view/line.ts";

export type LineDeps = {
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly stage: Stage;
  readonly rig: OrbitRig;
  /** The world's clock: held while a line is lived, let go on waking. */
  readonly time: { hold(who: string): void; release(who: string): void };
  /** The game's sound: its settings say whether the mode's own small sounds are heard (app/line-sound.ts). */
  readonly sound: ConstructorParameters<typeof LineSound>[0];
};

export type LineFlow = {
  readonly on: boolean;
  /** Entered: a line's ref to live (a tree-of-life node), or null for the world's first cells. */
  enter(from: string | null): Promise<void>;
  wake(): Promise<void>;
};

/** A saga as the page keeps it (host/saga.ts keeps it as it is given). */
type SagaData = {
  readonly v: 2;
  readonly digest: string;
  /** The world's clock when it was begun (s), and the line asked for (null: the world's first cells). */
  readonly began: number;
  readonly from: string | null;
  readonly fromName: string | null;
  stage: "cell" | "body";
  my: number;
  readonly first: Traits;
  gens: {
    pick: number;
    my: number;
    took: Daughter["took"];
    reasons: readonly string[];
    mated?: boolean;
  }[];
  /** Past the cells: the body the line lives in now, and its generations (the founder first). */
  body?: LineBody | null;
  bodies?: {
    my: number;
    name: string;
    way: string;
    mass: number;
    reasons: readonly string[];
    died: string | null;
  }[];
  gathered: number;
  ate: number;
  deaths: number;
  /** The tree of life's line its body was founded from (a line made so is its daughter; absent: none founded). */
  node?: number | null;
};

/** The drop's ways, by the step of the dawn each arises at (as the genesis has them). */
const ARISING: readonly (readonly [string, string])[] = [
  ["light", "light"],
  ["hunter", "nucleus"],
  ["colony", "together"],
];

/** How often the chrome's words are set (ms), and the saga kept while it is played (ms). */
const HUD_EVERY = 125,
  KEEP_EVERY = 15000;

type Root = { enabled: boolean; children?: unknown[]; camera?: unknown; light?: unknown };

/** `Loading`: the god game's loading screen, handed in (so the page's chunks are as without the mode). */
/** "a", "a and b", "a, b and c". */
const andWords = (xs: readonly string[]): string =>
  xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

export function installLine(d: LineDeps, Loading: typeof PlaceLoading): LineFlow {
  const hud = new LineHud(d.hud),
    loading = new Loading(d.hud),
    pages = new LinePages((ref) => pageOf(ref)),
    guide = new LineGuide(hud.coach, hud.guideButton, hud.element);
  let micro: MicroScene | null = null,
    on = false,
    entering = false,
    plan: GenesisPlan | null = null,
    facts: LineFacts | null = null,
    rungs: readonly LineRung[] = [],
    drop: DropState | null = null,
    hand: DropHand | null = null,
    saga: SagaData | null = null,
    sagaId = 0,
    traits: Traits | null = null,
    my = 0,
    owed = 0,
    hudAt = 0,
    keptAt = 0,
    told = "",
    choosing: Daughter[] | null = null,
    ended = false,
    done = false,
    nowTimer = 0,
    stepMs = 0,
    steps = 0,
    cy = 0,
    cz = 0,
    framed = false,
    wasSpeed: number | null = null,
    beast: LineCreature | null = null,
    /** Past the cells: whether its body is being lived now, and the young offered (or the founders). */
    living = false,
    offered: LineBody[] | null = null,
    pickMs = 0,
    turnMs = 0,
    /** Of the last turn, the asking of the host (its round trip, the worker's own time in it bounded by tests/host). */
    askMs = 0,
    /** The meter full when last drawn; food taken when last looked; the eye's breadth across the drop now (µm). */
    wasFull = false,
    ateSeen = 0,
    across = 0,
    played = 0,
    depth: DepthLayer | null = null,
    juice: CellJuice | null = null,
    /** The tribe (S6): the band led, whether it is being led now, its land as asked of the host. */
    band: LineBand | null = null,
    leading = false,
    bandLand: { cell: number; id: number; grain: boolean; sows: boolean } | null = null,
    /** The band's size when last drawn, its news last told, whether its land has been taught to sow. */
    bandSeen = 0,
    taught = false;
  const noises = new LineSound(d.sound);
  /** How everything stood as the mode was entered, to be put back as it was on waking. */
  let was: {
    roots: Map<Root, boolean>;
    rig: boolean;
    pos: [number, number, number];
    rot: [number, number, number, number];
    fov: number;
    near: number;
    far: number;
    fog: [number, number];
    scale: string | undefined;
    daylight: string | undefined;
  } | null = null;

  const gatesNow = (at = my): Gates =>
    cellGates(
      facts ?? { pigment: "chlorophyll", liquidName: "water" },
      rungs,
      at,
      plan?.drop?.light ?? 1,
    );
  const speedOf = (t: Traits) => swimSpeed(t, facts ?? { liquid: "water" });

  // —— The god game put away, and back ——————————————————————————————————————————————————————————————————————————————

  /** Every scene of the god game's (and whatever it laid on the stage), but the mode's own. */
  const others = (): Root[] => {
    const out: Root[] = [];
    const mine = micro?.root as unknown,
      land = beast?.scene.root as unknown,
      camp = band?.scene.root as unknown;
    for (const c of d.stage.root.children as unknown as Root[])
      if (c !== mine && c !== land && c !== camp) out.push(c);
    for (const c of d.stage.app.root.children as unknown as Root[])
      if (c !== (d.stage.root as unknown) && !c.camera && !c.light) out.push(c);
    return out;
  };
  const putAway = () => {
    const cam = d.stage.camera,
      lens = cam.camera!,
      p = cam.getPosition(),
      r = cam.getRotation(),
      fog = d.stage.app.scene.fog;
    was = {
      roots: new Map(others().map((c) => [c, c.enabled])),
      rig: d.rig.enabled,
      pos: [p.x, p.y, p.z],
      rot: [r.x, r.y, r.z, r.w],
      fov: lens.fov,
      near: lens.nearClip,
      far: lens.farClip,
      fog: [fog.start, fog.end],
      scale: document.body.dataset.scale,
      daylight: document.body.dataset.daylight,
    };
    for (const c of was.roots.keys()) c.enabled = false;
    d.rig.enabled = false;
    fog.start = 1e5;
    fog.end = 2e5;
    lens.fov = 45;
    lens.farClip = 400;
    document.body.dataset.scale = "micro";
    delete document.body.dataset.daylight;
    document.body.classList.add("lining");
  };
  /** Whatever the god game turned on while the mode stood is put away again, and kept as it wished it (on waking). */
  const keepAway = () => {
    if (!was) return;
    for (const c of others())
      if (c.enabled) {
        was.roots.set(c, true);
        c.enabled = false;
      }
  };
  const putBack = () => {
    if (!was) return;
    const w = was,
      cam = d.stage.camera,
      lens = cam.camera!,
      fog = d.stage.app.scene.fog;
    was = null;
    for (const [c, e] of w.roots) c.enabled = e;
    cam.setPosition(...w.pos);
    cam.setRotation(w.rot[0], w.rot[1], w.rot[2], w.rot[3]);
    lens.fov = w.fov;
    lens.nearClip = w.near;
    lens.farClip = w.far;
    fog.start = w.fog[0];
    fog.end = w.fog[1];
    if (w.scale === undefined) delete document.body.dataset.scale;
    else document.body.dataset.scale = w.scale;
    if (w.daylight !== undefined) document.body.dataset.daylight = w.daylight;
    d.rig.enabled = w.rig;
    document.body.classList.remove("lining");
  };

  // —— The saga ————————————————————————————————————————————————————————————————————————————————————————————————————————

  const keepSaga = async (): Promise<void> => {
    if (!saga) return;
    saga.my = my;
    keptAt = performance.now();
    try {
      sagaId = await d.client.query<number>({
        type: "saga.keep",
        args: { id: sagaId, data: saga },
      });
    } catch {
      // (Kept the next time: the line goes on meanwhile.)
    }
  };

  // —— The drop, and the cell held in it ———————————————————————————————————————————————————————————————————————————————

  const rungAt = (id: string) => rungs.find((r) => r.id === id)?.at ?? -1;
  const kindOf = (way: string) => plan?.drop?.kinds.findIndex((k) => k.way === way) ?? -1;
  /** The drop of the first seas as the line's clock stands: its kinds risen whose step of the dawn has come. */
  const dropAt = (at: number): DropState | null => {
    const block = plan?.drop;
    if (!block) return null;
    const risen = block.kinds.map((k) => {
      if (k.way === "eater" || k.way === "rock") return true;
      const rung = ARISING.find(([w]) => w === k.way)?.[1];
      return !!rung && at <= rungAt(rung);
    });
    return newDrop(block, risen);
  };
  /** The first kind a line begins as: the drop's first small cells that swim after what floats (else its rock-eaters). */
  const wayKind = (t: Traits) => {
    const k = kindOf(wayOf(t));
    return k >= 0 ? k : 0;
  };
  const firstKind = () => {
    const kinds = plan!.drop!.kinds;
    return kinds.find((k) => k.way === "eater") ?? kinds.find((k) => k.way === "rock") ?? kinds[0]!;
  };

  const begin = async (
    resume: { id: number; data: SagaData } | null,
    from: string | null,
  ): Promise<void> => {
    if (!plan?.drop || !facts) return;
    guide.away = false;
    const span = cellSpan(rungs);
    if (resume) {
      saga = resume.data;
      sagaId = resume.id;
      const line = lineAt(saga.first, saga.digest, sagaId, saga.gens, (at) => gatesNow(at), facts);
      traits = line.at(-1)!;
      my = saga.my;
    } else {
      const k = firstKind(),
        first = firstTraits(k, k.pace ?? 1);
      saga = {
        v: 2,
        digest: facts.digest,
        began: d.client.status?.t ?? 0,
        from,
        fromName: facts.line?.name ?? null,
        stage: "cell",
        my: span.from,
        first,
        gens: [],
        gathered: 0,
        ate: 0,
        deaths: 0,
      };
      sagaId = 0;
      traits = first;
      my = span.from;
      await keepSaga();
    }
    drop = dropAt(my);
    hand = drop ? holdDrop(drop, traits, speedOf(traits)) : null;
    choosing = null;
    ended = false;
    done = cellDone(my, rungs, traits);
    owed = 0;
    framed = false;
    told = "";
    hud.say(
      resume
        ? `You go on with your line: generation ${saga.gens.length + 1}, ${myWords(my)}`
        : `You are one of your world's first cells, ${myWords(my)}`,
    );
    wasFull = false;
    ateSeen = 0;
    across = 0;
    played = 0;
    if (drop && guide.first(`supply`))
      hud.say(
        drop.grain
          ? "Food wells up about the vent below you: keep near it, and swim into the specks"
          : "Food sheds from the lit water above you: keep near it, and swim into the specks",
      );
    leaveBody();
    if (saga.stage === "body" && saga.body) startBody();
    else if (done) stageDone();
  };

  // —— What opens over the drop ———————————————————————————————————————————————————————————————————————————————————————

  const layer = (e: HTMLElement | null) => hud.layerOpen(e);
  const openPage = (ref: string) => {
    if (hud.layer.firstElementChild !== pages.element) layer(pages.element);
    pages.open(ref);
    if (ref === "cell" || ref === "line" || ref.startsWith("gen:")) guide.did("page");
  };
  pages.onClose = () => layer(null);
  guide.onHelp = (ref) => openPage(ref);
  guide.onLayer = (e) => layer(e);
  const card = (
    title: string,
    words: readonly string[],
    keys: readonly HTMLButtonElement[],
    help: string,
  ) => {
    const box = el("div", "line-card"),
      head = el("div", "line-card-head"),
      q = el("button", "line-help", "?"),
      row = el("div", "line-card-row");
    q.setAttribute("aria-label", "What this means");
    q.onclick = () => openPage(help);
    head.append(el("h3", "", title), q);
    row.append(...keys);
    box.append(head, ...words.map((w) => el("p", "", w)), row);
    return box;
  };
  const key = (text: string, run: () => void, other = false) => {
    const b = el("button", other ? "line-card-other" : "line-card-go", text);
    b.onclick = run;
    return b;
  };

  /** The daughters of a division, to choose among: each what it is and why, and what it does here. */
  const openPicker = () => {
    if (!traits || !facts || !saga) return;
    const gen = saga.gens.length,
      mated = !!hand?.mated,
      ds = daughtersOf(traits, saga.digest, sagaId, gen, gatesNow(), facts, mated);
    choosing = ds;
    const box = el("div", "line-card line-pick"),
      head = el("div", "line-card-head"),
      q = el("button", "line-help", "?");
    q.setAttribute("aria-label", "How daughters differ");
    q.onclick = () => openPage("help:daughters");
    head.append(
      el(
        "h3",
        "",
        mated
          ? `You and your mate: ${ds.length} young`
          : `Your cell divides in ${ds.length === 3 ? "three" : "two"}`,
      ),
      q,
    );
    const list = el("div", "line-pick-list");
    ds.forEach((dt, i) => {
      const b = el("button", `line-daughter${dt.took ? " took" : ""}`),
        t = dt.traits,
        line = facts?.line,
        forebears =
          dt.took && line && line[dt.took]
            ? ` (as the forebears of ${line.name} did)`
            : dt.took && line
              ? ` (the forebears of ${line.name} never did)`
              : "";
      b.dataset.daughter = String(i);
      const kindColour = plan?.drop?.kinds[wayKind(t)]?.color,
        fill = kindColour
          ? `rgb(${kindColour.map((v) => Math.round(v * 255)).join(",")})`
          : undefined;
      b.append(
        cellPicture(t, dt.part?.gained ? dt.part.id : null, fill),
        el(
          "strong",
          "",
          `${dt.mate ? "💞 " : dt.took ? "✨ " : dt.part?.gained ? "🧩 " : ""}Daughter ${i + 1}${dt.mate ? " (her mate's part)" : forebears}`,
        ),
        el(
          "span",
          "line-daughter-nums",
          `${t.size.toFixed(1)} µm across · ${speedOf(t).toFixed(1)} µm a second`,
        ),
        ...dt.reasons.map((r) => el("span", "line-daughter-why", r)),
      );
      b.onclick = () => pick(i);
      list.append(b);
    });
    box.append(
      head,
      el(
        "p",
        "",
        "You live on in the daughter you choose; the other swims off as one of your line, ringed.",
      ),
      list,
    );
    layer(box);
  };
  const pick = (i: number) => {
    if (!choosing || !drop || !hand || !saga) return;
    const ds = choosing,
      chosen = ds[Math.max(0, Math.min(ds.length - 1, i))]!;
    saga.gens.push({
      pick: ds.indexOf(chosen),
      my,
      took: chosen.took,
      reasons: chosen.reasons,
      ...(hand.mated ? { mated: true } : {}),
    });
    const next = divideHeld(
      drop,
      hand,
      ds.map((x) => x.traits),
      ds.indexOf(chosen),
      speedOf,
    );
    choosing = null;
    layer(null);
    if (!next) return;
    noises.play("split");
    juice?.divided();
    wasFull = false;
    ateSeen = next.ate;
    hand = next;
    traits = chosen.traits;
    guide.did("choose");
    hud.say(
      chosen.took === "nucleus"
        ? "Your line has a nucleus now: it can take in smaller cells"
        : chosen.took === "light"
          ? "Your line lives by light now: bask near the surface"
          : chosen.took === "together"
            ? "Your line's cells stay together now: many as one"
            : `Generation ${saga.gens.length + 1}: ${chosen.reasons[0]!.split(":")[0]!.toLowerCase()}`,
    );
    void keepSaga();
    done = cellDone(my, rungs, traits);
    if (done) stageDone();
  };

  /** The cell held is gone: taken, or starved. The line goes on in one of its own. */
  const lost = () => {
    if (!hand || !saga) return;
    ended = true;
    noises.play("hurt");
    saga.deaths++;
    void keepSaga();
    const how =
      hand.ended === "taken"
        ? `One of the ${hand.by ?? "hunting cells"} took your cell in`
        : "Your cell spent more than it gathered, and died";
    // (Not an end: a moment, and the line goes on in a sister or one of its own, with all the line has become.)
    hud.say(`${how}. Your line goes on.`, false);
    const banner = el("div", "line-goes-on");
    banner.append(
      el("strong", "", "Your line goes on"),
      el("br"),
      el("span", "", "as one of its own"),
    );
    hud.element.append(banner);
    window.setTimeout(() => {
      banner.remove();
      if (on && ended && !living) goOn();
    }, 2400);
  };
  const goOn = () => {
    if (!drop || !traits) return;
    // (Where one of its line is still in the drop, there; else a sister newly divided, in the drop's middle.)
    const kin = drop.cells.find((c) => c.marked && c.id !== hand?.id);
    if (kin) drop.cells.splice(drop.cells.indexOf(kin), 1);
    hand = holdDrop(
      drop,
      traits,
      speedOf(traits),
      kin ? { x: kin.x, y: kin.y } : null,
      kin ? Math.max(kin.energy, worth(traits.size) * 0.6) : null,
    );
    const goes = heldCell(drop, hand);
    if (goes) clearAbout(drop, goes.x, goes.y, ["hunter"]);
    wasFull = false;
    ateSeen = 0;
    ended = false;
    layer(null);
    hud.say("You go on as one of your line");
  };

  /** The cell's stage come to its end: the line together, and its world's first bodies come. */
  // —— The tribe (S6): a band of the world's people led ———————————————————————————————————————————————————————————————
  // (Its day its own, view/band.ts; the hand's orders, its children and the grain come up, view/band-led.ts. Nothing of
  // it reaches the world but the land taught to sow: the god's own act.inspire, at the hand's word, its world kept first.)

  /** A band of the most peopled land that camps put under the hand (none camping: said so). */
  const startBand = async () => {
    layer(null);
    const land = await d.client.query<typeof bandLand>({ type: "line.band" }),
      info = land
        ? await d.client.query<CampNear | null>({
            type: "camp.near",
            args: { cell: land.cell, id: land.id },
          })
        : null;
    if (!land || !info) {
      layer(
        card(
          "No band camps now",
          [
            "Your world's peoples all live in villages and towns now: no band of them camps anywhere to lead. Lead one in a world that is young, from its beginning.",
          ],
          [key("☀️ Wake", () => void flow.wake())],
          "help:band",
        ),
      );
      return;
    }
    if (beast) beast.leave();
    living = false;
    offered = null;
    if (micro) micro.visible = false;
    band ??= new LineBand(d.stage);
    band.begin(info, land.grain);
    bandLand = land;
    leading = true;
    taught = false;
    bandSeen = band.band!.people.length;
    ended = false;
    told = "";
    guide.away = true;
    document.body.dataset.scale = "ground";
    // (The words left from another stage put by: the band's own, from now.)
    hud.say(`You lead the ${info.people}, camped in ${info.land}`, true);
    layer(
      card(
        `The ${info.people}: a band of ${info.size}`,
        [
          `You lead a band of your world's people, camped in ${info.land}. They live their own day: out gathering and hunting, home by dusk, asleep by night.`,
          "Look about with the stick: the ring is where you look. Send the hunters after a beast there, or walk the band on to that ground. Fed well, the band has children.",
          land.sows
            ? "Your land's people sow already: their villages will come."
            : land.grain
              ? "A wild grain grows in this land. Send the gatherers to the grass for its seed: what they drop by the fire may come up."
              : "No wild grain grows in this land: its people will forage on.",
        ],
        [key("⛺ Lead them", () => layer(null))],
        "help:band",
      ),
    );
  };
  const leaveBand = () => {
    band?.leave();
    leading = false;
    bandLand = null;
  };
  const bandFrame = (dt: number) => {
    if (!band) return;
    const paused = hud.modal || ended;
    if (!paused) {
      const press = hud.takePressed()[0];
      if (press !== undefined) {
        const r = band.act(press);
        if (r === "sow") sowCard();
        else {
          hud.say(r.words, r.good);
          if (r.good) noises.play("pop");
        }
      }
      band.stick = hud.stick();
      if (band.stick.x || band.stick.y) moved = true;
    } else hud.takePressed();
    band.frame(dt, paused);
    // (What came to pass, told as it comes: the last of a frame's.)
    const news = band.news.splice(0);
    if (news.length) {
      const last = news.at(-1)!;
      hud.say(last, !/died/.test(last));
      if (/child is born/.test(last)) {
        hud.pop();
        noises.play("split");
      }
      if (/come up/.test(last)) {
        noises.play("pop");
        if (guide.first("sprouted"))
          hud.say("The seed came up! Press 🌱 Sow to teach your land to sow", true);
      }
    }
    const now = performance.now();
    if (now - hudAt >= HUD_EVERY) {
      hudAt = now;
      bandChrome();
    }
  };
  const bandChrome = () => {
    if (!band?.band || !band.info || !band.led) return;
    const b = band.band,
      l = band.led,
      st = band.strip()!;
    hud.head(
      `The ${band.info.people} · your band`,
      band.info.land,
      taught
        ? 1
        : l.sprouted
          ? 0.85
          : Math.min(0.8, (b.people.length - bandSeen) / Math.max(1, l.most - bandSeen)),
      taught
        ? "Your land sows: its first village comes in its turn"
        : l.sprouted
          ? "Next: teach your land to sow"
          : "Next: a band well fed, and the seed it drops come up",
    );
    hud.cell(st.words, st.full);
    hud.offers(band.offers());
    hud.health(1, 0);
    hud.hintWords(moved ? "" : "Drag here to look about");
  };
  /** Teaching the land to sow: what it does said first; the world kept, then taught. */
  const sowCard = () => {
    if (!bandLand || !band?.info || taught) return;
    layer(
      card(
        "Teach your land to sow?",
        [
          `Your band has seen wild grain come up where it dropped seed by the fire. Taught, the people of ${band.info.land} sow: in their own time they settle, and their first village is founded in its turn.`,
          "This changes your world, as the god's Inspire does: it is kept first in your saves, as it is now.",
        ],
        [key("Not yet", () => layer(null), true), key("🌱 Teach it", () => void teach())],
        "help:band",
      ),
    );
  };
  const teach = async () => {
    if (!bandLand || taught) return;
    const params = new URLSearchParams(location.search),
      universe = params.get("universe") ?? "earth",
      seed = params.get("seed") ?? "first light";
    await d.client.save(`${universe}:${seed}:before your band sowed`).catch(() => undefined);
    const r = await d.client
      .command("act.inspire", { cell: bandLand.cell, sign: 1, years: 1 })
      .catch((e: unknown) => ({ ok: false, error: String(e) }));
    const ok = (r as { ok?: boolean }).ok !== false;
    taught = ok;
    layer(
      card(
        ok ? "Your land sows" : "Your land could not be taught",
        ok
          ? [
              `The people of ${band?.info?.land ?? "your land"} sow now. In their own time they settle, and when its turn comes, their first village is founded: wake and watch for it.`,
              "Your world as it was before is kept in your saves.",
            ]
          : [`${(r as { error?: string }).error ?? "It was turned back."}`],
        [
          key("Stay with the band", () => layer(null), true),
          key("☀️ Wake", () => void flow.wake()),
        ],
        "help:band",
      ),
    );
  };

  const stageDone = () => {
    if (!saga) return;
    saga.stage = "body";
    void keepSaga();
    layer(
      card(
        "The first bodies",
        [
          `${myWords(my)[0]!.toUpperCase()}${myWords(my).slice(1)}, your line's cells live together as one: the first bodies of your world are coming.`,
          "Found your line's first body, among the first bodies your world's seas grew; or stay a while in the drop.",
        ],
        [
          key("Stay in the drop", () => layer(null), true),
          key("☀️ Wake", () => void flow.wake(), true),
          key("⛺ Lead a band", () => void startBand(), true),
          key("🐚 Found a body", () => void openFounders()),
        ],
        "help:stage",
      ),
    );
  };

  // —— Past the cells: its bodies ——————————————————————————————————————————————————————————————————————————————————
  // (The bodies it founds and the young it goes on in are its world's own development of a genome, through its world's
  // physics: host/line.ts. Lived in the living world of its age, view/meadow.ts, or in its shallows.)

  let moved = false;
  const bodiesAt = () => (rungAt("bodies") > 0 ? rungAt("bodies") : 600);
  const ashoreAt = () => rungAt("ashore");
  const isSea = (way: string) =>
    ["sea swimmer", "sea crawler", "burrower", "drifter"].includes(way);
  /** The bodies, or the young, to choose among: each what it is, why, and what its world's physics allow it. */
  const bodyPicker = (
    title: string,
    words: string,
    list: LineBody[],
    help: string,
    run: (i: number) => void,
  ) => {
    const t0 = performance.now(),
      box = el("div", "line-card line-pick line-bodies"),
      head = el("div", "line-card-head"),
      q = el("button", "line-help", "?"),
      rows = el("div", "line-pick-list");
    q.setAttribute("aria-label", "How these bodies are made");
    q.onclick = () => openPage(help);
    head.append(el("h3", "", title), q);
    list.forEach((b, i) => {
      const fitter = b.better !== null && b.better > 0,
        row = el("button", `line-daughter line-body${fitter ? " took" : ""}`);
      row.dataset.body = String(i);
      row.append(
        beastPicture(b.body, help === "help:young" ? (saga?.body?.body ?? null) : null),
        el("strong", "", `${fitter ? "✨ " : ""}${b.name[0]!.toUpperCase()}${b.name.slice(1)}`),
        el(
          "span",
          "line-daughter-nums",
          `${massText(b.genome.mass)} · eats ${b.body.eats} · ${b.better === null ? `suits its way ${fitWords(b.fit)}` : fitter ? "fitter than its mother" : b.better < 0 ? "less fit than its mother" : "as fit as its mother"}`,
        ),
        ...b.reasons.slice(0, 4).map((r) => el("span", "line-daughter-why", r)),
      );
      row.onclick = () => run(i);
      rows.append(row);
    });
    box.append(head, el("p", "", words), rows);
    layer(box);
    pickMs = performance.now() - t0;
  };
  const openFounders = async () => {
    if (!saga) return;
    const list = await d.client.query<LineBody[]>({
      type: "line.founders",
      args: { digest: saga.digest, saga: sagaId, gen: saga.gens.length },
    });
    offered = list;
    if (!list.length) {
      offered = null;
      layer(
        card(
          "No body to found",
          [
            "None of the bodies your world's seas grew could be made of your line here. Your line is kept.",
          ],
          [key("☀️ Wake", () => void flow.wake())],
          "help:body",
        ),
      );
      return;
    }
    bodyPicker(
      "Your line's first body",
      "Each is one of the first kinds of body your world's seas grew, a little changed. Its physics are your world's: the weight its frame bears in the water under its pull, the oxygen its skin or gills can feed.",
      list,
      "help:body",
      (i) => found(i),
    );
  };
  const found = (i: number) => {
    const b = offered?.[i];
    if (!b || !saga) return;
    offered = null;
    saga.stage = "body";
    my = Math.min(my, bodiesAt());
    saga.my = my;
    saga.body = b;
    saga.node = b.node ?? null;
    saga.bodies = [
      { my, name: b.name, way: b.way, mass: b.genome.mass, reasons: b.reasons, died: null },
    ];
    void keepSaga();
    layer(null);
    startBody();
    hud.say(`Your line has a body: ${b.name}, ${massText(b.genome.mass)}`);
  };
  /** The line's body put into its age's living world (its shallows, while it lives in the water). */
  const startBody = () => {
    if (!saga?.body || !plan) return;
    guide.away = true;
    const t0 = performance.now(),
      b = saga.body,
      sea = isSea(b.way) || (ashoreAt() > 0 && my > ashoreAt()),
      // (The sea's own lines about it: those of the plan that swim.)
      swimmers = sea
        ? plan.lineages.filter((l) => l.niche === "swimmer" && l.body).slice(0, 3)
        : null;
    beast ??= new LineCreature(d.stage);
    if (micro) micro.visible = false;
    // (The sea's ages seen from within the water: the drop's own backdrop, blue-green.)
    document.body.dataset.scale = sea ? "micro" : "ground";
    const why = beast.begin(plan, b, my, swimmers);
    ateSeen = 0;
    wasFull = false;
    living = !why;
    ended = false;
    told = "";
    turnMs = performance.now() - t0;
    if (why)
      layer(
        card(
          "Your line's body cannot live here",
          [`${why[0]!.toUpperCase()}${why.slice(1)}. Your line is kept.`],
          [key("☀️ Wake", () => void flow.wake())],
          "help:body",
        ),
      );
  };
  const leaveBody = () => {
    if (beast) beast.leave();
    living = false;
    offered = null;
    if (micro) micro.visible = true;
    document.body.dataset.scale = "micro";
  };
  /** Young born to the line's body: the player chooses which to go on in. */
  const openYoung = async () => {
    if (!saga?.body || offered) return;
    const b = saga.body;
    offered = [];
    const list = await d.client.query<LineBody[]>({
      type: "line.young",
      args: {
        genome: b.genome,
        way: b.way,
        my,
        digest: saga.digest,
        saga: sagaId,
        gen: 1000 + (saga.bodies?.length ?? 0),
      },
    });
    offered = list;
    bodyPicker(
      "Young of your own",
      "Choose the one your line goes on in. Each is one change from its mother, and its world's physics allow it; the age between passes by itself, your line bred on by what suits its way best.",
      list,
      "help:young",
      (i) => void goOnIn(i),
    );
  };
  /** The line on in the young chosen: bred on through the age between (off the screen), into the next age's world. */
  const goOnIn = async (i: number) => {
    const y = offered?.[i];
    if (!y || !saga) return;
    layer(null);
    const t0 = performance.now(),
      to = Math.max(0, my - AGE_STEP),
      bred = await d.client.query<{
        died: null | { name: string; ref: string };
        line: LineBody | null;
      }>({
        type: "line.bred",
        args: {
          genome: y.genome,
          way: y.way,
          my,
          to,
          digest: saga.digest,
          saga: sagaId,
          gen: 1000 + (saga.bodies?.length ?? 0),
        },
      });
    offered = null;
    askMs = performance.now() - t0;
    const t1 = performance.now(),
      next = bred.line ?? y;
    my = to;
    saga.my = my;
    saga.body = next;
    (saga.bodies ??= []).push({
      my,
      name: next.name,
      way: next.way,
      mass: next.genome.mass,
      reasons: y.reasons,
      died: bred.died?.name ?? null,
    });
    void keepSaga();
    if (my <= 0) {
      leaveBody();
      layer(
        card(
          "Your line has come to now",
          [
            `Your line lives on in your world today: ${next.name}, ${massText(next.genome.mass)}.`,
            "Your line is kept.",
          ],
          [key("☀️ Wake", () => void flow.wake())],
          "help:body",
        ),
      );
      return;
    }
    startBody();
    turnMs = performance.now() - t1;
    hud.say(
      bred.died
        ? `Your line died out in the age between, outdone by its kin: you go on as the nearest of them, ${bred.died.name}`
        : `${myWords(my)[0]!.toUpperCase()}${myWords(my).slice(1)}: your line is ${next.name}, ${massText(next.genome.mass)}`,
      !bred.died,
    );
  };
  /** The line's body is gone: taken, starved, or old. It goes on as another of its line. */
  const bodyLost = (how: { how: string; by: string | null }) => {
    if (!saga) return;
    ended = true;
    saga.deaths++;
    void keepSaga();
    noises.play("hurt");
    // (Not an end: a moment, and the line goes on in another of its kind about it, or in its kind come anew.)
    hud.say(
      `${how.how === "taken" ? `It was taken${how.by ? ` by ${how.by}` : ""}` : how.how === "old" ? "It died of old age" : "It found too little to eat, and died"}. Your line goes on.`,
      false,
    );
    const banner = el("div", "line-goes-on");
    banner.append(
      el("strong", "", "Your line goes on"),
      el("br"),
      el("span", "", "as another of its kind"),
    );
    hud.element.append(banner);
    window.setTimeout(() => {
      banner.remove();
      if (!on || !ended || !living) return;
      ended = false;
      told = "";
      if (!beast?.kin()) startBody();
    }, 2400);
  };
  const bodyFrame = (dt: number) => {
    if (!beast) return;
    const paused = hud.modal || ended || !!offered;
    if (!paused) {
      const press = hud.takePressed()[0];
      if (press !== undefined) beast.pressed = press;
      beast.stick = hud.stick();
      if (beast.stick.x || beast.stick.y) moved = true;
    } else hud.takePressed();
    beast.frame(dt, paused);
    if (!paused) {
      if (beast.hadYoung()) {
        noises.play("split");
        void openYoung();
      }
      const gone = beast.ended;
      if (gone && !ended) bodyLost(gone);
    }
    const now = performance.now();
    if (now - hudAt >= HUD_EVERY) {
      hudAt = now;
      bodyChrome();
    }
  };
  const bodyChrome = () => {
    if (!beast || !saga?.body) return;
    const b = saga.body,
      st = beast.strip(),
      from = bodiesAt();
    hud.head(
      `${b.name[0]!.toUpperCase()}${b.name.slice(1)} · gen ${saga.bodies?.length ?? 1}`,
      myWords(my),
      Math.max(0, Math.min(1, (from - my) / from)),
      "Next: young of your own, to choose among",
    );
    // (Its meter toward young: full when it may court, as the meadow's own rule has it (fed and grown); it pops then.)
    const offers = beast.offers(),
      court = offers.find((o) => /court/i.test(o.label)),
      ready = !!court && (court.can || /None of its kind near/.test(court.words));
    if (st) hud.cell(st.words, ready ? 1 : Math.min(0.97, st.fed / 0.7));
    if (st && st.ate > ateSeen) noises.play("chomp");
    if (st) ateSeen = st.ate;
    if (ready && !wasFull) {
      hud.pop();
      noises.play("pop");
      if (guide.first("body-ready"))
        hud.say(
          `You are ready for young: find one of your kind (📣 Call brings them), then press ${court!.icon} ${court!.label}`,
        );
    }
    wasFull = ready;
    hud.offers(offers);
    // (Danger: the shallows' hunter near, its grip; and the meadow's own hunters, which take a held beast as any other.)
    const whole = beast.whole;
    hud.health(whole, whole < 0.999 ? 1 - whole : 0);
    if (beast.danger !== null) {
      noises.play("danger");
      const bolt = offers.find((o) => /bolt|flee|run/i.test(o.label));
      if (guide.first("danger-body"))
        hud.say(
          `Something bigger hunts you: flee!${bolt ? ` Press ${bolt.icon} ${bolt.label}` : ""}`,
          false,
        );
    }
    noises.ambient(true, beast.danger === null ? 0 : Math.max(0, 1 - beast.danger / 22));
    // (What hunts it here, told the first time there is anything that does.)
    const hunted = beast.hunted();
    if (hunted.by.length && guide.first("hunted"))
      hud.say(`Hunted here by ${andWords(hunted.by)}: keep clear of them, or bolt`, false);
    const t = beast.told();
    if (t && t.words !== told) {
      told = t.words;
      hud.say(t.words, t.good);
    }
    hud.hintWords(moved ? "" : "Drag here to move");
  };
  const bodyNow = (): string => {
    const st = beast?.strip(),
      offers = beast?.offers() ?? [];
    if (!st) return "Your line has no body living now: wake, or go on as one of your line.";
    const eat = offers.find((o) => /Eat|Graze|Browse|Peck|Feed/.test(o.label)),
      court = offers.find((o) => /Court/i.test(o.label));
    if (st.fed < 0.7)
      return eat?.can
        ? `Eat: press ${eat.icon} ${eat.label}. You need to be well fed to have young.`
        : `${eat?.words ?? "Find food"}. You need to be well fed to have young.`;
    if (court)
      return court.can
        ? `You are well fed: press ${court.icon} ${court.label} to have young, and choose which one your line goes on in.`
        : `${court.words}.`;
    return "Keep fed and keep clear of hunters; when you can, have young.";
  };

  // —— Its pages ————————————————————————————————————————————————————————————————————————————————————————————————————

  const pageOf = (ref: string): LinePage => {
    const t = traits,
      f = facts,
      s = saga,
      L = (text: string, r: string) => pages.link(text, r);
    if (ref === "cell" && t && f && s) {
      const c = drop && hand ? heldCell(drop, hand) : null,
        w = worth(t.size),
        re = reynoldsOf(t, f);
      return {
        title: `Your cell, generation ${s.gens.length + 1}`,
        help: "help:cell",
        parts: [
          fact("Size", `${t.size.toFixed(1)} µm across (a hair is some 80)`),
          fact("Speed", `${speedOf(t).toFixed(1)} µm a second in ${f.liquidName}`),
          fact(
            "Its liquid",
            `${f.liquidName}, ${(mediumOf(f).mu * 1000).toFixed(2)} mPa·s thick: at your size the Reynolds number is ${smallWords(re)}, so the liquid holds you like honey and you stop the moment you stop pushing`,
          ),
          fact(
            "Gathered",
            c
              ? `${Math.round((c.energy / (2 * w)) * 100)}% of what it takes to divide (twice what you are worth, your size to the 1.5)`
              : "—",
          ),
          fact(
            "Lives by",
            [
              t.base === "rock" ? "the chemistry of its rock grain" : "what floats in the water",
              t.light ? `light (${f.pigment})` : "",
              t.nucleus ? "taking in smaller cells" : "",
            ]
              .filter(Boolean)
              .join(", "),
          ),
          fact("Its skin", `${f.membrane} membranes, as all life on this world`),
          fact(
            "Its parts",
            Object.keys(t.parts ?? {}).length
              ? Object.entries(t.parts ?? {})
                  .map(
                    ([id, n]) =>
                      `${PARTS[id as PartId].name}${n! > 1 ? " (grown larger)" : ""}: ${PARTS[id as PartId].does}`,
                  )
                  .join("; ")
              : "none yet: each daughter may grow one",
          ),
          fact(
            "It eats",
            t.nucleus
              ? "specks, and cells it takes in (both: a grazer and a hunter)"
              : t.base === "rock"
                ? "its grain's chemistry, and specks"
                : "specks (a grazer)",
          ),
          fact("Its line", L(`${s.gens.length + 1} generations so far ›`, "line")),
          fact("Its world", L("What its seas are, and its dawn ›", "world")),
          fact("The drop", L("What lives about it ›", "drop")),
        ],
      };
    }
    if (ref === "body" && s?.body && f) {
      const b = s.body;
      return {
        title: `Your line's body, generation ${s.bodies?.length ?? 1}`,
        help: "help:body",
        parts: [
          fact("Its way", b.name),
          fact("Weight", massText(b.genome.mass)),
          ...(() => {
            const tier = sizeTier(b.genome.mass),
              h = beast?.hunted() ?? { by: [], larger: 0 };
            return [
              fact(
                "Its size",
                `${tier.words}${tier.next !== null ? ` (the next size up from ${massText(tier.next)})` : ""}; ${h.larger ? `${h.larger} kinds about it are larger` : "nothing about it is larger"}`,
              ),
              fact("Hunted by", h.by.length ? andWords(h.by) : "nothing here hunts it"),
            ];
          })(),
          fact(
            "Body",
            `${b.body.legs ? `${b.body.legs} pairs of legs` : "no legs"}, ${b.body.fins ? `${b.body.fins} pairs of fins` : "no fins"}, ${b.body.covering} skin, eats ${b.body.eats}`,
          ),
          ...b.reasons.map((r) => para(r, "line-para small")),
          fact(
            "Its line",
            L(`${s.gens.length + (s.bodies?.length ?? 0)} generations so far ›`, "line"),
          ),
          fact("Its world", L("What its seas are, and its dawn ›", "world")),
        ],
      };
    }
    if (ref === "line" && s && f) {
      const list = el("ol", "line-gens");
      const line = lineAt(s.first, s.digest, sagaId, s.gens, (at) => gatesNow(at), f);
      line.forEach((x, i) => {
        const li = el("li");
        li.append(L(`Generation ${i + 1}: ${x.size.toFixed(1)} µm, ${wayWord(x)} ›`, `gen:${i}`));
        list.append(li);
      });
      return {
        title: "Your line",
        help: "help:daughters",
        parts: [
          para(
            `Begun ${myWords(cellSpan(rungs).from)}${s.fromName ? `, to live the line of ${s.fromName}` : ""}. ${s.deaths ? `${s.deaths} of your cells were lost on the way; the line went on in its own.` : ""}`,
          ),
          list,
          ...(s.bodies?.length ? [para("Past its cells, its bodies:"), bodiesList(s)] : []),
        ],
      };
    }
    if (ref.startsWith("gen:") && s && f) {
      const i = Number(ref.slice(4)),
        line = lineAt(s.first, s.digest, sagaId, s.gens, (at) => gatesNow(at), f),
        x = line[i],
        g = i > 0 ? s.gens[i - 1] : undefined;
      if (!x)
        return { title: "Not in the line", parts: [para("That generation is not in your line.")] };
      return {
        title: `Generation ${i + 1}`,
        help: "help:daughters",
        parts: [
          fact("Size", `${x.size.toFixed(1)} µm across`),
          fact("Speed", `${speedOf(x).toFixed(1)} µm a second`),
          fact("Way", wayWord(x)),
          ...(g
            ? [
                fact("When", myWords(g.my)),
                fact(
                  "Chosen",
                  `daughter ${g.pick + 1}${g.took ? `, which took up ${TOOK_WORDS[g.took]}` : ""}`,
                ),
                ...g.reasons.map((r) => para(r, "line-para small")),
              ]
            : [para("The first cell of your line, as the first small cells of your world were.")]),
          fact(
            "Around it",
            ...(i > 0 ? [L("‹ The one before", `gen:${i - 1}`), " "] : []),
            ...(i + 1 < line.length ? [L("The one after ›", `gen:${i + 1}`)] : []),
          ),
        ],
      };
    }
    if (ref === "world" && f) {
      const list = el("ul", "line-rungs");
      for (const r of rungs) {
        const li = el("li", r.at >= my ? "passed" : "");
        li.textContent = `${r.at >= my ? "✓" : "○"} ${r.name}, ${myWords(r.at)}`;
        list.append(li);
      }
      return {
        title: `Your world's seas`,
        help: "help:cell",
        parts: [
          fact(
            "Its seas",
            `${f.liquidName} (${(mediumOf(f).mu * 1000).toFixed(2)} mPa·s, ${mediumOf(f).rho} kg in a cubic metre)`,
          ),
          fact("Its life is", `of ${f.family}, with ${f.membrane} membranes`),
          fact(
            "It catches light with",
            f.pigment === "polyimine"
              ? "nothing that light can drive here (too little reaches)"
              : f.pigment,
          ),
          fact(
            "Its pull",
            `${f.gravity.toFixed(2)} of Earth's (nothing to a cell: its liquid's thickness is all it feels)`,
          ),
          para(
            "The steps of its dawn, as they came: each opens to your line no earlier than it came to your world.",
          ),
          list,
        ],
      };
    }
    if (ref === "drop" && drop) {
      const n = drop.kinds.map(() => 0);
      for (const c of drop.cells) n[c.kind]!++;
      return {
        title: "The drop about your cell",
        help: "help:acts",
        parts: [
          ...drop.kinds.map((k, i) =>
            fact(
              k.name,
              drop!.risen[i]
                ? `${n[i]} now, some ${k.size} µm across${k.runs ? `, living on ${k.runs}` : ""}`
                : "not yet arisen",
            ),
          ),
          para(
            "Your own line is ringed. A hunting cell takes in any cell under half its size that it reaches.",
          ),
        ],
      };
    }
    const h = HELP[ref];
    if (h)
      return {
        title: h[0],
        help: ref === "help:pages" ? "help:pages" : "help:mode",
        parts: [
          ...h[1].map((p) => para(p)),
          fact(
            "More",
            ...HELP_LINKS.filter(([r]) => r !== ref).map(([r, text]) => L(`${text} ›`, r)),
          ),
        ],
      };
    return { title: "Nothing here", parts: [para("There is no such page.")] };
  };

  // —— Each frame ——————————————————————————————————————————————————————————————————————————————————————————————————————

  const frame = (dt: number) => {
    keepAway();
    if (leading) return bandFrame(dt);
    if (living) return bodyFrame(dt);
    if (!drop || !hand || !traits || !micro) return;
    const paused = hud.modal || hand.dividing || ended;
    if (!paused) {
      owed += Math.min(0.1, dt);
      let n = 0;
      const t0 = performance.now();
      while (owed >= STEP && n < 4) {
        const press = hud.takePressed()[0],
          offers = offersNow();
        if (press !== undefined) {
          const o = offers[press];
          if (o) {
            if (!o.can) hud.say(o.words, false);
            hand.act = o.act;
          }
        }
        const s = hud.stick();
        hand.mx = s.x;
        hand.my = s.y;
        stepHeld(drop, hand);
        owed -= STEP;
        n++;
      }
      if (n) {
        stepMs += performance.now() - t0;
        steps += n;
      }
      if (n === 4) owed = 0;
      // (What it gathered drives the clock on.)
      if (hand.gained > 0) {
        const before = my;
        my = clockOn(my, hand.gained, worth(traits.size), rungs, traits);
        if (saga) {
          saga.gathered += hand.gained;
          saga.my = my;
        }
        hand.gained = 0;
        for (const r of rungs)
          if (r.at < before && r.at >= my) {
            hud.say(`${r.name}, ${myWords(r.at)}: ${r.words}`);
            const way = ARISING.find(([, id]) => id === r.id)?.[0];
            if (way && kindOf(way) >= 0) arise(drop, kindOf(way));
          }
      }
      if (hand.ate > ateSeen) {
        noises.play("chomp");
        juice?.bite();
      }
      ateSeen = hand.ate;
      played += dt;
      if (hand.steered > 1.2) guide.did("steer");
      if (hand.ate >= 3) guide.did("eat");
      if (hand.dividing && !choosing) {
        guide.did("divide");
        openPicker();
      } else if (hand.ended && !ended) lost();
      if (performance.now() - keptAt > KEEP_EVERY) void keepSaga();
    } else hud.takePressed();
    eye(dt);
    const c = heldCell(drop, hand);
    const round = roundDrop(aboutHeld(drop, hand), c ? hand.id : null);
    if (c) {
      // (The cell held made lively: its eyes, its parts, its squash and stretch, its bites and its grip's ring.)
      juice ??= new CellJuice(d.stage, micro.root as never);
      juice.root.enabled = true;
      juice.update(
        round,
        c.kind,
        roundOf({ id: c.id, x: FIELD_W / 2, y: c.y }),
        Math.max(0.12, c.size * (12 / 180) * 1.7),
        c.heading,
        paused ? 0 : Math.min(1, Math.hypot(hand.mx, hand.my)),
        traits,
        lookOf(drop, c),
        1 - hand.caught / ENGULF,
        Math.min(0.1, dt),
      );
    } else if (juice) juice.root.enabled = false;
    micro.living(round, colours(), plan?.drop?.grain?.color);
    depth ??= new DepthLayer(d.stage, micro.root as never);
    depth.update(beyondOf(), traits.size, played, 0, cy);
    const now = performance.now();
    if (now - hudAt >= HUD_EVERY) {
      hudAt = now;
      chrome();
    }
  };
  const colours = () => plan?.drop?.kinds.map((k) => k.color) ?? [];
  /** The larger lives of the water beyond the drop: its kinds at their sizes and, once its first bodies come, those. */
  const beyondOf = (): Beyond[] => {
    const kinds = plan?.drop?.kinds ?? [],
      out: Beyond[] = kinds.map((k) => ({ size: k.size, color: k.color }));
    if (traits?.together || my <= rungAt("together"))
      out.push({ size: 600, color: [0.85, 0.7, 0.6] });
    return out;
  };

  /** The eye beside the drop's slab, on the cell held (it stays in the middle across: the drop wraps about it). */
  const eye = (dt: number) => {
    const c = drop && hand ? heldCell(drop, hand) : null,
      cam = d.stage.camera,
      tan = Math.tan((22.5 * Math.PI) / 180),
      aspect = innerWidth / Math.max(1, innerHeight),
      // (As the line grows the eye eases out: it shows some twenty-four of the cell held across, never less than 48 µm nor
      // more than the drop, eased over a second and a half: growth is felt, nothing leaps.)
      want = Math.max(
        48,
        Math.min(170, 24 * (traits?.size ?? 2) * (traits ? partEffects(traits).sight : 1)),
      ),
      k0 = across ? 1 - Math.exp(-Math.min(0.1, dt) / 1.5) : 1,
      wide = (across += (want - across) * k0) * (12 / 180),
      far = Math.max(wide / (2 * tan), (wide * 0.75) / (2 * tan * aspect)) * hud.zoom,
      high = 2 * far * tan;
    if (c) {
      const at = roundOf({ id: c.id, x: FIELD_W / 2, y: c.y }),
        room = Math.max(0, 4.6 - high / 2),
        y = Math.max(-room, Math.min(room, at.y)),
        k = framed ? 1 - Math.exp(-Math.min(0.1, dt) / 0.35) : 1;
      cy += (y - cy) * k;
      cz += (at.z - cz) * k;
      framed = true;
    }
    cam.setPosition(0, cy, cz + far);
    cam.lookAt(0, cy, cz);
  };

  const offersNow = () => {
    const c = drop && hand ? heldCell(drop, hand) : null;
    return cellOffers({
      t: traits!,
      gates: gatesNow(),
      energy: c?.energy ?? 0,
      prey: c && traits!.nucleus ? (drop!.kinds[preyOf(drop!, c)?.kind ?? -1]?.name ?? null) : null,
      basking: !!hand?.bask,
      light: c && drop ? lightAt(drop, c.y) : 0,
      mating: hand?.mate != null,
    });
  };

  /** The chrome's words, as the line stands. */
  const chrome = () => {
    if (!drop || !hand || !traits || !saga) return;
    const c = heldCell(drop, hand),
      span = cellSpan(rungs),
      through = (span.from - my) / Math.max(1e-9, span.from - span.to),
      next = rungs.filter((r) => r.at < my && r.at >= span.to).sort((a, b) => b.at - a.at)[0];
    hud.head(
      `Your cell · gen ${saga.gens.length + 1}`,
      myWords(my),
      through,
      next
        ? `Next: ${next.name.toLowerCase()}, ${myWords(next.at)}`
        : traits.together
          ? "Your world's first bodies"
          : "The first bodies, once your line's cells stay together",
    );
    if (c) {
      const w = worth(traits.size);
      // (The meter: from empty as a daughter newly divided, with its worth, to full at twice it.)
      const full = (c.energy - w) / w;
      hud.cell(
        `${traits.size.toFixed(1)} µm · ${speedOf(traits).toFixed(1)} µm/s · Re ${smallWords(reynoldsOf(traits, facts!))}`,
        full,
      );
      if (full >= 1 && !wasFull) {
        hud.pop();
        noises.play("pop");
        if (guide.first(traits.nucleus ? "full-mate" : "full"))
          hud.say(
            traits.nucleus
              ? "Your meter is full: call a mate! Press 💞 (Space), and your young will mix the two of you"
              : "Your meter is full: divide! Press ➗ (Space)",
          );
      }
      wasFull = full >= 1;
    }
    hud.offers(offersNow());
    hud.health(1 - hand.caught / ENGULF, hand.hurt);
    if (hand.caught > 0 && guide.first("caught"))
      hud.say("Caught! Swim hard, or dart (E), to pull free", false);
    if (c) {
      const near = threatOf(drop, c);
      if (near !== null && near < 34 * partEffects(traits).sight) {
        if (guide.first("danger"))
          hud.say("Something bigger is near: flee! Dart away with 💨 (E)", false);
        noises.play("danger");
      }
      if (traits.nucleus && preyOf(drop, c) && guide.first("prey"))
        hud.say("Smaller cells are food now: take one in with 🫧 (F)");
      if (
        beyondOf().some((l) => l.size > traits!.size * 1.6) &&
        played > 20 &&
        guide.first("beyond")
      )
        hud.say("Far behind, larger lives drift by: grow, and one day your line is their size");
      noises.ambient(true, near === null ? 0 : Math.max(0, 1 - near / 40));
    }
    const t = hand.told;
    if (t && t.words !== told) {
      told = t.words;
      hud.say(t.words, t.good);
    }
    hud.hintWords(hand.steered > 3 ? "" : "Drag here to swim");
  };

  const nowState = () => {
    const c = drop && hand ? heldCell(drop, hand) : null;
    return {
      moved: (hand?.steered ?? 0) > 1,
      ate: hand?.ate ?? 0,
      energy: c?.energy ?? 0,
      t: traits!,
      choosing: !!choosing,
      food: c && drop ? foodOf(drop, c) : null,
      threat: c && drop ? threatOf(drop, c) : null,
      gates: gatesNow(),
      my,
      rungs,
      basking: !!hand?.bask,
      light: c && drop ? lightAt(drop, c.y) : 0,
    };
  };

  // (Wake, or Make it so: once the line has come anywhere, both are offered; the world it was lived in is kept either way.)
  hud.onWake = () =>
    saga && (saga.gens.length || saga.body)
      ? layer(
          card(
            "Wake, or make it so?",
            [
              "☀️ Wake: back to your world as it is. Nothing in it has changed.",
              "✨ Make it so: a new world is made from your world's beginning, with your line in it. What your cell ate is what prospered in its first seas, and the ways your body lived prospered in their ages. Your world as it is now is kept.",
            ],
            [
              key("☀️ Wake", () => void flow.wake(), true),
              key("✨ Make it so", () => void makeItSo()),
            ],
            "help:makeso",
          ),
        )
      : void flow.wake();
  /** The line made so: the world's seed with the acts the line lived, the world kept, the new world opened from year 0. */
  const makeItSo = async () => {
    if (!saga) return;
    const made = await d.client.query<{ seed: string; acts: string[] }>({
      type: "line.makeSo",
      args: {
        // (The way its cell came to: the cell it lives in, or the last it lived in.)
        cell: wayOf(traits ?? saga.first),
        bodies: (saga.bodies ?? []).map((b) => ({ my: b.my, way: b.way })),
        node: saga.node ?? null,
        // (Its body as you leave it: the one your line lives in now.)
        genome: saga.body?.genome ?? null,
      },
    });
    if (!made.acts.length) {
      hud.say(
        "Your line has made nothing yet that would change its world: live it on, then make it so.",
        false,
      );
      return;
    }
    // (What the new world will hold of it, shown while it is made: the body your line lives in, its picture.)
    const made1 = card(
      "Making it so…",
      [
        saga.body
          ? `Your line, the ${saga.body.name}, lives on to now in the new world: as you left it, ${sizeTier(saga.body.genome.mass).words} and a ${saga.body.way}. Find it in its tree of life as “Your line”.`
          : "Your cell's way prospers in the new world's first seas.",
        "Your world as it is now is kept in your saves.",
      ],
      [],
      "help:makeso",
    );
    if (saga.body)
      made1.querySelector(".line-card-head")?.after(beastPicture(saga.body.body, null));
    layer(made1);
    await keepSaga();
    // (Your world kept as the game keeps it, its own save: app/main.ts's checkpoint, by the same name.)
    const params = new URLSearchParams(location.search),
      universe = params.get("universe") ?? "earth",
      seed = params.get("seed") ?? "first light";
    await d.client.save(`${universe}:${seed}:auto`).catch(() => undefined);
    location.search = `?universe=${encodeURIComponent(universe)}&seed=${encodeURIComponent(made.seed)}`;
  };
  hud.onHelp = () => openPage("help:mode");
  hud.onStripHelp = () => openPage(living ? "help:body" : "help:cell");
  hud.onName = () => openPage(living ? "body" : "cell");
  hud.onGuide = () => (hud.modal ? layer(null) : layer(guide.panel(() => layer(null))));
  hud.onNow = () => {
    if (!traits) return;
    hud.nowWords(living ? bodyNow() : whatNow(nowState()));
    clearTimeout(nowTimer);
    nowTimer = window.setTimeout(() => hud.nowWords(null), 7000);
  };
  hud.onKey = (code) => {
    if (code === "Escape") {
      if (hud.modal && !choosing && !ended && !offered) layer(null);
      return true;
    }
    if (code === "Slash" || code === "KeyH") {
      hud.onNow();
      return true;
    }
    return false;
  };
  d.stage.onUpdate((dt) => {
    if (on) frame(dt);
  });

  const flow: LineFlow = {
    get on() {
      return on;
    },
    async enter(from) {
      if (on || entering) return;
      entering = true;
      loading.show(
        {
          name: "Live a Line",
          year: Math.floor((d.client.status?.t ?? 0) / YEAR),
          air: "your world held still",
          facts: [
            from === "band"
              ? "A band of its people"
              : from
                ? "A line of its tree of life"
                : "From its world's first cells",
            "Wake brings you back",
          ],
        },
        ["Your world's first seas", "Your first cell"],
      );
      // (The world held where it stands from now: nothing of it goes on while the mode comes.)
      wasSpeed = d.client.status?.speed ?? null;
      d.time.hold("line");
      loading.onCancel = () => {
        loading.hide();
        if (on) void flow.wake();
      };
      try {
        loading.step(0, false);
        const [p, f, kept] = await Promise.all([
          d.client.query<GenesisPlan>({ type: "genesis" }),
          d.client.query<LineFacts>({
            type: "line.facts",
            args: from && from !== "band" ? { ref: from } : {},
          }),
          d.client.query<{ id: number; data: SagaData }[]>({ type: "saga.list" }),
        ]);
        plan = p;
        facts = f;
        rungs = p.rungs;
        // (Turned back while the world was asked: not entered.)
        if (!loading.shown) {
          d.time.release("line");
          return;
        }
        loading.step(0, true);
        loading.step(1, false);
        micro ??= new MicroScene(d.stage);
        putAway();
        micro.visible = true;
        hud.show();
        on = true;
        const resumable =
          kept.find((s) => s.data?.v === 2 && s.data.digest === f.digest && s.data.from === from) ??
          null;
        if (!p.drop) {
          drop = null;
          hand = null;
          layer(
            card(
              "No life here",
              [
                "No life ever arose in this world's seas: there is no line to live. Wake to your world.",
              ],
              [key("☀️ Wake", () => void flow.wake())],
              "help:mode",
            ),
          );
        } else if (from === "band") {
          // (The tribe asked for at once: the band led, the cells let be.)
          await begin(null, null);
          await startBand();
        } else {
          await begin(resumable, from);
          if (!guide.welcomed) layer(guide.welcome(() => {}));
          else if (resumable)
            layer(
              card(
                "Your line is kept",
                [
                  `You left it at generation ${resumable.data.gens.length + 1}, ${myWords(resumable.data.my)}.`,
                ],
                [
                  key(
                    "Begin a new line",
                    () => void begin(null, from).then(() => layer(null)),
                    true,
                  ),
                  key("⛺ Lead a band", () => void startBand(), true),
                  key("Go on with it", () => layer(null)),
                ],
                "help:mode",
              ),
            );
        }
        loading.step(1, true);
        loading.hide();
      } catch (error) {
        loading.hide();
        if (on) await flow.wake();
        else d.time.release("line");
        throw error;
      } finally {
        entering = false;
      }
    },
    async wake() {
      if (!on) return;
      guide.did("wake");
      await keepSaga();
      on = false;
      hud.hide();
      if (micro) micro.visible = false;
      choosing = null;
      if (beast) beast.leave();
      living = false;
      offered = null;
      leaveBand();
      noises.close();
      putBack();
      d.time.release("line");
      // (A world that stood still when the mode was entered stands still still: its clock is not let go by the mode.)
      if (wasSpeed === 0) d.client.setSpeed(0);
    },
  };

  // (For the look tools: the mode's state, and a few hands on it.)
  const exposed = (globalThis as { causalis?: Record<string, unknown> }).causalis;
  if (exposed)
    exposed.lineMode = {
      state: () => {
        const c = drop && hand ? heldCell(drop, hand) : null;
        return {
          on,
          my,
          gen: saga?.gens.length ?? 0,
          saga: sagaId,
          traits,
          way: traits ? wayOf(traits) : null,
          energy: c?.energy ?? null,
          worth: traits ? worth(traits.size) : null,
          x: c?.x ?? null,
          y: c?.y ?? null,
          cells: drop?.cells.length ?? 0,
          ate: hand?.ate ?? 0,
          steered: hand?.steered ?? 0,
          choosing: choosing?.length ?? 0,
          ended,
          done,
          layer: hud.modal ? (hud.layer.firstElementChild?.className ?? "") : null,
          page: pages.ref,
          nav: pages.nav,
          guide: { done: [...guide.done], welcomed: guide.welcomed, hidden: guide.hidden },
          offers: drop && hand ? offersNow() : [],
          stepMs: steps ? stepMs / steps : 0,
          generations: GENERATIONS,
          living,
          body: saga?.body
            ? { name: saga.body.name, way: saga.body.way, mass: saga.body.genome.mass }
            : null,
          bodies: saga?.bodies?.length ?? 0,
          offered: offered?.length ?? 0,
          pickMs,
          turnMs,
          askMs,
          beast: beast?.strip() ?? null,
          beastStepMs: beast?.steps ? beast.stepMs / beast.steps : 0,
          under: beast?.under ?? null,
          hunted: beast?.hunted() ?? null,
        };
      },
      /** Fill the cell held to dividing (a look tool's shortcut past the eating). */
      feed: () => {
        const c = drop && hand ? heldCell(drop, hand) : null;
        if (c && traits) c.energy = 2.05 * worth(traits.size);
      },
      pick: (i: number) => pick(i),
      /** A hunter of the drop set beside the cell held (a look tool's shortcut to danger). */
      threaten: () => {
        const c = drop && hand ? heldCell(drop, hand) : null,
          find = () => drop?.cells.find((x) => x.way === "hunter" && c && x.size > c.size * 2);
        if (drop && !find() && kindOf("hunter") >= 0) arise(drop, kindOf("hunter"));
        const o = find();
        if (!c || !o) return false;
        o.x = c.x + o.size * 0.3;
        o.y = c.y;
        o.full = 0;
        return true;
      },
      /** The beast made ready and Court pressed; what the courting is at. */
      court: () => beast?.courtNow() ?? false,
      nest: () => beast?.nestNow ?? null,
      /** Past the cells: the founders offered, a body founded, young had (a look tool's shortcut past the courting). */
      founders: () => openFounders(),
      found: (i: number) => found(i),
      young: () => openYoung(),
      goOnIn: (i: number) => goOnIn(i),
      /** The cell stage come to its end at once (a look tool's shortcut past thirty generations). */
      ripen: () => {
        if (!traits) return;
        traits = { ...traits, nucleus: true, together: true };
        my = Math.min(my, bodiesAt());
        done = true;
        stageDone();
      },
      page: (ref: string) => openPage(ref),
      now: () => (traits ? whatNow(nowState()) : null),
      close: () => layer(null),
      wake: () => flow.wake(),
      /** The tribe (S6): led, its state; the eye put on a point; an order given; so many band days lived at once. */
      lead: () => startBand(),
      band: () => {
        const b = band?.band,
          l = band?.led;
        return b && l
          ? {
              leading,
              people: b.people.length,
              food: b.food,
              day: b.day,
              hour: band!.hour(),
              camp: { ...b.camp },
              going: !!b.going,
              born: l.born,
              lost: l.lost,
              grass: l.grass,
              seed: l.seed.map((s) => ({ ...s })),
              sprouted: l.sprouted,
              grain: l.grain,
              look: { ...band!.look },
              quarry: band!.quarry(),
              offers: band!.offers(),
              taught,
              stepMs: band!.stepMs,
              land: bandLand,
            }
          : null;
      },
      bandLook: (x: number, z: number) => {
        if (!band) return;
        band.look.x = x;
        band.look.z = z;
      },
      bandAct: (i: number) => (band ? band.act(i) : null),
      bandLive: (days: number) => band?.live(days) ?? 0,
      bandMorning: () => band?.toMorning() ?? false,
      sow: () => sowCard(),
      teach: () => teach(),
    };
  return flow;
}

/** How far the clock goes on a generation of bodies played (My): an age of its world's (gen/deeptime.ts). */
const AGE_STEP = 25;

function massText(kg: number): string {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(1)} tonnes`
    : kg >= 1
      ? `${kg.toFixed(kg >= 10 ? 0 : 1)} kg`
      : kg >= 0.001
        ? `${(kg * 1000).toFixed(kg >= 0.01 ? 0 : 1)} g`
        : `${(kg * 1e6).toFixed(0)} mg`;
}
function fitWords(f: number): string {
  return f >= 1 ? "very well" : f >= 0.4 ? "well" : f >= 0 ? "fairly" : "poorly";
}
/** A line's bodies, generation by generation, as a list. */
function bodiesList(s: SagaData): HTMLElement {
  const ol = el("ol", "line-gens");
  for (const x of s.bodies ?? []) {
    const li = el("li");
    li.textContent = `${x.name}, ${massText(x.mass)}, ${myWords(x.my)}${x.died ? ` (its line died out: went on as ${x.died})` : ""}`;
    ol.append(li);
  }
  return ol;
}

const TOOK_WORDS: Readonly<Record<NonNullable<Daughter["took"]>, string>> = {
  nucleus: "a nucleus",
  light: "living by light",
  together: "staying together",
};

/** A cell's way of life, in a few words. */
function wayWord(t: Traits): string {
  return t.together
    ? "cells together"
    : t.nucleus
      ? t.light
        ? "a cell with a nucleus, living by light and by taking in others"
        : "a cell with a nucleus, taking in others"
      : t.light
        ? "living by light"
        : t.base === "rock"
          ? "living on its rock grain"
          : "eating what floats";
}

/** The help pages, in plain words: each panel's ? opens one. */
const HELP: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  "help:mode": [
    "What Live a Line is",
    [
      "You live one line of your world's life by hand, from one of its first cells. You steer, eat and divide; each time you divide, you choose which daughter to live on in.",
      "What your cell can do is your world's own: how thick its seas are, what light reaches them, what its life is built of, and when each step of its dawn came. Nothing is a number made up for the game.",
      "Your world is held still while you play. ☀️ Wake, at the top right, takes you back to it exactly where you left it: nothing you do here changes it. Your line is kept with your world, to go on with later.",
    ],
  ],
  "help:cell": [
    "Your cell's numbers",
    [
      "Size: how wide your cell is, in micrometres (thousandths of a millimetre). Larger cells are safe from more hunters (a hunting cell can take in only what is under half its size), but cost more to keep and need more food to divide.",
      "Speed: how fast your cell swims through its world's liquid. A cell this small feels only how thick the liquid is (its viscosity), not its own weight: in a thinner liquid it goes faster.",
      "Re, the Reynolds number: how much a moving thing keeps going by itself. Ours, swimming, is about a million; yours is far under one. So your cell stops the moment you stop pushing.",
      "The bar under your name: how much you have gathered against what it takes to divide (twice what your cell is worth: its size to the power 1.5).",
    ],
  ],
  "help:acts": [
    "What your cell can do",
    [
      "Divide (Space): when the bar is full. Your cell splits, and you choose the daughter to go on in. Once your line has a nucleus this is Mate: you call one of your kind, it swims to you, and your young mix the two of you (one of them carries a part of your mate's).",
      "Dart (E): a burst of speed for a moment, to get clear of a hunter or reach food. It costs five times as much as swimming.",
      "Take in (F): only once your line has a nucleus. Swallow a cell under half your size that you touch.",
      "Bask (R): only once your line has taken in a light-eater. Hold still and live by light, brighter near the surface.",
      "Each is greyed out until your world and your line allow it, and says why when you press it.",
    ],
  ],
  "help:daughters": [
    "How daughters differ",
    [
      "Each daughter is a little unlike its mother: a little larger or smaller, a little faster or slower, as cells of its kind vary. Each card says what that change does here.",
      "When your world's dawn has come to a new step (a nucleus, living by light, cells staying together), a third daughter may have taken it up. These are the steps life took on your world, and none comes to your line before it came to your world.",
      "The draws are fixed by your world and your choices: choose the same daughters again, and you get the same line.",
    ],
  ],
  "help:guide": [
    "The guide",
    [
      "The guide shows one step at a time, at the top under your cell's numbers, and ticks it off by itself once you have done it.",
      "👉 Show me lights up what the step speaks of. Hide puts the guide away; its 📘 button brings it back, with every step to read again.",
      "💡 What now? looks at how your cell stands and says what you might do next. It never does anything itself.",
    ],
  ],
  "help:pages": [
    "These pages",
    [
      "Press your cell's name at the top for its page; from there, links lead to its line, its world and the drop about it.",
      "‹ Back and Forward › walk the pages you have read, each as you left it. ✕ Close (or Esc) goes back to your cell; the drop waits while a page is open.",
    ],
  ],
  "help:body": [
    "Your line's body",
    [
      "Past its cells, your line lives as a body: grown from its instructions as every body of your world is, and made of what your world's physics allow. A frame of its own pressure, a shell or bones bears only so much weight under its world's pull (far more in the water); breathing through its skin, gills or lungs feeds only so large a body at its world's oxygen.",
      "Steer it with the stick; its buttons are what its way of life can do: eat, bolt, court, call, spring on prey. Each is greyed out until it can, and says why.",
      "Eat until you are well fed, then court one of your kind near you: young are born, and you choose which your line goes on in.",
    ],
  ],
  "help:makeso": [
    "Make it so",
    [
      "Your world's deep past is made, not lived: its first seas, its ages and its tree of life come from its beginning. Living a line changes none of it until you make it so.",
      "Make it so makes a new world from the same beginning with your line laid into it: the way your cell lived is what prospered in its first seas, each age your body lived on land prospered in that way, and your line itself is in its tree of life, a daughter of the line it was founded from.",
      "Everything your line did not reach is as it was. Your world as it is now is kept: you can go back to it from your saves.",
    ],
  ],
  "help:band": [
    "Leading a band",
    [
      "A band of your world's people lives its own day, as every band seen near does: out gathering and hunting by day, home by dusk, asleep by night, its crafts by the fire. You lead it: the stick moves where you look (the ring on the ground).",
      "🏹 Hunt sends the hunters after the beast nearest where you look, if they could take it. 🚶 Walk on packs up the camp and walks the band to the ground you look at. 🌾 Seed sends the gatherers to the grass for its seed instead of the woods.",
      "A band fed well three days running has a child; one starved three days running loses its weakest. Seed eaten by a fire is dropped there: where a wild grain grows, a camp come back to after some days has it growing thick. That is how sowing came to people. Once your band has seen it, 🌱 Sow teaches your land to sow, and its people settle in their own time.",
    ],
  ],
  "help:young": [
    "How your young differ",
    [
      "Each young one is one change from its mother: a little larger or smaller, a skin or a limb unlike hers. Only what its world's physics allow is offered.",
      "Fitter means it suits its way of life better here, by the same measure your world's own lines were bred by. You need not choose the fittest.",
      "Then the ages pass by themselves: your line is bred on, the fittest of each generation kept. A line outdone by its kin may die out; you go on as the nearest of them.",
    ],
  ],
  "help:stage": [
    "How your line goes on",
    [
      "If your cell is taken or starves, your line lives on in one of its own, with everything it has become.",
      "Once your line's cells stay together and your world's first bodies come, the cell's stage is done. Your line is kept with your world.",
    ],
  ],
};
const HELP_LINKS: readonly (readonly [string, string])[] = [
  ["help:mode", "What this mode is"],
  ["help:cell", "Your cell's numbers"],
  ["help:acts", "What your cell can do"],
  ["help:daughters", "How daughters differ"],
  ["help:guide", "The guide"],
  ["help:pages", "These pages"],
  ["help:body", "Your line's body"],
  ["help:young", "How your young differ"],
  ["help:makeso", "Make it so"],
  ["help:band", "Leading a band"],
];
