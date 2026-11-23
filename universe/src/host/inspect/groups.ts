// A realm's Groups tab, a group's page and a federation's (the groups, sim/order/groups.ts): what its people have to band for (each
// aim's stake and the members it would gather), its groups by strength with their heads, lands, standing and what each does (its
// aims as shares), what they take and give, the killing they do and suffer, the realm that pays or licenses them, their
// federations, and how their holds ended. Who, what, cost and effect: never how any crime is done or any weapon used. Phone first:
// a few facts, one set of bars, one table that fits.
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, Item, PageModel, Stat } from "../../bridge/index.ts";
import {
  ORG,
  ORG_AIMS,
  ORG_BASES,
  ORG_STANDING,
  basisOfAim,
  basisWords,
  type OrgAim,
} from "../../rules/index.ts";
import {
  beliefOf,
  templeOf,
  GROUP_ACT_YEARS,
  kindName,
  orgInquiryOf,
  orgSectOf,
  orgsOf,
  populationContext,
  standsAgainst,
  strikerOf,
  politiesOf,
  realmName,
  type Org,
  type OrgFed,
  type Polity,
} from "../../sim/index.ts";
import { ORG_IS, grainSum, orgWords } from "../../causal/index.ts";
import { realmColor } from "../colors.ts";
import {
  companyFields,
  orgFedNews,
  orgFedOf,
  orgFedRef,
  orgNews,
  orgOf,
  orgRef,
} from "../groups.ts";
import {
  claimUnder,
  count,
  item,
  link,
  many,
  part,
  share,
  stat,
  yearAt,
  yearNow,
} from "./words.ts";
import { landLink, realmLink } from "./names.ts";
import { bossLink } from "./boss.ts";
import { streetFightOf, watchFightTool } from "./streetfight.ts";

const th = (n: number) => share(n / 1000),
  grain = (n: number) => `${grainSum(Math.max(0, Math.round(n)))} grain's worth`,
  cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** What each aim is, in a few words: what its members do, and for whom. */
export const AIM_WORDS: Readonly<Record<OrgAim, string>> = {
  prey: "preying on trade",
  smuggle: "carrying what is forbidden or taxed",
  guard: "guarding its own",
  enforce: "holding wrongdoers to account",
  rule: "ruling its own town",
  aid: "caring for its sick, widowed and dead",
  lend: "lending to its own",
  trade: "safe passage and rights for its merchants",
  worship: "keeping its faith",
  hire: "selling its arms",
  rebel: "organising to overthrow the seat",
  conspire: "keeping its counsel against the seat",
  office: "seeking the seat's offices by its people's votes",
  refuge: "holding a hard land apart for those who fled",
  inquire: "inquiry shared and written between towns",
};
/** What each aim's stake is, for the realm's tab. */
const STAKE_WORDS: Readonly<Record<OrgAim, string>> = {
  prey: "Trade on roads and seas no one keeps",
  smuggle: "What the cartels leave of the smuggling rent",
  guard: "What preying, killing and war take, to guard against",
  enforce: "Wrongs left unjudged where courts are few",
  rule: "Great towns its seat's hand barely reaches",
  aid: "Death, sickness and the street, unpooled",
  lend: "Credit where no bank lends",
  trade: "Long trade among many towns, unguarded",
  worship: "A faith pressed by its seat",
  hire: "Pay for soldiers from realms at war",
  rebel: "Grievance under a doubted, voiceless seat",
  conspire: "An educated few shut out",
  office: "Interests many share that no house speaks for",
  refuge: "The bound and the hunted, and hard land to hold",
  inquire: "The learned, and a word free enough to share",
};

const orgLink = (r: Polity, g: { name: string; kind: number; event: string }) =>
  link(cap(orgWords(g.name, kindName(g))), orgRef(r.ref, g.event));
const fedLink = (r: Polity, f: OrgFed) =>
  link(`the ${f.name} federation`, orgFedRef(r.ref, f.event));

const killed = (n: number) =>
  n >= 1 ? `${many(Math.round(n), "killed", "killed")} a year` : "few";

