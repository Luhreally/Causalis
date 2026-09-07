// Blocs smoke: allies and league-mates form one bloc painted in the leading
// polity's colour on the Alliances lens while the unaligned keep their own,
// and rendering the lens leaves the world untouched; a coin-striking polity
// with an empty treasury borrows from a cordial lender, repays with interest
// when it can, defaults when the term runs out, and opinion remembers both.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const blocs = window.ALIFE_BLOCS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  for (const t of W.settlements) if (!t.ruined && !t.factionId && W.factions.length < 3) createFaction(t.id);
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  while (W.factions.length < 3 && people.length) {
    const founder = people.pop();
    let tile = -1;
    for (let tries = 0; tries < 400 && tile < 0; tries++) {
      const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
      if (W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && !campNear(t, 6) && !nearestSettlement(t, 10)) tile = t;
    }
    if (tile < 0) break;
    const soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(tile, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) {
      const b = planBuilding(camp, type, 5) || W.buildings.find((x) => !x.ruined && x.placeKind === "camp" && x.placeId === camp.id && x.type === type);
      if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
    }
    const town = createSettlement(camp.id);
    if (town) createFaction(town.id);
  }
  const living = W.factions.filter((f) => f.stability > 0);
  if (living.length < 3) { fail("could not raise three polities"); return out; }
  const [A, B, Cc] = living;
  for (const [p, q] of [[A, B], [B, A], [A, Cc], [Cc, A], [B, Cc], [Cc, B]]) { const rel = relationOf(p, q); rel.pressure = 30; rel.trade = 1; rel.opinion = 30; }
  // ── Blocs on the map ──
  if (!OVERLAY_DEFS.some((d) => d[0] === "alliances")) fail("the Alliances lens is not listed");
  out.blocsApart = [blocs.bloc(A.id), blocs.bloc(B.id), blocs.bloc(Cc.id)];
  if (new Set(out.blocsApart).size !== 3) fail("unallied polities share a bloc");
  A.allies.push(B.id); B.allies.push(A.id); relationOf(A, B).status = "allied"; relationOf(B, A).status = "allied";
  W.tick++; // blocs are read once a tick
  out.blocsAllied = [blocs.bloc(A.id), blocs.bloc(B.id), blocs.bloc(Cc.id)];
  if (out.blocsAllied[0] !== out.blocsAllied[1] || out.blocsAllied[2] === out.blocsAllied[0]) fail("allies do not share a bloc: " + out.blocsAllied.join(","));
  if (blocs.size(A.id) !== 2 || blocs.size(Cc.id) !== 1) fail("bloc sizes are wrong");
  const tileOf = (f) => { const cap = factionCapital(f); return cap ? idx(cap.x, cap.y) : -1; };
  const keepOwner = [], keepTerritory = [];
  for (const f of [A, B, Cc]) { const t = tileOf(f); keepOwner.push(W.tiles.owner[t]); keepTerritory.push(W.tiles.territory[t]); W.tiles.owner[t] = f.id; W.tiles.territory[t] = 900; }
  out.styles = [blocs.style(tileOf(A)), blocs.style(tileOf(B)), blocs.style(tileOf(Cc))];
  if (out.styles[0] !== out.styles[1]) fail("allies are not painted alike: " + out.styles.slice(0, 2).join(" vs "));
  if (out.styles[2] === out.styles[0]) fail("the unaligned polity wears the bloc's colour");
  if (out.styles.some((s) => s === "transparent" || /undefined|NaN/.test(s))) fail("a bloc style is broken: " + out.styles.join(" | "));
  const hashBefore = typeof worldHash === "function" ? worldHash() : null;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 1, overlay: "alliances", now: 5000 });
  if (hashBefore !== null && worldHash() !== hashBefore) fail("drawing the lens changed the world");
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 1, overlay: null, now: 5100 });
  [A, B, Cc].forEach((f, n) => { const t = tileOf(f); W.tiles.owner[t] = keepOwner[n]; W.tiles.territory[t] = keepTerritory[n]; });
  // ── Loans ──
  for (const f of [A, B, Cc]) { const cap = factionCapital(f); if (cap && !cap.knownProcesses.includes("currency")) cap.knownProcesses.push("currency"); }
  A.treasury = 400; B.treasury = 0; Cc.treasury = 0;
  out.loansMade = blocs.seek();
  const loanB = blocs.loans(B.id).find((t) => t.b === B.id), loanC = blocs.loans(Cc.id).find((t) => t.b === Cc.id);
  out.loanB = loanB ? { principal: loanB.principal, owed: loanB.owed } : null;
  if (!loanB) fail("the empty treasury borrowed nothing");
  if (loanB && !(B.treasury >= loanB.principal)) fail("the borrower did not receive the coin");
  if (loanB && A.treasury !== 400 - loanB.principal - (loanC ? loanC.principal : 0)) fail("the lender's treasury did not fall by the principal: " + A.treasury);
  const loanEvent = W.events.find((e) => e.type === "LoanEvent");
  if (!loanEvent) fail("no LoanEvent"); else out.loanSentence = eventSentence(loanEvent);
  if (!/Loans/.test(renderLegendPage("faction", B.id))) fail("the polity page does not list the loan");
  // Repayment with interest when the treasury allows.
  B.treasury = 300;
  const lenderBefore = A.treasury;
  blocs.service();
  out.repaid = !blocs.loans(B.id).some((t) => t.b === B.id);
  if (!out.repaid) fail("a rich borrower did not repay");
  // The other borrower may pay an instalment in the same pass, so the lender gains at least the debt with interest.
  if (loanB && !(A.treasury >= lenderBefore + loanB.owed)) fail("the lender was not repaid with interest: " + (A.treasury - lenderBefore) + " vs " + loanB.owed);
  const repayment = W.events.find((e) => e.type === "RepaymentEvent");
  if (!repayment) fail("no RepaymentEvent"); else out.repaySentence = eventSentence(repayment);
  if (!(opinionTarget(A, B).reasons.some((r) => /debt repaid/.test(r.label)))) fail("a repaid debt is not remembered warmly");
  // Default when the term runs out unpaid.
  if (!loanC) fail("the second empty treasury borrowed nothing");
  else {
    const live = W.diplomacy.treaties.find((t) => t.id === loanC.id);
    live.until = W.tick - 1;
    Cc.treasury = 0;
    const opinionBefore = relationOf(A, Cc).opinion || 0;
    blocs.service();
    out.defaulted = !!live.defaulted && !live.active;
    if (!out.defaulted) fail("an unpaid loan past its term did not default");
    if (!((relationOf(A, Cc).opinion || 0) < opinionBefore)) fail("a default did not sour the lender");
    if (!(opinionTarget(A, Cc).reasons.some((r) => /debt defaulted/.test(r.label)))) fail("a default is not remembered");
    const def = W.events.find((e) => e.type === "DefaultEvent");
    if (!def) fail("no DefaultEvent"); else out.defaultSentence = eventSentence(def);
    Cc.treasury = 0;
    out.loansAfterDefault = blocs.seek();
    if (blocs.loans(Cc.id).some((t) => t.b === Cc.id)) fail("a defaulter was lent to again");
  }
  simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_BLOCS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_BLOCS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
