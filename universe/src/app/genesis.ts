// The genesis (Phase 9 M89): a way to begin. The galaxy born from a turning cloud; a star
// and its worlds, and the world chosen (this one, or one never seen); the world forming —
// molten, cooling, its seas rising, its land greening — and marked by each of its deep ages;
// the dawn of life under the microscope, from the first cells to the first bodies; the
// living world arising age by age from its own lineages' bodies; the first people; and then
// where to begin. Each stage told, played on the screen's clock, the viewer free to turn about
// it, to go on, or to skip to the choice. Everything shown is the world's own generation.
import type { GalaxyPlan, GenesisPlan, HostClient, SystemPlan } from "../bridge/index.ts";
import {
  GalaxyScene,
  GlobeScene,
  MicroScene,
  OrbitRig,
  ParadeScene,
  SystemScene,
  type DeviceTier,
  type Stage,
} from "../render/index.ts";
import {
  DAWN,
  DAWN_WORDS,
  ageColors,
  ageWords,
  biomeColor,
  dropOf,
  figureOf,
  formingColors,
  globeColors,
  homeOf,
  paradeOf,
  systemSpec,
  type Dawn,
} from "../view/index.ts";

/** A stage of the genesis: its title and words, how long it plays, and what it shows. */
type Part = {
  readonly title: string;
  readonly text: () => string;
  readonly seconds: number;
  readonly enter: () => void;
  readonly update: (s: number) => void;
};

/** Where one may begin: the years, and what the world will be doing then. */
const BEGINNINGS: readonly (readonly [string, string, number])[] = [
  ["At the first people", "watch them from their first year", 0],
  ["Their first fields", "a generation or so on, as the first of them sow", 30],
  ["Three centuries on", "realms, writing, the first metal", 300],
  ["Seven centuries on", "iron and coal, the first engines", 700],
  ["Among the stars", "a world reaching for its sky", 1150],
];

