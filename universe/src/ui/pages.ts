// The observatory's pages (Phase 7 M67, M68, M70): a wild lineage, a realm, a deposit,
// a plate and the world's deep ages, opened from a land's inspector. Each page says what
// its thing is, where, and what it is to the people; each line that stands for something
// opens its why, and each line that stands for another page opens that page.
import type {
  DepositPage,
  HostClient,
  PlatePage,
  RealmPage,
  SpeciesPage,
} from "../bridge/index.ts";
import { el } from "./why.ts";

export type PageKind = "species" | "realm" | "deposit" | "plate" | "ages";

/** A page built: its title, its parts, and the ref whose why it opens with. */
export type Page = { title: string; parts: HTMLElement[]; why: string };

export type PageLinks = {
  /** A line that opens a why. */
  why(text: string, ref: string): HTMLElement;
  /** A line that opens another page. */
  page(text: string, kind: PageKind, ref: string): HTMLElement;
};

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
/** The (i + 1)th, in words while short: first, second… then 9th, 11th, 21st, 22nd. */
const nth = (i: number) => {
  const n = i + 1,
    teen = n % 100 >= 11 && n % 100 <= 13;
  return (
    ORDINALS[i] ??
    `${n}${teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`
  );
};
const BOUNDARY_WORDS = ["", "converging", "spreading", "sliding"];
const lands = (n: number) => `${n.toLocaleString()} land${n === 1 ? "" : "s"}`;

/** Build a page: ask the host for its facts and lay them out. */
export async function buildPage(
  client: HostClient,
  kind: PageKind,
  ref: string,
  links: PageLinks,
): Promise<Page> {
  switch (kind) {
    case "species":
      return speciesPage(
        await client.query<SpeciesPage>({ type: "species.page", args: { ref } }),
        links,
      );
    case "realm":
      return realmPage(await client.query<RealmPage>({ type: "realm.page", args: { ref } }), links);
    case "deposit":
      return depositPage(
        await client.query<DepositPage>({ type: "deposit.page", args: { ref } }),
        links,
      );
    case "plate":
      return platePage(await client.query<PlatePage>({ type: "plate.page", args: { ref } }), links);
    case "ages":
      return agesPage(
        await client.query<{ ref: string; claim: string }[]>({ type: "deep.ages" }),
        links,
      );
  }
}

function speciesPage(s: SpeciesPage, links: PageLinks): Page {
  const kg = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)} tonnes` : `${Math.round(n).toLocaleString()} kg`;
  const parts: HTMLElement[] = [
    el("h3", undefined, "What it is"),
    el(
      "div",
      "fact",
      `${cap(s.what)}${s.size !== null ? `, some ${kg(s.size)}` : ""}${s.wool ? ", with a woolly coat" : ""}${s.herd >= 0.5 ? ", living in herds" : ""}`,
    ),
    // Its body, as its world and its way of life made it (M83), and where it stands in the web.
    ...(s.body
      ? [
          el(
            "div",
            "fact",
            `${cap(s.body.words)}${s.body.features.length ? `; it grows ${s.body.features.join(", ").replace(/-/g, " ")}` : ""}`,
          ),
          el(
            "div",
            "fact muted",
            s.level >= 4
              ? "At the top of its land's web of eating: nothing hunts it but the people"
              : s.level === 3
                ? "It eats the plant-eaters (or what is left of them), and is eaten by the great hunters"
                : "It eats the land's plants, and is eaten by its hunters",
          ),
        ]
      : []),
    el(
      "div",
      "fact",
      s.tame
        ? s.niche === "seed grass"
          ? "Its seed is heavy enough to sow"
          : "Docile enough to tame"
        : s.niche === "seed grass"
          ? "Its seed is too light to be worth sowing"
          : "Too wild to tame",
    ),
    el(
      "div",
      "fact muted",
      `It thrives at ${Math.round(s.warm)} °C (±${Math.round(s.tolerance)}), with ${Math.round(s.rain[0]).toLocaleString()}–${Math.round(s.rain[1]).toLocaleString()} mm of rain a year`,
    ),
    el("h3", undefined, "Where it lives"),
    links.why(
      `It arose in the ${s.origin.biome} in the world's ${nth(s.arose.index)} age, ${s.arose.from}–${s.arose.to} million years ago`,
      s.arose.ref,
    ),
    s.died !== null
      ? el("div", "fact", `It died out in the ${nth(s.died)} age`)
      : el(
          "div",
          "fact",
          `It lives wild in ${lands(s.lands)}${s.peopled ? `, ${s.peopled.toLocaleString()} of them peopled` : ""}`,
        ),
    // Its place among the living: what it hunts, or what hunts it.
    ...(s.hunts.length || s.huntedBy.length
      ? [
          el("h3", undefined, "Among the living"),
          ...s.hunts.map((o) =>
            links.page(`It hunts the ${o.name}, in ${lands(o.lands)}`, "species", o.ref),
          ),
          ...s.huntedBy.map((o) =>
            links.page(`The ${o.name} hunts it, in ${lands(o.lands)}`, "species", o.ref),
          ),
          ...(s.raids
            ? [el("div", "fact", `It takes from the people's flocks in ${lands(s.raids)}`)]
            : []),
        ]
      : []),
    el("h3", undefined, "What it is to the people"),
  ];
  const uses = [
    s.sown ? `They sow it in ${lands(s.sown)}` : "",
    s.herded ? `They keep herds of it in ${lands(s.herded)}` : "",
    s.lost ? `They have hunted it out of ${lands(s.lost)}` : "",
  ].filter(Boolean);
  parts.push(
    ...(uses.length
      ? uses.map((u) => el("div", "fact", u))
      : [
          el(
            "div",
            "fact muted",
            !s.peopled
              ? "No people live beside it"
              : s.niche === "seed grass"
                ? s.tame
                  ? "They gather its seed where they live beside it; another grass is sown there"
                  : "They gather its seed where they live beside it"
                : s.niche === "hunter"
                  ? "A danger to those who live beside it, and to their herds"
                  : "Game where they live beside it",
          ),
        ]),
  );
  return { title: cap(s.name), parts, why: s.ref };
}

