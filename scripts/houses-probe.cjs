// Why do ready adults not conceive on a post-ship world?
//
// After the ship, the skyline probe counted five to ten adults a year who
// passed every clause of canReproduce and yet the world bore nought to two
// children a year. This loads the battery launch fixture (or runs a fresh
// world), presses through the launch (or not, with presses 0), and then, a
// year at a time, reads the whole fertile generation: how many are partnered
// and to whom (alive, dead, gone), the first clause of canReproduce that
// refuses each, and of the ready, why the coupling loop left them childless:
// partner dead and never cleared, partner no longer fertile, partner too far,
// no one within two tiles, everyone near them kin or partnered, or attraction
// below the bar. For the single, it also measures how far the nearest fertile
// single of another house stands and how close their best relationship comes
// to the three love thresholds, so pairing blocked by distance reads
// differently from pairing blocked by the thresholds. Houses (kinGroupId) are
// counted per town, since children take the older house.
//
// node scripts/houses-probe.cjs <fixture.json.gz|seed> <size> <complexity> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  years = Number(process.argv[5] || 40),
  presses = Number(process.argv[6] ?? 8);
const year = rt.get("TICKS_PER_YEAR");
(async () => {
  if (fs.existsSync(source)) {
    const archive = zlib.gunzipSync(fs.readFileSync(source)).toString("utf8");
    rt.sandbox.localStorage.setItem("causalis.save.launch", archive);
    const loaded = await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch");
    if (!loaded) throw new Error("fixture did not load");
    console.log(JSON.stringify({ source, year: rt.get("Math.floor(W.tick / TICKS_PER_YEAR)"), people: rt.get("biospherePopulation(KINDS.PERSON)") }));
  } else {
    rt.game.createTestWorld({ seed: source, size, complexity });
    const tick = rt.get("simTick");
    for (let i = 0; i < year * 30; i++) tick();
    console.log(JSON.stringify({ seed: source, size, complexity }));
  }
  for (let press = 1; press <= presses; press++) {
    const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`));
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  // Count the children born to people, by either road.
  rt.get(`(() => {
    globalThis.__pb = 0; globalThis.__cb = 0;
    const b = createOffspring; createOffspring = function (kind, ...a) { if (kind === KINDS.PERSON) globalThis.__pb++; return b(kind, ...a); };
    const c = addBirthToCohort; addBirthToCohort = function (kind, ...a) { if (kind === KINDS.PERSON) globalThis.__cb++; return c(kind, ...a); };
    return 1; })()`);
  const aYear = `(() => {
    globalThis.__pb = 0; globalThis.__cb = 0;
    const deaths0 = W.statistics.deaths;
    for (let i = 0; i < ${year}; i++) simTick();
    const refuse = {}, why = {}, townHouses = {}, ages = { young: 0, mid: 0, older: 0 }, agePartnered = { young: 0, mid: 0, older: 0 }, partnerState = {};
    let adults = 0, window = 0, ready = 0, partnered = 0, single = 0, near = [], love = [];
    const alive = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    const inWindow = new Set();
    for (const id of alive) {
      if (!isAdultPerson(id)) continue;
      const l = derivedLife(id), body = W.components.body[id];
      if (l.age < body.maxAge * PERSON_FERTILE_SHARE) inWindow.add(id);
    }
    const townOf = (id) => { const p = W.components.position[id]; return p ? nearestSettlement(idx(p.x, p.y), 8) : null; };
    for (const id of alive) {
      const soc = W.components.social[id], p = W.components.position[id], town = townOf(id);
      if (town && soc) { (townHouses[town.name] = townHouses[town.name] || {})[soc.kinGroupId] = (townHouses[town.name][soc.kinGroupId] || 0) + 1; }
      if (!isAdultPerson(id)) continue;
      adults++;
      if (!inWindow.has(id)) continue;
      window++;
      const l = derivedLife(id), body = W.components.body[id], r = W.components.reproduction[id], q = W.components.chemistry[id].q;
      const ageY = l.age / TICKS_PER_YEAR, bucket = ageY < 30 ? "young" : ageY < 45 ? "mid" : "older";
      ages[bucket]++;
      if (soc.partnerId) {
        partnered++; agePartnered[bucket]++;
        const pid = soc.partnerId, st = !W.kind[pid] ? "gone" : W.kind[pid] === KINDS.CORPSE ? "corpse" : classifyAlive(pid) ? "alive" : "kind" + W.kind[pid];
        partnerState[st] = (partnerState[st] || 0) + 1;
      } else single++;
      if (!canReproduce(id)) {
        const reason =
          r.mode !== "paired" ? "mode" : r.cooldown > 0 ? "cooldown" : l.hunger >= CONCEPTION_HUNGER ? "hunger" :
          l.energy <= 22 ? "energy" : l.health <= 48 ? "health" : q[C.ORGANIC] <= 34 ? "organic" : q[C.NUTRIENT] <= 16 ? "nutrient" :
          q[C.SOLVENT] <= 75 ? "solvent" : q[C.INFO] <= 16 ? "info" : q[C.MEMBRANE] <= 23 ? "membrane" :
          !reproductionDensityAllows(id, KINDS.PERSON) ? "density" : (typeof personHasSafeBirthSite === "function" && !personHasSafeBirthSite(id)) ? "water" : "other";
        refuse[reason] = (refuse[reason] || 0) + 1;
        continue;
      }
      ready++;
      let reason;
      if (soc.partnerId) {
        const pid = soc.partnerId, pp = W.components.position[pid];
        if (!classifyAlive(pid)) reason = "partner dead";
        else if (!pp) reason = "partner unplaced";
        else if (dist2(p.x, p.y, pp.x, pp.y) > 16) reason = "partner far";
        else if (!canReproduce(pid)) {
          const pl = derivedLife(pid), pb = W.components.body[pid], pr = W.components.reproduction[pid];
          reason = pl.age >= pb.maxAge * PERSON_FERTILE_SHARE ? "partner old" : pr.cooldown > 0 ? "partner cooldown" : pl.hunger >= CONCEPTION_HUNGER ? "partner hungry" : "partner unfit";
        } else reason = "partner ready (couples)";
      } else {
        const nearIds = nearbyIds(id, 2, (o) => o !== id && W.kind[o] === KINDS.PERSON && classifyAlive(o));
        const fertileNear = nearIds.filter((o) => canReproduce(o));
        if (!nearIds.length) reason = "nobody near";
        else if (!fertileNear.length) reason = "nobody near is fertile";
        else {
          const notKin = fertileNear.filter((o) => !sameKin(soc, W.components.social[o]));
          if (!notKin.length) reason = "all near are kin";
          else {
            const free = notKin.filter((o) => !W.components.social[o].partnerId);
            if (!free.length) reason = "all near are partnered";
            else {
              const drawn = free.filter((o) => Math.min(soc.relationships?.[o]?.attraction || 0, W.components.social[o].relationships?.[id]?.attraction || 0) >= MATE_ATTRACTION);
              reason = drawn.length ? "drawn (couples)" : "no mutual attraction";
            }
          }
        }
      }
      why[reason] = (why[reason] || 0) + 1;
    }
    // The single of the fertile generation: how far is the nearest fertile single of another house in the same town, and how close is their best relationship to love?
    for (const id of inWindow) {
      const soc = W.components.social[id], p = W.components.position[id], town = townOf(id);
      if (soc.partnerId || !p) continue;
      let best = Infinity, bestLove = null;
      for (const o of inWindow) {
        if (o === id) continue;
        const os = W.components.social[o], op = W.components.position[o];
        if (!op || os.partnerId || sameKin(soc, os) || townOf(o) !== town) continue;
        best = Math.min(best, Math.sqrt(dist2(p.x, p.y, op.x, op.y)));
        const ar = soc.relationships?.[o], br = os.relationships?.[id];
        if (ar && br) { const score = Math.min(ar.trust, br.trust) / LOVE_TRUST + Math.min(ar.affection, br.affection) / LOVE_AFFECTION + Math.min(ar.attraction, br.attraction) / LOVE_ATTRACTION; if (!bestLove || score > bestLove.score) bestLove = { score, t: +Math.min(ar.trust, br.trust).toFixed(2), af: +Math.min(ar.affection, br.affection).toFixed(2), at: +Math.min(ar.attraction, br.attraction).toFixed(2) }; }
      }
      near.push(best === Infinity ? "-" : Math.round(best));
      if (bestLove) love.push(bestLove.t + "/" + bestLove.af + "/" + bestLove.at);
    }
    const towns = Object.entries(townHouses).map(([n, h]) => n.slice(0, 8) + ":" + Object.values(h).sort((a, b) => b - a).join("/"));
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: alive.length, adults, window, ready, partnered, single, ages, agePartnered, partnerState, born: globalThis.__pb, cohort: globalThis.__cb, died: W.statistics.deaths - deaths0, refuse, why, towns, near, love, cap: sustainableSexualCapacity(KINDS.PERSON) });
  })()`;
  const bars = [rt.get("LOVE_TRUST"), rt.get("LOVE_AFFECTION"), rt.get("LOVE_ATTRACTION")].join("/");
  for (let n = 1; n <= years; n++) {
    const row = JSON.parse(rt.get(aYear));
    console.log(`y${String(row.year).padStart(4)} ppl${String(row.people).padStart(3)} adults${row.adults} window${row.window} ready${row.ready} partnered${row.partnered}/${row.window} (${row.ages.young}y/${row.ages.mid}m/${row.ages.older}o partnered ${row.agePartnered.young}/${row.agePartnered.mid}/${row.agePartnered.older}) partners${JSON.stringify(row.partnerState)} born${row.born}+${row.cohort} died${row.died} cap${row.cap}`);
    console.log(`     refused${JSON.stringify(row.refuse)} ready-why${JSON.stringify(row.why)}`);
    console.log(`     houses${JSON.stringify(row.towns)} single: nearest single of another house ${row.near.join(",")}; best love t/af/at (bars ${bars}): ${row.love.join(" ")}`);
    if (row.people < 6) break;
  }
})().catch((e) => { console.error(e); process.exit(1); });
