// The book of concepts on strife (Phase 22 M145): the army as one of a realm's voices, a coup,
// and a realm ruled by its army. Each says how the world works it, as it does.
import type { Concept } from "./concepts.ts";

const LEDGER = { text: "Every coup, side by side", ref: "world:ledger#strife" };

export const STRIFE_CONCEPTS: Readonly<Record<string, Concept>> = {
  "army-sway": {
    icon: "🛡️",
    title: "The army's voice",
    what: [
      "A realm's army is one of its interest groups. In peace it is a share of the men it could field — a chief's band, a seat's guard; in war, most of them; where the realm keeps a standing army, all of them. It is heard the more under a chief or a council of elders, the less in an assembly, and above all under a general.",
      "It wants its pay — more tribute, the more at war, the more again where it rules — and, the more its people prize valour, war on the neighbour its realm resents most. Its wants weigh on the realm's tithe, its wars and its laws (it holds with the lord's land, strangers as subjects and the ruler's courts).",
    ],
    drives: ["The men a realm fields; a standing army; war; who leads."],
    leads: ["A heavier tithe and readier wars; a coup, where the rule is doubted."],
    see: [LEDGER],
    related: ["coup", "military-rule", "tithe", "war"],
  },
  coup: {
    icon: "🗡️",
    title: "A coup",
    what: [
      "Where a realm's rule is doubted, a general may reach for its seat. The army weighs it by its own sway, the battles lost (it blames the court) or won (a victorious general has a following), an army unpaid in a hungry year, what is skimmed and a people who prize valour — and against it a seat that reaches its lands, an army of citizens under an assembly, a sacred throne, an old rule. Above the line, it is the likelier each year the further above.",
      "A coup tried is won the more often the more the army is heard and the more the rule is doubted. Won, the general takes the seat and the realm becomes a protectorate, ruled by its army; the old court's skimmers are purged. Foiled, the plotters are purged, the army cowed for twenty years, and the court stands the firmer for a while.",
    ],
    drives: [
      "A rule doubted; the army's sway; battles lost or won; hunger at the seat; corruption; valour.",
      "Against it: a seat's reach, an assembly, a priest-king, an old rule.",
    ],
    leads: ["A protectorate, ruled by its army — or plotters purged."],
    see: [LEDGER],
    related: ["army-sway", "military-rule", "legitimacy", "corruption"],
  },
  "military-rule": {
    icon: "🎖️",
    title: "A realm ruled by its army",
    what: [
      "A realm whose seat a general has seized is a protectorate. Its rulers are chosen by the army; its army is heard above all; it fields more of its men, and wants war the more. Its people hold a rule seized by the sword the less rightful, the more so the fresher the seizure, for a generation.",
      "Its own rule — of its people's ways as they are now — is given back when its standing returns, when its people press for a voice, or above all when a general dies and none is chosen to follow; a general may also be overthrown by another.",
    ],
    drives: ["A coup won."],
    leads: [
      "Heavier tithes, readier wars; a rule held the less rightful for a generation.",
      "Its own rule restored, in time.",
    ],
    see: [LEDGER],
    related: ["coup", "army-sway", "legitimacy", "realms"],
  },
};

/** The labels on pages that are measures of these concepts. */
export const STRIFE_CONCEPT_OF: Readonly<Record<string, string>> = {
  "Under arms": "army-sway",
  "Its army's sway": "army-sway",
  "A coup": "coup",
  Coups: "coup",
  "Ruled by their armies now": "military-rule",
  "Rule restored": "military-rule",
};
