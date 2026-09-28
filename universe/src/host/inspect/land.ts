// A land's page (Phase 10 M91): its people, its ground and climate, its living world, its
// market and works, its realm, what it knows and what has happened there. A colony's halls
// and a ship bound for a star are lands too (offworld sites), and a spot of the fine grid
// and a region open onto the land they are part of.
import {
  BIOME_NAMES,
  cellRef,
  isProvinceWorld,
  livingIn,
  offworldSite,
  spotRef,
} from "../../gen/index.ts";
import { GOODS } from "../../rules/index.ts";
import {
  homePlanet,
  marketsOf,
  politiesOf,
  populationContext,
  realmName,
  starSitesOf,
  wildsOf,
} from "../../sim/index.ts";
import { folkRef, waysRef } from "../../causal/index.ts";
import { parseRef, type Ref, type World } from "../../kernel/index.ts";
import type { Block, Item, Line, PageModel, Place, Row, Stat, Tab } from "../../bridge/index.ts";
import { cell as spotFacts, market, province, provinceHistory } from "../planet.ts";
import { realmColor } from "../colors.ts";
import { count, eventsAbout, item, link, many, part, share, stat, yearNow } from "./words.ts";
import { richWords } from "./life.ts";
import { prinRef } from "./matter.ts";
import { landStoresBlocks } from "./stores.ts";
import { groundBlocks } from "./ground.ts";
import {
  faithLink,
  landLink,
  landTitle,
  landsOf,
  languageLink,
  lineageIcon,
  realmLink,
  spotOfLand,
  townLink,
} from "./names.ts";

const OCCUPATION_WORDS: Readonly<Record<string, string>> = {
  dependent: "children and the old",
  child: "children",
  forager: "foragers",
  farmer: "farmers",
  herder: "herders",
  crafter: "crafters",
  trader: "traders",
  leader: "leaders",
};

/** Where a land is to be seen: its own land (region) scale; a colony's body; a ship's star. */
export function landPlace(world: World, cell: number): Place | null {
  const g = homePlanet(world).generated,
    site = offworldSite(g, cell);
  if (site && site.body >= 0) return { scale: "system", body: site.body };
  if (site) {
    const ship = starSitesOf(world)?.get(cell);
    return ship ? { scale: "cluster", star: ship.star } : null;
  }
  return cell < landsOf(world) ? { scale: "region", cell } : null;
}

