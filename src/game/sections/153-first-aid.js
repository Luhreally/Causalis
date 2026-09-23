// ═══════════════════════════════════════════════════════════════════════════
// 153. FIRST AID — who comes to the hurt, the clinic's care, the field medic
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: people who are hurt to be cared for, field medics, and people
// helping each other where it makes sense. The rescue of 42c already sent
// the nearest fit person within ten tiles to anyone in distress, to hand over
// food and water, staunch a wound and drag a helpless body a tile toward home;
// but it chose by distance alone (a stranger before a wife two tiles
// farther), never took anyone to the clinic, whose only work was brewing
// medicine (30e) that almost nobody used, taught no one the healer's craft
// (51 lists the Healer and nothing grants it), and a fighter who fell out of
// a column at a quarter health (41) walked home alone.
//
// Now:
//   the helper is chosen as a person would be: a healer, then the hurt one's
//   partner, kin and friends, then the kindest, nearer before farther within
//   twelve tiles; a helper not fit to help (hungry, hurt, fighting) is passed
//   over as before;
//   whoever gives aid learns the healer's craft by it (heal, 51);
//   a wounded person who can walk and whose town has a clinic goes there
//   (a civil order, 52), and the clinic's care dresses the open wounds of the
//   hurt within two tiles every eight ticks with a measure of the town's own
//   medicine (a conserved packet into the patient, as 42c's rescue gives it),
//   the town's best healer attending when there is one;
//   a column at war names a field medic, its most skilled healer or its
//   kindest, who does not charge but goes to the worst hurt of the column
//   within ten tiles, stops the bleeding, and sends a fighter too hurt to
//   fight home to the clinic;
//   and a hungry child is fed from the food a parent or a household carries.
const AID = {
  helpersChosen: 0,
  kinHelped: 0,
  healersHelped: 0,
  toClinic: 0,
  dressed: 0,
  medicine: 0,
  medics: 0,
  fieldDressed: 0,
  sentHome: 0,
  childrenFed: 0,
};
const AID_REACH = 12,
  CLINIC_REACH = 2,
  CLINIC_WALK_REACH = 20,
  MEDIC_REACH = 10,
  CHILD_MEAL = 6;
