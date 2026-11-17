// The sweep's Nature lane on the pages: a land's crop (how tame, how it fits, where it was bred, what it gives), what its people
// eat and go short of, its volcano and its river's floods; and on the world's page, the fires below and their veil. Pure reads of
// what the stores keep (sim/ecology/crops.ts, sim/population/diet.ts, sim/planet/fires.ts, sim/planet/floods.ts).
import type { World } from "../../kernel/index.ts";
import { FOODS, G, GOODS, STUNTING, VOLCANO } from "../../rules/index.ts";
import {
  cropReading,
  exchangeReading,
  dietReading,
  eruptionsAYear,
  eruptionsOn,
  firesOf,
  floodplains,
  floodsOf,
  floodsOn,
  populationContext,
  veilNow,
  ventOn,
} from "../../sim/index.ts";
import type { Block, Item, Stat } from "../../bridge/index.ts";
import { landLink } from "./names.ts";
import { count, item, link, stat } from "./words.ts";

const pc = (x: number) => `${Math.round(x * 100)}%`;

/** A land's crop: what it sows, how tame it has grown, how it fits the land, where it was bred, what it gives. */
export function cropBlock(world: World, cell: number): Block | null {
  const ctx = populationContext(world),
    r = cropReading(world, ctx, cell);
  if (!r) return null;
  const rows: Stat[] = [
    stat("Sown", [link(r.name, r.lineage), r.from === cell ? ", bred here" : ""]),
    stat(
      "How tame",
      r.tame >= 1
        ? "tamed: its seed waits on the ear to be reaped"
        : `${pc(r.tame)} of the way from a wild stand (whose seed falls before the cut) to a tamed crop`,
    ),
    stat(
      "How it fits this land",
      r.fit >= 0.995
        ? "as the land it was bred on"
        : `${pc(r.fit)}: bred for warmth of ${r.bredWarm.toFixed(0)}° and days at ${r.bredLat.toFixed(0)}° from the equator`,
    ),
    stat("Its fields give", `${pc(r.gives)} of what this land's own plant, tamed, would`),
  ];
  if (r.from !== cell) rows.splice(1, 0, stat("First bred in", [landLink(world, r.from, true)]));
  if (r.came) rows.push(stat("Came here", [link("from a land it meets", r.came)], { why: r.came }));
  // (Weeds, pests and herd beasts carried on contact: ecology/exchange.ts.)
  const x = exchangeReading(world, ctx, cell);
  if (x?.beast)
    rows.push(
      stat("Its herds", [
        link(x.beast.name, x.beast.ref),
        x.beastFrom === cell ? ", tamed here" : ", first kept in ",
        ...(x.beastFrom === cell ? [] : [landLink(world, x.beastFrom, true)]),
        x.gives !== 1 ? `: they give ${pc(x.gives)} of what the beast it first kept would` : "",
      ]),
    );
  if (x?.came)
    rows.push(stat("The beast came", [link("from a land it meets", x.came)], { why: x.came }));
  if (x && (x.pests >= 0.005 || x.struck))
    rows.push(
      stat(
        "Weeds and pests carried in",
        [
          x.pests >= 0.005
            ? `they take ${pc(x.pests)} of its fields, less each year as it learns to keep them down`
            : "they came, and are kept down now",
          ...(x.struck ? [" (", link("they came", x.struck), ")"] : []),
        ],
        x.struck ? { why: x.struck } : undefined,
      ),
    );
  return { type: "facts", title: "Its crop", rows };
}

