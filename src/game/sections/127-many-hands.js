// ═══════════════════════════════════════════════════════════════════════════
// 127. MANY HANDS — the effort raises its city while its scholars study
// ═══════════════════════════════════════════════════════════════════════════
// The Causal skip works its objectives one at a time, in the order of the ages,
// and the modern world's buildings come after the crafts that precede them. On
// a battery-saver world that order cost the ship. Measured on causal-origin:
// the objective sat on Planetary Stewardship from year eighty-eight to a
// hundred and twenty-six, pushing research thirty-two times in the last eight
// years alone, while the two cities stood with their electricity, machines and
// masonry known and their tower blocks at stage one — "needs 28 timber",
// "needs 24 metal" — because the skyline stage was not the objective and no
// push reached them. The moment it was, both cities planned five blocks apiece
// and the stone arrived; by then the people were thirty and falling.
//
// Three things change here. The effort works on the buildings of the modern
// world beside whatever it is studying: every year it pushes its objective, it
// also raises the towers, the apartment blocks, the factory and the road in the
// cities that already know the crafts for them, so the decades of labour a
// skyline takes run under the decades of research rather than after them.
// Research is left to the objective; the hands do not pull the scholars.
//
// A rare input reaches the work face from the third push, as common ones do.
// The push fed pigment into the stores for builders to fetch, and on the same
// world Cloudwatch's archive sat at stage zero, "needs 4 pigment", for nine
// years while the store was fed four at a time: the stores keep a research
// reserve, the samples borrow, the surplus spills, and the four never reached
// the site. Governance waits on the archive and Stewardship on Governance, so
// the town's own inquiry was stopped by the building the push could not land.
//
// And the smallest map holds more than forty people once it farms. The sexual
// carrying capacity is tiles times a density, food and craft factor, with a
// floor of forty; on seventy-two by forty-four the product is twenty-five
// times those factors and the floor always wins, so the world sat at thirty-
// one to forty people with births rationed above thirty-one, and by year a
// hundred and twenty two adults in three were past the fertile window. The
// floor now follows the fields: four people for every finished farm over the
// forty a foraging world holds, or the harvest itself, six a farm, whichever
// is more (two a farm over the forty at first; the constants below say why
// four, why six, and why the harvest is not over the forty), never over the
// people the world keeps as people (12), and no lift at all while a town is
// in famine. On a standard map the formula already exceeds this floor; it
// changes only the maps where the floor was the cap.
const MANY_HANDS_FACE_PUSH = 3,
  MANY_HANDS_PEOPLE_FLOOR = 40,
  MANY_HANDS_ASIDE = Object.freeze(["skyline", "homes", "works", "road"]),
  MANY_HANDS = { aside: 0, raised: 0, faced: 0, studied: 0, yielded: 0, remembered: 0 };
