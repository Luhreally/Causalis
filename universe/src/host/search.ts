// Search (Phase 10 M96): any named thing by its name — realms (the fallen too), towns, lands,
// faiths, tongues, wars, living lineages, the people met, and matter (substances, reactions,
// principles, goods: Phase 15) — each with its icon and a few
// words, the best matches first (a name that is the words asked, then one that begins with
// them, then one with a word that does, then one that holds them), the greater before the
// less. Pure reads of the world as it stands.
import { offworldSite } from "../gen/index.ts";
import {
  beliefOf,
  citiesOf,
  homePlanet,
  languagesOf,
  politiesOf,
  populationContext,
  realmName,
  warsOf,
} from "../sim/index.ts";
import { observer } from "../causal/index.ts";
import { GOODS, PRINCIPLES, REACTIONS, SUBSTANCES } from "../rules/index.ts";
import type { World } from "../kernel/index.ts";
import { lineageIcon } from "./inspect/names.ts";

export type Found = {
  readonly ref: string;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: string;
};

/** How well a name answers the words asked (0: not at all). */
export function matchScore(name: string, asked: string): number {
  const n = name.toLowerCase(),
    a = asked.trim().toLowerCase();
  if (!a) return 0;
  if (n === a) return 100;
  if (n.startsWith(a)) return 70;
  // (A word of it that begins so: "Sairis" in "the commonwealth of Sairis".)
  if (n.split(/[\s'’-]+/).some((w) => w.startsWith(a))) return 50;
  return n.includes(a) ? 25 : 0;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US"),
  /** So many of a thing: "1 land", "12 lands". */
  many = (n: number, one: string, more: string) => `${fmt(n)} ${Math.round(n) === 1 ? one : more}`;

/** Every named thing that answers the words asked, the best first (at most `most`). */
export function search(world: World, asked: string, most = 24): Found[] {
  if (asked.trim().length < 2) return [];
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    found: { f: Found; score: number }[] = [],
    offer = (name: string, weight: number, f: () => Found) => {
      const k = matchScore(name, asked);
      // The match first; among equals, the greater (by the log of its weight).
      if (k) found.push({ f: f(), score: k * 1000 + Math.min(999, Math.log10(1 + weight) * 100) });
    };
  const realms = politiesOf(world);
  for (const r of realms.all()) {
    const people = r.members.reduce((n, c) => n + peopleOf(c), 0);
    offer(realmName(r), r.ended === null ? people + 1e6 : 0, () => ({
      ref: r.ref,
      icon: "👑",
      title: realmName(r),
      subtitle:
        r.ended === null
          ? `${many(r.members.length, "land", "lands")}, ${many(people, "person", "people")}`
          : `fell in year ${fmt(r.ended)}`,
    }));
  }
  const cities = citiesOf(world);
  for (const t of ctx.settlements.all()) {
    if (t.population <= 0) continue;
    offer(t.name, t.population, () => {
      const realm = realms.of(t.cell);
      return {
        ref: t.ref,
        icon: cities.get(t.ref) ? "🏙️" : "🏘️",
        title: t.name,
        subtitle: `${many(t.population, "person", "people")}${realm ? `, ${realmName(realm)}` : ""}`,
      };
    });
  }
  // A land by its first town's name ("Sairis's land"), where that is not also the town's.
  for (const p of ctx.provinces.all()) {
    if (offworldSite(g, p.cell) || !p.total()) continue;
    const first = ctx.settlements.inProvince(p.cell)[0];
    if (!first) continue;
    offer(`${first.name}'s land`, p.total() / 10, () => ({
      ref: `cell:0:${p.cell}`,
      icon: "🗺️",
      title: `${first.name}'s land`,
      subtitle: many(p.total(), "person", "people"),
    }));
  }
  const beliefs = beliefOf(world);
  for (const f of beliefs.all()) {
    const lands = beliefs.lands(f.ref).length;
    offer(f.name, lands * 1000, () => ({
      ref: f.ref,
      icon: "✨",
      title: f.name,
      subtitle: lands ? `held in ${many(lands, "land", "lands")}` : "no land holds it now",
    }));
  }
  const langs = languagesOf(world),
    speakers = langs.speakers();
  for (const l of langs.all()) {
    const lands = speakers.get(l.index)?.length ?? 0;
    offer(l.name, lands * 1000, () => ({
      ref: l.ref,
      icon: "🗣️",
      title: l.name,
      subtitle: lands ? `spoken in ${many(lands, "land", "lands")}` : "no longer spoken",
    }));
  }
  for (const w of warsOf(world).all()) {
    const a = realms.get(w.attacker)?.town ?? "the fallen",
      d = realms.get(w.defender)?.town ?? "the fallen",
      name = `the war of ${a} upon ${d}`;
    offer(name, (w.ended === null ? 1e6 : 0) + w.fallen[0] + w.fallen[1], () => ({
      ref: w.ref,
      icon: "⚔️",
      title: name,
      subtitle: `${w.ended === null ? "still fought" : `year ${fmt(w.declared)}–${fmt(w.ended)}`}, ${fmt(w.fallen[0] + w.fallen[1])} fallen`,
    }));
  }
  for (const s of g.life.species) {
    if (s.died !== null) continue;
    const flies = !!s.body && s.body.wings > 0 && s.body.moves === "fly";
    offer(s.name, s.size, () => ({
      ref: s.ref,
      icon: lineageIcon(s.niche, flies),
      title: s.name,
      subtitle: s.niche,
    }));
  }
  // Matter (Phase 15 M122): substances, reactions, principles and goods, by their names.
  for (const m of SUBSTANCES)
    offer(m.name, 5, () => ({
      ref: `subst:${m.id}`,
      icon: "🧪",
      title: m.name[0]!.toUpperCase() + m.name.slice(1),
      subtitle: `${m.written} — a substance`,
    }));
  for (const r of REACTIONS)
    offer(r.name, 5, () => ({
      ref: `rxn:${r.id}`,
      icon: "⚗️",
      title: r.name[0]!.toUpperCase() + r.name.slice(1),
      subtitle: "a reaction",
    }));
  for (const pr of PRINCIPLES)
    offer(pr.name, 5, () => ({
      ref: `prin:${pr.id}`,
      icon: "📜",
      title: pr.name[0]!.toUpperCase() + pr.name.slice(1),
      subtitle: "a principle",
    }));
  for (const gd of GOODS)
    offer(gd.name, 6, () => ({
      ref: `good:${gd.id}`,
      icon: "📦",
      title: gd.name[0]!.toUpperCase() + gd.name.slice(1),
      subtitle: "a good, the world over",
    }));
  const ledger = observer(world);
  for (const p of ledger.persons.values()) {
    const name = `${p.name} ${p.surname}`;
    offer(name, p.alive ? 10 : 1, () => ({
      ref: p.ref,
      icon: "🧑",
      title: name,
      subtitle: p.alive
        ? `born in year ${fmt(p.birthYear)}`
        : `died in year ${fmt(p.diedYear ?? 0)}`,
    }));
  }
  return found
    .sort((a, b) => b.score - a.score || (a.f.title < b.f.title ? -1 : 1))
    .slice(0, most)
    .map((x) => x.f);
}

export const SEARCH_QUERIES = {
  search: (world: World, args: unknown) => {
    const a = args as { text: string; most?: number };
    return search(world, String(a.text ?? ""), a.most ?? 24);
  },
};
