// The culture sweep's pages (2026-11-16): for a land, who its people count their own and how far their "us" reaches, what they
// make, and what its town draws; for a realm, what its seat tells and how it is taken, how far its people count themselves one,
// and its faith's houses; for a faith, its houses: clergy, granaries, relief and teaching. Pure readings of what the sweep's
// systems kept (rules/folk.ts, temple.ts, voice.ts, urban.ts, art.ts), made when a page is read.
import { mostTakenStat, visionsStat } from "./tastes.ts";
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  TEMPLE,
  VOICE_WORDS,
  academyWords,
  learnedHealing,
  learnedInquiry,
  templeSway,
  drawWords,
  kinWords,
  nationWords,
  renownWords,
  templeWords,
} from "../../rules/index.ts";
import {
  academyOf,
  artMakers,
  artOf,
  beliefOf,
  identityOf,
  languagesOf,
  politiesOf,
  populationContext,
  realmFolk,
  templeOf,
  urbanOf,
  voiceOf,
  wagesOfLand,
  type Faith,
  type Polity,
} from "../../sim/index.ts";
import { faithLink, realmLink } from "./names.ts";
import {
  dayBlock,
  didYouKnowBlock,
  festivalsBlock,
  portraitBlock,
  timelineBlock,
  wordsBlock,
  worksBlocks,
} from "./theirlife.ts";
import { customsBlock, musicBlocks, tasteBlock } from "./customs.ts";

/** A realm's people's life, read whole, in its order on its Culture tab (none where nothing is kept of them). */
export function theirLifeBlocks(world: World, r: Polity): Block[] {
  return [
    portraitBlock(world, r),
    didYouKnowBlock(world, r),
    dayBlock(world, r),
    tasteBlock(world, r),
    ...musicBlocks(world, r),
    customsBlock(world, r),
    wordsBlock(world, r),
    festivalsBlock(world, r),
    ...worksBlocks(world, r),
    timelineBlock(world, r),
  ].filter((b): b is Block => !!b);
}
import { count, link, many, share, stat } from "./words.ts";

/** Who a land's people count their own, what they make, and what its town draws: for its People tab. */
export function landCultureBlocks(world: World, cell: number): Block[] {
  const blocks: Block[] = [],
    ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p?.total()) return blocks;
  const realm = world.hasStore("polity.states") ? politiesOf(world).of(cell) : undefined,
    id = identityOf(world, cell);
  if (realm && id) {
    const speech = world.hasStore("culture.languages") ? languagesOf(world).of(cell) : undefined,
      rows: Stat[] = [
        stat(
          "Their seat's people",
          realm.seat === cell ? "they are its seat" : `${kinWords(id.kin)} to them`,
        ),
        stat("Their own reach to", nationWords(id.nation)),
        stat("Under", [realmLink(world, realm.ref), ` since year ${id.since}`]),
      ];
    if (speech) rows.push(stat("They speak", speech.name));
    blocks.push({ type: "facts", title: "Who they count their own", rows });
  }
  const art = artOf(world, cell);
  if (art && art.works > 0) {
    const m = artMakers(ctx, p),
      rows: Stat[] = [
        stat("Their works", `${art.form}, in ${art.stuff}`),
        stat("Renown", renownWords(art.renown)),
        stat("Works kept", `${count(art.works)} years of work`),
        stat("Made a year", `${count(m.made)} years of work`),
      ];
    if (art.court > 0.05) rows.push(stat("Kept by those who rule", share(art.court)));
    if (art.clergy > 0.05) rows.push(stat("Kept by their faith", share(art.clergy)));
    blocks.push({ type: "facts", title: "What they make", rows });
  }
  // (Higher learning: who its patrons keep at study past their letters, and what its learned do: rules/academy.ts.)
  const academy = academyOf(world, cell);
  if (academy && academy.learned > 0) {
    const patrons = [
      ["its temple", academy.temple],
      ["its seat", academy.seat],
      ["its great houses", academy.houses],
    ] as const;
    const kept = patrons.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    blocks.push({
      type: "facts",
      title: "Higher learning",
      rows: [
        stat("Learned past their letters", academyWords(academy.learned)),
        stat("Of their people", `${(academy.learned * 100).toFixed(2)}%`),
        stat("A generation on", `${(academy.target * 100).toFixed(2)}%, as they are kept now`),
        stat("Kept by", kept.length ? kept.map(([n]) => n).join(", ") : "no patron now"),
        stat("Their inquiry", `${learnedInquiry(academy.learned).toFixed(2)}× as ready`),
        stat("Their healers reach", `${learnedHealing(academy.learned).toFixed(2)}× as far`),
      ],
    });
  }
  const urban = urbanOf(world, cell),
    town = ctx.settlements.inProvince(cell).find((v) => v.market);
  if (urban && town) {
    const w = wagesOfLand(world, p);
    blocks.push({
      type: "facts",
      title: "Who lives in their town",
      rows: [
        stat("Its people", count(town.population)),
        stat("It holds", drawWords(urban.draw)),
        stat(
          "Its work pays",
          w.field > 0 ? `${(w.town / w.field).toFixed(1)}× the fields'` : "no wage yet",
        ),
        stat("Drawn toward", `${urban.target.toFixed(1)}× its trades and their kin`),
      ],
    });
  }
  return blocks;
}

