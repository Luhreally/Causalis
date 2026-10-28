// node tools/ci-gates.ts <gate>... — a shard of CI's browser gates (the journey shared out over
// runners side by side: .github/workflows/test.yml). Each gate named runs in turn with its CI
// arguments; one that fails runs once more, since a runner's software GL and slower clock make the
// odd timing miss, and only a gate failing twice fails the shard. Every gate named runs, whatever
// failed before it.
// node tools/ci-gates.ts --plan N — the gates shared out over N shards by their time on a runner,
// longest first to the least loaded (the workflow's matrix is written from it).
// On CI a gate's second run keeps a picture of each step (gates from Phase 17 on take --shots) in
// shots/gate-N, which the workflow keeps when its shard fails.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** A gate CI runs: its phase, and its part where a phase has a second ("55b": tools/phase55b-gate.ts). */
type Gate = { gate: number; part?: string; args: readonly string[]; s: number };
/** The gates CI runs in a browser: their CI arguments, and how long each took on a runner (s, run 2026-10-26). */
export const GATES: readonly Gate[] = [
  // The Phase 7 gate's journey: the brief's journey walked at a phone's size in WebKit,
  // every step answered with its why (to the Earth seed's year 1450, its first war
  // between the stars fought). The phone's budgets need a GPU; they run locally:
  // npm run gate:7.
  { gate: 7, args: ["--sky-year", "1450", "--no-budgets"], s: 540 },
  // The Phase 8 gate's world: hunters and their game, a hunt run, a village's flock,
  // people carrying, a mine, another people's world visited, and the same history at
  // every setting. Its per-setting budgets run locally: npm run gate:8.
  { gate: 8, args: ["--no-budgets"], s: 142 },
  // The Phase 9 gate: every beast a body of its own in a web of eating, a village's day
  // seen (its people kept out of its walls), its wars drawn, one zoom from a person to
  // the galaxy and back, and the genesis played through to where to begin. Its hand-over
  // timing needs a GPU; it runs locally: npm run gate:9.
  { gate: 9, args: ["--ci"], s: 322 },
  // The Phase 10 gate: everything a page, its numbers explained; tooltips; the political
  // map and its chrome (search, the outliner, the chronicle, the ledger); zoom both ways
  // toward the pointer, a battle seen from the globe to its village; go-to flights; free
  // roam walked and flown through the scales.
  { gate: 10, args: ["--ci"], s: 661 },
  // The Phase 11 gate: realms' arms on their pages and beside their names; hosts as
  // counters on the globe and in a land; a great happening in its window, the clock waiting
  // and the god's hand answering; realms side by side and a war's tally; the realms' map
  // closer, taken lands in shadow and sieges marked.
  { gate: 11, args: ["--ci"], s: 230 },
  // The Phase 12 gate: the god's palette (an act's reach lit and said, cast, playing where it
  // fell); the peoples in its hand (peace made and war set between two realms); the deeper
  // lenses and their tooltips; the world in numbers; armies seen on the globe and in a land;
  // the palette on a phone.
  { gate: 12, args: ["--ci"], s: 202 },
  // The Phase 13 gate: disasters from the palette (a quake, fire from the sky and its crater,
  // a river raised); makings (settlers, a blessing, two realms made one); a battle played out
  // in its land; a realm's army and a war's course.
  { gate: 13, args: ["--ci"], s: 221 },
  // The Phase 14 gate: a people's ways, a tongue and a faith from the palette; the ways and
  // belief lenses and their tooltips; one of the people under the hand (their traits as
  // chips, their family tree walked, a trait given); a people read, the god as they name it.
  { gate: 14, args: ["--ci"], s: 286 },
  // The Phase 15 gate: matter (a substance found by name, a reaction, a principle, a good's
  // ways); stores broken down and balancing; the goods lens.
  { gate: 15, args: ["--ci"], s: 239 },
  // The Phase 17 gate: the tree of life (every line of descent charted, the first of each
  // kind of body drawn, a lineage's ancestry, a forebear's page from its row; on a phone).
  { gate: 17, args: ["--ci"], s: 66 },
  // The Phase 18 gate: the sky alive (life on other worlds told and drawn; ships, landings,
  // contact, exchanges and wars as they come).
  { gate: 18, args: ["--ci"], s: 240 },
  // The Phase 19 gate: bonds and freedoms (a realm's order and who it holds, the book's page
  // of its standing, the lenses of bondage and of standing, the ledger's bonds, the god's
  // sign against a rule; the Order tab on a phone).
  { gate: 19, args: ["--ci"], s: 87 },
  // The Phase 20 gate: sickness (every sickness side by side, the deadliest's page and its
  // drop of blood under the glass, the book's page of a sickness, the lens of sickness, a land
  // warded by the god; a sickness's page on a phone).
  { gate: 20, args: ["--ci"], s: 238 },
  // The Phase 21 gate: credit (every house of lending side by side, the greatest's page and
  // the book's page of credit, a realm's war chests, the lens of debt, a house broken by the
  // god; a house's page on a phone).
  { gate: 21, args: ["--ci"], s: 172 },
  // The Phase 24 gate: the dawn, played (the deep clock run and paused, the first seas' drop
  // alive and fed, a cell followed, what prospered under the hand laid on the seed, an age
  // cooled and the world remade from it, the world begun the world remade; on a phone).
  { gate: 24, args: ["--ci"], s: 98 },
  // The Phase 25 gate: towns seen growing on the land (drawn from their fabric, with their
  // fields and roads, as the land's clock runs), and in a town a tap on a building, a home
  // and the walls each opening its page; a building's page on a phone.
  { gate: 25, args: ["--ci"], s: 430 },
  // The Phase 26 gate: a land's ways busy (carts, wagons and ships as its era has them), and its towns
  // watched growing.
  { gate: 26, args: ["--ci"], s: 342 },
  // The Phase 27 gate: the ages lived, from the Earth seed's beginning (the land bare until life comes
  // ashore, then the beasts of each age's lineages going about their lives).
  { gate: 27, args: ["--ci"], s: 93 },
  // The Phase 28 gate: the peopling played (the bands going out over the globe land by land, each
  // family of tongues named and told as it comes).
  { gate: 28, args: ["--ci"], s: 247 },
  // The Phase 29 gate: the bands on the land (their camps about the greatest, tents round their fires,
  // each camp named).
  { gate: 29, args: ["--ci"], s: 147 },
  // The Phase 30 gate: the weather near (the god's rain sent on a land from the palette, falling on a
  // band and greening the land about them).
  { gate: 30, args: ["--ci"], s: 71 },
  // The Phase 31 gate: the world's stage beside the date at every scale, and the eye that watches by
  // itself.
  { gate: 31, args: ["--ci"], s: 103 },
  // The Phase 32 gate: the countryside about a town as Classic drew it (the fields bounded in
  // their land's manner, a patchwork of crops, orchards, barns, windmills turning, the pasture
  // fenced) and the year on it (blossom, scarecrows, fruit, hay; none of them in winter).
  { gate: 32, args: ["--ci"], s: 64 },
  // The Phase 33 gate: a town's feasts and market days (bunting and tables, the bonfire at
  // dusk, the town at the tables and dancing in a ring about it; the stalls of a morning).
  { gate: 33, args: ["--ci"], s: 157 },
  // The Phase 34 gate: a people's own look, made of their world (four worlds never seen, each
  // people's stance, arms, eyes, what grows on them and their hide; Earth's upright apes).
  { gate: 34, args: ["--ci"], s: 216 },
  // The Phase 35 gate: the world's making under the god's hand (its star, pull, orbit, seas and
  // air on the title's dials and in its genesis; the world begun as made, its page telling it).
  { gate: 35, args: ["--ci"], s: 23 },
  // The Phase 36 gate: the thread back to the beginning (a life's Origins, from their birth back
  // through their town, land, people and line to the world and its galaxy; on a phone; on a
  // world the hand made).
  { gate: 36, args: ["--ci"], s: 42 },
  // The Phase 37 gate: battles seen (a battle of history watched on its field, the world held
  // while its own clock runs, held and sped and drawn back and forth; its hosts in proportion and
  // as many fallen as history says; one who fought followed; back to the land; on a phone) and
  // Phase 55's blows where they land (wounds, parts cut off, the wounded going back, arrows stuck;
  // the setting; on a phone). (Its time with the blows estimated from software GL: 75 → 113 s.)
  { gate: 37, args: ["--ci"], s: 130 },
  // The Phase 38 gate: wars seen unfolding (a war of history played again on the globe, the
  // world held while its own clock runs, held and sped and drawn back and forth; its battles in
  // their turns, drawn and marked, its fallen tallied, its end told; one of them watched fought
  // and back to the war; from the ledger and the war's page; on a phone).
  { gate: 38, args: ["--ci"], s: 172 },
  // Phase 39 (the town lived: its many drawn; its people at the work its needs set them —
  // reaping, the sheaves to the granary, beams to what is going up; its stores heaped, on the
  // line under its bar and on their card; one of them tapped, what they do and why).
  { gate: 39, args: ["--ci"], s: 921 },
  // Phase 40 (war in place: a war of history played on its land on the world's clock — the
  // attacker mustered at its border and marched by the roads, the defenders' garrison rallied,
  // the two drawn up, the clock left to run and slowed toward the battle and through the night
  // before it, the battle fought the morning after the year's turn, the rout; on the globe, its
  // host going between; before a town, the battle laid and fought in place). (Its time with the
  // clock run across the turn estimated from software GL.)
  { gate: 40, args: ["--ci"], s: 345 },
  // Phase 41 (a town's trades at their own buildings: its children at their letters in the
  // school's rows and one teaching them, its potters at the kiln aglow, sparks at the anvil;
  // its woodlot's trees felled, lying and carried off, their stumps; a day of rest's prayer).
  { gate: 41, args: ["--ci"], s: 114 },
  // Phase 42 (the god's hand in a town watched: fire sent on a home of it from the palette, its
  // homes catching and burning, the town come running — throwing water, a line passing
  // buckets, others watching — the flames out and the ruins smouldering; a spring set where
  // touched; its land shaken: the ground shaking, homes down in dust, the rubble dug).
  { gate: 42, args: ["--ci"], s: 184 },
  // Phase 43 (a town's dead buried: its graveyard past its homes, a grave dug in the morning,
  // the dead borne on a bier by four in step, its mourners after it, the grave filled in;
  // those a fire killed buried together two days after it, on biers one after another).
  { gate: 43, args: ["--ci"], s: 143 },
  // Phase 44 (the year in a town's fields: the crop standing in its rows; the rain withheld and
  // water carried out to the parched fields; a blight pulled and burned; the harvest reaped
  // row by row, so many at each field's front, the rest carrying in the sheaves).
  { gate: 44, args: ["--ci"], s: 135 },
  // Phase 45 (a crowd sized to its town; a person's day told on their page and card, a line
  // still to come taken on to with a tap, the eye kept on them).
  { gate: 45, args: ["--ci"], s: 159 },
  // Phase 46 (a flock's day and year: folded by night in its hurdles, driven out and grazing,
  // brought in; the stubble after the harvest; the fold on hay in winter, fewer of it).
  { gate: 46, args: ["--ci"], s: 192 },
  // Phase 47 (the hunt: the town's hunters creeping in on the game abreast, its heads up, the
  // rush and the herd running, one brought down and dressed, carried home across the shoulders).
  { gate: 47, args: ["--ci"], s: 189 },
  // Phase 48 (the road's trade: a trader loading the town's goods at its store and setting out down
  // the road with them, away, back a day or two on with what that land sends; the card's trade).
  { gate: 48, args: ["--ci"], s: 319 },
  // Phase 49 (the camp's crafts: of an evening the band at the work ground knapping their own
  // land's stone, twisting cord, binding spears, a hide scraped on its frame; fire made new at a
  // fresh camp; the camp page's stone tapped through to its own page).
  { gate: 49, args: ["--ci"], s: 132 },
  // Phase 50 (the chain from the ground to a thing: a town's named smiths at the anvil casting
  // its land's metal, one tapped to their card; its smithy's page naming who works there and a
  // tool made there traced from its ore; a person's tool traced from the ground to the hand; a
  // realm's arms forged at its seat's smithy, from their ore to the smith who made them).
  { gate: 50, args: ["--ci"], s: 199 },
  // Phase 51 M213 (things seen being made: the furnace by a town's diggings roaring as one of
  // its diggers works the bellows, the copper carried to the yard and from it to the forge, the
  // day's tools hung on the rack before the smithy, one tapped where it hangs and traced from its
  // ore to the smith who made it).
  { gate: 51, args: ["--ci"], s: 838 },
  // Phase 52 (the chain decides: a town's smiths forging bronze, its tin brought down the road
  // and traced on its smithy's page; a battle its arms decided, ringed on its war's course, its
  // page telling each side's arms and how much of its host bore them; the winner's army, how
  // much of its host is so armed).
  { gate: 52, args: ["--ci"], s: 114 },
  // Phase 53 (later-age arms: a machine gun traced from the ground to the converter and its
  // machinist, its brass and gun cotton, and an armoured car on its oil; a battle of machine
  // guns and armoured cars against repeating rifles watched near, the attackers coming on in
  // rushes, the defenders in their trench, cars knocked out burning, a machine gunner followed
  // and their weapon traced from the battle's bar; the bar at a phone's width).
  { gate: 53, args: ["--ci"], s: 86 },
  // Phase 54 (novel elements: Earth's chemistry the Sun's own and its tables Earth's; sixty open
  // worlds' chemistries as varied as planned; a world round a small old star — thin air, arsenic
  // its hardener, native copper, mispickel and lydite — and its smithy's arsenical copper tool
  // traced from its own ore, never tin; Earth's matter guide with no "This world" tab).
  { gate: 54, args: ["--ci"], s: 240 },
  // Phase 55 wave 5 (the soldier as a person: a fallen soldier before the town tapped where he
  // lies, his card naming him from the battle's roll with his family and his body, his page's
  // Family and Body tabs; one maimed, the member lost; one of the town's people, their roof the
  // household the town draws; one borne home on a litter; an alien people's own plan; the card and
  // the page at a phone's width).
  { gate: 55, part: "b", args: ["--ci"], s: 420 },
  // Phase 55 wave 3 (wounds seen, and healing: the levy home from the battles at the year's turn,
  // its wounded borne in on litters and abed, its healer's round door to door and their page, the
  // wounded up and bound and marked for good — a stump, a crutch, a patch — told on their card)
  // and wave 4 (the battle at the turn fought the morning after before its town: every figure a
  // man of its roll, the town indoors but for some come out to watch, the clock slowed for it, its
  // blows, its rout, its fallen lying until borne in and buried; one who fell tapped, his page and
  // his arm's; the four views a tap apart; zoomed onto its mark from the land, into its town while
  // it is fought and down onto its field once it is past). Its phone budgets run locally. (Its time
  // with the battle estimated from software GL.)
  { gate: 55, args: ["--ci"], s: 680 },
  // Phase 56 (world kinds: the open worlds' kinds and each made by its dial; the title's dials; a
  // carbon, a sulfur-volcano, an ice-and-ammonia and a methane world by day — globe, land, town, the
  // matter guide's "This world", bronze shut where nothing burns, their own ages — and a rocky one).
  { gate: 56, args: ["--ci"], s: 260 },
  // Phase 57 (alien biochemistry: the gate's worlds' lives and the open worlds' shares; a sulfur
  // world's near-black woods and legend, bones of silica and green blood on a lineage's page and a
  // met one's Body tab, its dawn and matter guide, opal's and vanadium's pages, a battle of its
  // wars; an ammonia world's golden woods, a garment of its own mirrored fibre and its stores; a
  // methane world's amber woods and its dawn fed by the haze; a lifeless world's bare ground; Earth
  // as it was, and bread at its mill).
  { gate: 57, args: ["--ci"], s: 480 },
  // The culture's names for materials, switched and remembered at phone size.
  { gate: 58, args: [], s: 90 },
  // Phase 60 (one of a town's people possessed, the god's hand made flesh: refused in plain words
  // where the hand does not rest; a smith of the greatest town taken from the palette, walked to his
  // forge by the keys and set to it until a plough share is made, his and the town's; a word to one
  // near him, their spirits moved; let go, the chronicle and his page telling it, the world going
  // on, the town handed back; the same world opened again in a phone's own frame, by touch, the
  // stick and the acts, turned on its side; the save replayed from the seed to the same world.
  // WebKit's touch run and the phone's frames: locally).
  { gate: 60, args: ["--ci"], s: 900 },
  // Phase 61 (the god's hand in any body: at a desk, a soldier of a battle of the year before laid
  // before its land's heart town, taken from the palette as it is fought, his strip his arm and the
  // battle's tally, brought to the foe and struck at until one falls, the fallen named; let go, the
  // chronicle, the battle's record and his page telling it, the world going on from the hand's day;
  // one of a town's flock grazed and run from its herd until it strays, lost to it; the same at a
  // phone's size by touch, turned on its side; an age's living world, one of its beasts walked in,
  // eaten, steered and let go; the save replayed from the seed to the same world. WebKit's touch run
  // and the phone's frames: locally).
  { gate: 61, args: ["--ci"], s: 700 },
  // God brushes: touch painting, Undo, multi-touch cancellation, confirmation and save recovery.
  { gate: 62, args: [], s: 120 },
];