/** A land's page (tab: the tab it opens on). */
export function landPage(world: World, cell: number, tab?: string): PageModel {
  const g = homePlanet(world).generated;
  if (!Number.isInteger(cell) || cell < 0 || cell >= g.grid.count)
    throw new Error(`no land ${cell}`);
  const ref = cellRef(0, cell),
    site = offworldSite(g, cell),
    p = province(world, cell),
    ctx = populationContext(world),
    towns = ctx.settlements.inProvince(cell),
    year = yearNow(world),
    spot = spotOfLand(world, cell),
    place = spot === null ? null : spotFacts(g as never, spot);
  const title = landTitle(world, cell),
    realm = politiesOf(world).of(cell);
  const subtitle: Line = site
    ? [site.body >= 0 ? "Halls beyond the world" : "A ship among the stars"]
    : [
        place?.biome ? `${place.biome[0]!.toUpperCase()}${place.biome.slice(1)}` : "Land",
        ...(realm ? [" · ", link(realmName(realm), realm.ref)] : []),
        ...(p?.faith ? [" · ", faithLink(world, p.faith.ref)] : []),
      ];

  // The headline: its people, how well they eat, what they have put by, its towns.
  const stats: Stat[] = [];
  if (p) {
    stats.push(
      stat("People", count(p.people), {
        why: folkRef(cell),
        parts: p.byOccupation.map((o) => part(OCCUPATION_WORDS[o.name] ?? o.name, count(o.count))),
      }),
      stat("Fed", share(p.fed / 1000), { why: folkRef(cell) }),
    );
    const m = market(world, cell);
    if (m) stats.push(stat("Food put by", `${m.foodMonths.toFixed(1)} months`));
  }
  stats.push(stat("Towns", count(towns.length)));
  if (realm) stats.push(stat("Realm", [link(realmName(realm), realm.ref)]));

  const tabs: Tab[] = [];
  // Overview.
  {
    const rows: Stat[] = [];
    if (p) {
      rows.push(
        stat("People", count(p.people), { why: folkRef(cell) }),
        stat("Fed", share(p.fed / 1000), { why: folkRef(cell) }),
        stat("Settled", p.settledYear === null ? "before the chronicle" : `year ${p.settledYear}`, {
          why: p.arrival,
        }),
        stat(
          "Farming",
          p.farming
            ? p.cultivation
              ? "they sow their fields"
              : "they sow"
            : "they gather and hunt",
          { why: p.cultivation },
        ),
      );
      if (p.herding) rows.push(stat("Herding", "they keep flocks", { why: folkRef(cell) }));
    }
    if (realm) {
      const g2 = politiesOf(world).discontent(cell);
      rows.push(
        stat("Realm", [link(realmName(realm), realm.ref)], { why: realm.ref }),
        stat("Grievance", share(Math.min(1, g2.level)), { why: g2.cause }),
      );
    }
    if (p?.faith) rows.push(stat("Faith", [faithLink(world, p.faith.ref)], { why: p.faith.event }));
    if (p?.ways?.language)
      rows.push(stat("Tongue", [languageLink(world, p.ways.language.ref)], { why: waysRef(cell) }));
    if (!p)
      rows.push(
        stat("People", site ? "no one lives here now" : "no one lives here"),
        ...(place?.biome ? [stat("Ground", place.biome)] : []),
      );
    const blocks: Block[] = [{ type: "facts", rows }];
    if (towns.length)
      blocks.push({
        type: "list",
        title: "Towns",
        items: towns.map((t) =>
          item(
            [
              townLink(world, t.ref),
              ` — ${many(t.population, "person", "people")}, founded year ${t.founded}`,
            ],
            t.ref,
          ),
        ),
      });
    if (site && site.body >= 0) {
      const body = g.system.bodies[site.body]!;
      blocks.push({
        type: "facts",
        title: "Where",
        rows: [stat("On", [link(body.designation, body.ref)], { why: body.ref })],
      });
    }
    if (p) blocks.push({ type: "why", title: "How they came to be here", ref: folkRef(cell) });
    else if (spot !== null)
      blocks.push({ type: "why", title: "What it is", ref: spotRef(0, spot) });
    blocks.push({ type: "tool", tool: "acts.land", args: { cell } });
    tabs.push({ id: "overview", name: "Overview", blocks });
  }
  // Its people: their work, ways, speech and faith, and their years.
  if (p) {
    const blocks: Block[] = [
      {
        type: "table",
        title: "What they do",
        columns: ["Work", "People"],
        rows: p.byOccupation.map((o) => ({
          cells: [[OCCUPATION_WORDS[o.name] ?? o.name], [count(o.count)]],
          keys: [o.name, o.count],
        })),
      },
    ];
    if (p.ways)
      blocks.push({
        type: "facts",
        title: "Their ways",
        rows: [
          stat("Ways", p.ways.words.join(", ") || "as their elders were", { why: p.ways.ref }),
          ...(p.ways.language
            ? [
                stat(
                  "Tongue",
                  [
                    languageLink(world, p.ways.language.ref),
                    ...(p.ways.language.family !== p.ways.language.name
                      ? [` (of the ${p.ways.language.family} family)`]
                      : []),
                  ],
                  {
                    why: p.ways.language.took?.event ?? waysRef(cell),
                  },
                ),
                stat("Like its common speech", `${p.ways.language.like} in a hundred`),
              ]
            : []),
          stat("Names they give", p.ways.sounds.join(", ")),
        ],
      });
    if (p.faith)
      blocks.push({
        type: "facts",
        title: "Their faith",
        rows: [
          stat("Faith", [faithLink(world, p.faith.ref)], { why: p.faith.event }),
          stat("God", p.faith.deity),
          stat("Since", `year ${p.faith.since}`, { why: p.faith.event }),
        ],
      });
    const h = provinceHistory(world, cell);
    if (h.years.length > 1) {
      blocks.push(
        {
          type: "chart",
          title: "People",
          points: h.years.map((y) => ({ x: y.year, y: y.population })),
          unit: "people",
        },
        {
          type: "chart",
          title: "How well fed",
          points: h.years.map((y) => ({ x: y.year, y: y.fed / 100 })),
          unit: "share",
        },
      );
    }
    if (h.prices.length > 1)
      blocks.push({
        type: "chart",
        title: "The price of food",
        points: h.prices.map((y) => ({ x: y.year, y: y.food })),
        unit: "price",
      });
    blocks.push({ type: "tool", tool: "meet.land", args: { cell } });
    tabs.push({ id: "people", name: "People", blocks });
  }
  // The ground and its air.
  if (place) {
    const rows: Stat[] = [
      stat("Ground", place.biome ?? "", { why: spotRef(0, spot!) }),
      stat("Height", `${Math.round(place.elevation)} m`),
      stat("Warmth", `${place.temperature.toFixed(1)} °C through the year`),
      stat("Rain", `${Math.round(place.precipitation)} mm a year`),
      stat(
        "Seasons",
        place.seasonality > 0.5 ? "sharp" : place.seasonality > 0.2 ? "marked" : "mild",
      ),
      stat("Water", place.river ? "a river runs through it" : place.lake ? "a lake" : "no river"),
      stat(
        "Plate",
        [link(place.plate.continental ? "a continental plate" : "an ocean plate", place.plate.ref)],
        {
          why: place.plate.ref,
        },
      ),
      stat(
        "Where",
        `${Math.abs(place.lat).toFixed(1)}°${place.lat >= 0 ? "N" : "S"}, ${Math.abs(place.lon).toFixed(1)}°${place.lon >= 0 ? "E" : "W"}`,
      ),
    ];
    if (place.boundary && place.boundary !== "none")
      rows.push(stat("Plates meeting", place.boundary));
    const fine = isProvinceWorld(g) ? g.fine : g,
      deposits = fine.deposits.filter(
        (d) => (isProvinceWorld(g) ? g.provinceOf[d.cell] : d.cell) === cell,
      );
    const blocks: Block[] = [{ type: "facts", rows }];
    if (deposits.length)
      blocks.push({
        type: "list",
        title: "What lies in the ground",
        items: deposits.map((d) =>
          item([link(`${d.kind}, ${richWords(d.richness)}`, d.ref), ` (${d.process})`], d.ref),
        ),
      });
    tabs.push({ id: "land", name: "Land", blocks });
    // Its ground (Phase 15 M124): bedrock, soil, what lies in it, its water, the air.
    tabs.push({ id: "ground", name: "Ground", blocks: groundBlocks(world, cell) });
  }
  // The living world: its web's levels, and its lineages.
  if (cell < landsOf(world)) {
    const living = livingIn(g.life, cell),
      lost = p ? new Set(wildsOf(ctx, cell).lost) : new Set<number>();
    const blocks: Block[] = [];
    if (p) {
      const e = p.ecology,
        rows: Stat[] = [
          stat("Wild game", share(e.wild), { why: `${ref}` }),
          stat("Forest", share(e.forest)),
          stat("Soil", share(e.soil)),
        ];
      if (e.hunters)
        rows.push(
          stat("Hunters", [link(e.hunters.name, e.hunters.ref), ` at ${share(e.hunters.stock)}`], {
            why: e.hunters.ref,
          }),
        );
      rows.push(stat("Small game", share(e.small)));
      if (e.lesser)
        rows.push(
          stat("Small hunters", [
            link(e.lesser.name, e.lesser.ref),
            ` at ${share(e.lesser.stock)}`,
          ]),
        );
      if (e.scavengers)
        rows.push(
          stat("Scavengers", [
            link(e.scavengers.name, e.scavengers.ref),
            ` at ${share(e.scavengers.stock)}`,
          ]),
        );
      if (e.fish !== null) rows.push(stat("Fish", share(e.fish)));
      if (e.grainLost > 0)
        rows.push(stat("Grain eaten by small game", share(e.grainLost), { why: e.grainEaten }));
      blocks.push({ type: "facts", title: "The web of eating", rows });
    }
    const items: Item[] = living
      .filter((s) => s.niche !== "upright ape")
      .sort((a, b) => a.level - b.level || (a.name < b.name ? -1 : 1))
      .map((s) =>
        item(
          [
            `${lineageIcon(s.niche, (s.body?.wings ?? 0) > 0 && s.body?.moves === "fly")} `,
            link(s.name, s.ref),
            ` — ${s.niche}${s.tame ? ", can be tamed" : ""}${lost.has(s.index) ? ", driven out" : ""}`,
          ],
          s.ref,
        ),
      );
    if (items.length) blocks.push({ type: "list", title: "What lives here", items });
    if (blocks.length) tabs.push({ id: "life", name: "Life", blocks });
  }
  // Its market, trade and works.
  {
    const m = market(world, cell);
    if (m && p) {
      const rows: Row[] = m.goods.map((x) => ({
        ref: x.ref,
        cells: [
          [link(x.name, x.ref)],
          [x.words],
          [count(x.stock)],
          [count(x.made)],
          [count(x.used)],
        ],
        keys: [x.name, x.ratio, x.stock, x.made, x.used],
      }));
      const blocks: Block[] = [
        {
          type: "table",
          title: m.town ? `The market at ${m.town.name}` : "What they make and use",
          columns: ["Good", "Price", "Stock", "Made", "Used"],
          rows,
        },
      ];
      const flows = marketsOf(world).flows.filter((f) => f.from === cell || f.to === cell);
      if (flows.length)
        blocks.push({
          type: "list",
          title: "Trade",
          items: flows.map((f) => {
            const other = f.from === cell ? f.to : f.from;
            return item(
              [
                `${count(f.count)} ${GOODS[f.good]!.name} ${f.from === cell ? "to" : "from"} `,
                landLink(world, other),
              ],
              cellRef(0, other),
            );
          }),
        });
      const ind = p.industry,
        rows2: Stat[] = [];
      if (ind.works)
        rows2.push(stat("Works", [link(ind.works.words, ind.works.ref)], { why: ind.works.ref }));
      if (ind.power)
        rows2.push(stat("Power", `${(ind.power / 0.1).toFixed(1)}× what their own muscle drives`));
      if (ind.mine) rows2.push(stat("Mine", "they dig ore"));
      if (ind.well) rows2.push(stat("Well", "they draw oil"));
      if (ind.factory) rows2.push(stat("Factory", "they make machines"));
      if (p.house)
        rows2.push(
          stat("How they build", [link(p.house.words, p.house.ref)], { why: p.house.ref }),
        );
      if (rows2.length) blocks.push({ type: "facts", title: "Works", rows: rows2 });
      tabs.push({ id: "economy", name: "Economy", blocks });
      // Its stores broken down (Phase 15 M123): by good and by what they are made of.
      const stores = landStoresBlocks(world, cell);
      if (stores.length) tabs.push({ id: "stores", name: "Stores", blocks: stores });
    }
  }
  // Its realm.
  if (p?.realm) {
    const r = p.realm,
      blocks: Block[] = [
        {
          type: "facts",
          rows: [
            stat("Realm", [link(r.name, r.ref)], { why: r.ref }),
            stat("Rule", r.government),
            stat("Ruler", `${r.ruler}, since year ${r.since}`),
            stat("Tithe", `${r.tithe}% of their grain`),
            stat("Grievance", share(Math.min(1, r.grievance)), { why: r.cause }),
            stat("Seat", r.seat ? "this land is its seat" : "elsewhere"),
          ],
        },
      ];
    if (r.interests.length)
      blocks.push({
        type: "list",
        title: "Who holds sway",
        items: r.interests.map((i) =>
          item(`${i.group} (${share(i.sway)})${i.want ? ` — ${i.want}` : ""}`, i.source),
        ),
      });
    if (r.wars.length)
      blocks.push({
        type: "list",
        title: "At war",
        items: r.wars.map((w) =>
          item(
            [
              link(
                `${w.attacking ? "Against" : "Defending against"} ${w.name}, since year ${w.since}`,
                w.ref,
              ),
            ],
            w.ref,
          ),
        ),
      });
    if (r.neighbours.length)
      blocks.push({
        type: "list",
        title: "Neighbours",
        items: r.neighbours.map((n) => item([link(`${n.name}: ${n.standing}`, n.ref)], n.ref)),
      });
    tabs.push({ id: "realm", name: "Realm", blocks });
  }
  // What they know.
  if (p?.lore.length)
    tabs.push({
      id: "lore",
      name: "Lore",
      blocks: [
        {
          type: "list",
          title: "What they know, newest first",
          // (Each a principle's page; how they came to it, its event.)
          items: p.lore.map((l) =>
            item(
              [
                link(l.name, prinRef(l.id)),
                ` — year ${l.year}, `,
                link("how they came to it", l.event),
              ],
              prinRef(l.id),
              l.year,
            ),
          ),
        },
      ],
    });
  // What has happened there.
  {
    const items = eventsAbout(
      world,
      [ref, folkRef(cell), waysRef(cell), ...towns.map((t) => t.ref)],
      30,
    );
    if (items.length)
      tabs.push({ id: "history", name: "History", blocks: [{ type: "list", items }] });
  }

  return {
    ref,
    kind: site ? "colony" : "land",
    icon: site ? (site.body >= 0 ? "🏛️" : "🚀") : "🗺️",
    title,
    subtitle,
    color: realm ? realmColor(realm.ref) : null,
    place: landPlace(world, cell),
    stats,
    tabs,
    ...(tab ? { tab } : {}),
    followable: true,
    year,
  };
}