/** What a group does, its greatest aims first, as shares. */
function doesOf(g: Org): string {
  return ORG_AIMS.map((a, i) => [a, g.aims[i] ?? 0] as const)
    .filter(([, w]) => w >= 100)
    .sort((a, b) => b[1] - a[1])
    .map(([a, w]) => `${AIM_WORDS[a]} (${th(w)})`)
    .join(", ");
}

function passedItems(
  world: World,
  news: (e: ReturnType<World["events"]["all"]>[number]) => boolean,
  since: number,
): Item[] {
  const all = world.events.all(),
    out: Item[] = [];
  for (let i = all.length - 1; i >= 0 && out.length < 12; i--) {
    const e = all[i]!;
    if (yearAt(e.t) < since) break;
    if (!news(e)) continue;
    const y = yearAt(e.t);
    out.push(item([`Year ${y}: `, link(claimUnder(world, e.id, y), e.id)], e.id, y));
  }
  return out;
}

const HOW: Readonly<Record<string, string>> = {
  crushed: "broken by its realm",
  withered: "withered, its stake no longer worth holding together for",
  merged: "taken into",
  won: "had what it formed for, and disbanded",
  "fallen with its realm": "fell with its realm",
};

// —— A realm's Groups tab ——————————————————————————————————————————————————————————————————————————————

/** A realm's Groups tab: none where nothing is reckoned. */
export function realmGroupsBlocks(world: World, r: Polity): Block[] {
  const v = orgsOf(world)?.of(r.ref);
  if (!v) return [];
  const blocks: Block[] = [],
    groups = [...v.orgs].sort((a, b) => b.power - a.power || a.id - b.id);
  if (groups.length) {
    blocks.push({
      type: "bars",
      title: "Its groups, by strength",
      bars: groups.map((g) => ({
        label: [orgLink(r, g)],
        ref: orgRef(r.ref, g.event),
        value: g.power / 1000,
      })),
      unit: "share",
      wrap: true,
    });
    blocks.push({
      type: "table",
      title: "Each group",
      columns: ["Group", "Head", "Members", "Since"],
      rows: groups.map((g) => ({
        ref: orgRef(r.ref, g.event),
        cells: [[orgLink(r, g)], [g.leader.name], [count(g.members)], [`${g.since}`]],
        keys: [g.name, g.leader.name, g.members, g.since],
      })),
      few: ORG.most,
      fit: true,
    });
    blocks.push({
      type: "facts",
      title: "What each does",
      rows: groups.map((g) => {
        const payer = g.patron ? politiesOf(world).get(g.patron) : undefined;
        return stat(cap(orgWords(g.name, kindName(g))), doesOf(g) || "little yet", {
          why: g.event,
          parts: [
            part("how its realm holds it", ORG_STANDING[g.standing] ?? "let be"),
            ...(g.takes ? [part("takes from others", `${grain(g.takes)} a year`)] : []),
            ...(g.gives ? [part("gives its own", `${grain(g.gives)} a year`)] : []),
            part("the killing it does and suffers", killed(g.violence)),
            ...(payer ? [part("paid by", realmName(payer))] : []),
          ],
        });
      }),
    });
  } else
    blocks.push({
      type: "text",
      lines: [
        [
          "No group of its people holds together now: what they share is not worth, to each of them, what banding together would cost.",
        ],
      ],
    });
  // What its people have to band for.
  const stakes = ORG_AIMS.map((a, k) => [a, v.stakes[k] ?? 0, v.gather[k] ?? 0] as const)
    .filter(([a, s]) => s > 0 && a !== "smuggle")
    .sort((a, b) => b[2] - a[2] || b[1] - a[1])
    .slice(0, 6);
  if (stakes.length)
    blocks.push({
      type: "facts",
      title: "What its people have to band for",
      rows: stakes.map(([a, s, n]) =>
        stat(STAKE_WORDS[a], `${grain(s)} a year`, {
          parts: [
            part(
              "who would hold together for it",
              n >= ORG.crew ? count(Math.round(n)) : "too few for a group",
            ),
          ],
        }),
      ),
    });
  if (v.feds.length)
    blocks.push({
      type: "facts",
      title: "Their federations",
      rows: v.feds.map((f) =>
        stat("A federation", [fedLink(r, f), `: ${many(f.members.length, "group", "groups")}`], {
          why: f.event,
          parts: [part("its strength among its realm's groups", th(f.strength))],
        }),
      ),
    });
  blocks.push({
    type: "facts",
    title: "What it costs",
    rows: [
      stat("The killing they do and suffer", killed(v.killings)),
      stat("What preying takes", `${grain(v.taken)} a year`),
      stat("Its hand against what it outlaws", th(v.suppression)),
      ...(v.pays
        ? [stat("What it pays those it hires and licenses", `${grain(v.pays)} a year`)]
        : []),
    ],
  });
  if (v.gone.length)
    blocks.push({
      type: "list",
      title: "How their holds ended",
      items: [...v.gone]
        .reverse()
        .map((g) =>
          item(
            [
              `Year ${g.year}: `,
              link(cap(orgWords(g.name, kindName(g))), orgRef(r.ref, g.rose)),
              ` (since ${g.since}), ${HOW[g.how] ?? g.how}${g.into ? ` the ${g.into}` : ""}`,
            ],
            g.event,
            g.year,
          ),
        ),
    });
  return blocks;
}

