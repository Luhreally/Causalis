// The head of a group (asked 2026-11-16: "bosses and group leaders get person pages"): an underworld group's boss, a group's leader,
// by the group's realm and the event it rose by (`boss:<realm>:<event>`, whoever heads it now; `boss:<realm>:<event>:<year>`, the
// one who went that year, from the note kept as their draw stood: sim/hand/deaths.ts). Their name, birth, group; how they went; and
// (withDeath, host/death.ts) what could take them now and the god's acts on them.
import type { Ref, World } from "../../kernel/index.ts";
import { deathNotesOf, groupOfBoss, politiesOf } from "../../sim/index.ts";
import type { Block, Item, PageModel, Stat } from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { parseBossRef } from "../death.ts";
import { groupRef, underName } from "../underworld.ts";
import { orgName, orgRef } from "../groups.ts";
import { landLink, realmLink } from "./names.ts";
import { item, link, stat, yearNow } from "./words.ts";

/** A link to a group's head's page, by their group's realm and rising event. */
export const bossLink = (realm: string, event: string, name: string) =>
  link(name, `boss:${realm}:${event}`);

/** The group a head's ref is of, as its page names it: its ref and name (null: none history keeps). */
function groupNamed(world: World, head: string): { ref: string; name: string } | null {
  const m = /^boss:(pol:\d+:\d+):(ev:\d+:\d+)$/.exec(head);
  if (!m) return null;
  const mob = groupRef(m[1]!, m[2]!),
    org = orgRef(m[1]!, m[2]!),
    a = underName(world, mob);
  if (a) return { ref: mob, name: a };
  const b = orgName(world, org);
  return b ? { ref: org, name: b } : null;
}

export function bossPage(world: World, ref: string): PageModel {
  const at = parseBossRef(ref);
  if (!at) throw new Error(`no head of a group ${ref}`);
  const realm = at.head.split(":").slice(1, 4).join(":") as Ref,
    r = politiesOf(world).get(realm),
    group = groupNamed(world, at.head),
    year = yearNow(world),
    notes = deathNotesOf(world)?.headsOf(at.head) ?? [],
    gone = at.year !== null ? (notes.find((n) => n.year === at.year) ?? null) : null,
    now = at.year === null ? groupOfBoss(world, at.head) : null,
    head = now ? (now.kind === "under" ? now.g.boss : now.g.leader) : null,
    word = now?.kind === "under" ? "Boss" : "Leader",
    facts: Stat[] = [
      ...(r ? [stat("Realm", [realmLink(world, r.ref)])] : []),
      ...(group ? [stat("Group", [link(group.name, group.ref)])] : []),
    ],
    blocks: Block[] = [];
  if (head && now) {
    facts.push(
      stat("Born", `year ${head.born}`),
      stat("At its head since", `year ${head.since}`),
      stat("Home", [landLink(world, now.g.home)]),
    );
  } else if (gone) {
    facts.push(
      stat("Went", `in year ${gone.year}, aged ${gone.age}`),
      stat("Born", `year ${gone.year - gone.age}`),
    );
  } else {
    // (Whoever headed a group now gone; or one gone before the notes were kept.)
    blocks.push({
      type: "text",
      lines: [
        [
          group
            ? `Their group no longer holds: what history says of it is on its page.`
            : "History keeps no group by this name.",
        ],
      ],
    });
  }
  blocks.unshift({ type: "facts", rows: facts });
  // Those who headed it before, as their notes stand.
  const before: Item[] = notes
    .filter((n) => n !== gone)
    .slice(-12)
    .reverse()
    .map((n) =>
      item(
        [
          link(n.name, `${at.head}:${n.year}`),
          `: ${n.how === "struck" ? "struck down by the god" : n.how === "taken" ? "taken by the realm" : "died of their years"}, aged ${n.age}`,
        ],
        n.event ?? null,
        n.year,
      ),
    );
  if (before.length) blocks.push({ type: "list", title: "Its heads gone", items: before });
  const name = head?.name ?? gone?.name ?? "One who headed a group";
  return {
    ref,
    kind: "person",
    icon: now?.kind === "org" ? "🧭" : "🕴️",
    title: name,
    subtitle: [
      head ? `${word} of ` : gone ? "Once at the head of " : "Of ",
      group ? link(group.name, group.ref) : "a group",
      ...(r ? [", in ", realmLink(world, r.ref)] : []),
    ],
    color: r ? realmColor(r.ref) : null,
    place: null,
    stats: [],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}
