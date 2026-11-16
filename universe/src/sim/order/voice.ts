// What each realm's seat tells its people (rules/voice.ts), each year: what it most needs them to hold, how far it carries (its
// heralds at the seat, its faith's clergy in the lands of that faith, writing to those who read as far as its word joins its far
// lands), how far it is believed, and what free voices tell besides. Read where a realm's standing is weighed (order.ts
// addsStanding), where a land's ways are drawn (blame laid on strangers closes a people: culture.ts drawsWays), and where a land
// weighs its kin to its seat (one people told and believed: sim/culture/folk.ts). One row a realm; nothing that grows with history.
import {
  YEAR,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  HOLD,
  VOICE,
  VOICE_TOPICS,
  VOICE_WORDS,
  WAY_TRAITS,
  toldStanding,
  voiceBelied,
  voiceCredence,
  voiceHeard,
  voiceNeeds,
  voiceStanding,
  voiceTopic,
  type VoiceSituation,
  type VoiceTopic,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { beliefOf } from "../belief/belief.ts";
import { pulpitIn } from "../belief/temple.ts";
import { readersOf } from "../lore/letters.ts";
import { warsOf } from "../war/war.ts";
import { refNumber } from "../money/kept.ts";
import { WAY, cultureOf, drawsWays } from "../culture/culture.ts";
import { realmFolk, realmJoined } from "../culture/folk.ts";
import { VOICE_ROW, VOICE_STORE, cultureRows } from "../culture/rows.ts";
import { addsStanding, orderOf } from "./order.ts";

/** What a realm stands in, as its seat reads it this year, and how far its word carries: pure reads of the world. */
export function voiceSituation(
  ctx: PopulationContext,
  realm: Polity,
): VoiceSituation & { reach: number; readers: number; free: number } {
  const { world } = ctx,
    t = world.now,
    year = yearOfMoment(t),
    realms = politiesOf(world),
    faiths = beliefOf(world),
    seatFaith = faiths.of(realm.seat).faith,
    o = orderOf(world)?.of(realm.ref),
    joined = realmJoined(ctx, realm);
  let people = 0,
    hungry = 0,
    shared = 0,
    grievance = 0,
    heard = 0,
    readers = 0;
  for (const c of realm.members) {
    const prov = ctx.provinces.get(c),
      n = prov?.total() ?? 0;
    if (!n) continue;
    people += n;
    const f = prov!.lastFamine ? world.events.get(prov!.lastFamine) : undefined;
    if (f && t - f.t <= 2 * YEAR) hungry += n;
    const same = seatFaith !== null && faiths.of(c).faith === seatFaith;
    if (same) shared += n;
    grievance += n * Math.min(1, realms.discontent(c).level);
    const r = readersOf(world, c);
    readers += n * r;
    heard += n * voiceHeard(c === realm.seat, same ? pulpitIn(world, c) : 0, r, joined);
  }
  let won = 0,
    lost = 0;
  const wars = warsOf(world).hotOf(realm.ref);
  for (const w of wars) {
    const side = w.attacker === realm.ref ? 0 : w.defender === realm.ref ? 1 : -1;
    if (side < 0) continue;
    for (const b of w.battles) if (b.year >= year - 5) b.won === (side === 0) ? won++ : lost++;
  }
  const all = Math.max(1, people),
    folk = realmFolk(ctx, realm);
  return {
    legitimacy: o?.legitimacy ?? 0.6,
    atWar: wars.length > 0,
    lost: won + lost ? lost / (won + lost) : 0,
    apart: folk.apart,
    nation: folk.nation,
    hungry: hungry / all,
    shared: seatFaith ? shared / all : 0,
    piety: cultureOf(world).get(realm.seat)?.traits[WAY.piety] ?? 0.5,
    grievance: grievance / all,
    reach: heard / all,
    readers: readers / all,
    free: o?.held ? o.held[HOLD.word]! / 100 : 0.5,
  };
}

/** What a realm's seat tells and how it is taken, as last reckoned, or null. */
export function voiceOf(
  world: World,
  realm: Ref,
): {
  topic: VoiceTopic | null;
  since: number;
  reach: number;
  credence: number;
  free: number;
  readers: number;
  grievance: number;
  standing: number;
  told: number;
} | null {
  const row = cultureRows(world, VOICE_STORE)?.get(refNumber(realm));
  if (!row) return null;
  return {
    topic: VOICE_TOPICS[row[VOICE_ROW.topic]! - 1] ?? null,
    since: row[VOICE_ROW.since]!,
    reach: row[VOICE_ROW.reach]! / 1000,
    credence: row[VOICE_ROW.credence]! / 1000,
    free: row[VOICE_ROW.free]! / 1000,
    readers: row[VOICE_ROW.readers]! / 1000,
    grievance: row[VOICE_ROW.grievance]! / 1000,
    standing: row[VOICE_ROW.standing]! / 10000,
    told: row[VOICE_ROW.told]! / 10000,
  };
}

/** The year's voices: each living realm's seat says what it most needs to, and it is heard and taken as it is. */
export function voiceYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = cultureRows(world, VOICE_STORE);
  if (!rows || !world.hasStore("polity.states")) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    living = new Set<string>();
  for (const realm of realms.living()) {
    const serial = refNumber(realm.ref),
      row = rows.get(serial);
    living.add(String(serial));
    const s = voiceSituation(ctx, realm),
      chosen = voiceTopic(voiceNeeds(s)),
      was = row ? (VOICE_TOPICS[row[VOICE_ROW.topic]! - 1] ?? null) : null,
      // (A seat that needs to say nothing new keeps telling what it told.)
      topic = chosen ?? was,
      credence = topic ? voiceCredence(voiceBelied(topic, s), s.free, s.readers) : 0,
      standing = topic ? voiceStanding(s.reach, credence) : 0,
      told = toldStanding(s.free, s.readers, s.grievance);
    if (!row && !topic && told === 0) continue;
    rows.set(serial, [
      topic ? VOICE_TOPICS.indexOf(topic) + 1 : 0,
      topic && topic === was && row ? row[VOICE_ROW.since]! : year,
      Math.round(s.reach * 1000),
      Math.round(credence * 1000),
      Math.round(s.free * 1000),
      Math.round(s.readers * 1000),
      Math.round(s.grievance * 1000),
      Math.round(standing * 10000),
      Math.round(told * 10000),
    ]);
  }
  // (A realm ended tells nothing.)
  for (const key of rows.keys()) if (!living.has(key)) rows.drop(key);
}

