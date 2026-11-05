# Lives, leaders and OG Causalis

Asked for 2026-11-04: "bringing back og causalis into this game as something i can load into maybe on
lands i lay my hand on but also like ways to click the key leaders/politicians and see where they live
and the comparative wealth across countries visibly and like crusader kings type drama and sims like
game play i can load into on town view or some, like this is very encompassing game but this
functionality should essentially blend in with the bringing back causalis og, and like can also extend
the possession functionalities we introduced earlier".

This starts now, alternating with the galaxy phases (galaxy-plan.md), not after Phase 73. It changes
two earlier steers: "not character focused" (2026-09-28) and "dynasties secondary" (Classic's
inspiration note). The rest of OG Causalis is folded in here, from classic-inventory.md.

## The rule

**Possession is the way in. There is no separate mode.** Lay your hand on a land, go down to a town and
take anyone. What you can do depends on who they are, and OG's detail, what everything holds and is made
of, stays one tap away. The old game is not embedded: its history would not be this world's.

What a possessed body does is the god's act, recorded, and history goes on from it (possession-plan.md).
So playing someone changes history only when you act, and a world nobody plays keeps its seed list.

## Steps

| Step | What it does | What you see and do | Cost |
|---|---|---|---|
| L1 Leaders you can click | Each country's key figures, who they are and where they live | Open a country's leaders, go to their home in the town view, possess them | Quick: shows what history holds |
| L2 Wealth you can see | Every country's wealth, compared | A world map colored by wealth, a ranking, rich and poor countries side by side | Quick: shows what history holds |
| L3 Live as anyone | A person's home, family, job, needs and day, from the hand on a land down to the town | "Live here" under the hand; take someone and choose what they do: the Sims side | Changes history only when you act |
| L4 Play a ruler | What a ruler can do, by their station: decrees, wars, marriages | Possess a ruler and rule: the Crusader Kings side | Changes history only when you act |
| L5 Courts and drama | Heirs, rivals, councils and politicians, plots, marriages, successions, running without you | Dramas that unfold on their own, each with a why; event windows you can step into | Slow: changes history for every world |
| L6 The rest of OG | What is left of the ranked Classic list, folded into the steps above where it fits | Town and country detail, trade and coin, as each comes up | Mixed |

## L3, as built (2026-11-05)

A life is a possession with a second pace. Press 🏠 Live here in a town, or on a town in a land's panel, and the
hand is laid and a sheet offers up to eight real people. The town view stays as it is, with the clock running their
day at about two minutes a day, a strip of needs, purse, want and rival above, and a tray of choices below.

- Their work is the view's own day, so any trade in any age works with no new placing. 🕹 Walk drops to the
  joystick and ✋ Let go comes back up to the day.
- ⏭ lets months go by on a habit, with the eye held over their home. A window stops the clock: a child, a want
  done, a rival's move, what a child will become. It goes on when answered. At death you go on as an heir.
- Coin is a person's bread for a day, and wages and prices read the real market. Buying moves the real market's
  goods, so "no cloth to be had" is true when it says so.
- Reading and looking move nothing. History moves when Live here is pressed: things made past the day's work,
  goods bought, a marriage, a child taught. Worlds nobody plays keep their exact history, and the eight fixtures
  are unchanged.

