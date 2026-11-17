// A realm's music, the taste of its food and its customs (asked 2026-11-16: "tell me what their music sounds like and food taste like
// and customs etc"): each a reading of what the world keeps of the realm (./lifeways.ts) and of its people's body and world, never a
// draw and never flavour of its own. Its music is heard in its first sense, played on what its land makes, measured or wild as its
// ways are, mourning as its years were; its food tastes of how it is kept and of what its world's life is made of; each custom says
// in a line what it is read from, and opens the page it is read from. A reading with nothing behind it in this realm is left out.
import { YEAR, type World } from "../../kernel/index.ts";
import type { Block, Line, MusicVoice, Span, Stat } from "../../bridge/index.ts";
import { worldLife } from "../../gen/index.ts";
import { G, PAIRING_WORDS, WAY, findSubstance, pairingOf, type Sense } from "../../rules/index.ts";
import {
  DEITIES,
  cropReading,
  exchangeReading,
  fieldedParts,
  homePlanet,
  loreOf,
  marketsOf,
  populationContext,
  woodsRead,
  type Polity,
} from "../../sim/index.ts";
import { firstSense, lifeOf, type Life } from "./lifeways.ts";
import { memoryOf, songFor, songRef } from "./memory.ts";
import { gamesPlayed, workDays } from "./theirlife.ts";
import { faithLink, landLink } from "./names.ts";
import { count, link, part, sentence, stat } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`;

/** A row with its plain "why" opened under it: what it is read from, the source a link. */
function why(label: string, value: Line | string, because: Line): Stat {
  return { ...stat(label, value), parts: [part(["Read from ", ...because], "")] };
}

/** A people's ways, or the middle where none is kept. */
function waysOf(l: Life): readonly number[] {
  return l.ways ?? [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
}

// —— Their music ——————————————————————————————————————————————————————————————————————————————————

/** What a people's music is, in the sense it is made for. */
const MEDIUM: Readonly<Record<Sense, string>> = {
  hearing: "sound: song above all, for they hear before they see",
  sight: "patterns of light and colour moved in time, for they see before all else",
  smell:
    "scent let go in sequence, one note of smell after another, for they smell before they see",
  echo: "calls thrown at walls built to answer them, heard in the echo",
  electric: "pulses of current played through the water and felt along the body",
};

/** What the music of a people that hears, though another sense comes first, is: sound, beside the art of its first sense. */
const HEARD_TOO: Readonly<Record<Sense, string>> = {
  hearing: MEDIUM.hearing,
  sight: "sound, as they hear it, though their first art is for the eye",
  smell: "sound, as they hear it, though their first art is scent",
  echo: MEDIUM.echo,
  electric: "sound, as they hear it, though their first art is the current",
};

/** Whether a people's music is heard (and so could be played aloud). */
export function heardMusic(world: World): boolean {
  const senses = homePlanet(world).generated.life.people?.body.senses ?? ["sight", "hearing"];
  return senses.includes("hearing") || senses[0] === "echo";
}

/** What a realm's music is read from: its parts, each with what it is read from. */
export type Music = {
  readonly heard: boolean;
  readonly medium: string;
  readonly instruments: readonly { readonly what: string; readonly from: Line }[];
  /** 0 slow and measured … 1 fast and loud. */
  readonly pace: number;
  readonly feel: string;
  readonly feelFrom: Line;
  readonly moods: readonly { readonly what: string; readonly from: Line }[];
  readonly where: readonly { readonly what: string; readonly from: Line }[];
};

/** A realm's music, read (null: nothing kept of its people). */
export function musicOf(world: World, r: Polity): Music | null {
  const l = lifeOf(world, r);
  if (!l.people) return null;
  const ctx = populationContext(world),
    sense = firstSense(world),
    heard = heardMusic(world),
    water = ctx.medium === "water",
    seat = r.seat,
    m = marketsOf(world).get(seat),
    lore = world.hasStore("lore.known") ? loreOf(world) : null,
    knows = (id: string) => !!lore?.get(seat, id),
    seatLink = landLink(world, seat, true),
    instruments: { what: string; from: Line }[] = [];
  if (heard) {
    const woods = water ? 0 : woodsRead(ctx, seat).now;
    if (woods >= 0.1)
      instruments.push({
        what: "flutes and drums of wood",
        from: [`the woods of `, seatLink, ` (${pc(woods)} wooded)`],
      });
    if ((m?.book("made", G.hides) ?? 0) >= 1)
      instruments.push({
        what: "drums of stretched hide",
        from: ["the hides ", seatLink, " makes"],
      });
    const x = world.hasStore("life.exchange") ? exchangeReading(world, ctx, seat) : null;
    if (x?.beast)
      instruments.push({
        what: `horns of the ${x.beast.name}`,
        from: ["the herds of ", link(x.beast.name, x.beast.ref), " they keep"],
      });
    if (knows("loom"))
      instruments.push({ what: "strings of twisted fibre", from: ["the loom their seat knows"] });
    const metal = m?.toolMetalIn() ?? null;
    if (metal && metal !== "stone")
      instruments.push({
        what:
          metal === "copper"
            ? "copper bells"
            : metal === "bronze"
              ? "bronze gongs and horns"
              : `${metal} bells`,
        from: [`the ${metal} their smiths head tools with`],
      });
    if (knows("glass"))
      instruments.push({ what: "glass chimes", from: ["the glass their seat knows"] });
    if (knows("electricity"))
      instruments.push({
        what: "instruments played by current",
        from: ["the electricity their seat knows"],
      });
  }
  // (Measured where custom and rank are held, fast and loud where the new and valour are.)
  const w = waysOf(l),
    measured = (w[WAY.tradition]! + w[WAY.hierarchy]!) / 2,
    lively = (w[WAY.openness]! + w[WAY.valour]!) / 2,
    pace = Math.max(0, Math.min(1, 0.5 + (lively - measured))),
    feel =
      measured - lively > 0.08
        ? "slow and measured, in set forms handed down"
        : lively - measured > 0.08
          ? "fast and loud"
          : "neither slow nor fast, between set forms and new ones",
    feelFrom: Line = [
      `their ways: custom ${pc(w[WAY.tradition]!)}, rank ${pc(w[WAY.hierarchy]!)}, openness ${pc(w[WAY.openness]!)}, valour ${pc(w[WAY.valour]!)}`,
    ],
    moods: { what: string; from: Line }[] = [];
  if (l.people > 0 && l.fallen / l.people >= 0.005)
    moods.push({
      what: "laments for their fallen",
      from: [`the ${count(l.fallen)} of theirs fallen in war these thirty years`],
    });
  if (l.leanest < 0.8)
    moods.push({
      what: "songs of the lean months",
      from: [`their seat fed ${pc(l.leanest)} in its leanest month`],
    });
  const where: { what: string; from: Line }[] = [];
  if (l.faith && (w[WAY.piety]! >= 0.55 || (l.art?.clergy ?? 0) >= 0.1))
    where.push({
      what: `at the temple, for ${DEITIES[l.faith.tenet]}`,
      from: [faithLink(world, l.faith.ref), `, and their piety ${pc(w[WAY.piety]!)}`],
    });
  if ((l.art?.court ?? 0) >= 0.1)
    where.push({
      what: "at the court of those who rule",
      from: [`those who rule keeping ${pc(l.art!.court)} of their makers`],
    });
  if (l.rest && l.rest.feasts >= 5)
    where.push({
      what: "at their feasts",
      from: [`their ${Math.round(l.rest.feasts)} feast days`],
    });
  const town = ctx.settlements.seenIn(seat).find((t) => t.name === r.town);
  if (town && town.population >= 2000)
    where.push({
      what: `in the streets of ${town.name}`,
      from: [`${town.name}, ${count(town.population)} strong`],
    });
  return {
    heard,
    medium: heard ? HEARD_TOO[sense] : MEDIUM[sense],
    instruments: instruments.slice(0, 4),
    pace,
    feel,
    feelFrom,
    moods,
    where,
  };
}

const listed = (xs: readonly string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? "");

/** Their music: what it is made in, what it is played on, how it moves, when and where (null: nothing kept). */
export function musicBlocks(world: World, r: Polity): Block[] {
  const mu = musicOf(world, r);
  if (!mu) return [];
  const words = [
    `${sentence(mu.feel)}${mu.instruments.length ? `, on ${listed(mu.instruments.map((i) => i.what))}` : ""}`,
    ...(mu.where.length ? [`played ${listed(mu.where.map((x) => x.what))}`] : []),
    ...(mu.moods.length ? [`with ${listed(mu.moods.map((x) => x.what))}`] : []),
  ];
  const each = (xs: readonly { what: string; from: Line }[]) =>
      xs.map((x) => part([sentence(x.what), ": from ", ...x.from], "")),
    rows: Stat[] = [why("Made in", mu.medium, ["their first sense"])];
  if (mu.instruments.length)
    rows.push({
      ...stat("Played on", sentence(listed(mu.instruments.map((i) => i.what)))),
      parts: each(mu.instruments),
    });
  rows.push(why("Its feel", mu.feel, mu.feelFrom));
  const when = [...mu.where, ...mu.moods];
  if (when.length)
    rows.push({
      ...stat("When", sentence(listed(when.map((x) => x.what)))),
      parts: each(when),
    });
  const deeds = [...(memoryOf(world).byRealm.get(r.ref) ?? [])].sort(
    (a, b) => b.worth - a.worth || b.year - a.year,
  );
  if (deeds[0]) {
    const s = songFor(world, deeds[0]);
    rows.push(stat("Their best-known song", [link(s.title, songRef(deeds[0])), `, ${s.form}`]));
  }
  return [
    { type: "text", title: "Their music", lines: [[`${words.join("; ")}.`]] },
    { type: "facts", rows },
    ...(mu.heard
      ? [
          {
            type: "tool" as const,
            tool: "culture.music",
            args: musicVoice(r, mu),
          },
        ]
      : []),
  ];
}

/** The numbers a realm's music is played by: read off its music, never drawn. */
export function musicVoice(r: Polity, mu: Music): MusicVoice {
  let seed = 0;
  for (const ch of r.ref) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const has = (s: string) => mu.instruments.some((i) => i.what.includes(s)),
    mourning = mu.moods.some((x) => x.what.startsWith("laments")),
    // (A people of measured music keeps the old five-note scale; a lively one the seven; mourning its minor.)
    scale = mourning
      ? [0, 2, 3, 5, 7, 8, 10]
      : mu.pace < 0.45
        ? [0, 2, 4, 7, 9]
        : [0, 2, 4, 5, 7, 9, 11];
  return {
    realm: r.ref,
    seed: seed >>> 0,
    tempo: Math.round(60 + 80 * mu.pace),
    scale,
    root: mourning ? 196 : 220,
    timbre:
      has("bell") || has("gong") || has("chime") || has("current")
        ? "metal"
        : has("strings")
          ? "string"
          : has("flute")
            ? "wood"
            : "voice",
    drums: has("drum") ? Math.max(1, Math.round(2 + 4 * mu.pace)) : 0,
    falling: mourning,
  };
}

// —— How their food tastes ——————————————————————————————————————————————————————————————————————————

/** How each means of keeping makes food taste. */
const KEPT_TASTE = {
  smoke: "smoky",
  salt: "salty",
  drying: "dry and chewy",
  frost: "kept cold through the winter",
  ferment: "sour",
  spice: "hot and fragrant",
} as const;
const KEPT_WHY = {
  smoke: "smoked over their woods' fires",
  salt: "salted from the sea at their coast",
  drying: "dried in warm, dry air",
  frost: "laid by in the frost",
  ferment: "fermented where they brew",
  spice: "cooked with what grows hot in a hot land",
} as const;

/** How their food tastes: of how they keep it, of their crop and herds, and of what their world's life is made of (null: none kept). */
export function tasteBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r);
  if (!l.table) return null;
  const t = l.table,
    ctx = populationContext(world),
    life = worldLife(ctx.generated),
    crop = world.hasStore("life.crops") ? cropReading(world, ctx, r.seat) : null,
    x = world.hasStore("life.exchange") ? exchangeReading(world, ctx, r.seat) : null,
    lore = world.hasStore("lore.known") ? loreOf(world) : null,
    tastes = (Object.keys(KEPT_TASTE) as (keyof typeof KEPT_TASTE)[])
      .filter((k) => t.means[k] >= 0.3)
      .sort((a, b) => t.means[b] - t.means[a]),
    rows: Stat[] = [],
    staple: Span = crop ? link(crop.name, crop.lineage) : "their grain",
    store = findSubstance(life.store)?.name ?? life.store,
    flesh = findSubstance(life.flesh)?.name ?? life.flesh;
  const words: Span[] = [];
  if (tastes.length) words.push(`${sentence(tastes.map((k) => KEPT_TASTE[k]).join(", "))} `);
  if (t.grain >= t.meat && t.grain >= t.wild)
    words.push(
      ...(tastes.length ? [] : ["Plain "]),
      ...(crop && crop.lineage === null
        ? [crop.name.startsWith("beds of ") ? `${crop.name.slice(8)} from their beds` : crop.name]
        : ["porridge and bread of ", staple]),
    );
  else if (t.meat >= t.wild)
    words.push(
      ...(tastes.length ? [] : ["Rich "]),
      "flesh",
      ...(x?.beast ? [" of the ", link(x.beast.name, x.beast.ref)] : []),
    );
  else
    words.push(
      ...(tastes.length ? [] : ["Fresh "]),
      "what they gather and hunt, eaten as it is found",
    );
  if (t.meat >= 0.1 && x?.beast && t.means.ferment >= 0.5)
    words.push("; sour fermented milk of the ", link(x.beast.name, x.beast.ref));
  if (t.means.ferment >= 0.5) words.push("; a strong brewed drink");
  if (!life.sugar) words.push("; nothing sweet, for their world's life makes no sugar");
  else if (crop && crop.lineage === null && crop.name.includes("fruit"))
    words.push("; sweet with fruit");
  else if (lore?.get(r.seat, "beekeeping")) words.push("; sweet with honey");
  words.push(".");
  rows.push(stat("It tastes", words));
  for (const k of tastes)
    rows.push(
      why(sentence(KEPT_TASTE[k]), `what is ${KEPT_WHY[k]}`, [
        `how their seat keeps its food: ${k} ${pc(t.means[k])} of its fullest`,
      ]),
    );
  rows.push(
    why(
      "Its weight",
      t.meat >= 0.3
        ? "rich and fatty: much of it is flesh and milk"
        : t.grain >= 0.7
          ? `starchy and filling: most of it is ${crop?.name ?? "grain"}`
          : "a mix of grain, flesh and the wild's",
      [`their food: grain ${pc(t.grain)}, flesh and milk ${pc(t.meat)}, the wild's ${pc(t.wild)}`],
    ),
  );
  // (Where their world's life is made of other stuff than Earth's: what their grain stores and their flesh is made of.)
  if (
    !life.earth &&
    (life.store !== "starch" || life.flesh !== "protein" || life.sugar !== "sugar")
  )
    rows.push(
      why(
        "Of their world's own stuff",
        `their grain stores ${store}${life.sugar ? "" : ", not sugar or starch"}; their flesh is of ${flesh}`,
        ["what their world's life is made of"],
      ),
    );
  return { type: "facts", title: "How their food tastes", rows };
}