function openWoundsOf(id) {
  return (W.components.life[id]?.wounds || []).filter((w) => !w.healedTick && !w.treated && ((w.bleed || 0) > 0 || (w.severity || 0) > 0.2));
}
function healSkill(id) {
  return W.components.identity[id]?.skills?.heal || 0;
}
// ── Who comes ────────────────────────────────────────────────────────────────
function aidBond(helper, victim) {
  const soc = W.components.social[victim],
    r = soc?.relationships?.[helper],
    kin = (W.components.identity[victim]?.parents || []).includes(helper) || (W.components.identity[helper]?.parents || []).includes(victim);
  return (soc?.partnerId === helper ? 1 : 0) + (kin ? 0.8 : 0) + (r ? (r.affection || 0) * 0.6 + (r.trust || 0) * 0.3 : 0);
}
function fitToHelp(id) {
  const q = W.components.chemistry[id]?.q,
    l = derivedLife(id),
    p = W.components.position[id],
    task = W.components.work?.[id]?.task;
  return !!(p && q && !personInDistress(id) && l.hunger < 70 && l.thirst < 75 && q[C.ENERGY] > 150 && embodiedCapability(id).locomotion >= 0.42 && task !== "fight");
}
updatePersonRescue = function () {
  if (W.tick % 4 !== 2) return;
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)),
    busyHelpers = new Set();
  let rescues = 0;
  for (const victim of people) {
    if (rescues >= 6) break;
    if (!personInDistress(victim)) continue;
    const vp = W.components.position[victim];
    if (!vp) continue;
    let best = null;
    for (const id of nearbyIds(victim, AID_REACH, (o) => W.kind[o] === KINDS.PERSON && classifyAlive(o))) {
      if (busyHelpers.has(id) || !fitToHelp(id)) continue;
      const p = W.components.position[id],
        d = Math.sqrt(dist2(p.x, p.y, vp.x, vp.y)),
        skill = healSkill(id),
        bond = aidBond(id, victim),
        kind = phenotype(id).cooperation || 0.5,
        score = skill / 25 + bond * 1.5 + kind - d * 0.12;
      if (!best || score > best.score || (score === best.score && id < best.id)) best = { id, score, skill, bond };
    }
    if (!best) continue;
    busyHelpers.add(best.id);
    AID.helpersChosen++;
    if (best.bond > 0.5) AID.kinHelped++;
    if (best.skill >= 10) AID.healersHelped++;
    if (performRescue(best.id, victim)) rescues++;
  }
};
// Aid given is the healer's craft learned.
const emitEventAidBase = emitEvent;
emitEvent = function (type, data = {}) {
  const ev = emitEventAidBase(type, data);
  if ((type === "RescueEvent" || type === "WoundsDressedEvent") && W?.kind && typeof grantSkill === "function") {
    const helper = ev.subjects?.[0];
    if (helper && W.kind[helper] === KINDS.PERSON) grantSkill(helper, "heal", type === "RescueEvent" ? 3 : 2, ev.id);
  }
  return ev;
};
// ── The clinic ───────────────────────────────────────────────────────────────
function townClinic(town) {
  return town ? completedBuildings(town, "clinic").sort((a, b) => a.id - b.id)[0] || null : null;
}
function dressWounds(patient, town, healer = 0) {
  const wounds = openWoundsOf(patient);
  if (!wounds.length) return 0;
  const vq = W.components.chemistry[patient]?.q,
    life = W.components.life[patient],
    medicine = town?.knownProcesses?.includes("medicine") && (town.inventory[C.MEDICINE] || 0) > 0 && vq;
  if (medicine) {
    town.inventory[C.MEDICINE] -= 1;
    vq[C.MEDICINE] = u16(vq[C.MEDICINE] + 1);
    AID.medicine++;
  }
  let dressed = 0;
  for (const wound of wounds.slice(0, medicine ? wounds.length : 2)) {
    wound.treated = true;
    wound.bleed = medicine ? 0 : Math.max(0, (wound.bleed || 0) * 0.4);
    dressed++;
  }
  life.pain = clamp((life.pain || 0) - (medicine ? 30 : 12), 0, 100);
  AID.dressed += dressed;
  if (W.tick - (life.lastDressedEventTick ?? -1e9) >= 128) {
    life.lastDressedEventTick = W.tick;
    const p = W.components.position[patient];
    emitEvent("WoundsDressedEvent", {
      subjects: [healer, patient].filter(Boolean),
      location: p ? idx(p.x, p.y) : -1,
      importance: 1,
      evidence: [`${dressed} wound${dressed === 1 ? "" : "s"} dressed${medicine ? ` with medicine from ${town.name}` : " by hand"}`],
      data: { patient: entityName(patient), healer: healer ? entityName(healer) : "", place: town?.name || "", medicine: !!medicine },
    });
  }
  return dressed;
}
function townHealer(town, near) {
  let best = 0,
    bestSkill = 0;
  for (const id of nearbyIds(near, 8, (o) => W.kind[o] === KINDS.PERSON && classifyAlive(o))) {
    const s = healSkill(id);
    if (s > bestSkill || (s === bestSkill && s > 0 && id < best)) {
      best = id;
      bestSkill = s;
    }
  }
  return bestSkill >= 5 ? best : 0;
}
function clinicCare() {
  for (const town of W.settlements) {
    if (town.ruined) continue;
    const clinic = townClinic(town);
    if (!clinic) continue;
    for (const id of entityAtRadius(idx(clinic.x, clinic.y), CLINIC_REACH, KINDS.PERSON)) {
      if (!classifyAlive(id) || !openWoundsOf(id).length) continue;
      dressWounds(id, town, townHealer(town, id));
    }
  }
}
// The hurt who can walk go to their town's clinic.
function sendToClinic() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const wounds = openWoundsOf(id);
    if (!wounds.length || W.components.work?.[id]?.task === "fight" || civilOrderOf(id) || W.components.campaign?.[id]) continue;
    if (embodiedCapability(id).locomotion < 0.3) continue;
    const town = homeTownOf(id),
      clinic = townClinic(town),
      p = W.components.position[id];
    if (!clinic || !p) continue;
    const d2 = dist2(p.x, p.y, clinic.x, clinic.y);
    if (d2 <= CLINIC_REACH * CLINIC_REACH || d2 > CLINIC_WALK_REACH * CLINIC_WALK_REACH) continue;
    issueCivilOrder(id, "convalesce", clinic.x, clinic.y, { placeId: town.id });
    AID.toClinic++;
  }
}
// ── The field medic ─────────────────────────────────────────────────────────
function unitMedic(unit) {
  const members = (unit.memberIds || []).filter((id) => classifyAlive(id) && W.kind[id] === KINDS.PERSON);
  if (unit.medicId && members.includes(unit.medicId)) return unit.medicId;
  let best = 0,
    score = -1;
  for (const id of members) {
    const s = healSkill(id) + (phenotype(id).cooperation || 0) * 10;
    if (s > score || (s === score && id < best)) {
      best = id;
      score = s;
    }
  }
  if (best) {
    unit.medicId = best;
    AID.medics++;
  }
  return best;
}
function fieldMedics() {
  for (const unit of W.militaryUnits || []) {
    if (!unit.active || !unitOnCampaign(unit)) continue;
    const medic = unitMedic(unit),
      mp = medic ? W.components.position[medic] : null;
    if (!mp || personInDistress(medic)) continue;
    let worst = null;
    for (const id of nearbyIds(medic, MEDIC_REACH, (o) => W.kind[o] === KINDS.PERSON && classifyAlive(o))) {
      if (W.components.social[id]?.factionId !== unit.factionId) continue;
      const open = openWoundsOf(id);
      if (!open.length) continue;
      const bleed = open.reduce((n, w) => n + (w.bleed || 0), 0);
      if (!worst || bleed > worst.bleed || (bleed === worst.bleed && id < worst.id)) worst = { id, bleed };
    }
    if (!worst) continue;
    const wp = W.components.position[worst.id];
    if (dist2(mp.x, mp.y, wp.x, wp.y) > 2) {
      moveWorkerToward(medic, idx(wp.x, wp.y), "heal", `🩹 running to ${entityName(worst.id)}, wounded in the column`);
      continue;
    }
    const home = homeTownOf(worst.id);
    AID.fieldDressed += dressWounds(worst.id, home, medic);
    setWorkAction(medic, "heal", `🩹 dressing ${entityName(worst.id)}'s wounds in the field`, idx(wp.x, wp.y));
    const life = derivedLife(worst.id);
    if (life.health < 25 && home && !civilOrderOf(worst.id)) {
      const clinic = townClinic(home);
      issueCivilOrder(worst.id, "convalesce", clinic ? clinic.x : home.x, clinic ? clinic.y : home.y, { placeId: home.id });
      AID.sentHome++;
    }
  }
}
// ── A hungry child is fed ────────────────────────────────────────────────────
function feedChildren() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || isAdultPerson(id)) continue;
    const life = W.components.life[id],
      gut = W.components.inventory[id]?.digestive;
    if (!gut || (life.hunger || 0) < 60) continue;
    const soc = W.components.social[id],
      carers = [...(W.components.identity[id]?.parents || []), soc?.householdId].filter((c, i, a) => c && c !== id && a.indexOf(c) === i && classifyAlive(c));
    for (const carer of carers) {
      const inv = W.components.inventory[carer],
        cp = W.components.position[carer],
        p = W.components.position[id];
      if (!inv || !cp || !p || dist2(cp.x, cp.y, p.x, p.y) > 36) continue;
      const give = Math.min(CHILD_MEAL, inv.materials[C.ORGANIC] || 0, 65535 - gut[C.ORGANIC]);
      if (give <= 0) continue;
      inv.materials[C.ORGANIC] -= give;
      gut[C.ORGANIC] += give;
      AID.childrenFed++;
      break;
    }
  }
}
const simTickAidBase = simTick;
simTick = function () {
  simTickAidBase();
  if (!W?.settlements) return;
  if (W.tick % 8 === 5) clinicCare();
  if (W.tick % 16 === 7) sendToClinic();
  if (W.tick % 4 === 3) fieldMedics();
  if (W.tick % 16 === 11) feedChildren();
};
const eventSentenceAidBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "WoundsDressedEvent") {
    const d = e.data || {};
    return `🩹 ${d.healer ? `${d.healer} dressed` : "The clinic dressed"} ${d.patient}'s wounds${d.medicine ? ` with medicine` : " by hand"}${d.place ? ` in ${d.place}` : ""}.`;
  }
  return eventSentenceAidBase(e);
};
window.ALIFE_AID_DEBUG = Object.freeze({
  counts: () => ({ ...AID }),
  bond: (helper, victim) => aidBond(helper, victim),
  dress: (patient, townId, healer = 0) => dressWounds(patient, W.settlements.find((s) => s.id === townId), healer),
  clinicCare: () => clinicCare(),
  sendToClinic: () => sendToClinic(),
  medics: () => fieldMedics(),
  medicOf: (unitId) => unitMedic((W.militaryUnits || []).find((u) => u.id === unitId) || { memberIds: [] }),
  feedChildren: () => feedChildren(),
});
