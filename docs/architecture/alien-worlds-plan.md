# Truly alien worlds — after Phase 55 (Phases 56–59, not yet specced)

Asked for 2026-10-26: "add this into later plans too", of these suggestions made at Phase 54's end:

> - Whole new kinds of worlds: carbon worlds, ice and ammonia worlds, sulfur-volcano worlds, methane
>   worlds. Each would have its own liquids, materials and path through the ages, like ice tools,
>   carbide blades, or methane instead of wood for fuel.
> - Alien biochemistry for their life: different fibres, dyes, foods and body matter.
> - Their own names: each people names its materials in its own language (the game already has
>   languages), with the field guide giving the real chemistry, much like the original's field guide.
> - Or invented elements, like the original's "Kelium" and "Nyxite", if you'd rather have fiction
>   than physics. That breaks the first-principles rule, so it's your call.

Phase 54 gave each world a bulk chemistry from its star and orbit (carbon, metals, silica, air,
redox, hardener) and its own stones, ores, metals, rocks and furnace heats, with Earth pinned to the
Sun's own. All of those worlds are still rocky, watery, oxygen-breathing ones. This plan goes past
them, keeping one rule: **nothing a world does may break physics or chemistry**. Where a suggestion
would ("methane instead of wood for fuel" on a world with no oxygen), the plan says what the world
does instead, and that is where the novelty comes from.

## Phase 56 — world kinds (the liquids, the rock, the fire)

A world's kind comes from what the making already sets (star, orbit, pull, seas, air;
rules/making.ts) plus two new inputs: its **carbon-to-oxygen ratio** and its **volatiles** (which
ices it gathered past the snow line). The kind sets its liquid, its bedrock, its air, and what
burns. Each kind's tables go beside Earth's and Phase 54's NOVEL tables, never replacing them.

| Kind | What makes it | Liquid / rock / air | What burns, and what they make with |
|---|---|---|---|
| **Carbon world** | C/O above about 0.8 in its disk (Kuchner & Seager 2005) | Hydrocarbon tars; carbide and graphite crust, diamond below; CO and methane air, little free oxygen | Silicon carbide (moissanite, Mohs 9.3) knaps like flint, and diamond grit edges. Metals come as carbides, so they need no smelting but the carbon must be burnt out, and oxidant is the scarce thing. Fuel is everywhere, air to burn it is not. |
| **Ice and ammonia world** | Cold, past the snow line, or a far orbit | Ammonia–water (liquid down to 176 K); water ice as bedrock (at −78 °C ice is about Mohs 6); nitrogen air | Ice tools: blades and walls of hard cold ice, worked by melting and freezing. No fire without an oxidant: heat comes from the ground and the tides, kept, not made. |
| **Sulfur-volcano world** | Tidal heating (Io), or young volcanism with sulfur | Molten sulfur lakes (they melt at 115 °C), sulfuric acid; SO₂ air; sulfide rock | Where some oxygen is in the air, sulfur is a fuel. Acid leaches ores in place of a furnace. Sulfur concrete builds walls. |
| **Methane world** | Titan-like: cold, thick nitrogen air, organic haze | Liquid methane and ethane seas; ice bedrock hard as granite at 94 K; tholin dunes as soil | No oxygen, so nothing "burns". Energy for life and work comes from acetylene with hydrogen giving methane (McKay & Smith 2005). Tools of ice and tholin polymers. Metal is all but out of reach, so their ages climb through ice, polymers and cold chemistry, not bronze and iron. |

- **Ages by kind:** the principles a people can come to (rules/principles.ts) are gated by what
  their world holds and what physics allows, the way Phase 54 gated the furnace by heat. A world
  without a metal age gets its own ladder of ages, with the field guide and the tech pages
  saying why ("no furnace can be built where nothing burns").
- **Calibration:** surveys across open seeds (tools/chem-survey.ts) for the share of each kind, and
  for each kind reaching its ages. Earth and Phase 54's worlds stay bit-identical (oracle).

## Phase 57 — alien biochemistry

Life is made of what its world holds and dissolved in what its world has as a liquid. The tree of
life (Phase 17) and a people's look (Phase 34, folkFacts → folkLook) read from it, and so do the
goods.
- **Body matter:** bones of silica, calcium carbonate or iron sulfide (as Earth's scaly-foot snail
  grows); shells; blood carrying iron, copper or vanadium; cold-world cell membranes of
  azotosome-like films in methane (Stevenson et al. 2015, offered as a possibility).
- **Fibres, dyes, foods:**
  - fibres from the polymers that life makes;
  - dyes from the pigments its light favours (a red dwarf's life darker, as Phase 54's chemistry
    already reasons);
  - foods only what a people's metabolism can take: their own chirality and their own sugars.
  These enter the matter tables as NOVEL substances with real formulas, and the making chain uses
  them (cloth, rope, dye, bread) as it uses Earth's.
- **What eats what:** a people cannot eat another world's life unless their chemistries match.
  This matters for colonies and contact (Phase 20).

## Phase 58 — their own names

Each people names each material in its own tongue (the languages of sim/culture; Classic's 48):
- "black-edge-stone" in their morphemes for moissanite, "cold-blood-ice" for ammonia ice. The
  names are built from the words for what the thing is like: colour, use, where it is found.
- **The field guide gives both:** their name first, then the real chemistry (formula, what it is,
  its properties), as Classic's field guide did. The pages switch between "as they call it" and
  "as it is".
- **Each people their own:** two peoples of one world name the same stone differently. Trade
  carries loanwords (a name crossing a road with the thing).

## Phase 59 — invented matter (an option, off by default)

The user's call, made 2026-10-26: plan it. Fictional elements such as Classic's "Kelium" and "Nyxite"
are a **Creator's dial at world making** ("Invented matter: off / a few / many"), off by default, so
worlds stay first-principles unless the player asks.
- With it on, a world draws a few invented elements, each with fixed made-up properties (mass,
  state, sort, what it joins with, what it does).
- They stay consistent within that world: they enter the same tables, reactions, furnace heats
  and pages as real matter.
- The field guide marks them plainly: "not of this universe's physics: of this world's making".

## Order

After Phase 55 (warfare), before the rest of the Classic inventory (classic-inventory.md):
56 world kinds → 57 biochemistry → 58 names → 59 invented matter. Phases 57 and 58 can interleave
with Classic work, since they touch the culture and life code, not the war code. Each gets its own
Opus spec, Haiku coders, and gates, as Phases 52–55 did.