// —— Their customs —————————————————————————————————————————————————————————————————————————————————

/** How a people of each first sense greets. */
const GREET_SENSE: Readonly<Record<Sense, string>> = {
  sight: "by sight",
  hearing: "by voice, a call and its answer",
  smell: "by scent, close enough to smell each other",
  echo: "by a call, each hearing the other's shape in its echo",
  electric: "by their currents, felt as they near",
};

/** Their customs, each with the line it is read from (null: nothing kept of their people). */
export function customsBlock(world: World, r: Polity): Block | null {
  const l = lifeOf(world, r);
  if (!l.people) return null;
  const ctx = populationContext(world),
    body = ctx.generated.life.people?.body ?? null,
    sense = firstSense(world),
    w = waysOf(l),
    rows: Stat[] = [],
    seatLink = landLink(world, r.seat, true),
    lives = (words: string): Line => [link(words, `cell:0:${r.seat}#lives`)];
  // Greeting: their first sense, how closely their kind lives together, how close they hold kin.
  const social = body?.social ?? 0.5,
    close = (social + w[WAY.kinship]!) / 2;
  rows.push(
    why(
      "Greeting",
      `${sentence(GREET_SENSE[sense])}${close >= 0.55 ? ", with a touch: they live close" : close < 0.35 ? ", at a distance: they keep apart" : ""}`,
      [
        `their first sense, ${sense}; their kind lives ${pc(social)} as close as a hive; their ways hold kin at ${pc(w[WAY.kinship]!)}`,
      ],
    ),
  );
  // Marriage: how their kind pairs, and who pays by who works.
  const pairing = pairingOf(body, ctx.life.adulthood),
    p = PAIRING_WORDS[pairing];
  if (pairing === "life" || pairing === "harem") {
    const norm = l.roles?.norm ?? null,
      pays =
        norm === null
          ? ""
          : norm >= 0.6
            ? "; the groom's kin pay for the bride, a worker her own lose"
            : norm < 0.4
              ? "; the bride brings a dowry, for her work is kept at home"
              : "; both kin give at the wedding";
    rows.push(
      why(`Marriage`, `${sentence(p.name)}${pays}`, [
        `how their kind raises its young (${p.line.toLowerCase().replace(/\.$/, "")})${norm === null ? "" : `; a bearer's work beyond the home, ${pc(norm)} of another's`}`,
        ...(norm === null ? [] : [": ", ...lives("their Lives")]),
      ]),
    );
  } else
    rows.push(
      why(
        "Marriage",
        `They do not wed: ${pairing === "brood" ? "one of them bears the young of all" : pairing === "season" ? "they pair for a season and part" : "their kind does not pair"}`,
        [p.line],
      ),
    );
  // Funerals: the dead of their towns are buried in their graveyards, as their towns are seen.
  if (ctx.medium !== "water") {
    const year = Math.floor(world.now / YEAR) - 1,
      dead = ctx.history.deathsIn(r.seat, year);
    rows.push(
      why(
        "Funerals",
        `Burial in their towns' graveyards${dead > 0 ? ` (${count(Math.round(dead))} in their seat's land last year)` : ""}; their fallen are brought home from a battle near, and lie where they fell far off`,
        ["the deaths of ", seatLink, "; where a battle's fallen are buried"],
      ),
    );
  }
  // Hospitality: trade and openness in their ways, and how lean their months.
  const welcome = (w[WAY.trade]! + w[WAY.openness]!) / 2;
  rows.push(
    why(
      "Strangers",
      welcome >= 0.55 && l.leanest >= 0.8
        ? "are fed at the door: they live by meeting others"
        : welcome < 0.4
          ? "are met warily, and kept outside the family"
          : l.leanest < 0.8
            ? "are given what the lean months leave"
            : "are taken in as guests, for a while",
      [
        `their ways: trade ${pc(w[WAY.trade]!)}, openness ${pc(w[WAY.openness]!)}; their seat fed ${pc(l.leanest)} in its leanest month`,
      ],
    ),
  );
  // Coming of age: valour and the levy.
  const f = fieldedParts(ctx, r);
  rows.push(
    why(
      "Coming of age",
      f.standing
        ? "the young are taken into the standing army"
        : f.share >= 0.15 && f.valour >= 0.55
          ? "the young prove their valour in the levy"
          : f.share >= 0.15
            ? "the grown are called to the levy"
            : "comes with work, not arms",
      [
        `the share of their grown it fields, ${pc(f.share)}; their valour, ${pc(f.valour)}${f.standing ? "; the standing army their seat knows" : ""}: `,
        link("their army", `${r.ref}#army`),
      ],
    ),
  );
  // Gifts: what the seat hands out as favours, and how few hold the wealth.
  if (l.favours !== null || l.top !== null) {
    const favours = l.favours ?? 0,
      top = l.top ?? 0;
    rows.push(
      why(
        "Gifts",
        favours >= 0.4
          ? "bind men to the seat: much of what it gives is favours"
          : top >= 0.5
            ? "show who holds the wealth"
            : "are small and among kin",
        [
          ...(l.favours !== null
            ? [`the seat's favours, ${pc(favours)} of what it hands out; `]
            : []),
          ...(l.top !== null ? [`their richest tenth's share of wealth, ${pc(top)}`] : []),
          ...(l.favours !== null ? [": ", link("their houses", `${r.ref}#houses`)] : []),
        ],
      ),
    );
  }
  // Taboos: what their body cannot eat, and what their realm forbids.
  const taboos: string[] = [],
    from: Span[] = [];
  // (Only where their table bears it out: a people whose body lives on flesh may still eat what its beds give.)
  if (body?.diet === "plants" && l.table && l.table.meat < 0.02) {
    taboos.push("they eat no flesh");
    from.push("their bodies, which live on plants");
  } else if (body?.diet === "flesh" && l.table && l.table.grain < 0.02) {
    taboos.push("they eat no grain");
    from.push("their bodies, which live on flesh");
  }
  if ((l.barred ?? 0) >= 0.5) {
    taboos.push("what calms, wakes and eases is forbidden");
    if (from.length) from.push("; ");
    from.push(link("their realm's law on it", `${r.ref}#treasury`));
  }
  if (taboos.length) rows.push(why("Taboos", sentence(listed(taboos)), from));
  // Holidays: their feast and holy days.
  if (l.rest)
    rows.push(
      why(
        "Holidays",
        `${Math.round(l.rest.holy)} holy days and ${Math.round(l.rest.feasts)} feast days a year; they work the other ${workDays(l.rest.holy, l.rest.feasts)}`,
        [
          `their piety for the holy days, what they have to spare for the feasts${gamesPlayed(l).length ? ", and what their bodies are good at for their games" : ""}: `,
          ...lives("their Lives"),
        ],
      ),
    );
  return { type: "facts", title: "Their customs", rows };
}