function realmPage(r: RealmPage, links: PageLinks): Page {
  const parts: HTMLElement[] = [
    el("div", "fact", cap(r.government)),
    el(
      "div",
      "fact",
      `${lands(r.lands)}${r.offworld ? `, ${r.offworld} of them beyond the world` : ""}; ${r.people.toLocaleString()} people`,
    ),
    links.why(
      r.ended !== null
        ? `Founded in year ${r.founded} at ${r.town}; it fell in year ${r.ended}`
        : `Founded in year ${r.founded}, its seat at ${r.town}`,
      r.event,
    ),
    el("div", "fact muted", `Its seat takes ${r.tithe} parts in a hundred of the grain`),
    ...(r.host ? [links.why("How its host is armed", r.host.ref)] : []),
    el("h3", undefined, "Its rulers"),
    links.why(`${r.ruler.name}, since year ${r.ruler.since}`, r.ruler.event),
    ...r.rulers
      .filter((x) => x.event !== r.ruler.event)
      .slice(0, 4)
      .map((x) => links.why(x.claim, x.event)),
    el("h3", undefined, "What they know, in the order they came to know it"),
  ];
  const known = r.known.slice(-24);
  if (r.known.length > known.length)
    parts.push(el("div", "fact muted", `${r.known.length - known.length} things known before`));
  parts.push(
    ...(known.length
      ? known.map((k) => links.why(`Year ${k.year}: ${k.name}`, k.event))
      : [el("div", "fact muted", "Nothing beyond the ways of their fathers yet")]),
    el("h3", undefined, "Its wars"),
  );
  if (!r.wars.length) parts.push(el("div", "fact muted", "It has fought no war history holds"));
  for (const w of r.wars) {
    parts.push(
      links.why(
        `${w.attacking ? "Against" : "Attacked by"} ${w.name}, ${w.ended !== null ? `${w.since}–${w.ended}` : `since ${w.since}`}: ${w.battles} battle${w.battles === 1 ? "" : "s"}`,
        w.peace ?? w.ref,
      ),
    );
    if (w.embargo) parts.push(links.why("The war shut the trade between their lands", w.embargo));
  }
  parts.push(el("h3", undefined, "Its neighbours"));
  if (!r.pacts.length) parts.push(el("div", "fact muted", "No realm borders it"));
  for (const n of r.pacts.slice(0, 8))
    parts.push(links.why(`With ${n.name}: ${n.standing}`, n.ref));
  return { title: cap(r.name), parts, why: r.ref };
}

function depositPage(d: DepositPage, links: PageLinks): Page {
  const parts: HTMLElement[] = [
    links.why(
      `${d.richness.toLocaleString()} units of ${d.kind}, laid down by ${d.process}`,
      d.ref,
    ),
    el(
      "div",
      "fact muted",
      d.people
        ? `${d.people.toLocaleString()} people live in its land`
        : "No one lives in its land",
    ),
    el("h3", undefined, "The ground beneath"),
  ];
  if (d.plate)
    parts.push(
      links.page(
        `It lies on a ${d.plate.continental ? "continental" : "oceanic"} plate`,
        "plate",
        d.plate.ref,
      ),
    );
  if (d.across)
    parts.push(
      links.page(
        `Where it meets a ${d.across.continental ? "continental" : "oceanic"} plate`,
        "plate",
        d.across.ref,
      ),
    );
  if (d.age) parts.push(links.why(`Buried in the world's ${nth(d.age.index)} age`, d.age.ref));
  parts.push(links.page("The ages of the world's deep past", "ages", ""));
  return { title: `${cap(d.kind)}`, parts, why: d.ref };
}

function platePage(p: PlatePage, links: PageLinks): Page {
  const parts: HTMLElement[] = [
    links.why(
      `A ${p.continental ? "continental" : "oceanic"} plate, ${(100 * p.share).toFixed(1)}% of the world, turning ${p.speed.toFixed(1)}° every million years`,
      p.ref,
    ),
    el(
      "div",
      "fact",
      `${Math.round(100 * p.dry)}% of it above the sea; ${p.people.toLocaleString()} people live on it`,
    ),
    el("h3", undefined, "Its ores"),
    ...(p.deposits.length
      ? [
          el(
            "div",
            "fact",
            p.deposits.map((d) => `${d.kind}${d.count > 1 ? ` ×${d.count}` : ""}`).join(", "),
          ),
        ]
      : [el("div", "fact muted", "No ore lies on it")]),
    el("h3", undefined, "The plates it meets"),
    ...p.neighbours.map((n) =>
      links.page(
        `At a ${BOUNDARY_WORDS[n.boundary] ?? ""} boundary`.replace("  ", " "),
        "plate",
        n.ref,
      ),
    ),
    links.page("The ages of the world's deep past", "ages", ""),
  ];
  return { title: p.continental ? "A continental plate" : "An oceanic plate", parts, why: p.ref };
}

function agesPage(ages: { ref: string; claim: string }[], links: PageLinks): Page {
  return {
    title: "The deep past",
    parts: [
      el("div", "fact muted", "Oldest first: each age's warmth and seas, and what it laid down"),
      ...ages.map((a) => links.why(a.claim, a.ref)),
    ],
    why: ages[0]?.ref ?? "",
  };
}