/** A spot of the fine grid: its own ground, and the land it is part of. */
export function spotPage(world: World, spot: number): PageModel {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g)) throw new Error("no spots on this world");
  const f = spotFacts(g, spot),
    land = f.province;
  return {
    ref: spotRef(0, spot),
    kind: "spot",
    icon: "📍",
    title: `${f.biome ? f.biome[0]!.toUpperCase() + f.biome.slice(1) : "Ground"} at ${Math.abs(f.lat).toFixed(1)}°${f.lat >= 0 ? "N" : "S"}`,
    subtitle: ["Part of ", landLink(world, land)],
    color: null,
    place: { scale: "globe", spot },
    stats: [
      stat("Height", `${Math.round(f.elevation)} m`),
      stat("Warmth", `${f.temperature.toFixed(1)} °C`),
      stat("Rain", `${Math.round(f.precipitation)} mm`),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Land", [landLink(world, land)]),
              stat("Plate", [
                link(f.plate.continental ? "a continental plate" : "an ocean plate", f.plate.ref),
              ]),
              stat("Water", f.river ? "a river" : f.lake ? "a lake" : "none"),
              ...(f.deposit
                ? [
                    stat("In the ground", [link(f.deposit.kind, f.deposit.ref)], {
                      why: f.deposit.ref,
                    }),
                  ]
                : []),
              ...(f.boundary && f.boundary !== "none" ? [stat("Plates meeting", f.boundary)] : []),
            ],
          },
          { type: "why", ref: spotRef(0, spot) },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** The land a people, its ways or a region belong to (`folk:0:N`, `ways:0:N`, `regn:0:N`). */
export function landOfRef(ref: string): number {
  return parseRef(ref as Ref).b;
}

/** A land's biome words (for others' pages). */
export function biomeOf(world: World, cell: number): string {
  const g = homePlanet(world).generated,
    spot = spotOfLand(world, cell);
  if (spot === null) return "land";
  const fine = isProvinceWorld(g) ? g.fine : g;
  return BIOME_NAMES[fine.climate.biome[spot]!] ?? "land";
}

export { realmLink };
