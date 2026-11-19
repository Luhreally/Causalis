// Schools of thought in words (sim/ideas): what a school teaches, who founded it and for whom, where it is held; its founding, a
// seat's taking it up, its breaking in two; and why.
import { yearOfMoment, type CauseRef, type World } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { IDEA_ASKS, IDEA_PARTS } from "../rules/index.ts";
import {
  IDEA_EVENTS,
  PILGRIM_EVENTS,
  beliefOf,
  SCHOOL,
  WORK_EVENTS,
  homePlanet,
  schoolId,
  schoolRef,
  schoolsOf,
  type School,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

/** What a school asks for, the hardest pressed first: each leaning's end in words, with how hard (hundredths). */
export function schoolAsks(s: School, most = 3): { words: string; lean: number; part: number }[] {
  const out: { words: string; lean: number; part: number }[] = [];
  for (let k = 0; k < IDEA_PARTS; k++) {
    const v = s.creed[k] ?? 0;
    if (Math.abs(v) >= 4) out.push({ words: IDEA_ASKS[k]![v >= 0 ? 1 : 0], lean: v, part: k });
  }
  return out.sort((a, b) => Math.abs(b.lean) - Math.abs(a.lean) || a.part - b.part).slice(0, most);
}

/** A school in a line: "the Free Word of Kirath, which teaches word moving freely and choices carried by many". */
export function schoolWords(s: School): string {
  const asks = schoolAsks(s, 2).map((a) => a.words);
  return asks.length ? `${s.name}, which teaches ${asks.join(" and ")}` : s.name;
}

registerExplainer(SCHOOL.code, (world, ref) => {
  const store = schoolsOf(world),
    s = store?.get(schoolId(ref));
  if (!store || !s) return null;
  const lands = store.landsOf(s.id),
    claim = `${cap(schoolWords(s))}: ${s.by ? `${s.by} founded it` : "it began"} in ${landWords(world, cellRef(0, s.seat))} in year ${s.founded}, speaking for ${s.speaks}; ${lands ? `${count(lands)} land${lands === 1 ? "" : "s"} hold it` : "no land holds it now"}`;
  const causes: CauseRef[] = [{ ref: s.event, role: "trigger", weight: 0.8 }],
    elder = s.from !== null ? store.get(s.from) : undefined;
  if (elder) causes.push({ ref: schoolRef(elder.id), role: "enabler", weight: 0.2 });
  return { ref, claim, basis: "recorded", t: null, causes: edges(world, causes) };
});

type Data = Readonly<Record<string, unknown>> | null;
const text = (d: unknown, k: string) => {
  const v = (d as Data)?.[k];
  return typeof v === "string" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;
const group = (g: string | null) => (g ? (/^the /.test(g) ? g : `the ${g}`) : "those unheard");

registerEventWords(IDEA_EVENTS.founded.type, (world, e) => {
  const by = text(e.data, "by"),
    realm = text(e.data, "realm");
  return `${by ?? "A teacher"} founded ${text(e.data, "name") ?? "a school of thought"} in ${landWords(world, e.place)}, speaking for ${group(text(e.data, "group"))}${realm ? ` of ${realm}` : ""}, ${year(e.t)}`;
});
registerEventWords(
  IDEA_EVENTS.taken.type,
  (world, e) =>
    `The seat of ${text(e.data, "realm") ?? landWords(world, e.place)} took up the teaching of ${text(e.data, "name") ?? "a school"}, ${year(e.t)}`,
);
registerEventWords(IDEA_EVENTS.split.type, (world, e) => {
  const by = text(e.data, "by");
  return `${cap(text(e.data, "name") ?? "A school")} broke from ${text(e.data, "from") ?? "its elders"} in ${landWords(world, e.place)}${by ? `, led out by ${by}` : ""}, ${year(e.t)}`;
});
registerDecisionWords(
  "ideas.founded",
  (_, d) =>
    `Whether one of name founded a school of thought, and for whom it speaks (${group((d.outcome as { group?: string } | null)?.group ?? null)})`,
);

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

// —— Works ————————————————————————————————————————————————————————————————————————————————————————————————————————

/** What a work told and not written is, by the sense its people know the world by first. */
const TOLD: Readonly<Record<string, string>> = {
  sight: "a tale shown in pictures",
  hearing: "a song",
  smell: "a telling in scents",
  echo: "a song for a hall that answers",
  electric: "a telling in woven currents",
};

/** A work's form in words, as its people make such a thing ("a song", "a thing raised to stand", "a book"). */
export function workFormWords(world: World, form: string): string {
  if (form === "raised") return "a work raised to stand";
  if (form === "written") return "a book";
  if (form === "sent") return "a work sent out to many at once";
  const sense = homePlanet(world).generated.life.people?.body.senses?.[0] ?? "hearing";
  return TOLD[sense] ?? "a telling";
}

/** What a work remembers, by the kind of the event it was made of. */
export function workThemeWords(theme: string): string {
  const head = theme.slice(0, theme.indexOf(".") < 0 ? theme.length : theme.indexOf("."));
  if (theme === "people.famine") return "a hunger";
  if (theme.startsWith("war.battle")) return "a battle";
  if (theme === "polity.formed") return "the founding of a realm";
  if (theme === "polity.succession") return "a ruler's passing and another's coming";
  switch (head) {
    case "war":
    case "terms":
    case "starwar":
      return "a war";
    case "health":
      return "a sickness";
    case "belief":
      return "a faith's beginning";
    case "strife":
    case "court":
      return "a struggle for the seat";
    case "ties":
    case "diplomacy":
      return "a binding of realms";
    case "polity":
      return "a realm made or unmade";
    case "act":
    case "hand":
      return "a sign from beyond";
    case "planet":
    case "wild":
    case "weather":
    case "climate":
    case "ecology":
      return "what the world itself did";
    case "lore":
    case "knowledge":
    case "design":
      return "a thing found out";
    case "order":
    case "society":
    case "houses":
      return "a change in who holds whom";
    case "space":
    case "contact":
    case "peoples":
    case "frontier":
      return "a going beyond the sky";
    case "trade":
    case "money":
    case "credit":
    case "finance":
      return "a fortune made or lost";
    default:
      return "a great thing of its time";
  }
}

registerEventWords(WORK_EVENTS.made.type, (world, e) => {
  const by = text(e.data, "by"),
    title = text(e.data, "title"),
    patron = text(e.data, "patron"),
    kind = text(e.data, "kind"),
    of = (e.data as Data)?.of;
  return `${by ?? "One of name"} made ${title ? `"${title}"` : "a work"}, ${workFormWords(world, text(e.data, "form") ?? "told")} of ${workThemeWords(text(e.data, "theme") ?? "")}${typeof of === "number" ? ` (year ${of})` : ""}, in ${landWords(world, e.place)}${patron ? ` for ${kind === "seat" ? `the seat of ${patron}` : kind === "house" ? `the house of ${patron}` : patron}` : ""}, ${year(e.t)}`;
});

// —— Pilgrimage ——————————————————————————————————————————————————————————————————————————————————————————————————

registerEventWords(PILGRIM_EVENTS.began.type, (world, e) => {
  const d = e.data as Data,
    of = e.subjects[0],
    n = typeof d?.pilgrims === "number" ? d.pilgrims : 0,
    lands = typeof d?.lands === "number" ? d.lands : 0,
    name = of
      ? of.startsWith("idea:")
        ? schoolsOf(world)?.get(schoolId(of))?.name
        : world.hasStore("belief.faiths")
          ? beliefOf(world).get(of)?.name
          : undefined
      : undefined,
    who = d?.school ? "those taught by" : "the faithful of";
  return `${cap(landWords(world, e.place))} became a place of pilgrimage: ${n ? `${count(n)} of ` : ""}${who} ${name ?? "what began there"} came in a year${lands ? ` from ${count(lands)} land${lands === 1 ? "" : "s"}` : ""}, ${year(e.t)}`;
});
