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

Found by pressing, after the spec: a person's page said nothing where history had nothing to tell yet, and now says so under its own heading. A window for an heir's death comes only where the heir is not the voices' choosing, since an heir they would choose anyway costs no one a decision. A plotter can die in the year of their plot, and then it comes to nothing and is not told as found (Tuk Lilindis at 41, on Earth at 450): that is the world working, so gate 79 keeps spare plots rather than fixing the odds. A court can part a realm before the first war does: a plotter who flees may take far lands with them.

Coups, civil wars, realms ended and successions all held within what a century's chance gives, on six worlds. Limits, stated: marriages of state still move regard and give no claim, and the kin words wait with them; a voice does nothing of their own but plot; the numbers are first guesses, all in `rules/court.ts`.

### L6, first slice: homes, as built (2026-11-06)

A home can be looked into. 🏠 Look in, on a home's page, a lot's or a household's, or 🏠 Go in on the tray of a life, puts the town away, holds the clock and lifts the roof off a cutaway of that home. It adds no state and no events: **reading moves nothing**, the gate compares every hash before and after, and history moves only when someone in it is taken.

- **What it holds is what its people need, what their land allows and what they can pay for.** `rules/dwelling.ts` is a table of needs (sleep, cook, sit, keep, wash, read, tell the hour), each with its ways, best first, each asking something of the world and costing goods at this market's prices. The first way they can pay for stands there. Nothing says a family at a level owns a thing.
- **Coin is read, not rolled**: wages from L3's table, this market's bread, the land's making as L2's book has it, standing by their street and their own key, rent, and a seat at court. A home's rooms are as many as they can pay for and its level gives.
- **Any body, any world.** A water people sleeps in kelp hammocks in round chambers, warms a stone at a vent and keeps a kelp knife, not a hoe. A people who cannot grip cook at a fire pit, keep things in niches in the wall, and never sit to a table. Wood comes from trees standing there or from a market that deals in what is made of it. A people who keep no houses have one hall for all who sleep there, and no family's name on it.
- **Tap anything.** A thing says what it is for, what it is made of, how good it is, who made it (a real hand at the works where one is to be found), and its worth at the market. A person gives their page, 🖐 Possess and 🏡 Live as. 🚪 Back out returns the eye to where it stood, and to the person it was following.
- A ruin holds what was left (a pot only if it wasn't burnt). A ruler's home has two rooms more than its level gives. A flat says which floor of how many.

Found by pressing, after the spec: 90% of the homes of a world with screens and cold boxes ate on a mat, because wood was read off the trees outside the door. A wall was given up on when one long thing did not fit, so halls of beds had no room for anything else. A life's 🏠 Go in opened on an empty picture, the life's own eye still following its body, and the button itself lay off the edge of a phone. Round walls stood out from their rooms like fins. A home's buttons lay over a page's words.

Measures, Earth `first light`, year 1500, 430 by 932: opening a home took 25 ms for one room (43 parts) and 4 ms for seven rooms on three floors (184 parts); nothing runs per frame once the roof is off, nothing at all for one who never opens a home. Poor against rich: 34 colours against 40, 62% of the shot different.

Limits, stated: the frame cost on a slowed phone is not measured. Hive and burrow chambers are laid out but no such town has been pressed. A person's page has no Look in yet, for those met or for agents. Rent has no law behind it. Every number is a first guess in `rules/dwelling.ts`. The next three: 144 Homes view (a lens of who owns or rents), 145 Wages (wages paid and rent owed in history), 89 Markets and coin (a town's price board).

### L6, second slice: what things cost and who pays, as built (2026-11-06)

A town's money can be read at a touch. 💰 on the town's bar turns every home and its lot from deep violet to gold by what its people have to spend, with a legend of the ramp, its two ends in coin, and who owns and who rents. Tap a home for its page. Anyone's page now leads with **Home** and **A day's work**, and under their first facts, 🏠 Look in and "Where they live, and what it comes to": their home, what a day's work brings and what that buys here, what they pay and to whom, and what is left. Nothing is kept: **reading moves nothing**, and the gate compares every hash before and after.

- **One reckoning.** `reckonDay` and `wageTimes` in `rules/dwelling.ts`, `reckonHome` in `host/home.ts`. A home's furniture, its page, the lens and a person's page all read the one sum, and the gate checks they agree. One lived as reads their own: `dayWage`, their real purse and the rent their strip pays, not the home's estimate.
- **Three readings of a home changed, none of them history.** A family's standing is now 30% how near the square, 50% the repute of their street (a key to their block of 8 lots), 20% their own: it was 35% and 65% their own, which is confetti, and no street could be rich. A child brings in nothing, even where the record gives them an occupation. A ruler pays no rent: it goes with the seat.
- **The ramp is the town's own spread**, from its 3rd to its 97th percentile of coin, because the five word bands gave two colours in nearly every far town. A spread narrower than 6 times is laid about its middle, so homes nearly alike stay nearly one colour.
- **Cheap.** `homeMoney` furnishes nothing, 5.7 to 17.6 ms a town where `homeSurvey` takes 269 to 949 ms. Nothing is asked of the host until 💰 is pressed, and the layer has no per-frame work (a single check for leaving the town, only while it is on).

Tally of 160 towns of each far save, by word band (very little / little / enough / plenty / a great deal):

| Save | Homes standing | Bands | Let |
|---|---|---|---|
| `first light` 1500 | 775,568, plus 66,370 ruins | 0 / 1 / 34 / 64 / 0% | 50% |
| `gale 710` 1500 | 940,815, plus 34 ruins | 2 / 5 / 35 / 57 / 0% | 75% |
| `kestrel 557` 2000 | 689,300 | 3 / 9 / 45 / 42 / 0% | 96% |
| `first light` year 30 | 2,769 | 33 / 19 / 40 / 8 / 0% | |

No town of the 160 was one colour. A young world is poor, as it should be: a third have very little, mostly falling short of their bread. On and off differ in 44% of the shot at Pedackholt, `first light` 1500, 47% in a town of halls or of ruins, 42% in a town at war, 53% on a water world.

Found by pressing, after the spec: one lived as read "To live there: nothing" over a sum that took rent. A town with no fabric of lots keeps its homes in a ring about a wide ground, and the lens had nothing to say to an eye over its middle: the eye now stands back until they are in sight, and comes back when it is turned off.

**What wages and rent moving through history would need:** a store of households' purses by land, read and written each year in `sim/economy`, with wages paid out of a market's real output and rent moved to an owner the realm's law names; that owner must exist, a lord or landlord class per land which the courts could seat (L5). Then a rule version bump on both universes and the seed list. Eviction, debt (Phase 21's credit could hold it) and a class tally on the wealth lens would follow. Until then this slice is a reading, and the page says "History keeps a land's market, not a family's purse".

Limits, stated: the frame cost on a slowed phone is not measured (the lens adds at most 9 draw calls, nothing per frame). A home's level does not enter its coin, so a gold hut can stand beside a violet tower. A person past those a town draws has no address, because a plan stops at 160 homes. Hive and burrow towns under the lens have not been pressed. The next: 89 Markets and coin, a town's price board.

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
