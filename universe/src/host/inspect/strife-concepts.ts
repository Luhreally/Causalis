// The book of concepts on strife (Phase 22 M145): the army as one of a realm's voices, a coup,
// and a realm ruled by its army (M146: a civil war, a revolution). Each says how the world works
// it, as it does.
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
  "civil-war": {
    icon: "⚔️",
    title: "A civil war",
    what: [
      "A realm may go to war with itself. When a ruler dies in a crisis and its far lands break away under a rival claimant, the claimant fights for the throne — seven times in ten where rule passes by birth (kin's claims are the hardest to set aside), less where it passes by choice or by acclaim. A general whose coup was foiled may flee to the far lands and raise them; a revolution's old court may do the same; the god may raise a pretender. And where the bound rose and won a realm of their own, their old masters — where they still hold the bound, keep to rank and are the stronger — may march on them to take them back.",
      "Its host marches on the realm's seat, battle by battle, as in any war. If it takes the seat, the throne is the claimant's: the old realm falls and its lands pass to the new. When peace comes short of that, whether the rising is put down is weighed: the likelier if it was beaten back, the more the realm's host outweighs its own, and the less the farther the realm's seat is from reaching those lands — a realm that broke because it could not hold its far lands seldom wins them back. Put down, its realm ends and its lands return, aggrieved; else the realm stays parted for good. The freed, taken back, are bound again.",
    ],
    drives: [
      "A succession in crisis; a foiled coup; a revolution; the god's hand; the freed.",
      "Rule by birth, for a throne contested.",
    ],
    leads: ["A throne taken, a rising put down, or a realm parted; the fallen of both sides."],
    see: [LEDGER],
    related: ["realms", "war", "coup", "revolution"],
  },
  revolution: {
    icon: "🔥",
    title: "A revolution",
    what: [
      "Where a realm's people press for a voice or for the land, they may rise at its seat. It is weighed by how doubted the rule is and how strong the movement, by hunger at the seat and a seat that cannot reach its lands, by ideas of a voice and of rights where philosophy is known, and by the many massed in workshops where there are factories — and against it an army loyal to the seat (the more so a general's) and rank set hard. Philosophy and the factory feed the movement for a voice too: an age of revolutions comes with them.",
      "Won, the realm becomes a commonwealth, its rulers acclaimed: its court is purged, its rank broken, one law holds for all — and the land goes to those who till it, if that is what they rose for. Its new rule holds a generation before its people's ways may reform it. Its old court may flee to the far lands and fight to return. Lost, it is drowned in blood at the seat: remembered as a massacre, its movement broken, its rank the harder.",
    ],
    drives: [
      "A doubted rule; a movement for a voice or the land; hunger; a thin reach.",
      "Philosophy, and the factory.",
    ],
    leads: [
      "A commonwealth, one law for all, the land to its tillers — or a massacre remembered.",
      "A counter-revolution, sometimes.",
    ],
    see: [LEDGER],
    related: ["movement", "legitimacy", "civil-war", "laws"],
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
  "A civil war": "civil-war",
  "It came to": "civil-war",
  "Civil wars": "civil-war",
  "A revolution": "revolution",
  Revolutions: "revolution",
};