/**
 * A realm's Culture tab: its people's life read whole (./theirlife.ts, ./customs.ts: a portrait, what is striking about it, a day, how their
 * food tastes, their music and customs, their words, feasts, works and years), then what its seat tells, how far its people count themselves one, and its faith's houses.
 */
export function realmCultureBlocks(world: World, r: Polity): Block[] {
  const blocks: Block[] = [...theirLifeBlocks(world, r)],
    ctx = populationContext(world),
    v = voiceOf(world, r.ref),
    // (What its people take most, legal, taxed or forbidden: tastes.ts.)
    taken = mostTakenStat(world, r.ref, "What its people take most, and its law on it"),
    visions = visionsStat(world, r);
  if (taken)
    blocks.push({
      type: "facts",
      title: "What its people take most",
      rows: [
        taken,
        ...(visions ? [visions] : []),
        stat("More", [link("its treasury: what it comes to", `${r.ref}#treasury`)]),
      ],
    });
  if (v) {
    const rows: Stat[] = [
      stat("Its seat tells", v.topic ? VOICE_WORDS[v.topic] : "nothing of note", {}),
      ...(v.topic ? [stat("Since", `year ${v.since}`)] : []),
      stat("Heard by", share(v.reach)),
      ...(v.topic ? [stat("Believed", share(v.credence))] : []),
      stat(
        "Word moves",
        v.free >= 0.66 ? "freely" : v.free >= 0.33 ? "as the seat allows" : "only as the seat says",
      ),
      stat("Who read", share(v.readers)),
      stat(
        "Its standing from its word",
        `${v.standing >= 0 ? "+" : ""}${Math.round(v.standing * 100)} in a hundred`,
      ),
    ];
    if (v.told < 0)
      rows.push(
        stat("What free voices tell", `${Math.round(v.told * 100)} in a hundred of its standing`),
      );
    blocks.push({ type: "facts", title: "What its seat tells", rows });
  }
  const folk = realmFolk(ctx, r);
  if (folk.weighed) {
    let strangers = 0;
    for (const c of r.members) {
      const f = identityOf(world, c);
      if (f && f.kin < 0.6) strangers++;
    }
    blocks.push({
      type: "facts",
      title: "Who its people count their own",
      rows: [
        stat("Its seat's people are, to most", kinWords(folk.kin)),
        stat("Their own reach to", nationWords(folk.nation)),
        stat("Lands that count its seat strangers", many(strangers, "land", "lands")),
      ],
    });
  }
  if (world.hasStore("belief.faiths")) {
    const faith = beliefOf(world).of(r.seat).faith,
      f = faith ? beliefOf(world).get(faith) : undefined,
      houses = f ? faithHousesBlock(world, f) : null;
    if (houses) blocks.push(houses);
  }
  return blocks;
}

/** A faith's houses: its clergy, its granaries, what it gave the hungry, how far it teaches. */
export function faithHousesBlock(world: World, f: Faith): Block | null {
  const h = templeOf(world, f);
  if (!h) return null;
  return {
    type: "facts",
    title: "Its temples",
    rows: [
      stat("Faith", [faithLink(world, f.ref)]),
      stat("Its temples", templeWords(h.clergy, h.faithful)),
      stat(
        "Its weight where it is held",
        `${share(templeSway(h.faithful > 0 ? h.clergy / h.faithful / TEMPLE.teachAt : 0))} of what its piety could carry`,
      ),
      stat("Its clergy", count(h.clergy)),
      stat("Its faithful", `${count(h.faithful)} in ${many(h.lands, "land", "lands")}`),
      stat("Given it last year", `${count(h.given)} grain`),
      stat("In its granaries", `${count(h.granary)} grain`),
      stat(
        "Given to the hungry",
        h.relief > 0 ? `${count(h.relief)} grain last year` : "none last year",
      ),
      stat(
        "Its clergy teach",
        h.teaching > 0 ? `${share(h.teaching)} of the young they reach` : "none",
      ),
      stat("Since", `year ${h.since}`),
    ],
  };
}