// ── Rare inputs reach the work face ──────────────────────────────────────────
function manyHandsFace(b) {
  if (!b || b.complete || b.ruined) return 0;
  let placed = 0;
  for (let guard = 0; guard < 6; guard++) {
    const missing = missingBuildingMaterial(b);
    if (!missing || !STORE_DRAWN_MATERIALS.includes(missing.sp)) break;
    const amount = Math.min(missing.needed, 65535 - (b.composition[missing.sp] || 0));
    if (amount <= 0) break;
    b.composition[missing.sp] += amount;
    causalPushInput(amount);
    placed += amount;
  }
  if (placed) {
    refreshBuildingStage(b);
    MANY_HANDS.faced += placed;
  }
  return placed;
}
const causalPushBuildingManyHandsBase = causalPushBuilding;
causalPushBuilding = function (place, type, pushes) {
  if (!place || pushes < MANY_HANDS_FACE_PUSH) return causalPushBuildingManyHandsBase(place, type, pushes);
  const kind = place.knownProcesses ? "settlement" : "camp",
    site = () => W.buildings.find((b) => !b.ruined && !b.complete && b.placeKind === kind && b.placeId === place.id && b.type === type);
  // The face first, so the push that follows finds the common material short
  // rather than feeding the store a rare one that is already placed.
  const before = site();
  if (before) manyHandsFace(before);
  const out = causalPushBuildingManyHandsBase(place, type, pushes);
  if (out && !before) manyHandsFace(site());
  return out;
};
const modernSupplySiteManyHandsBase = modernSupplySite;
modernSupplySite = function (place, b, pushes) {
  if (place && b && pushes >= MANY_HANDS_FACE_PUSH) manyHandsFace(b);
  return modernSupplySiteManyHandsBase(place, b, pushes);
};
// ── The buildings rise beside the studies ────────────────────────────────────
function manyHandsKnows(place, ...techs) {
  return techs.every((t) => place.knownProcesses.includes(t));
}
// The modern stages are sought only past the terrestrial ages; before that a
// tower is not an objective anyone holds.
function manyHandsModernSought() {
  return typeof causalSkipMicroStages === "function" && causalSkipMicroStages().some((s) => s.key === "skyline");
}
function manyHandsRaise(key, cities, pushes) {
  if (key === "road") {
    if (!worldTowns().some((s) => s.knownProcesses.includes("road_building"))) return 0;
    return modernPush("road", pushes) ? 1 : 0;
  }
  const type = key === "skyline" ? "tower" : key === "homes" ? "tenement" : "factory",
    able = cities.filter((city) =>
      key === "skyline"
        ? manyHandsKnows(city, "electricity", "mechanization", "masonry")
        : key === "homes"
          ? manyHandsKnows(city, "masonry")
          : manyHandsKnows(city, "electricity", "mechanization"),
    );
  if (!able.length) return 0;
  const count = key === "skyline" ? modernCount(["tower", "office"]) : modernCount([type]),
    wanted = key === "skyline" ? modernSkylineWanted() : key === "homes" ? modernHomesWanted() : modernWorksWanted();
  let left = Math.max(0, wanted - count);
  if (!left) return 0;
  // Every able city works on at least one block, whatever the count still
  // wanted: the last block a skyline lacked was handed to whichever city came
  // first in the list, and on battery causal-origin that was a city of five,
  // which held it unfinished for twenty-four years while the world starved.
  // A block over the count is a block, and the count is a floor.
  const each = Math.max(1, Math.ceil(left / able.length)),
    kind0 = (city) => (key === "skyline" && city.knownProcesses.includes("computing") && placeHasFacility(city, "market") ? "office" : type);
  let raised = 0;
  for (const city of able) {
    // The skyline's kind is the modern world's own reading (114): a tower while
    // the city's beds are short, an office once they are not, nothing while an
    // office cannot yet be raised.
    if (key === "skyline" && typeof modernSkylineRaise === "function") {
      raised += modernSkylineRaise(city, Math.max(1, left), each, pushes);
      continue;
    }
    raised += modernRaise(city, kind0(city), each, pushes);
  }
  return raised;
}
// ── The studies run beside the building ──────────────────────────────────────
// While the objective is a building stage — the cities, the skyline, the
// blocks, the works, the road, the people — the craft the ship needs is
// studied meanwhile at the place it will leave from, the way the launch push
// itself (114) has the polity take up the site's missing groundwork. Measured
// on battery causal-origin at year eighty: the skyline stage held the
// objective from year sixty-nine past a hundred and twenty-five while the
// site's next step toward Starflight, Computing, stood at no notes for want of
// a crystal sample nobody was pushed to bring. Research stages keep their own
// objective; the studies here only run under a building.
const MANY_HANDS_BUILDING = Object.freeze(["cities", "skyline", "homes", "works", "road", "hundred"]);
function manyHandsStudy(target) {
  if (!target || !MANY_HANDS_BUILDING.includes(target.key) || typeof modernLaunchSite !== "function") return 0;
  const site = modernLaunchSite();
  if (!site) return 0;
  const pushes = target.pushes || 0,
    groundwork = modernGroundworkMissing(site),
    missing = groundwork.length ? groundwork : site.knownProcesses.includes("starflight") ? [] : ["starflight"];
  if (!missing.length) return 0;
  const f = W.factions.find((x) => x.id === site.factionId) || null;
  let n = 1,
    pushed = 0;
  for (const town of polityTownsOf(f)) {
    if (n >= missing.length) break;
    if (town === site) continue;
    if (causalPushResearch(town, missing[n], pushes)) {
      n++;
      pushed++;
    }
  }
  for (let k = missing.length - 1; k >= 0; k--) if (causalPushResearch(site, missing[k], pushes)) pushed++;
  if (pushed) MANY_HANDS.studied += pushed;
  return pushed;
}
// ── The ship leaves from a city that is still one ────────────────────────────
// The site is held once chosen (114), and rightly, but a held city that has
// fallen under the urban gate's local count is a village with a memory: on
// battery causal-origin the site was Kinhollow at nineteen people, and by year
// a hundred and one it held five while Willowwatch held forty and knew half as
// much. Research runs with the people, so the site yields when it has fallen
// under the gate and another city stands over it; otherwise it is held as
// before, and size alone never moves it.
// The first cut only cleared the held site and let 114 choose again, and 114
// chose the same town back: its score counts the groundwork a town knows,
// and the emptied city knew more than the full one. Being populous enough
// for the gate is now one of the merits — worth more than groundwork and
// order together, less than a tower or the craft — so a city that has
// emptied yields to one that has not, and a town that holds the tower is
// still held whatever the other town's size, which is the rule 114 set.
// And a town that could launch today, its launch tower, its skyline and its
// works all standing (110), outranks one that must still make room for them:
// four points, the craft's worth, so a ready town that lacks the craft ties
// with a knowing one that lacks the industry and the held site keeps. On
// battery variety-14 the held site, a full city with neither block nor
// factory, stood at the gate from 63 while Vragud-an, fourteen people with
// five blocks, four factories, a launch tower and Starflight, scored the
// same 34 and was never chosen (HANDOFF section 26). A town whose blocks and
// works stand but whose tower does not gets nothing for them: the modern
// test's site, its tower pulled down and its people gone to a neighbour that
// held its industry, must keep the site and raise its own.
function manyHandsSiteReady(s) {
  return (
    completedBuildings(s, "launch_tower").length > 0 &&
    typeof hasSkyline === "function" && hasSkyline(s) &&
    typeof hasWorks === "function" && hasWorks(s)
  );
}
function manyHandsSiteScore(s, local) {
  return (
    (cityStage(s) ? 16 : 0) +
    completedBuildings(s, "launch_tower").length * 8 +
    (s.knownProcesses.includes("starflight") ? 4 : 0) +
    (manyHandsSiteReady(s) ? 4 : 0) +
    (settlementPopulation(s) >= local ? 3 : 0) +
    (modernGroundworkMissing(s).length ? 0 : 2) +
    ((s.stability || 0) >= 0.35 ? 1 : 0)
  );
}
const modernLaunchSiteManyHandsBase = modernLaunchSite;
modernLaunchSite = function () {
  if (!W?.settlements || typeof urbanGate !== "function" || typeof cityStage !== "function")
    return modernLaunchSiteManyHandsBase();
  const towns = worldTowns();
  if (!towns.length) return null;
  const local = urbanGate().local,
    score = (s) => manyHandsSiteScore(s, local),
    best = towns
      .slice()
      .sort((a, b) => score(b) - score(a) || settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)[0];
  if (typeof ensureCausalReached === "function") ensureCausalReached();
  const held = towns.find((t) => t.id === W.causalLaunchSiteId);
  if (held && score(held) >= score(best)) return held;
  if (held) MANY_HANDS.yielded++;
  W.causalLaunchSiteId = best.id;
  return best;
};
// ── The effort keeps its people in its cities ────────────────────────────────
// A world founds a place for every twenty-four people it holds (fourteen when
// this was written, 30e), and a town of twenty-four sends settlers. On battery causal-origin that made five towns of
// sixty-six people by year a hundred: the city that held the site went from
// sixty-two to seven, and the hamlets it seeded held their people at half to
// all hungry. Once the modern stages are sought, the concerted effort founds
// nothing new — the ship wants two cities, not five hamlets — and the pull to
// the hub (108) is left to gather what has already spread.
const worldHasRoomForPlacesManyHandsBase = worldHasRoomForPlaces;
worldHasRoomForPlaces = function () {
  if (
    W?.civilization &&
    typeof concertedIntensity === "function" &&
    concertedIntensity() > 0 &&
    manyHandsModernSought()
  )
    return false;
  return worldHasRoomForPlacesManyHandsBase();
};
function manyHandsAside(target) {
  if (!target || !W?.settlements || !manyHandsModernSought()) return 0;
  const cities = modernCities();
  if (!cities.length) return 0;
  const pushes = target.pushes || 0;
  let worked = 0;
  for (const stage of modernStages()) {
    if (stage.key === target.key || !MANY_HANDS_ASIDE.includes(stage.key) || stage.done()) continue;
    worked += manyHandsRaise(stage.key, cities, pushes);
  }
  if (worked) {
    MANY_HANDS.aside++;
    MANY_HANDS.raised += worked;
  }
  return worked;
}
// ── The effort remembers how long it has worked on an objective ──────────────
// A press ends at every milestone, the objective is released when it ends,
// and the next press begins the same objective at zero pushes — and a work
// face is stocked only from the third. On battery causal-origin the site knew
// Starflight from year 94 and kept discovering, one branch craft a press:
// Global Networks, Advanced Composites, Thinking Machines, Materials Science,
// Deep Theory I to III. Each press gave the skyline a year of material and
// stopped; seven blocks stood at seven from year 107 to 121. The count of
// pushes an objective has had is kept on the world by its key and restored
// when the same objective is taken up again, so the next press starts where
// the last left off. A new objective still starts at zero.
function manyHandsMemory() {
  if (!W?.civilization) return null;
  return (W.civilization.effortMemory = W.civilization.effortMemory || {});
}
const setCausalTargetManyHandsBase = setCausalTarget;
setCausalTarget = function (stage) {
  const before = W?.civilization?.concertedTarget || null,
    target = setCausalTargetManyHandsBase(stage),
    memory = manyHandsMemory();
  if (target && target !== before && memory && !target.pushes && memory[target.key]) {
    target.pushes = memory[target.key];
    MANY_HANDS.remembered++;
  }
  return target;
};
const causalPushTowardManyHandsBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  const out = causalPushTowardManyHandsBase(target);
  if (target && W) {
    const memory = manyHandsMemory();
    if (memory && target.key) memory[target.key] = target.pushes || 0;
    manyHandsAside(target);
    if (manyHandsModernSought()) manyHandsStudy(target);
  }
  return out;
};
// ── A farming world holds the people its fields feed ─────────────────────────
// The first cut lifted the floor by the crafts the formula's own lift counts —
// forty times two for agriculture and irrigation, up to three for machines.
// On battery causal-origin that made a hundred and eight people by year
// sixty-two on thirteen fields, fifty-three by eighty-six and twenty-four by a
// hundred and ten: a craft is not a harvest. The floor follows the fields
// instead, two people for every finished farm in a living town over the forty
// a foraging world holds, and it is not lifted at all while any town is in
// famine, so a world that has outgrown its fields stops growing rather than
// starving. Measured on the same world before any lift, thirteen farms kept
// fifty-five to sixty people with nobody hungry.
//
// Two a farm held a third of what the fields feed: the granary plans one farm
// for every six people (82), so a floor of two a farm sat well under the
// harvest, and the skyline the modern gate asks of a world, sixteen blocks
// and more whatever its people (114), stood for nobody. Measured at year
// sixty, lean, six worlds ticking at once: battery causal-origin held 80
// people in 384 beds and phone 89 in 444, one bed in five slept in. Four a
// farm, with a place for every twenty-four people (30e): 151 in 336 and 157
// in 390, two beds in five, in the same five and six towns, and the tick 1.4
// and 1.3 times the base. Four a farm alone spread the same people over nine
// and ten towns, each with its cottages, at 1.7 times. Six a farm is the
// harvest itself and no floor at all, since the fields grow with the people;
// and doubling the ground's own density instead cost 2.75 times on phone and
// ran it at the two hundred and fifty the world keeps as people (12).
//
// Six a farm, the harvest itself, once the towers were asked to fill: at four
// the world sat at 151 people and 157 at year sixty and at the ship its people
// lay in a tenth to a fifth of the beds the modern gate had raised (HANDOFF
// section 27). Six is the granary's own count, so the floor is the fields and
// the fields grow with the people, bounded by the land a town can plant, by
// the famine brake below, and by the two hundred and fifty the world keeps as
// people, which the floor never passes: past it the newest are folded into
// cohorts (12), and a phone world with the density doubled did just that.
// The harvest, or the forty, not the forty and the harvest: six a farm over
// the forty ran battery variety-3's two towns to 192 people on twenty-five
// fields, seven and a half a farm, and Tranguwo, ninety-five people on nine
// fields it had no land to add to, went hungry to the last person from year
// 89 to 120 and the world flew at 235 where it had flown at 97 (HANDOFF
// section 28). The forty is what a world holds before it farms; a farming
// world holds what its fields feed. But the harvest alone is under four a
// farm over the forty until the twentieth field, and a world of ten fields
// held sixty where it had held eighty: battery variety-7 stood at forty
// people at year thirty-nine where it had stood at seventy-two, and flew at
// 170 where it had flown at 121. So the floor is the greater of the two
// readings, four a farm over the forty as section 27 swept it and the
// harvest itself once that is more, from the twentieth field.
const MANY_HANDS_PER_FARM = 4,
  MANY_HANDS_HARVEST_PER_FARM = 6;