/** What a realm's word does to its standing: what its seat tells, and what free voices tell of its lands. */
function voiceFactors(ctx: PopulationContext, realm: Polity): Factor[] {
  const v = voiceOf(ctx.world, realm.ref);
  if (!v) return [];
  const out: Factor[] = [];
  if (v.topic)
    out.push({
      name: `its word ${v.credence >= 0.5 ? "believed" : "not believed"}: ${VOICE_WORDS[v.topic]}`,
      value: v.reach,
      contribution: v.standing,
      source: null,
    });
  if (v.told < 0)
    out.push({
      name: "what free voices tell of its lands' grievance",
      value: v.free,
      contribution: v.told,
      source: null,
    });
  return out;
}

/** What a realm's word draws of a land's ways: blame for a hunger laid on strangers closes them to strangers. Only reads. */
function voiceLean(world: World, cell: number): readonly number[] | null {
  if (!world.hasStore(VOICE_STORE) || !world.hasStore("polity.states")) return null;
  const realm = politiesOf(world).of(cell),
    v = realm ? voiceOf(world, realm.ref) : null;
  if (!v || v.topic !== "blame") return null;
  const k = WAY.openness;
  return WAY_TRAITS.map((_, i) => (i === k ? -VOICE.blame * v.reach * v.credence : 0));
}

/** Teach a peopled world what its seats tell. */
export function installVoice(world: World, ctx: () => PopulationContext): void {
  world.system({ key: "186.order.voice", every: YEAR, run: (t) => voiceYear(ctx(), t) });
  addsStanding(voiceFactors);
  drawsWays(voiceLean);
}