/** What a land's people eat, and what they go short of though fed. */
export function dietBlock(world: World, cell: number): Block | null {
  const r = dietReading(world, cell);
  if (!r) return null;
  const ate = FOODS.filter((g) => (r.eaten[g] ?? 0) >= 0.005)
      .map((g) => `${pc(r.eaten[g]!)} ${GOODS[g]!.name}`)
      .join(", "),
    rows: Stat[] = [
      stat("What they eat", ate || "nothing of their own books"),
      stat(
        "What their bodies build from",
        `${pc(Math.min(1, r.protein))} of the protein they want, ${pc(Math.min(1, r.micro))} of the vitamins and metals`,
      ),
    ];
  if (r.sun < 0.995)
    rows.push(
      stat(
        "The light they live by",
        `their sun stands high enough for their skin to make what they want of it too short a part of the year (or their smoke keeps it off): their food makes up ${pc(r.sun)} of it`,
      ),
    );
  if (r.short >= 0.01) {
    rows.push(
      stat(
        "Going short",
        `their young die ${pc(r.deaths.young - 1)} the more, their grown ${pc(r.deaths.grown - 1)}; they stand some ${pc(r.stunted)} shorter than fed as they want (at most ${pc(STUNTING)})`,
        { why: r.poor },
      ),
    );
    if ((r.eaten[G.grain] ?? 0) > 0.6)
      rows.push(
        stat(
          "Why",
          "most of what they eat is grain, short of the protein flesh has and the greens the wild gives",
        ),
      );
  }
  return { type: "facts", title: "What its people eat", rows };
}

/** A land's volcano and its river's floods: what kind, how often, what each did. */
export function landFiresBlocks(world: World, cell: number): Block[] {
  const ctx = populationContext(world),
    vent = ventOn(ctx, cell),
    plain = floodplains(ctx).includes(cell),
    items: Item[] = [];
  if (!vent && !plain) return [];
  const rows: Stat[] = [];
  if (vent)
    rows.push(
      stat(
        "Volcanoes",
        vent === "arc"
          ? `a chain of cones where one plate goes under another (eruptions up to ${VOLCANO.most.arc} on the scale of ash)`
          : vent === "hotspot"
            ? `a hot place under its plate (eruptions up to ${VOLCANO.most.hotspot}: the greatest there are)`
            : vent === "island"
              ? "an ocean island over a hot place: mostly lava"
              : "a rift where its plates part: small eruptions",
      ),
    );
  if (plain)
    rows.push(
      stat(
        "Its river",
        "overruns its plain in a wet year: a flood drowns that year's fields and lays its silt",
      ),
    );
  for (const e of eruptionsOn(world, cell).slice(0, 6))
    items.push(
      item(
        [
          link(`An eruption of ${e.vei}`, e.event),
          `: ${count(e.dead)} dead`,
          e.sulphur > 0 ? `, ${(e.sulphur / 10).toFixed(1)} Mt of sulphur above the weather` : "",
        ],
        e.event,
        e.year,
      ),
    );
  for (const f of floodsOn(world, cell).slice(0, 6))
    items.push(
      item(
        [
          link(f.size >= 200 ? "A great flood" : "A flood", f.event),
          `: ${pc(f.fields / 1000)} of the harvest drowned, ${count(f.dead)} drowned`,
        ],
        f.event,
        f.year,
      ),
    );
  const blocks: Block[] = [{ type: "facts", title: "Fire below and water over", rows }];
  if (items.length) blocks.push({ type: "list", title: "What they did", items });
  return blocks;
}

/** The world's page: its fires below, a veil over it now, and its floods all told. */
export function worldFiresBlocks(world: World): Block[] {
  const fires = firesOf(world),
    floods = floodsOf(world),
    ctx = populationContext(world),
    rows: Stat[] = [
      stat(
        "Eruptions",
        `some ${eruptionsAYear(ctx).toFixed(2)} a year of 3 or more on the scale of ash, as its plates feed its volcanoes`,
      ),
    ];
  if (fires && fires.tally.eruptions > 0)
    rows.push(
      stat(
        "In the chronicle",
        `${count(fires.tally.eruptions)} eruptions, ${count(fires.tally.dead)} dead; the greatest ${fires.tally.greatest}${fires.tally.veils ? `; ${count(fires.tally.veils)} veils over the world` : ""}`,
        { why: fires.veil },
      ),
    );
  const cool = veilNow(world);
  if (cool >= 0.05)
    rows.push(
      stat(
        "A veil now",
        `its sulphur keeps the world ${cool.toFixed(2)} K cooler: short, cold summers`,
        {
          why: fires?.veil ?? null,
        },
      ),
    );
  if (floods && floods.tally.floods > 0)
    rows.push(
      stat(
        "Floods",
        `${count(floods.tally.floods)} rivers overran their plains, ${count(floods.tally.dead)} drowned`,
      ),
    );
  return [{ type: "facts", title: "Fire below and water over", rows }];
}