/** A gate's name as CI calls it: its phase, and its part where it has one ("55b"). */
const nameOf = (g: Gate) => `${g.gate}${g.part ?? ""}`;
/** Gates in their phases' order, a phase's parts after it. */
const byPhase = (a: Gate, b: Gate) =>
  a.gate - b.gate || (nameOf(a) < nameOf(b) ? -1 : nameOf(a) > nameOf(b) ? 1 : 0);

const argv = process.argv.slice(2),
  planned = argv.indexOf("--plan");
if (planned >= 0) {
  const n = Number(argv[planned + 1]),
    shards = Array.from({ length: n }, () => ({ s: 0, gates: [] as Gate[] }));
  for (const g of [...GATES].sort((a, b) => b.s - a.s || byPhase(a, b))) {
    const least = shards.reduce((m, x) => (x.s < m.s ? x : m));
    least.s += g.s;
    least.gates.push(g);
  }
  for (const x of shards) x.gates.sort(byPhase);
  for (const x of shards.sort((a, b) => byPhase(a.gates[0]!, b.gates[0]!)))
    console.log(`${x.gates.map(nameOf).join(" ")}  (~${Math.round(x.s / 60)} min)`);
  process.exit(0);
}

const failed: string[] = [];
for (const n of argv) {
  const g = GATES.find((x) => nameOf(x) === n);
  if (!g) {
    console.error(`gate ${n} is not one CI runs`);
    process.exit(2);
  }
  let passed = false;
  for (let attempt = 1; attempt <= 2 && !passed; attempt++) {
    const t0 = performance.now();
    console.log(`::group::gate ${n}${attempt > 1 ? ", once more" : ""}`);
    const shots =
        attempt > 1 && process.env.CI && g.gate >= 17 ? ["--shots", `shots/gate-${n}`] : [],
      run = spawnSync(
        process.execPath,
        [fileURLToPath(new URL(`./phase${n}-gate.ts`, import.meta.url)), ...g.args, ...shots],
        { stdio: "inherit" },
      );
    console.log("::endgroup::");
    passed = run.status === 0;
    console.log(
      `gate ${n} ${passed ? "passes" : "fails"} in ${Math.round((performance.now() - t0) / 1000)} s`,
    );
  }
  if (!passed) {
    failed.push(n);
    console.log(`::error::gate ${n} failed twice`);
  }
}
if (failed.length) {
  console.log(`failed twice: gate ${failed.join(", gate ")}`);
  process.exit(1);
}
console.log("every gate passes");
