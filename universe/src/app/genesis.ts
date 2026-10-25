// The genesis (Phase 9 M89): a way to begin. The galaxy born from a turning cloud; a star
// and its worlds, and the world chosen (this one, or one never seen); the world forming —
// molten, cooling, its seas rising; the dawn of life under the microscope, from the first
// cells to the first bodies; the living world arising age by age from its own lineages'
// bodies; the first people; and then where to begin. Everything shown is the world's own
// generation.
//
// Played (Phase 24, asked for 2026-10-24: "i should be able to be in my game and see the cell
// stage and every stage like spore i would just watch it emerge and be able to pause and
// influence and all that"): the whole of it runs on a deep clock, its speeds each stage's own,
// paused and let go at will. The first seas are a living drop — small cells, then light-eaters,
// hunting cells and cells together arising as the clock comes to them — that the god's hand
// may feed, shade, warm and stir; what prospered in it under the hand bends the living world
// after it. Any age of the deep past may be warmed, cooled, set afire, struck from the sky or
// calmed. Each act is laid on the world's seed, and the world is made again from it: what the
// act reaches is changed, the rest is as it was; and the world begun is the world remade.
//
// The ages lived (Phase 27): each age's living world is a stretch of its land with the beasts of
// its lineages on it, grazing, browsing, hunting, fleeing, bearing young and dying, its lineages
// coming and going as the clock passes the ages. The god's hand may green it or parch it, hearten
// its hunters or shelter the hunted; what fared best under the hand, against the land left alone,
// is laid on the world as the age ends, and the ages after run the more to its kind.
//
// The peopling (Phase 28): from the cradle the first people's bands go out over the globe land by
// land, as the world is begun from, each land in the colour of the family of tongues it will speak,
// the families named where they began, the eye following the bands' front. The god's hand may lower
// the seas for them to walk over the straits, give them a kind age or a hard one, or bid them rise
// elsewhere — a land tapped — and the peopling goes out again from the world remade. Or a band of
// them is watched near, on the last age's land among its beasts: camped about their fire, out to
// gather and to hunt by day, asleep by night, walking on when the land about them is bare.
import type { GalaxyPlan, GenesisPlan, HostClient, SystemPlan } from "../bridge/index.ts";
import { seedWithAct, seedWithoutAct } from "../kernel/index.ts";
import {
  BandLayer,
  GalaxyScene,
  GlobeScene,
  MeadowScene,
  MicroScene,
  OrbitRig,
  ParadeScene,
  SystemScene,
  type DeviceTier,
  type Stage,
} from "../render/index.ts";
import {
  AGE_ACT_WORDS,
  DAWN_WORDS,
  DROP_ACT_WORDS,
  DeepClock,
  GENESIS,
  MEADOW_ACT_WORDS,
  MEADOW_STEP,
  PEOPLING_ACT_WORDS,
  STEP,
  ageAct,
  ageAt,
  ageColors,
  ageWords,
  arise,
  bandHour,
  bandPace,
  bandWords,
  biomeColor,
  cradleAct,
  dawnAct,
  deepSpeedLabel,
  deepSpeedWords,
  deepWhen,
  dropOf,
  familiesReached,
  familyColor,
  familyWords,
  figureOf,
  follow,
  followBeast,
  followWords,
  followedLife,
  formingColors,
  genesisSpans,
  globeColors,
  homeOf,
  lifeAct,
  meadowAge,
  meadowCounts,
  meadowProspered,
  meadowProsperedWords,
  newBand,
  newDrop,
  newMeadow,
  paradeOf,
  peoplingAct,
  peoplingColors,
  peoplingCounts,
  peoplingDoneWords,
  peoplingFront,
  peoplingLandWords,
  peoplingReached,
  peoplingThrough,
  prosperedWords,
  remakeWords,
  roundDrop,
  roundOf,
  rungsPassed,
  stepBand,
  stepDrop,
  stepMeadow,
  systemSpec,
  touchDrop,
  touchMeadow,
  waysWorth,
  type AgeAct,
  type BandState,
  type DropAct,
  type DropState,
  type GenesisStage,
  type MeadowAct,
  type MeadowState,
  type Peopling,
  type PeoplingAct,
} from "../view/index.ts";

/** Where one may begin: the years, and what the world will be doing then. */
const BEGINNINGS: readonly (readonly [string, string, number])[] = [
  ["At the first people", "watch them from their first year", 0],
  ["Their first fields", "a generation or so on, as the first of them sow", 30],
  ["Three centuries on", "realms, writing, the first metal", 300],
  ["Seven centuries on", "iron and coal, the first engines", 700],
  ["Among the stars", "a world reaching for its sky", 1150],
];