function manyHandsFarms() {
  let farms = 0;
  for (const b of W.buildings)
    if (b.type === "farm" && b.complete && !b.ruined && b.placeKind === "settlement") {
      const place = W.settlements.find((s) => s.id === b.placeId);
      if (place && !place.ruined) farms++;
    }
  return farms;
}
// The hungry share of everyone living in a town. A single village of three
// with an empty larder is not a world in famine, and gating on any town at all
// left the floor at forty on a world whose cities were fed.
// A quarter was the first bar, and it braked the wrong world: the hungry share
// is read within seven tiles of each hall and swings between a fifth and a
// half from year to year on a lean city, so the capacity fell to nine-tenths
// of the people every other year and births stopped on a world that was not
// starving — measured on battery causal-origin at year sixty, capacity 83 one
// year and 68 the next with 78 people, births 0 to 2 a year. The bar is the
// granary's own famine line (82), two in five.
const MANY_HANDS_HUNGRY_SHARE = 0.4,
  MANY_HANDS_FAMINE_BRAKE = 0.9;
function manyHandsHungryShare() {
  if (typeof hungryShare !== "function") return 0;
  let people = 0,
    hungry = 0;
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    const pop = settlementPopulation(s);
    if (!pop) continue;
    people += pop;
    hungry += hungryShare(s) * pop;
  }
  return people ? hungry / people : 0;
}
function manyHandsPeopleFloor() {
  if (manyHandsHungryShare() > MANY_HANDS_HUNGRY_SHARE) return MANY_HANDS_PEOPLE_FLOOR;
  const ceiling = typeof CAPS !== "undefined" && CAPS.person ? CAPS.person : Infinity;
  const farms = manyHandsFarms();
  return Math.min(ceiling, Math.max(MANY_HANDS_PEOPLE_FLOOR + MANY_HANDS_PER_FARM * farms, MANY_HANDS_HARVEST_PER_FARM * farms));
}
// And a hungry world does not grow at all. The formula's own craft lift took
// battery causal-origin to a capacity of ninety-four once it knew waterworks,
// sanitation and machines, and the world grew to eighty-nine on ten fields
// that had fed fifty-five; a quarter of its townspeople were hungry by year
// sixty-two and all of them by sixty-nine. Conception already waits on a
// quiet belly (23), but the fed majority kept a starving world growing. While
// more than a quarter of the townspeople are hungry the capacity sits just
// under the people there are, so the world meets its fields by fewer births.
const sustainableSexualCapacityManyHandsBase = sustainableSexualCapacity;
sustainableSexualCapacity = function (kind) {
  const base = sustainableSexualCapacityManyHandsBase(kind);
  if (kind !== KINDS.PERSON || !W?.settlements) return base;
  if (manyHandsHungryShare() > MANY_HANDS_HUNGRY_SHARE)
    return Math.min(base, Math.max(1, Math.floor(biospherePopulation(KINDS.PERSON) * MANY_HANDS_FAMINE_BRAKE)));
  return Math.max(base, manyHandsPeopleFloor());
};
window.ALIFE_MANY_HANDS_DEBUG = Object.freeze({
  counts: () => ({ ...MANY_HANDS }),
  reset: () => {
    for (const k of Object.keys(MANY_HANDS)) MANY_HANDS[k] = 0;
  },
  aside: (key = "stewardship", pushes = 1) => manyHandsAside({ key, pushes }),
  study: (key = "skyline", pushes = 1) => manyHandsStudy({ key, pushes }),
  face: (buildingId) => manyHandsFace(W.buildings.find((b) => b.id === buildingId)),
  floor: () => manyHandsPeopleFloor(),
  perFarm: () => MANY_HANDS_PER_FARM,
  harvestPerFarm: () => MANY_HANDS_HARVEST_PER_FARM,
  farms: () => manyHandsFarms(),
  hungry: () => +manyHandsHungryShare().toFixed(3),
  capacity: () => sustainableSexualCapacity(KINDS.PERSON),
  sought: () => manyHandsModernSought(),
});
