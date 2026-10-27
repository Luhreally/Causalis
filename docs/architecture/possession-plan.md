# Possession: the god's hand made flesh (Phases 60–61, not yet specced)

Asked for 2026-10-27: "oh shit add in functionality to possess anything like worldbox/worldfall mod,
plan for this later and make sure it works right in mobile".

Any figure the world draws near (a townsman at his trade, a soldier on the field before his town, a
beast in the pasture, a creature of the meadow's age) can be taken over and steered by hand: walked,
run, set to work, made to strike, to flee, to talk. Then the body is let go, and the world goes on
from what was done. It must play as well on the phone floor (an iPhone 15 Plus, held in either hand,
in portrait or landscape) as on a desk.

## The one rule it keeps

Watching never changes history; only the god's hand does. Possession is the hand. Taking over a body
lays the hand where that body is (a village, a battle, a meadow; `sim/hand/hand.ts`: one hand at a
time, its people made individuals with the simulation's own draws). Everything the possessed does
there is the god's doing, recorded as such, and history goes on from it, the way it goes on from a
quake cast from the palette.

- **What it changes.**
  - A man struck down by the possessed is dead, or wounded on the struck part (wave 3's wounds,
    the blows' anatomy): the hand's agent dies or is hurt, written back into the counts and the
    roster.
  - Goods carried off move between stores.
  - Work done by hand is the town's work (the making chain's things, made by the possessed, with
    him as their maker).
  - A battle with a possessed soldier in it is fought man by man near him. From the moment he is
    taken, its outcome is decided by the fight on the field, not imported from history, and the
    war goes on from that result.
- **Determinism.**
  - The possessed body's inputs are sampled at a fixed step (20 a second) and kept in the hand's
    store with their moments. The local fight and walk run in the host, at that step, on keyed
    streams of their own (`hand.possess`).
  - Replaying a save gives the same world, step for step. Worlds where nothing was possessed keep
    every hash (oracle unchanged).
- **Told as the hand.**
  - The chronicle gets "the god walked among them as Teadryn the smith, year 402".
  - Pages say what was done by the god's hand ("struck down by the god in Teadryn's body").
  - A people's faith reads it as it reads the god's other acts (Phase 14 omens and the god's name).

## What can be possessed, and what each can do

The things a body can do come from its body plan and its kind, never from a list per species: alien
peoples and beasts get their own moves from their own plans (the first-principles rule).

| Body | Where | Its moves |
|---|---|---|
| A person of a town | the village view (any town; the hand laid on it) | walk/run on the town's ground among its lots, streets and walls; work at the trade in front of them (forge, wheel, loom, field row: the day's thing made by hand); carry and set down; talk (a word bubble, the listener's mood moves); strike or wrestle (a brawl); take goods |
| A soldier on the field | the placed battle before the town (Phase 55 M227) and the close field (Phase 37) | advance, hold, fall back; strike with the arm he bears (edge, point, blunt, shot: the blows track decides where it lands and what it does by arm against protection); block; rally the men near; fly. If he falls, the body is let go. |
| A beast | the pasture, the woodlot, the land about a town (Phase 8–9 fauna; Phase 46 flock) | graze, drink, run, herd, hunt (a predator), flee; a herder's beast breaks from the flock |
| A creature of the meadow's age | the meadow (Phase 27) | move, eat, flee, court, as its lineage's body allows (the creature stage played by hand, as Spore's) |
| (later) a cart, a boat, a train | the land's ways (Phase 26) | drive it along the ways it can go |

## Controls, phone first

- **Taking a body.** The god's palette gets **Possess** (an act like the others). Touch a figure and the
  eye goes down behind it. On a desk, possession can also start from a figure's card.
- **Moving.** A floating joystick under the left thumb: it appears where the thumb lands in the left
  half of the screen. Its tilt is the direction, relative to the camera; pushed to the rim it runs.
  On a desk: WASD or the arrow keys, Shift to run.
- **Acting.** Up to four round buttons under the right thumb, each at least 56 pt, labelled for what
  is in front of the body now. The first is the action that fits ("Strike", "Work the forge",
  "Talk", "Graze", "Pick up"); the second blocks, dodges or sets down; the third runs or rallies.
  **Let go** sits apart, at the top right. On a desk: Space and E for the first two, F for the third,
  Esc to let go.
- **Looking.** Drag on the right half (outside the buttons) to turn the camera about the body. Pinch
  to come closer or stand off. A double tap puts the camera behind the body again. The camera keeps
  off walls and roofs (the village's clearance rules).
- **Seen while possessed.** A strip at the top shows the body's name, what it is, and its body:
  - the members of its plan, whole, struck or lost, drawn live from the same body model as the
    soldier's Body page (Phase 55 wave 5);
  - its strength left, and what it carries.
  The clock runs at the scale's own pace and can be slowed. Time held stops the body too.
- **Touch done right on iOS Safari.**
  - Multi-touch: the joystick and a button are held at once, each tracked by its own pointer id.
  - `touch-action: none` on the controls and the canvas while possessed, so Safari's own gestures
    don't take the touch: no page pinch-zoom, no pull-to-refresh, no text selection or callout on a
    long press.
  - The controls sit inside `env(safe-area-inset-*)`, clear of the Dynamic Island and the home
    indicator, and are laid out again when the phone turns.
  - Nothing relies on vibration (iOS Safari has none): a strike that lands shows on the screen and
    on the body struck.
  - Buttons answer on pointerdown, not on click, so there is no tap delay.
- **Frame budget.** While possessed in a busy town or a battle, p80 frame ≤ 22 ms at 4× CPU
  throttle, at the phone floor's size (430 × 932, DPR 3), as gate 8 and wave 4 measure it. The
  local simulation runs in the worker; the page only draws and sends inputs.

## How it is built (the shape; the specs will say exactly)

1. **The local world (host).**
   - Laying the hand for possession collapses the village (or the battle's field) into individuals,
     as the hand does now, and gives each a body in the scene. A body starts where the view draws
     it at that moment (`momentOf`, the placed battle's troopers, the fauna).
   - Then a small fixed-step simulation moves the bodies near the possessed, within a reach about
     the size of the village drawn: steering, collision with the town's fabric, the actions.
   - Bodies further off go on as the views draw them.
   - On letting go, what lasts is written back: deaths, wounds, goods, made things, a battle's
     result. The views go back to drawing from history, which now holds it.
2. **Inputs (bridge).** `possess.input {t, move, act}` at the fixed step, batched. The host answers
   with the local bodies' states, which the page draws between steps.
3. **The fight.**
   - The blows track (`view/blows.ts`: where a blow lands, by arm against protection) becomes the
     rule the local fight uses. It moves into rules/ so the host can use it, and the views keep
     drawing with it.
   - A possessed soldier's strikes are decided by the same rule as everyone else's.
4. **The page (app/ui).**
   - The possession HUD: joystick, buttons, body strip, Let go.
   - The camera rig behind the body.
   - The palette's Possess act.
5. **Gates.**
   - Possess a townsman on the phone frame in WebKit with touch: walk him to his work, make one thing,
     talk, let go. Check that the thing made is his and the talk moved a mood.
   - Possess a soldier in a placed battle: strike until one falls, see the battle's tally move and
     the fallen man named, let go.
   - Possess a beast.
   - Replay the save: the same world.
   - The frame budget at the phone floor.
   - Desktop keys.

## Order

- **Phase 60 (the person):** possession of a townsman: the local world, inputs, the HUD and the
  controls, the work, talk, a brawl, and the gates on phone and desk.
- **Phase 61 (war and the wild):** a soldier in the placed battle (the hand battle and the outcome it
  decides), beasts and the flock, the meadow's creatures, alien bodies from their plans. Carts and
  boats come after.

Scheduled after Phase 55 (wave 4, the battle before the town, and wave 5, the soldier as a person,
which the body strip reuses) and Phase 56 (world kinds). It goes before Phases 57–59, since it needs
none of them. Each gets its own Opus spec and stage, Haiku coders, and gates, as before.