export async function runGenesis(o: {
  stage: Stage;
  hud: HTMLElement;
  canvas: HTMLCanvasElement;
  client: HostClient;
  tier: DeviceTier;
  universe: string;
  seed: string;
  /** Where the world's own page is, for a year (to begin there). */
  beginAt: (year: number) => void;
  /** Another world never seen, from its beginning. */
  another: () => void;
}): Promise<void> {
  const { stage, hud, client } = o;
  const [galaxy, system, plan] = await Promise.all([
    client.query<GalaxyPlan>({ type: "galaxy.plan" }),
    client.query<SystemPlan>({ type: "planet.system" }),
    client.query<GenesisPlan>({ type: "genesis" }),
  ]);
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
    land = globeColors(frame, "terrain");

  const galaxyScene = new GalaxyScene(stage),
    skyScene = new SystemScene(stage),
    globe = new GlobeScene(stage),
    micro = new MicroScene(stage),
    parade = new ParadeScene(stage),
    rig = new OrbitRig(stage, o.canvas, {
      distance: 200,
      minDistance: 0.5,
      maxDistance: 2000,
      pitch: -45,
      drift: 3,
      onTap: () => {},
    });
  galaxyScene.build(galaxy, o.tier.name === "phone" ? 8000 : 16000);
  galaxyScene.visible = false;
  skyScene.build(system);
  skyScene.visible = false;
  globe.build(frequency, elevation);
  globe.visible = false;
  const detail = o.tier.name === "phone" ? 1 : 2,
    beasts = plan.lineages.filter((l) => l.body);
  // (The stage's ground the green of the land the first people came to know.)
  parade.set(beasts, detail, biomeColor(8));
  parade.people(plan.people ? figureOf(plan.people.figure, detail) : null);

  // The words over the scene: a card at the foot, the stage's title and telling, and ways on.
  const card = document.createElement("div"),
    step = document.createElement("div"),
    title = document.createElement("h2"),
    text = document.createElement("p"),
    row = document.createElement("div"),
    skip = document.createElement("button"),
    next = document.createElement("button");
  card.className = "genesis";
  step.className = "genesis-step";
  row.className = "genesis-row";
  skip.className = "link";
  skip.textContent = "Skip to where to begin";
  next.textContent = "Next ›";
  row.append(skip, next);
  card.append(step, title, text, row);
  hud.append(card);

  const hideAll = () => {
    galaxyScene.visible = false;
    skyScene.visible = false;
    globe.visible = false;
    micro.visible = false;
    parade.visible = false;
  };
  const home = system.bodies.find((b) => b.kind === "home") ?? system.bodies[0]!,
    ages = plan.ages,
    R = galaxy.radius / 1000,
    beastWords = (age: number) =>
      beasts
        .filter((l) => l.arose === age)
        .slice(0, 2)
        .map((l) => `the ${l.name} arose — ${l.words}`)
        .join("; ");
  let paintedAt = -1;
  const paint = (colors: Uint8Array, now: number) => {
    // (A tenth of a second between paints: the globe's cells are many.)
    if (now - paintedAt < 0.1) return;
    paintedAt = now;
    globe.paint(colors);
  };

  const dawn = (d: Dawn): Part => ({
    title: DAWN_WORDS[d][0],
    text: () => DAWN_WORDS[d][1],
    seconds: 10,
    enter: () => {
      hideAll();
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
    update: (s) => micro.update(dropOf(d, s)),
  });

  const parts: Part[] = [
    {
      title: "The galaxy is born",
      text: () =>
        `Some thirteen billion years ago a cloud of gas began to turn. Its middle fell together first, a swarm of old stars; its arms, turning, lit with young ones, one after another — a disk ${Math.round((galaxy.radius * 2) / 1000)} thousand light-years across. Out on an arm, ${Math.hypot(homeOf(galaxy).x, homeOf(galaxy).z).toFixed(0)} thousand light-years from the middle, a star would light.`,
      seconds: 14,
      enter: () => {
        hideAll();
        stage.backdrop("space");
        galaxyScene.visible = true;
        galaxyScene.emerge(0);
        rig.configure({
          distance: R * 2.6,
          minDistance: 2,
          maxDistance: R * 6,
          pitch: -50,
          target: [0, 0, 0],
          drift: 3,
        });
      },
      update: (s) => galaxyScene.emerge(Math.min(1, s / 11)),
    },
    {
      title: "A star, and its worlds",
      text: () =>
        `A ${system.star.spectral} star, ${system.star.ageGyr.toFixed(1)} billion years old, ${system.star.luminosity.toFixed(2)} times the Sun's light. About it, ${system.bodies.filter((b) => b.around < 0).length} worlds: rock inside its frost line, ${system.frostLine.toFixed(1)} times as far as Earth from the Sun; ice and gas beyond. One of them held water, and would hold life.`,
      seconds: 11,
      enter: () => {
        hideAll();
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
      update: (s) => skyScene.update(systemSpec(system, s * 20 * 86_400 * 30)),
    },
    {
      title: "The world forms",
      text: () =>
        `The world — ${home.mass.toFixed(2)} of Earth's weight, ${home.a.toFixed(2)} times Earth's distance from its star — formed hot: its rock molten and glowing. As it cooled a dark crust closed over it, the fire showing in its cracks; the rain of ages filled its low ground with seas; and its land, where the rains fell, greened.`,
      seconds: 16,
      enter: () => {
        hideAll();
        stage.backdrop("space");
        globe.visible = true;
        globe.features(false, true, false);
        rig.configure({
          distance: 3.4,
          minDistance: 1.4,
          maxDistance: 12,
          pitch: -15,
          target: [0, 0, 0],
          drift: 6,
        });
      },
      update: (s) => {
        const k = Math.min(1, s / 13);
        paint(formingColors(elevation, land, k, s), s);
        if (k >= 1) globe.features(true, true, false);
      },
    },
    {
      title: "Its deep ages",
      text: () =>
        ages
          .map((a) => ageWords(a))
          .slice(-4)
          .join(". ") + ".",
      seconds: Math.max(8, ages.length * 1.6),
      enter: () => {
        hideAll();
        stage.backdrop("space");
        globe.visible = true;
        globe.features(true, true, false);
        paintedAt = -1;
      },
      update: (s) => {
        const at = Math.min(ages.length - 1e-6, s / 1.6),
          a = ages[Math.floor(at)]!;
        title.textContent = `Its deep ages: ${a.index + 1} of ${ages.length}`;
        text.textContent = `${ageWords(a)}.${beastWords(a.index) ? ` In it ${beastWords(a.index)}.` : ""}`;
        paint(ageColors(land, grid.lat, elevation, a.kind, at - Math.floor(at), a.index + 1), s);
      },
    },
    ...DAWN.map(dawn),
    {
      title: "The living world",
      text: () =>
        `${beasts.length} lineages of beasts in all, each a body of its own — of its niche, its world's pull and air, the climate it arose in — some living yet, some gone in the great deaths.`,
      seconds: Math.max(12, ages.length * 2),
      enter: () => {
        hideAll();
        stage.backdrop("ground", 20);
        parade.visible = true;
        rig.configure({
          distance: 7.5,
          minDistance: 3,
          maxDistance: 30,
          pitch: -18,
          target: [0.9, 0.4, -0.6],
          drift: 2,
        });
      },
      update: (s) => {
        const t = Math.min(1, s / Math.max(12, ages.length * 2)),
          p = paradeOf(plan, t);
        parade.update(
          p.on.map((q) => ({ ...q, lineage: beasts.indexOf(plan.lineages[q.lineage]!) })),
          s,
        );
        const a = ages[p.age];
        if (a) {
          title.textContent = `The living world: age ${a.index + 1} of ${ages.length}`;
          const born = beastWords(a.index);
          text.textContent = `${ageWords(a)}.${born ? ` ${born[0]!.toUpperCase()}${born.slice(1)}.` : ""}`;
        }
      },
    },
    {
      title: "The first people",
      text: () =>
        plan.people
          ? `And then, in ${plan.people.cradle}, the ${plan.people.name} rose to thought — ${plan.people.words}; ${plan.people.because}.`
          : "On this world no lineage rose to thought: its life goes on, watched by no one of its own.",
      seconds: 12,
      enter: () => {
        hideAll();
        stage.backdrop("ground", 20);
        parade.visible = true;
        rig.configure({ drift: 0 });
      },
      update: (s) => {
        const p = paradeOf(plan, 1);
        parade.update(
          p.on.map((q) => ({ ...q, lineage: beasts.indexOf(plan.lineages[q.lineage]!) })),
          s,
        );
        // (Along the watcher's own line of sight, toward them, from among the beasts.)
        const toward = (rig.yaw * Math.PI) / 180,
          d = -10 + Math.min(1, s / 4) * 30;
        parade.placePeople(
          9 + Math.sin(toward) * d,
          -6 + Math.cos(toward) * d,
          Math.atan2(Math.sin(toward), Math.cos(toward)),
          s,
        );
      },
    },
  ];

  // The runner: each stage for its while, then the next; the viewer may go on, or skip.
  let at = -1,
    started = 0,
    done = false;
  const go = (i: number) => {
    at = i;
    started = performance.now();
    if (i >= parts.length) return choose();
    const part = parts[i]!;
    step.textContent = `${i + 1} of ${parts.length}`;
    title.textContent = part.title;
    text.textContent = part.text();
    part.enter();
  };
  const choose = () => {
    done = true;
    step.textContent = "";
    title.textContent = "Where to begin";
    text.textContent = plan.people
      ? `Begin with the ${plan.people.name} wherever you will; history runs on from there, and every why can be asked.`
      : "Begin where you will; the world runs on from there.";
    row.replaceChildren(
      ...BEGINNINGS.map(([label, note, year]) => {
        const b = document.createElement("button"),
          small = document.createElement("small");
        b.className = "choice";
        b.textContent = label;
        small.textContent = note;
        b.append(small);
        b.onclick = () => o.beginAt(year);
        return b;
      }),
    );
  };
  next.onclick = () => go(at + 1);
  skip.onclick = () => go(parts.length);
  // (On the star's stage: another world, never seen, from its beginning.)
  const another = document.createElement("button");
  another.className = "link";
  another.textContent = "A world never seen ↻";
  another.onclick = () => o.another();
  row.prepend(another);
  stage.onUpdate(() => {
    if (done || at < 0) return;
    const s = (performance.now() - started) / 1000,
      part = parts[at]!;
    part.update(s);
    another.hidden = at > 1;
    if (s > part.seconds) go(at + 1);
  });
  go(0);
}
