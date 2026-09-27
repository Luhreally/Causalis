// A page's way up (Phase 10 M96): the world, then the realm, the land, the town and the
// household a thing is part of — each a link — as a grand strategy game's windows lead from
// a province to its country. The page's own thing is not in it: the way leads up to it.
import { cellRef } from "../../gen/index.ts";
import { observer } from "../../causal/index.ts";
import { politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Line, Span } from "../../bridge/index.ts";
import { link } from "./words.ts";
import { landTitle } from "./names.ts";
import { landOfRef } from "./land.ts";

/** Which of the ledger's tabs a kind of thing is compared in. */
const LEDGER_TAB: Readonly<Record<string, string>> = {
  faith: "faiths",
  lang: "tongues",
  spec: "life",
  war: "wars",
};

/** The way up to a page's thing: each step a link, "The world" first. */
export function crumbsOf(world: World, ref: string): Line {
  const out: Span[] = [],
    add = (text: string, to: string) => {
      if (out.length) out.push(" › ");
      out.push(link(text, to));
    },
    realms = politiesOf(world),
    realmOf = (cell: number) => {
      const r = realms.of(cell);
      if (r) add(r.town, r.ref);
    },
    landOf = (cell: number) => {
      realmOf(cell);
      add(landTitle(world, cell), cellRef(0, cell));
    };
  // (The world's own pages are the top of the way; a concept's leads up to the book.)
  if (ref.startsWith("world:") || ref === "concept:index") return out;
  if (ref.startsWith("concept:")) {
    add("The book of concepts", "concept:index");
    return out;
  }
  add("The world", "world:chronicle");
  const code = ref.slice(0, ref.indexOf(":"));
  try {
    switch (code) {
      case "cell":
      case "regn":
      case "folk":
      case "ways":
        realmOf(landOfRef(ref));
        break;
      case "town": {
        const t = populationContext(world).settlements.get(ref as Ref);
        if (t) landOf(t.cell);
        break;
      }
      case "hhold": {
        const h = observer(world).household(ref as Ref);
        if (h) {
          landOf(h.cell);
          const t = h.village ? populationContext(world).settlements.get(h.village) : undefined;
          if (t) add(t.name, t.ref);
        }
        break;
      }
      case "prsn": {
        const ledger = observer(world),
          p = ledger.person(ref as Ref),
          h = p ? ledger.household(p.household) : undefined;
        if (p) {
          landOf(p.cell);
          const t = p.village ? populationContext(world).settlements.get(p.village) : undefined;
          if (t) add(t.name, t.ref);
          if (h) add(`the ${h.surname} household`, h.ref);
        }
        break;
      }
      case "war": {
        const w = warsOf(world).get(ref as Ref),
          a = w ? realms.get(w.attacker) : undefined;
        add("The ledger", "world:ledger#wars");
        if (a) add(a.town, a.ref);
        break;
      }
      case "ev": {
        // A battle: the war it was fought in.
        const w = warsOf(world)
          .all()
          .find((x) => x.battles.some((b) => b.event === ref));
        if (w) {
          const a = realms.get(w.attacker),
            d = realms.get(w.defender);
          add(`the war of ${a?.town ?? "the fallen"} upon ${d?.town ?? "the fallen"}`, w.ref);
        }
        break;
      }
      default:
        if (LEDGER_TAB[code]) add("The ledger", `world:ledger#${LEDGER_TAB[code]}`);
    }
  } catch {
    // (A thing gone leads up only to the world.)
  }
  return out;
}