// —— A group's page, a federation's ——————————————————————————————————————————————————————————————————————

/** What a group of each first aim is, and what it does to others: who, what, cost and effect. */
const ABOUT: Readonly<Record<OrgAim, string>> = {
  prey: "Where trade passes that no one keeps, men with nothing better can live by taking from it. It takes a share of what passes its roads or seas, and kills; the trade there shrinks and holdings are the less safe. A realm at war may license such men against its foe.",
  smuggle:
    "What is forbidden or taxed is dearer than it would be, and those who carry it past the law keep the difference.",
  guard:
    "Where its seat does not keep its people, they keep themselves: those under arms guard their own against those who prey and the war on their border, and hold deals the courts do not.",
  enforce:
    "Where courts are few and wrongs go unjudged, its members hold wrongdoers to account themselves; deals are held the better, and some are killed without a court's word.",
  rule: "A great town far from a seat that barely reaches it rules itself: it keeps order and its own dues, and the seat's hand there is the thinner.",
  aid: "Its members pay in so that when one falls sick, dies or loses his roof, the others care for him and his: what only members get is why so many join. Fewer die, and fewer are left on the street.",
  lend: "Its members pool what they save and lend it in turn to one another, where no bank lends to such as them; deals among them are held.",
  trade:
    "Merchants of many towns banded for safe passage and the rights a weak seat cannot give: their trade is the safer, their deals held.",
  worship:
    "A faith pressed by its seat is kept together by those who hold it: its lands are the slower to leave it, and the pressing breeds grievance.",
  hire: "Veterans with no war of their own sell their arms to a realm at war that is short of men: each worth more than a levied man, paid from its treasury. Unpaid, they may turn to preying.",
  rebel:
    "Those aggrieved under a seat that is doubted, gives them no voice and holds its arms close organise to overthrow it; the more of them, the nearer a rising.",
  conspire:
    "A sworn few, shut out of standing and the free word, keep their counsel against the seat; a coup comes the nearer.",
  office:
    "Where the many choose who governs, those who share an interest no great house speaks for band to carry it: their votes held to their own candidate, more of them brought out, their interest weighing the more in who the seat must pay. A demagogue may lead one.",
  refuge:
    "Those who fled bondage or the law hold a land too broken and far for their realm's hand: one land, kept apart and defended, a free land for others to flee to.",
  inquire:
    "The learned of a land band for inquiry and the free word: they meet, write between towns and realms, and a land where they hold finds the more readily and takes up what learned lands elsewhere know.",
};