/** The stages the first seas' drop is watched in. */
const DROP_STAGES: ReadonlySet<GenesisStage> = new Set(["first cells", "nucleus", "colonies"]);
/** The drop's ways, by the step of the dawn each arises at. */
const ARISING: readonly (readonly [string, string])[] = [
  ["light", "light"],
  ["hunter", "nucleus"],
  ["colony", "together"],
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export async function runGenesis(o: {
  stage: Stage;
  hud: HTMLElement;
  canvas: HTMLCanvasElement;
  client: HostClient;
  tier: DeviceTier;
  universe: string;
  seed: string;
  /** Where the world's own page is, for a year (to begin there), of the seed's text given. */
  beginAt: (year: number, seed: string) => void;
  /** Another world never seen, from its beginning. */
  another: () => void;
  /** Hooks for a machine driving the page (the gates). */
  expose?: (hooks: Record<string, unknown>) => void;
}): Promise<void> {
  const { stage, hud, client } = o;
  const [galaxy, system, first] = await Promise.all([
    client.query<GalaxyPlan>({ type: "galaxy.plan" }),
    client.query<SystemPlan>({ type: "planet.system" }),
    client.query<GenesisPlan>({ type: "genesis" }),
  ]);
  let plan = first,
    seed = first.seed;
  client.setInterest({ view: "globe", focus: null });
  // The world as generated (its cells, heights and land), for it to form on the globe.
  let frame = client.latestFrame("globe");
  for (let k = 0; !frame && k < 400; k++) {
    await new Promise((r) => setTimeout(r, 50));
    frame = client.latestFrame("globe");
  }
  if (!frame) throw new Error("the world did not come");
  const elevation = frame.arrays.elevation as Float32Array,
    frequency = (frame.meta as { frequency: number }).frequency,
    grid = (await import("../kernel/index.ts")).sphereGrid(frequency),
    land = globeColors(frame, "terrain"),
    // (Each cell's province and ground: the lands the bands came to, and where a people could rise.)
    province = frame.arrays.province as Int32Array,
    biome = frame.arrays.biome as Uint8Array;

  const galaxyScene = new GalaxyScene(stage),
    skyScene = new SystemScene(stage),
    globe = new GlobeScene(stage),
    micro = new MicroScene(stage),
    parade = new ParadeScene(stage),
    meadowScene = new MeadowScene(stage);
  let tap: (x: number, y: number) => void = () => {};
  const rig = new OrbitRig(stage, o.canvas, {
    distance: 200,
    minDistance: 0.5,
    maxDistance: 2000,
    pitch: -45,
    drift: 3,
    onTap: (x, y) => tap(x, y),
  });
  galaxyScene.build(galaxy, o.tier.name === "phone" ? 8000 : 16000);
  galaxyScene.visible = false;
  skyScene.build(system);
  skyScene.visible = false;
  globe.build(frequency, elevation);
  globe.visible = false;
  const detail = o.tier.name === "phone" ? 1 : 2;
  meadowScene.setDetail(detail);
  const bandLayer = new BandLayer(stage, meadowScene.root);
  let beasts = plan.lineages.filter((l) => l.body),
    bodies = plan.lineages.map((l) => l.body);
  const castParade = () => {
    beasts = plan.lineages.filter((l) => l.body);
    bodies = plan.lineages.map((l) => l.body);
    // (The stage's ground the green of the land the first people came to know.)
    parade.set(beasts, detail, biomeColor(8));
    parade.people(
      plan.people ? figureOf(plan.people.figure, detail) : null,
      plan.people?.figure ?? null,
    );
  };
  castParade();

  const spans = genesisSpans(plan),
    clock = new DeepClock(spans);

  // —— The bar: the world's name, the deep clock and its stage's speeds ——————————————————
  const bar = el("header", "bar genesis-bar"),
    toMenu = el("button", "link", "🏠 Main menu"),
    brand = el("strong", "brand", plan.name),
    when = el("span", "clock"),
    speeds = el("div", "speeds");
  speeds.setAttribute("role", "group");
  speeds.setAttribute("aria-label", "Speed");
  toMenu.onclick = () => (location.href = location.pathname);
  bar.append(brand, when, speeds, toMenu);
  let speedButtons: HTMLButtonElement[] = [],
    speedsOf = "";
  const drawSpeeds = () => {
    // (Watching a band, the speeds are its day's: the deep clock held meanwhile.)
    const near = watchingBand();
    if (speedsOf !== `${clock.at}${near ? " band" : ""}`) {
      speedsOf = `${clock.at}${near ? " band" : ""}`;
      speedButtons = [0, ...clock.span.speeds].map((s, i) => {
        const pace = near ? bandPace(i) : null,
          b = el("button", "speed", s === 0 ? "❚❚" : pace ? pace.label : deepSpeedLabel(s));
        b.setAttribute("aria-label", s === 0 ? "Pause" : pace ? pace.words : deepSpeedWords(s));
        b.title = s === 0 ? "Pause (Space)" : `${pace ? pace.words : deepSpeedWords(s)} (${i})`;
        b.onclick = () => {
          clock.pick(i);
          drawSpeeds();
        };
        return b;
      });
      speeds.replaceChildren(...speedButtons);
    }
    const lit = near
      ? clock.paused
        ? 0
        : clock.span.speeds.indexOf(clock.speedAt()) + 1
      : clock.lit;
    speedButtons.forEach((b, i) => {
      b.classList.toggle("on", i === lit);
      b.setAttribute("aria-pressed", String(i === lit));
    });
  };

  // —— The card at the foot: the stage told, the god's hand, what came of it, ways on ——————
  const card = el("div", "genesis"),
    step = el("div", "genesis-step"),
    title = el("h2"),
    text = el("p"),
    acts = el("div", "genesis-acts"),
    counts = el("p", "genesis-count"),
    told = el("div", "genesis-told"),
    row = el("div", "genesis-row"),
    skip = el("button", "link", "Skip to where to begin"),
    back = el("button", "link", "‹ Back"),
    next = el("button", undefined, "Next ›"),
    another = el("button", "link", "A world never seen ↻");
  another.onclick = () => o.another();
  row.append(skip, another, back, next);
  card.append(step, title, text, acts, counts, told, row);
  // (The families of tongues named over the globe as the bands come to them: Phase 28.)
  const labels = el("div", "labels genesis-labels");
  labels.hidden = true;
  hud.append(labels, bar, card);

  /** A line of what came to pass (the last few kept). */
  const tell = (words: string) => {
    const p = el("p", undefined, words);
    told.append(p);
    while (told.childElementCount > 3) told.firstElementChild?.remove();
  };
  /** The acts laid on this world's dawn, in a line. */
  const laid = () => {
    const parts = plan.acts.ages.map(
      (a) => `age ${a.age + 1} made ${/^[aeiou]/.test(a.kind) ? "an" : "a"} ${a.kind}`,
    );
    if (plan.acts.dawn) parts.push(`the first seas' ${plan.acts.dawn} prospered`);
    for (const l of plan.acts.lives) parts.push(`age ${l.age + 1}'s ${l.way} prospered`);
    const pa = plan.acts.peopling;
    if (pa.cradle !== null) parts.push("they rose where you bade");
    if (pa.seasLow) parts.push("the seas low as they spread");
    if (pa.age) parts.push(`a ${pa.age} age for their bands`);
    return parts.length ? `Your hand: ${parts.join(" · ")}` : "";
  };

  const hideAll = () => {
    galaxyScene.visible = false;
    skyScene.visible = false;
    globe.visible = false;
    micro.visible = false;
    parade.visible = false;
    meadowScene.visible = false;
    labels.hidden = true;
    globe.mark(null);
  };
  const home = system.bodies.find((b) => b.kind === "home") ?? system.bodies[0]!,
    R = galaxy.radius / 1000,
    beastWords = (age: number) =>
      beasts
        .filter((l) => l.arose === age)
        .slice(0, 2)
        .map((l) => `the ${l.name} arose — ${l.words}`)
        .join("; ");
  let paintedAt = -1,
    played = 0;
  const paint = (colors: Uint8Array) => {
    // (A tenth of a second between paints: the globe's cells are many.)
    if (played - paintedAt < 0.1 && paintedAt >= 0) return;
    paintedAt = played;
    globe.paint(colors);
  };

  // —— The first seas' drop: alive, its kinds arising as the clock comes to them ————————————
  const block = plan.drop,
    colors = block ? block.kinds.map((k) => k.color) : [],
    kindOf = (way: string) => (block ? block.kinds.findIndex((k) => k.way === way) : -1),
    rungAt = (id: string) => plan.rungs.find((r) => r.id === id)?.at ?? -1;
  let drop: DropState | null = null,
    // (The same drop untouched, beside it: what would have prospered without the hand.)
    twin: DropState | null = null,
    touched = false,
    // (Laid in this play: a world remade at its dawn before keeps its act unless touched again.)
    dawnLaid = false,
    chosen: number | null = null,
    owed = 0;
  const freshDrop = () => {
    if (!block) return;
    const risen = block.kinds.map((k) => k.way === "eater");
    drop = newDrop(block, risen);
    twin = newDrop(block, risen);
    touched = false;
    dawnLaid = false;
    chosen = null;
  };
  const touch = (act: DropAct) => {
    if (!drop || !block) return;
    touchDrop(drop, act, block);
    touched = true;
  };
  const stepDrops = (dt: number) => {
    if (!drop || !twin) return;
    for (const [way, rung] of ARISING) {
      const k = kindOf(way);
      if (k >= 0 && clock.my <= rungAt(rung)) {
        arise(drop, k);
        arise(twin, k);
      }
    }
    // (Faster at the stage's faster speeds; still while the clock is.)
    owed += dt * Math.max(0, clock.lit);
    let n = 0;
    while (owed >= STEP && n < 10) {
      stepDrop(drop);
      stepDrop(twin);
      owed -= STEP;
      n++;
    }
    if (n === 10) owed = 0;
  };
  let countedAt = -1;
  const countDrop = () => {
    if (!drop || !block || played - countedAt < 0.5) return;
    countedAt = played;
    const n = block.kinds.map(() => 0);
    for (const c of drop.cells) n[c.kind]!++;
    counts.textContent = block.kinds
      .map((k, i) => (drop!.risen[i] ? `${k.name} ${n[i]}` : ""))
      .filter(Boolean)
      .join(" · ");
    if (chosen !== null) counts.textContent += ` — ${followWords(drop, chosen)}`;
  };
  /** Once the dawn is past: what the hand made prosper in the first seas, laid on the world. */
  const settleDawn = () => {
    if (dawnLaid || !touched || !drop || !twin) return;
    dawnLaid = true;
    const { way, words } = prosperedWords(drop, waysWorth(twin));
    tell(words);
    void remake(dawnAct(way));
  };

  // —— An age's living world: alive, its lineages coming and going as the ages pass ————————
  let meadow: MeadowState | null = null,
    // (The same land untouched, beside it: what would have fared best without the hand.)
    meadowTwin: MeadowState | null = null,
    meadowTouched = false,
    meadowOwed = 0;
  /** The ages whose living world's act was laid in this play (once each). */
  const lifeLaid = new Set<number>();
  const freshMeadow = (age: number) => {
    meadow = newMeadow(plan, age, seed);
    meadowTwin = newMeadow(plan, age, seed);
    meadowTouched = false;
    meadowScene.reset();
  };
  const touchLife = (act: MeadowAct) => {
    if (!meadow) return;
    touchMeadow(meadow, act);
    meadowTouched = true;
  };
  /** An age left forward: what fared best in its living world under the hand, laid on the world. */
  const settleAge = () => {
    const m = meadow,
      twin = meadowTwin;
    if (!m || !twin || !meadowTouched || lifeLaid.has(m.age)) return;
    lifeLaid.add(m.age);
    meadowTouched = false;
    const { way, words } = meadowProsperedWords(m, twin);
    tell(words);
    if (way) void remake(lifeAct(m.age, way));
  };
  /** The living world at the clock's age: on into the next (its dead falling, its new coming in), or begun afresh. */
  const syncMeadow = (age: number) => {
    if (!meadow || age < meadow.age) return freshMeadow(age);
    if (age === meadow.age) return;
    settleAge();
    meadow = meadowAge(meadow, plan, age);
    meadowTwin = meadowAge(meadowTwin!, plan, age);
  };
  const stepMeadows = (dt: number) => {
    if (!meadow || !meadowTwin) return;
    // (Faster at the stage's faster speeds; still while the clock is.)
    meadowOwed += dt * Math.max(0, clock.lit);
    let n = 0;
    while (meadowOwed >= MEADOW_STEP && n < 12) {
      stepMeadow(meadow);
      stepMeadow(meadowTwin);
      meadowOwed -= MEADOW_STEP;
      n++;
    }
    if (n === 12) meadowOwed = 0;
  };
  let meadowCounted = -1;
  const countMeadow = () => {
    if (!meadow || played - meadowCounted < 0.5) return;
    meadowCounted = played;
    const followed = followedLife(meadow);
    counts.textContent = `${meadowCounts(meadow) || (meadow.age === 0 ? "Life keeps to the seas: nothing walks the land yet" : "Nothing walks the land")}${followed ? ` — ${followed}` : ""}`;
  };

  // —— The god's hand on an age: the world remade from it ————————————————————————————————
  let remaking = false,
    // (The last remaking, waited on before the world is begun.)
    pending: Promise<void> = Promise.resolve();
  const remake = (act: string) =>
    (pending = remaking ? pending : remakeNow(act, seedWithAct(seed, act)));
  /** An act lifted: the world made again without it. */
  const lift = (act: string) =>
    (pending = remaking ? pending : remakeNow(act, seedWithoutAct(seed, act)));
  const remakeNow = async (act: string, next: string) => {
    remaking = true;
    clock.hold("remake");
    acts.classList.add("busy");
    tell("The world remakes itself from your hand…");
    try {
      const p = await client.query<GenesisPlan>({ type: "genesis", args: { seed: next } }),
        words = remakeWords(plan, p, act);
      plan = p;
      seed = next;
      castParade();
      ageShown = -1;
      // (Its living world begun again from the world remade, at the age the clock is in.)
      if (meadow) freshMeadow(meadow.age);
      told.lastElementChild?.remove();
      tell(words || "The world is remade.");
      laidLine.textContent = laid();
      // (The peopling gone out again from the world remade; the stage's acts as they now stand.)
      if (spans[shown]?.stage === "peopling") {
        freshPeopling();
        band = null;
        showPeopling();
        clock.jump(spans.findIndex((s) => s.stage === "peopling"));
      }
      if (shown >= 0) {
        text.textContent = STAGES[spans[shown]!.stage].text();
        acts.replaceChildren(...(STAGES[spans[shown]!.stage].acts?.() ?? []));
      }
    } finally {
      acts.classList.remove("busy");
      clock.release("remake");
      remaking = false;
    }
  };
  const laidLine = el("p", "genesis-laid", laid());
  card.insertBefore(laidLine, told);

  // —— Each stage: what it shows, how it is told, the hand's acts in it ——————————————————
  let lookAtWorld = false,
    ageShown = -1;
  const actButton = (icon: string, words: string, why: string, act: () => void) => {
    const b = el("button", "act", `${icon} ${words}`);
    b.title = why;
    b.onclick = act;
    return b;
  };
  const ageActs = () => {
    const view = el("button", "link", lookAtWorld ? "🦕 Its life" : "🌍 The world");
    view.title = lookAtWorld ? "See the living world of this age" : "See the world in this age";
    view.onclick = () => {
      lookAtWorld = !lookAtWorld;
      enter(clock.at);
    };
    const life = lookAtWorld
      ? []
      : (Object.keys(MEADOW_ACT_WORDS) as MeadowAct[]).map((a) => {
          const [icon, words] = MEADOW_ACT_WORDS[a];
          return actButton(
            icon,
            words,
            `${words}: this age's living world — what fares best under your hand, the ages after run the more to`,
            () => touchLife(a),
          );
        });
    return [
      view,
      ...life,
      ...(Object.keys(AGE_ACT_WORDS) as AgeAct[]).map((a) => {
        const [icon, words] = AGE_ACT_WORDS[a];
        return actButton(icon, words, `${words}: this age, as the clock stands in it`, () => {
          const { age } = ageAt(plan, clock.my);
          if (age >= 0) void remake(ageAct(age, a));
        });
      }),
    ];
  };
  // —— The peopling: the bands going out over the land, land by land (Phase 28) ————————————————
  let frontTold = -1,
    frontShown = -1,
    peoplingTold = false,
    choosingCradle = false,
    // (The eye follows the bands' front until the viewer turns the globe for themselves.)
    eyeSet: { yaw: number; pitch: number } | null = null,
    eyeOwn = false,
    labelled: { el: HTMLElement; middle: number; family: number }[] = [];
  const P = grid.positions,
    provinces = province.reduce((m, v) => Math.max(m, v + 1), 0),
    // (Each province's direction from the globe's middle: the sum of its cells'.)
    toward = new Float32Array(provinces * 3);
  for (let c = 0; c < province.length; c++) {
    const q = province[c]! * 3;
    toward[q] = toward[q]! + P[c * 3]!;
    toward[q + 1] = toward[q + 1]! + P[c * 3 + 1]!;
    toward[q + 2] = toward[q + 2]! + P[c * 3 + 2]!;
  }
  /** When the bands came (or will come) to a step from the cradle, by the deep clock. */
  const stepWhen = (step: number) => {
    const p = plan.peopling!,
      s = spans.find((x) => x.stage === "peopling")!,
      my = s.from - peoplingThrough(p, step) * (s.from - s.to);
    return my >= clock.my
      ? deepWhen(my)
      : `in some ${Math.max(1, Math.round((clock.my - my) * 1000))} thousand years`;
  };
  /** The eye turned toward a direction from the globe's middle. */
  const face = (x: number, y: number, z: number) => {
    const len = Math.hypot(x, y, z) || 1;
    rig.yaw = (Math.atan2(x, z) * 180) / Math.PI;
    rig.pitch = Math.max(-78, Math.min(78, (-Math.asin(y / len) * 180) / Math.PI));
    eyeSet = { yaw: rig.yaw, pitch: rig.pitch };
  };
  const turned = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  /** The peopling from its beginning: the cradle marked and faced, its families labelled as they are come to. */
  const freshPeopling = () => {
    frontTold = -1;
    frontShown = -1;
    peoplingTold = false;
    eyeOwn = false;
    paintedAt = -1;
    const p = plan.peopling;
    // The greatest families named, at the land their first tongue was first spoken in.
    const named = p
      ? p.families
          .map((f, i) => ({ f, i }))
          .sort((a, b) => b.f.lands - a.f.lands || a.i - b.i)
          .slice(0, o.tier.name === "phone" ? 6 : 10)
      : [];
    labelled = named.map(({ f, i }) => {
      const l = el("span", "label genesis-label"),
        swatch = el("i", "swatch"),
        [r, g, b] = familyColor(i);
      swatch.style.background = `rgb(${r},${g},${b})`;
      l.append(swatch, f.name);
      return { el: l, middle: f.middle, family: i };
    });
    labels.replaceChildren(...labelled.map((x) => x.el));
  };
  /** The eye eased toward the bands' front (the lands they came to last), the short way round. */
  const followFront = (p: Peopling, front: number) => {
    if (eyeOwn || !eyeSet) return;
    if (turned(rig.yaw, eyeSet.yaw) > 0.5 || Math.abs(rig.pitch - eyeSet.pitch) > 0.5) {
      eyeOwn = true;
      return;
    }
    let x = 0,
      y = 0,
      z = 0;
    for (const [cell, s] of p.lands)
      if (s <= front && s > front - 2.5) {
        x += toward[cell * 3]!;
        y += toward[cell * 3 + 1]!;
        z += toward[cell * 3 + 2]!;
      }
    const len = Math.hypot(x, y, z);
    if (len < 1e-6) return;
    const yaw = (Math.atan2(x, z) * 180) / Math.PI,
      pitch = Math.max(-78, Math.min(78, (-Math.asin(y / len) * 180) / Math.PI)),
      dyaw = ((yaw - rig.yaw + 540) % 360) - 180;
    rig.yaw += dyaw * 0.025;
    rig.pitch += (pitch - rig.pitch) * 0.025;
    eyeSet = { yaw: rig.yaw, pitch: rig.pitch };
  };
  /** The families' names over the globe, each once its first land is come to and while it faces the eye, none over another. */
  const placeLabels = (p: Peopling, front: number) => {
    const placed: { x: number; y: number; w: number }[] = [];
    const steps = new Map<number, number>(p.lands.map(([cell, s]) => [cell, s])),
      at = globe.screenOf(
        labelled.map((x) => ({
          x: P[x.middle * 3]!,
          y: P[x.middle * 3 + 1]!,
          z: P[x.middle * 3 + 2]!,
        })),
        1.03,
      );
    labelled.forEach((x, k) => {
      const s = steps.get(p.families[x.family]!.root) ?? Infinity,
        spot = at[k]!,
        // (About as wide as its name; the greatest families placed first.)
        w = 26 + 7 * p.families[x.family]!.name.length,
        show =
          s <= front &&
          spot.facing > 0.3 &&
          !placed.some(
            (q) => Math.abs(q.x - spot.x) < (q.w + w) / 2 && Math.abs(q.y - spot.y) < 20,
          );
      if (show) placed.push({ x: spot.x, y: spot.y, w });
      x.el.hidden = !show;
      if (show) x.el.style.transform = `translate(${spot.x}px, ${spot.y}px) translate(-50%, -50%)`;
    });
  };
  let peoplingCounted = -1;
  const countPeopling = (p: Peopling, front: number) => {
    if (played - peoplingCounted < 0.25 || choosingCradle) return;
    peoplingCounted = played;
    counts.textContent = peoplingCounts(p, front);
  };
  /** Whether a people of this world could rise on a cell (the hand bids them only where they could). */
  const fitCradle = (cell: number) => {
    const b = biome[cell]!,
      medium = plan.people?.figure.medium ?? "land",
      ground = elevation[cell]! > 0;
    // (Ice 4, hot desert 11, alpine 15; a reef shelf 2.)
    if (medium === "water") return b === 2;
    if (medium === "shore") return ground && b !== 4;
    return ground && b !== 4 && b !== 11 && b !== 15;
  };
  // —— A band watched: the peopling seen near, on the last age's land (Phase 28 M158) ——————————
  let lookAtBand = false,
    band: BandState | null = null,
    bandLand: MeadowState | null = null,
    bandOwed = 0,
    bandCounted = -1,
    // (The band's own screen time: on at its pace, still while paused — the deep clock, and the
    // screen time that goes with it, held while it is watched.)
    bandTime = 0;
  /** Whether a band is being watched now (the deep clock held meanwhile). */
  const watchingBand = () => lookAtBand && spans[shown]?.stage === "peopling";
  /** A band of the first people camped on the last age's land, as many as their age was kind to. */
  const freshBand = () => {
    band = null;
    bandLand = null;
    meadowScene.reset();
    if (!plan.people) return;
    bandLand = newMeadow(plan, Math.max(0, plan.ages.length - 1), seed);
    const age = plan.acts.peopling.age,
      drawn = figureOf(plan.people.figure, detail);
    band = newBand(
      bandLand,
      age === "kind" ? 18 : age === "hard" ? 10 : 14,
      plan.people.name,
      seed,
      undefined,
      undefined,
      drawn.scale,
    );
    bandLayer.people(drawn, plan.people.figure);
  };
  /** The band a frame on, at the pace chosen (still while paused); what came to pass told. */
  const stepBands = (dt: number) => {
    if (!band || !bandLand) return;
    const pace = clock.paused ? 0 : clock.span.speeds.indexOf(clock.speedAt()) + 1;
    bandOwed += dt * Math.max(0, pace);
    bandTime += dt * Math.max(0, pace);
    let n = 0;
    while (bandOwed >= MEADOW_STEP && n < 12) {
      stepMeadow(bandLand);
      stepBand(band, bandLand);
      bandOwed -= MEADOW_STEP;
      n++;
    }
    if (n === 12) bandOwed = 0;
    while (band.news.length) tell(band.news.shift()!);
  };
  /** Where the eye keeps: between the fire and the band, or on them as they walk on. */
  const bandMiddle = () => {
    if (!band) return null;
    let x = 0,
      z = 0;
    for (const q of band.people) {
      x += q.x;
      z += q.z;
    }
    const n = band.people.length || 1,
      mx = band.going ? x / n : (band.camp.x * 2 + x / n) / 3,
      mz = band.going ? z / n : (band.camp.z * 2 + z / n) / 3;
    return { x: mx * 0.1, y: 0.2, z: mz * 0.1 };
  };
  /** The peopling seen: over the world, its bands going out; or one band near, the deep clock held. */
  const showPeopling = () => {
    hideAll();
    choosingCradle = false;
    if (!plan.people) lookAtBand = false;
    if (lookAtBand) {
      clock.hold("band");
      stage.backdrop("ground", 40);
      meadowScene.visible = true;
      bandLayer.root.enabled = true;
      if (!band) freshBand();
      const c = band ? band.camp : { x: 0, z: 0 };
      rig.configure({
        distance: 7,
        minDistance: 2,
        maxDistance: 30,
        pitch: -26,
        minPitch: -85,
        maxPitch: -8,
        target: [c.x * 0.1, 0.2, c.z * 0.1],
        drift: 0,
      });
      rig.follow = bandMiddle;
      bandCounted = -1;
      return;
    }
    clock.release("band");
    rig.follow = null;
    bandLayer.root.enabled = false;
    stage.backdrop("space");
    globe.visible = true;
    globe.features(true, true, false);
    labels.hidden = false;
    rig.configure({
      distance: 3,
      minDistance: 1.4,
      maxDistance: 12,
      pitch: -15,
      minPitch: -80,
      maxPitch: 80,
      target: [0, 0, 0],
      drift: 0,
    });
    const p = plan.peopling;
    globe.mark(p ? p.middle : null);
    paintedAt = -1;
    frontShown = -1;
    // (Fresh, facing the cradle; come back from the band, turned toward the bands' front.)
    if (p && frontTold < 0) face(P[p.middle * 3]!, P[p.middle * 3 + 1]!, P[p.middle * 3 + 2]!);
    else {
      eyeOwn = false;
      eyeSet = { yaw: rig.yaw, pitch: rig.pitch };
    }
  };
  const peoplingActs = () => {
    const view = el("button", "link", lookAtBand ? "🌍 The world" : "👣 A band");
    view.title = lookAtBand
      ? "See the bands go out over the world"
      : "See a band of them near: their camp, their fire, out gathering and hunting the age's beasts";
    view.onclick = () => {
      lookAtBand = !lookAtBand;
      showPeopling();
      counts.textContent = "";
      acts.replaceChildren(...peoplingActs());
      drawSpeeds();
    };
    const made = plan.acts.peopling,
      act = (a: PeoplingAct, on: boolean, off: string) => {
        const [icon, words, why] = PEOPLING_ACT_WORDS[a];
        return actButton(
          icon,
          on ? off : words,
          on ? `${off}: the act lifted` : why,
          () => void (on ? lift(peoplingAct(a)) : remake(peoplingAct(a))),
        );
      },
      rise = actButton(
        "📍",
        choosingCradle
          ? "Tap a land for them to rise in…"
          : made.cradle !== null
            ? "Where they first rose"
            : "Let them rise elsewhere",
        made.cradle !== null
          ? "The people rise where they would have: the act lifted"
          : "Tap a land of the globe: the people rise there, and the peopling goes out from it",
        () => {
          if (made.cradle !== null && !choosingCradle) return void lift(cradleAct(made.cradle));
          choosingCradle = !choosingCradle;
          counts.textContent = choosingCradle ? "Tap the land where the people should rise." : "";
          peoplingCounted = -1;
          acts.replaceChildren(...peoplingActs());
        },
      );
    return [
      // (A band to watch only where there is a people.)
      ...(plan.people ? [view] : []),
      act("seas", made.seasLow, "Let the seas rise again"),
      act("kind", made.age === "kind", "An ordinary age"),
      act("hard", made.age === "hard", "An ordinary age"),
      ...(lookAtBand ? [] : [rise]),
    ];
  };
  /** A land of the globe tapped: the people bidden to rise there, or what came to it told. */
  const tapPeopling = (x: number, y: number) => {
    if (lookAtBand) return;
    const p = plan.peopling,
      cell = globe.pick(x, y);
    if (!p || cell === null) return;
    if (choosingCradle) {
      if (!fitCradle(cell)) {
        tell(
          "No people could rise there: the land is too cold, too dry or too high, or no land at all.",
        );
        return;
      }
      choosingCradle = false;
      void remake(cradleAct(cell));
      return;
    }
    counts.textContent = peoplingLandWords(
      p,
      province[cell]!,
      peoplingFront(p, clock.through),
      stepWhen,
    );
    peoplingCounted = played + 4;
  };

  const dropActs = () =>
    (Object.keys(DROP_ACT_WORDS) as DropAct[]).map((a) => {
      const [icon, words] = DROP_ACT_WORDS[a];
      return actButton(icon, words, `${words}: the drop of the first seas`, () => touch(a));
    });

  const STAGES: Readonly<
    Record<
      GenesisStage,
      {
        readonly title: string;
        readonly text: () => string;
        readonly enter: () => void;
        readonly update: (k: number) => void;
        readonly acts?: () => HTMLElement[];
      }
    >
  > = {
    galaxy: {
      title: "The galaxy is born",
      text: () =>
        `Some thirteen billion years ago a cloud of gas began to turn. Its middle fell together first, a swarm of old stars; its arms, turning, lit with young ones, one after another — a disk ${Math.round((galaxy.radius * 2) / 1000)} thousand light-years across. Out on an arm, ${Math.hypot(homeOf(galaxy).x, homeOf(galaxy).z).toFixed(0)} thousand light-years from the middle, a star would light.`,
      enter: () => {
        stage.backdrop("space");
        galaxyScene.visible = true;
        rig.configure({
          distance: R * 2.6,
          minDistance: 2,
          maxDistance: R * 6,
          pitch: -50,
          target: [0, 0, 0],
          drift: 3,
        });
      },
      update: (k) => galaxyScene.emerge(Math.min(1, k * 1.15)),
    },
    star: {
      title: "A star, and its worlds",
      text: () =>
        `A ${system.star.spectral} star, ${system.star.ageGyr.toFixed(1)} billion years old, ${system.star.luminosity.toFixed(2)} times the Sun's light. About it, ${system.bodies.filter((b) => b.around < 0).length} worlds: rock inside its frost line, ${system.frostLine.toFixed(1)} times as far as Earth from the Sun; ice and gas beyond. One of them held water, and would hold life.`,
      enter: () => {
        stage.backdrop("space");
        skyScene.visible = true;
        rig.configure({
          distance: 60,
          minDistance: 2,
          maxDistance: 400,
          pitch: -60,
          target: [0, 0, 0],
          drift: 2,
        });
      },
      update: () => skyScene.update(systemSpec(system, played * 20 * 86_400 * 30)),
    },
    forming: {
      title: "The world forms",
      text: () =>
        `The world — ${home.mass.toFixed(2)} of Earth's weight, ${home.a.toFixed(2)} times Earth's distance from its star — formed hot: its rock molten and glowing. As it cooled a dark crust closed over it, the fire showing in its cracks; and the rain of ages filled its low ground with seas, where life would begin.`,
      enter: () => {
        stage.backdrop("space");
        globe.visible = true;
        globe.features(false, true, false);
        paintedAt = -1;
        rig.configure({
          distance: 3.4,
          minDistance: 1.4,
          maxDistance: 12,
          pitch: -15,
          target: [0, 0, 0],
          drift: 6,
        });
      },
      // (Its seas risen by the end; its land greens only once life comes ashore, in the ages.)
      update: (k) => paint(formingColors(elevation, land, 0.72 * k, played)),
    },
    "first cells": dropStage("first cells"),
    nucleus: dropStage("nucleus"),
    colonies: dropStage("colonies"),
    bodies: {
      title: DAWN_WORDS.bodies[0],
      text: () => DAWN_WORDS.bodies[1],
      enter: () => {
        stage.backdrop("space");
        document.body.dataset.scale = "micro";
        micro.visible = true;
        rig.configure({
          distance: 8.5,
          minDistance: 3,
          maxDistance: 30,
          pitch: -20,
          target: [0, 0, 0],
          drift: 1.5,
        });
      },
      update: () => micro.update(dropOf("bodies", played)),
    },
    ages: {
      title: "The living world",
      text: () =>
        `${beasts.length} lineages of beasts in all, each a body of its own — of its niche, its world's pull and air, the climate it arose in — some living yet, some gone in the great deaths. Green an age's land or parch it, hearten its hunters or shelter the hunted, and tap a beast to follow its line: what fares best under your hand, the ages after run to. Or lay your hand on the age itself — warm it, cool it, wake its fires, strike it from the sky or calm it — and the world is remade from it.`,
      enter: () => {
        ageShown = -1;
        if (lookAtWorld) {
          stage.backdrop("space");
          globe.visible = true;
          globe.features(true, true, false);
          paintedAt = -1;
          rig.configure({
            distance: 3.4,
            minDistance: 1.4,
            maxDistance: 12,
            pitch: -15,
            target: [0, 0, 0],
            drift: 6,
          });
          return;
        }
        stage.backdrop("ground", 40);
        meadowScene.visible = true;
        rig.configure({
          distance: 13,
          minDistance: 3,
          maxDistance: 30,
          pitch: -30,
          target: [0, 0.2, 0],
          drift: 1.5,
        });
      },
      update: () => {
        const { age, within } = ageAt(plan, clock.my),
          a = plan.ages[age];
        if (!a) return;
        syncMeadow(age);
        if (age !== ageShown) {
          ageShown = age;
          title.textContent = `The living world: age ${a.index + 1} of ${plan.ages.length}`;
          const born = beastWords(a.index);
          text.textContent = `${ageWords(a)}.${born ? ` ${born[0]!.toUpperCase()}${born.slice(1)}.` : ""}`;
        }
        if (lookAtWorld) paint(ageColors(land, grid.lat, elevation, a.kind, within, a.index + 1));
        else if (meadow) meadowScene.update(meadow, bodies);
        countMeadow();
      },
      acts: ageActs,
    },
    people: {
      title: "The first people",
      text: () =>
        plan.people
          ? `And then, in ${plan.people.cradle}, the ${plan.people.name} rose to thought — ${plan.people.words}; ${plan.people.because}.`
          : "On this world no lineage rose to thought: its life goes on, watched by no one of its own.",
      enter: () => {
        stage.backdrop("ground", 20);
        parade.visible = true;
        rig.configure({
          distance: 7.5,
          minDistance: 3,
          maxDistance: 30,
          pitch: -18,
          target: [0.9, 0.4, -0.6],
          drift: 0,
        });
      },
      update: () => {
        const p = paradeOf(plan, 1);
        parade.update(
          p.on.map((q) => ({ ...q, lineage: beasts.indexOf(plan.lineages[q.lineage]!) })),
          played,
        );
        // (Along the watcher's own line of sight, toward them, from among the beasts.)
        const toward = (rig.yaw * Math.PI) / 180,
          d = -10 + Math.min(1, played / 4) * 30;
        parade.placePeople(
          9 + Math.sin(toward) * d,
          -6 + Math.cos(toward) * d,
          Math.atan2(Math.sin(toward), Math.cos(toward)),
          played,
        );
      },
    },
    peopling: {
      title: "The peopling",
      text: () =>
        plan.people && plan.peopling
          ? `From ${plan.people.cradle} the ${plan.people.name}${plan.people.name.endsWith("s") ? "'" : "'s"} bands went out over the land, a few days' walk in a lifetime — land after land, and as they went their speech grew apart, into the families of tongues the chronicle opens with, each land here the colour of its family. Tap a land to ask who came to it; lower the seas for them to walk over the straits, give them a kind age or a hard one, or bid them rise elsewhere.`
          : "No one's bands went out over this world: its land waits, unpeopled.",
      enter: () => {
        freshPeopling();
        // (A fresh band each time the stage is come to: the meadow drawn may have been another's.)
        band = null;
        showPeopling();
      },
      update: (k) => {
        const p = plan.peopling;
        if (lookAtBand) {
          // A band seen near: the land and its beasts, the band, the hour of their day.
          if (band && bandLand) {
            meadowScene.update(bandLand, bodies);
            bandLayer.update(band, bandTime);
            stage.daylight(bandHour(band) / 24);
            if (bandCounted < 0 || bandTime - bandCounted >= 0.25) {
              bandCounted = bandTime;
              counts.textContent = bandWords(band);
            }
          }
          return;
        }
        if (!p) return;
        const front = peoplingFront(p, k);
        // (Back to the stage's beginning: told again from it.)
        if (front < frontTold) {
          frontTold = -1;
          peoplingTold = false;
        }
        // (The cradle's tongue and the great families told as they are come to; the small, named on asking.)
        for (const f of familiesReached(p, frontTold, front))
          if (f === 0 || labelled.some((x) => x.family === f))
            tell(familyWords(p, f, deepWhen(clock.my)));
        frontTold = front;
        if (!peoplingTold && peoplingReached(p, front).lands === p.lands.length) {
          peoplingTold = true;
          tell(peoplingDoneWords(p));
        }
        // (Painted as the front goes on a tenth of a step, as often as the globe may be.)
        const tenth = Math.floor(front * 10) / 10;
        if (tenth !== frontShown && (paintedAt < 0 || played - paintedAt >= 0.1)) {
          frontShown = tenth;
          paint(peoplingColors(land, province, p, front, elevation));
        }
        followFront(p, front);
        placeLabels(p, front);
        countPeopling(p, front);
      },
      acts: peoplingActs,
    },
  };

  /** A stage of the dawn watched in the drop of the first seas, alive. */
  function dropStage(d: "first cells" | "nucleus" | "colonies"): (typeof STAGES)["galaxy"] {
    return {
      title: DAWN_WORDS[d][0],
      text: () =>
        `${DAWN_WORDS[d][1]} ${d === "first cells" ? "Feed the drop, shade it, warm it or stir it, and tap a cell to follow its line: what prospers under your hand will shape the life that comes of it." : ""}`.trim(),
      enter: () => {
        stage.backdrop("space");
        document.body.dataset.scale = "micro";
        micro.visible = true;
        if (!drop) freshDrop();
        rig.yaw = 0;
        rig.configure({
          distance: 13,
          minDistance: 3,
          maxDistance: 30,
          pitch: -10,
          target: [0, 0, 0],
          drift: 0,
        });
      },
      update: () => {
        if (!drop) return micro.update(dropOf(d, played));
        micro.living(roundDrop(drop, chosen), colors);
        countDrop();
      },
      acts: block ? dropActs : undefined,
    };
  }

  // —— Going from stage to stage ——————————————————————————————————————————————————————
  let shown = -1,
    done = false;
  const enter = (i: number) => {
    const going = i > shown && shown >= 0;
    // (Leaving the dawn forward: what the hand made prosper there is laid on the world.)
    if (going && !DROP_STAGES.has(spans[i]!.stage) && DROP_STAGES.has(spans[shown]!.stage))
      settleDawn();
    // (Back into the dawn: a fresh drop.)
    if (DROP_STAGES.has(spans[i]!.stage) && (i < shown || !drop)) freshDrop();
    // (Leaving the ages forward: what fared best in the last age's living world, laid on the world.)
    if (going && spans[shown]!.stage === "ages") settleAge();
    shown = i;
    played = 0;
    paintedAt = -1;
    choosingCradle = false;
    // (The band's hold on the deep clock, and the eye kept on it, let go with its stage; the band
    // not drawn on another stage's meadow.)
    clock.release("band");
    rig.follow = null;
    bandLayer.root.enabled = false;
    const st = STAGES[spans[i]!.stage];
    hideAll();
    delete document.body.dataset.scale;
    // (The pitch's limits each stage's own: a globe seen from below as from above only in the peopling.)
    rig.configure({ minPitch: -85, maxPitch: -8 });
    st.enter();
    step.textContent = `${i + 1} of ${spans.length}`;
    title.textContent = st.title;
    text.textContent = st.text();
    acts.replaceChildren(...(st.acts?.() ?? []));
    acts.hidden = !st.acts;
    counts.textContent = "";
    counts.hidden =
      !DROP_STAGES.has(spans[i]!.stage) &&
      spans[i]!.stage !== "ages" &&
      spans[i]!.stage !== "peopling";
    another.hidden = i > 1;
    back.hidden = i === 0;
    tap = DROP_STAGES.has(spans[i]!.stage)
      ? (x, y) => {
          if (!drop) return;
          const k = micro.pick(x, y, drop.cells.map(roundOf));
          chosen = k >= 0 ? drop.cells[k]!.id : null;
          follow(drop, chosen);
          countedAt = -1;
        }
      : spans[i]!.stage === "ages"
        ? (x, y) => {
            // A beast tapped, followed with its line.
            if (!meadow || lookAtWorld) return;
            followBeast(meadow, meadowScene.pick(meadow, x, y));
            meadowCounted = -1;
          }
        : spans[i]!.stage === "peopling"
          ? tapPeopling
          : () => {};
    drawSpeeds();
  };
  const choose = () => {
    if (done) return;
    done = true;
    step.textContent = "";
    acts.replaceChildren();
    counts.textContent = "";
    title.textContent = "Where to begin";
    text.textContent = plan.people
      ? `Begin with the ${plan.people.name} wherever you will; history runs on from there, and every why can be asked.`
      : "Begin where you will; the world runs on from there.";
    row.replaceChildren(
      ...BEGINNINGS.map(([label, note, year]) => {
        const b = el("button", "choice", label),
          small = el("small", undefined, note);
        b.append(small);
        b.onclick = () => void pending.then(() => o.beginAt(year, seed));
        return b;
      }),
    );
  };
  next.onclick = () => {
    clock.jump(clock.at + 1);
    if (clock.done) {
      settleDawn();
      choose();
    }
  };
  back.onclick = () => clock.jump(Math.max(0, clock.at - (clock.through < 0.05 ? 1 : 0)));
  skip.onclick = () => {
    clock.jump(spans.length);
    settleDawn();
    choose();
  };

  // Space pauses and lets go; the numbers choose a speed; the arrows go on and back.
  addEventListener("keydown", (e) => {
    if (done || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
    if (e.key === " ") {
      e.preventDefault();
      clock.toggle();
      drawSpeeds();
    } else if (/^[0-9]$/.test(e.key)) {
      if (clock.pick(Number(e.key))) drawSpeeds();
    } else if (e.key === "ArrowRight") next.click();
    else if (e.key === "ArrowLeft") back.click();
  });

  let last = performance.now(),
    whenShown = "";
  stage.onUpdate(() => {
    const now = performance.now(),
      dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (done) return;
    const before = clock.my;
    clock.run(dt);
    if (!clock.stopped) played += dt;
    for (const r of rungsPassed(plan, before, clock.my))
      tell(`${deepWhen(r.at)}: ${r.name} — ${r.words}.`);
    if (clock.at !== shown) enter(clock.at);
    if (DROP_STAGES.has(spans[shown]!.stage)) stepDrops(dt);
    if (spans[shown]!.stage === "ages") stepMeadows(dt);
    if (watchingBand()) stepBands(dt);
    STAGES[spans[shown]!.stage].update(clock.through);
    const w = `${deepWhen(clock.my)}${watchingBand() ? ` · a band, day ${(band?.day ?? 0) + 1}${clock.paused ? " · paused" : ""}` : clock.stopped ? " · paused" : ""}`;
    if (w !== whenShown) {
      whenShown = w;
      when.textContent = w;
      drawSpeeds();
    }
    if (clock.done) {
      settleDawn();
      choose();
    }
  });
  enter(0);

  o.expose?.({
    genesis: () => ({
      stage: spans[clock.at]!.stage,
      stages: GENESIS.length,
      my: clock.my,
      paused: clock.stopped,
      speed: clock.speed,
      seed,
      acts: plan.acts,
      ages: plan.ages.map((a) => a.kind),
      lineages: plan.lineages.length,
      died: plan.lineages.map((l) => l.died),
      people: plan.people?.name ?? null,
      cells: drop
        ? Object.fromEntries(
            [...new Set((drop as DropState).cells.map((c) => c.way))].map((w) => [
              w,
              (drop as DropState).cells.filter((c) => c.way === w).length,
            ]),
          )
        : null,
      born: drop ? (drop as DropState).born : 0,
      motes: drop ? (drop as DropState).motes.length : 0,
      chosen,
      choosing: done,
      // An age's living world (Phase 27): its age, its beasts by lineage, its lives, the one followed.
      meadow: meadow
        ? {
            age: (meadow as MeadowState).age,
            beasts: (meadow as MeadowState).beasts.length,
            kinds: Object.fromEntries(
              (meadow as MeadowState).kinds.map((k, i) => [
                k.name,
                (meadow as MeadowState).beasts.filter((b) => b.kind === i).length,
              ]),
            ),
            born: (meadow as MeadowState).born,
            died: (meadow as MeadowState).died,
            taken: (meadow as MeadowState).taken,
            grass:
              (meadow as MeadowState).grass.reduce((x, y) => x + y, 0) /
              (meadow as MeadowState).grass.length,
            chosen: (meadow as MeadowState).chosen,
            parts: meadowScene.count(),
            touched: meadowTouched,
            // (What would be said to have fared best, were the age to end now.)
            verdict: meadowTwin
              ? meadowProspered(meadow as MeadowState, meadowTwin as MeadowState)
              : null,
            first: (meadow as MeadowState).beasts[0]
              ? {
                  id: (meadow as MeadowState).beasts[0]!.id,
                  x: (meadow as MeadowState).beasts[0]!.x,
                  z: (meadow as MeadowState).beasts[0]!.z,
                }
              : null,
          }
        : null,
    }),
    /** Where a beast of the living world is on the screen (the look tools). */
    meadowSpot: (id: number) => (meadow ? meadowScene.onScreen(meadow, id) : null),
    // The peopling (Phase 28): how far the bands have come, what the hand has laid on it.
    peopling: () => {
      const p = plan.peopling;
      if (!p) return null;
      const front = peoplingFront(p, spans[clock.at]!.stage === "peopling" ? clock.through : 1);
      return {
        front,
        reached: peoplingReached(p, front),
        all: peoplingReached(p, Infinity),
        livable: p.livable,
        cradle: p.cradle,
        families: p.families.map((f) => f.name),
        labels: labelled.filter((x) => !x.el.hidden).length,
        choosing: choosingCradle,
        acts: plan.acts.peopling,
        painted: frontShown,
        own: eyeOwn,
        yaw: rig.yaw,
        pitch: rig.pitch,
        counts: counts.textContent,
      };
    },
    /** A band watched near (Phase 28 M158): its people at what they are at, its day, its store, its camps and kills. */
    band: () =>
      band
        ? {
            watching: watchingBand(),
            people: (band as BandState).people.length,
            doing: Object.fromEntries(
              [...new Set((band as BandState).people.map((q) => q.doing))].map((d) => [
                d,
                (band as BandState).people.filter((q) => q.doing === d).length,
              ]),
            ),
            hour: bandHour(band as BandState),
            day: (band as BandState).day,
            food: (band as BandState).food,
            hunts: (band as BandState).hunts,
            kills: (band as BandState).kills,
            camps: (band as BandState).camps,
            gathered: (band as BandState).gathered,
            camp: (band as BandState).camp,
            going: (band as BandState).going !== null,
            first: { x: (band as BandState).people[0]!.x, z: (band as BandState).people[0]!.z },
            beasts: bandLand ? (bandLand as MeadowState).beasts.length : 0,
            parts: bandLayer.count(),
            counts: counts.textContent,
          }
        : null,
    /** Cells of the globe facing the eye, on the screen, where a people could rise or not (the look tools). */
    globeSpots: (fit: boolean, many = 8) => {
      const out: { cell: number; x: number; y: number }[] = [];
      for (let c = 0; c < province.length && out.length < many; c += 7) {
        // (Its neighbours alike, so a tap a little off it falls on the same kind of ground.)
        let alike = fitCradle(c) === fit;
        for (let j = grid.offsets[c]!; alike && j < grid.offsets[c + 1]!; j++)
          alike = fitCradle(grid.neighbours[j]!) === fit;
        if (!alike) continue;
        const [spot] = globe.screenOf([{ x: P[c * 3]!, y: P[c * 3 + 1]!, z: P[c * 3 + 2]! }], 1.01);
        if (spot && spot.facing > 0.6 && document.elementFromPoint(spot.x, spot.y) === o.canvas)
          out.push({ cell: c, x: spot.x, y: spot.y });
      }
      return out;
    },
    /** The beginning's eye (the look tools). */
    rig,
  });
}