Limits, stated: going off with the levy, changing a grown person's work, affairs and same-sex partners are cut for
now (the hand's births need a mother and a father; L5 fixes the kin words first). Rent is 0.5 a day with no law or
eviction behind it. Singles are scarce because the hand pairs every woman at once, so a lived single man may have
no one to court: the want is not offered then, and the Book says so. The numbers are first guesses from one market
at year 300, and all sit in `rules/life.ts`, a table each. Decrees, wars and marriages of state are L4.

### L4, as built (2026-11-05)

A ruler is taken by 👑 Rule as them on a realm's Leaders tab or a ruler's page, 👑 Rule on the chip at their home, or 👑 Rule on the tray of a life lived as them. **Taking them records nothing**: the page alone knows whom it rules, so a world under a ruler who does nothing runs exactly as it would have. The eye goes to their home, and the town view stays. A bar above shows who, the month, people, worth a head and its place, the host, standing and grievance, wars, the heir, and bars of wealth against up to three realms they meet; every part goes to its page. A tray below has Decrees, War and peace, Marriage, The realm, and Walk (the L1 body, back to the bar on letting go). The months go by at a month in five seconds or a month a second, held whenever a sheet, a window or a page is open.

- **Station is read off what the world says they hold.** By birth or by others' leave, and alone or sharing rule, set the share of the realm's voices they must carry (0, 25 or 50 in a hundred). Standing says how far they are heard (under 0.30 a word stops at the seat's door, under 0.20 no one marches). The seat's reach says how far they are obeyed (lands past it chafe at a word they did not want). Nothing written means custom is the law.
- **Decrees** are the four laws, a step at a time, and the tithe, two parts in a hundred. They cost standing by the sway against them and are weighed again by the realm in its turn.
- **War and peace** go through the same store and the same year as any war, for a land named on the frontier, which its battles then go for. A foe winning by two battles holds out against peace; a civil war cannot be asked to end.
- **A marriage of state** moves one number, what the two realms think of each other (0.1 + 0.5 x the two peoples' mean kinship, halved if a seat is not held by birth, fading by half in thirty years). War and pacts read it. It is kept on both realms' orders, so the family page shows it. The people are the keyed family a ruler's page already shows. Two of one sex are not yet wed (L3's limit). A people with kinship under 0.15 keep no houses, and a house under -0.85 gives no one.
- **The fall** says how (a death at an age, a coup's own words, a realm ended) and offers whoever holds the seat. Going on records nothing either.

Limits, stated: the eldest child shown is the keyed family's, and whoever history crowns may be another. The numbers are first guesses, all in `rules/reign.ts`. Heirs, rivals, plots, councils and running on their own are L5.

### L5, first slice, as built (2026-11-05)

A realm is no longer a ruler and a line of events. It has a court: a handful of real people per standing realm, kept in `court.states`, each with a page, a home in the seat's town and a body to take. A Court tab stands beside Leaders.

- **An heir who is in history.** Whoever the court holds as heir takes the seat, unless a claim made at that hour carries it, and what stopped them is told. The child on a ruler's family page is now the one history names. Whether a seat passes by blood or by voices comes from the orders and from how the people count kin: under 0.15 they keep no houses, and no one is heir by blood.
- **Voices.** Those who hold sway (`the army`, `the court`, `the temple`, `traders`) have one person each at court: one voice where rule is held alone, up to four by the share a ruler must carry. What each wants is what their group presses for hardest.
- **A rival** is someone grown who wants the seat, for reasons that are numbers history already holds: their group's sway, how few hold the rule rightful, a seat by leave, a child on the seat or as heir, no heir, battles lost, a law the powerful are against, a wrong done to them, valour against custom, the rule's age.
- **A plot takes a year**: `court.plot` when they move, `court.seized` or `court.found` a year on, drawn when it moved. The army's coups go the same way under the name of its voice, weighed exactly as before. One found, or a claimant beaten, may flee and raise the far lands, and that civil war's first cause is a person. A child on the seat means a regency.
- **Stepping in.** Ruling, a plot against you or an heir's death stops the clock with a window. `court.answer` seizes or buys off, `court.name` names an heir, and "Let it come" sends nothing, so the realm decides it exactly as it would with no one there.

Coups, civil wars, realms ended and successions all held within what a century's chance gives, on six worlds. Limits, stated: marriages of state still move regard and give no claim, and the kin words wait with them; a voice does nothing of their own but plot; the numbers are first guesses, all in `rules/court.ts`.

## What is known, and what is not

- Realm pages show rulers: a name, since when, and the event that made them. Their Court tabs show heirs,
  rivals and the voices of those who hold sway (L5).
- History records no home for a ruler. L1 derives one in the seat town from the ruler's identity, the same
  home every time, and their page says so.
- A hand on a town of more than 50,000 holds a ward of 50,000 one by one and counts the rest as a land's
  people are (sim/hand/hand.ts, HAND_HOLDS), so any ruler of any town can be taken. A town of 58.66 million
  takes 81 ms to lay and 698 ms a year.
- Possession today gives a body a joystick and up to four actions (work, talk, strike). L3 and L4 extend
  those actions and add a person's day and a ruler's powers.

## What stays fixed

Watching never changes history. Everything new has a page and a why. Phone first, with the iPhone 15 Plus
as the floor. A step is done when it can be watched and used on the phone. One Opus planner at a time.