/** A group's page (`org:<realm>:<event>`). */
export function orgPage(world: World, ref: string): PageModel {
  const g = orgOf(world, ref);
  if (!g) throw new Error(`no group ${ref}`);
  const year = yearNow(world),
    r = g.realm,
    rec = g.record,
    v = orgsOf(world)?.of(r.ref),
    since = rec?.since ?? g.gone?.since ?? yearAt(world.events.get(g.event)?.t ?? world.now),
    facts: Stat[] = [
      stat("Realm", [realmLink(world, r.ref)]),
      stat("What it is", ORG_IS[g.kind] ?? g.kind, {
        why: g.event,
        // (The same said in the terms every organised body is told by: rules/institutions.ts.)
        parts: rec
          ? [
              part(
                basisWords(
                  basisOfAim(ORG_AIMS[rec.aim] ?? "aid", {
                    standing: rec.standing,
                    patron: !!rec.patron,
                    basis: ORG_BASES[rec.basis] ?? "poor",
                    house: !!rec.house,
                  }),
                ),
                "",
              ),
            ]
          : [],
      }),
      stat("Since", `year ${since}`, { why: g.event }),
    ];
  if (rec) {
    const payer = rec.patron ? politiesOf(world).get(rec.patron) : undefined,
      fed = rec.fed !== undefined ? v?.feds.find((x) => x.id === rec.fed) : undefined;
    facts.push(
      stat(
        "Its head",
        [
          bossLink(r.ref, g.event, rec.leader.name),
          `, born year ${rec.leader.born}, at its head since year ${rec.leader.since}`,
        ],
        { parts: [part("its heads so far", count(rec.leaders))] },
      ),
      stat(
        "Its lands",
        rec.lands.flatMap((c, i) => (i ? [", ", landLink(world, c)] : [landLink(world, c)])),
      ),
      stat("What it does", doesOf(rec) || "little yet"),
      stat("Bound first by", ORG_BASES[rec.basis] ?? "its stake", {
        parts: [part("how its realm holds it", ORG_STANDING[rec.standing] ?? "let be")],
      }),
    );
    if (payer) facts.push(stat("Paid by", [realmLink(world, payer.ref)]));
    // (A party's interest, how far it holds its votes, the house that leads it.)
    if (ORG_BASES[rec.basis] === "interest")
      facts.push(
        stat("Carries", `the ${rec.identity}`, {
          parts: [
            part("of their votes it holds to its own", th(rec.organised ?? 0)),
            ...(rec.house ? [part("led by", `the house of ${rec.house}`)] : []),
          ],
        }),
      );
    // (An order's faith and its temple: the clergy it is tied to.)
    if (g.kind === "monastic order" && rec.identity) {
      const faith = beliefOf(world).get(rec.identity as Ref),
        temple = faith ? templeOf(world, faith) : null;
      facts.push(
        stat("Of the faith", faith?.name ?? "its seat's", {
          parts: temple
            ? [
                part("its temple's clergy", count(temple.clergy)),
                part("its faithful", count(temple.faithful)),
              ]
            : [],
        }),
      );
    }
    if (fed) facts.push(stat("Allied in", [fedLink(r, fed)]));
    // (A learned society is a voice: it carries word to those who read, where its realm lets it be. sim/order/institutions.ts)
    if (g.kind === "learned society")
      facts.push(
        stat(
          "Carries word",
          `to those who read in ${rec.lands.length === 1 ? "its land" : "its lands"}: a free voice, half as far as it holds among their learned`,
          {
            parts: [
              part("its hold among the learned at home", share(orgInquiryOf(world, rec.home))),
            ],
          },
        ),
      );
  }
  if (g.gone)
    facts.push(
      stat(
        "Its hold ended",
        [`in year ${g.gone.year}, `, link(HOW[g.gone.how] ?? g.gone.how, g.gone.event)],
        {
          why: g.gone.event,
        },
      ),
    );
  const blocks: Block[] = [{ type: "facts", rows: facts }];
  // (Brigands and pirates: their latest year's preying, played where the most of it is. Read off their record: no event tells it.)
  if (rec && streetFightOf(world, g.ref))
    blocks.push(watchFightTool(g.ref, "▶ Watch its latest year's preying"));
  if (rec) {
    blocks.push({
      type: "bars",
      title: "What it does",
      bars: ORG_AIMS.map((a, i) => ({
        label: [cap(AIM_WORDS[a])],
        value: (rec.aims[i] ?? 0) / 1000,
      }))
        .filter((b) => b.value >= 0.05)
        .sort((a, b) => b.value - a.value),
      unit: "share",
      wrap: true,
    });
    blocks.push({
      type: "facts",
      title: "What it holds, and what it costs",
      rows: [
        stat("Members", count(rec.members)),
        stat("Its purse", grain(rec.wealth), {
          parts: [part("taken in a year", grain(rec.income))],
        }),
        ...(rec.takes ? [stat("Takes from others", `${grain(rec.takes)} a year`)] : []),
        ...(rec.gives ? [stat("Gives its own", `${grain(rec.gives)} a year`)] : []),
        stat("Strength among its realm's groups", th(rec.power)),
        stat("The killing it does and suffers", killed(rec.violence)),
      ],
    });
    blocks.push({
      type: "text",
      lines: [
        [
          g.kind === "monastic order"
            ? "The devout of a faith their seat holds withdraw to a land of their own under a rule of their own, tied to its temple: they keep learning and stores, their land's scholars kept by them and its hungry and sick spared, and the seat's hand there the lighter."
            : ABOUT[ORG_AIMS[rec.aim] ?? "aid"],
        ],
      ],
    });
  }
  // (Your hand on it: sim/order/grouphand.ts.)
  if (rec) {
    const held =
        rec.decreeUntil !== undefined && rec.decreeUntil >= yearNow(world)
          ? `held ${ORG_STANDING[rec.decree ?? 1] ?? "let be"} by decree until year ${rec.decreeUntil}`
          : null,
      hand =
        rec.handUntil !== undefined && rec.handUntil >= yearNow(world)
          ? `${rec.hand === 1 ? "blessed" : rec.hand === -1 ? "cursed" : "kept from its realm's hand"} until year ${rec.handUntil}`
          : null;
    if (held || hand)
      blocks.push({
        type: "facts",
        rows: [stat("The hand on it", [held, hand].filter(Boolean).join("; "))],
      });
    blocks.push({
      type: "tool",
      tool: "acts.group",
      args: { group: g.event, name: orgWords(g.name, g.kind), years: GROUP_ACT_YEARS },
    });
  }
  // (Whom what it does is against, within its reach: who would be struck at, were it pressed to. sim/order/deeds.ts.)
  if (rec) {
    const against = standsAgainst(
      populationContext(world),
      r,
      strikerOf(
        rec,
        rec.lands.some((c) => orgSectOf(world, c) > 0),
      ),
    );
    if (against.length)
      blocks.push({
        type: "list",
        title: "Whom it stands against",
        items: [
          ...against.map((a) =>
            item([
              link(a.name, a.ref),
              `, ${a.what}${a.near ? "" : ", beyond its own lands"}: ${share(a.weight)} of what it does`,
            ]),
          ),
          item([
            "A group pressed hard may strike at the one who heads what it is against. A watch that is manned and honest where they are guards them, and the answer takes of the group's own.",
          ]),
        ],
      });
  }
  // (A company's fields: each battle it stood in, for whom, how many and what it did. Any group a realm hires stands on the
  // field so, privateers as a free company: sim/war/companies.ts.)
  {
    const fields = companyFields(world, g.ref, since, yearAt);
    if (fields.length)
      blocks.push({
        type: "list",
        title: "Its fields",
        items: fields.map((f) =>
          item(
            [
              `Year ${f.year}: `,
              link("a battle", f.battle),
              `, ${count(f.men)} men for ${f.payer} against ${f.foe}: ${FIELD_HOW[f.how] ?? "stood and fought"}${f.how === "fought" ? (f.won ? ", and won" : ", and lost") : ""}`,
            ],
            f.battle,
            f.year,
          ),
        ),
      });
  }
  const passed = passedItems(world, orgNews(g), since);
  blocks.push(
    passed.length
      ? { type: "list", title: "What has passed in it", items: passed }
      : {
          type: "text",
          title: "What has passed in it",
          lines: [["Nothing yet that history tells."]],
        },
  );
  return {
    ref: g.ref,
    kind: "family",
    icon: ICONS[g.kind] ?? "🤝",
    title: cap(orgWords(g.name, g.kind)),
    subtitle: [rec ? `${cap(g.kind)} of ` : "Once a group of ", realmLink(world, r.ref)],
    color: realmColor(r.ref),
    place: rec?.lands[0] !== undefined ? { scale: "region", cell: rec.lands[0] } : null,
    stats: [
      ...(rec
        ? [
            stat("Head", [bossLink(r.ref, g.event, rec.leader.name)]),
            stat("Members", count(rec.members)),
          ]
        : []),
      stat("Since", `year ${since}`),
    ],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** What a company did on a field, in words. */
const FIELD_HOW: Readonly<Record<string, string>> = {
  fought: "stood and fought",
  left: "left the field unpaid before the day",
  turned: "went over to the foe unpaid",
};

const ICONS: Readonly<Record<string, string>> = {
  brigands: "🏴",
  pirates: "🏴‍☠️",
  privateers: "⛵",
  raiders: "🏇",
  smugglers: "📦",
  militia: "🛡️",
  vigilantes: "⚖️",
  commune: "🏘️",
  "mutual-aid society": "🤝",
  confraternity: "🕯️",
  brotherhood: "🤝",
  "lending circle": "🪙",
  "merchant league": "⚓",
  sect: "🕯️",
  "hidden sect": "🕯️",
  "free company": "⚔️",
  "sea company": "⚓",
  "revolutionary circle": "✊",
  insurgents: "✊",
  resistance: "✊",
  lodge: "🔺",
  party: "🗳️",
  "maroon community": "⛰️",
  "monastic order": "⛪",
  "learned society": "📜",
};

/** A federation's page (`ofed:<realm>:<event>`). */
export function orgFedPage(world: World, ref: string): PageModel {
  const f = orgFedOf(world, ref);
  if (!f) throw new Error(`no federation ${ref}`);
  const year = yearNow(world),
    r = f.realm,
    rec = f.record,
    v = orgsOf(world)?.of(r.ref),
    since = rec?.since ?? yearAt(world.events.get(f.event)?.t ?? world.now),
    members = rec ? (v?.orgs ?? []).filter((g) => rec.members.includes(g.id)) : [],
    facts: Stat[] = [
      stat("Realm", [realmLink(world, r.ref)]),
      stat("Since", `year ${since}`, { why: f.event }),
    ];
  if (rec) {
    facts.push(
      stat(
        "Its groups",
        members.flatMap((g, i) => (i ? [", ", orgLink(r, g)] : [orgLink(r, g)])),
        { parts: [part("its strength among its realm's groups", th(rec.strength))] },
      ),
      stat("What they do", AIM_WORDS[ORG_AIMS[rec.aim] ?? "aid"]),
    );
  } else facts.push(stat("Now", "its groups no longer hold together"));
  const blocks: Block[] = [
    { type: "facts", rows: facts },
    {
      type: "text",
      lines: [
        [
          "Groups of one aim in one realm, allied where writing or a shared people lets them reach each other: what one learns or holds, the others share, and each is the stronger for it.",
        ],
      ],
    },
  ];
  const passed = passedItems(world, orgFedNews(f), since);
  if (passed.length) blocks.push({ type: "list", title: "What has passed in it", items: passed });
  return {
    ref: f.ref,
    kind: "family",
    icon: "🔗",
    title: `The ${f.name} federation`,
    subtitle: ["Groups allied in ", realmLink(world, r.ref)],
    color: realmColor(r.ref),
    place: members[0] ? { scale: "region", cell: members[0].home } : null,
    stats: rec
      ? [stat("Groups", count(rec.members.length)), stat("Since", `year ${since}`)]
      : [stat("Since", `year ${since}`)],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}
