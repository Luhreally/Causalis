// A soldier or a beast possessed, as the page sees it (Phase 61): the small world the sim keeps,
// stepped on by the bids the page has not yet sent (sim/hand/fight.ts soldierAhead, sim/hand/wild.ts
// beastAhead), so it draws the bodies and shows what each act came to between the seconds it sends;
// told in words — the four acts under the thumb, what each would do or why it cannot be done now, what
// the last came to, the strip of who he is (a soldier's arm and its maker, his wounds; a beast's kind,
// its herd, how fed it is), and a soldier's battle as it stands, its fallen named. And a battle the
// god fought, at any step of its fight fought out (for the field drawn as he fought it), and what it
// did to one of its men (for his page). Reading only: the kept world is never stepped here.
import type { World } from "../kernel/index.ts";
import {
  BLOW_PLACES,
  FIGHT_TOLD,
  POSSESS_HZ,
  WILD_TOLD,
  fightOffers,
  herdMiddle,
  strayed,
  wildOffers,
  type FightBody,
  type FightScene,
  type FightWorld,
  type WildScene,
  type WildWorld,
} from "../rules/index.ts";
import {
  beastAhead,
  foughtOn,
  handOf,
  politiesOf,
  populationContext,
  realmName,
  soldierAhead,
  warsOf,
  type HandFought,
  type HeldBeast,
  type HeldSoldier,
} from "../sim/index.ts";
import type {
  FoughtNow,
  HeldBody,
  HeldFallen,
  HeldLive,
  HeldNow,
  HeldTally,
  PossessOffer,
  PossessStrip,
  StruckNow,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import { armBorne } from "./inspect/arm.ts";

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const firstOf = (name: string) => name.replace(/ of .*$/, "");
/** A place struck, in words ("the left arm"). */
const PLACE_WORDS: Readonly<Record<string, string>> = {
  head: "the head",
  trunk: "the body",
  "arm-l": "the left arm",
  "arm-r": "the right arm",
  "hand-l": "the left hand",
  "hand-r": "the right hand",
  "leg-l": "the left leg",
  "leg-r": "the right leg",
};
const placeWords = (k: number) => PLACE_WORDS[BLOW_PLACES[k] ?? ""] ?? "the body";

/** A held one's small world stepped ahead, kept for the bids last asked (the next ask steps only those added). */
type Ahead<W> = { readonly kept: number; readonly letters: string; world: W };
const AHEAD = new WeakMap<object, Ahead<FightWorld | WildWorld>>();

/** The small world as the bids not yet sent make it: from what was last asked if these go on from those, else afresh. */
function aheadOf<W extends FightWorld | WildWorld>(
  h: object,
  kept: number,
  letters: string,
  step: (letters: string, onto?: W) => W | null,
): W | null {
  const was = AHEAD.get(h) as Ahead<W> | undefined;
  if (was && was.kept === kept) {
    if (was.letters === letters) return was.world;
    if (letters.startsWith(was.letters) && letters.length > was.letters.length) {
      const w = step(letters.slice(was.letters.length), was.world);
      if (w) {
        AHEAD.set(h, { kept, letters, world: w });
        return w;
      }
    }
  }
  const w = step(letters);
  if (w) AHEAD.set(h, { kept, letters, world: w });
  return w;
}

/** A body of a small world as the page draws it. */
function bodyOf(b: FightBody | WildWorld["bodies"][number]): HeldBody {
  const f = "hurt" in b ? b : null;
  return {
    id: b.id,
    x: b.x,
    z: b.z,
    yaw: b.yaw,
    vx: b.vx,
    vz: b.vz,
    doing: b.doing,
    hurt: f ? f.hurt : 0,
    struck: f ? f.struck : -1,
    lost: f ? f.lost : -1,
  };
}

/** The disabling blow's clock comes from the same deeds the battle's result and replay read. */
function fightBodies(scene: FightScene, f: FightWorld): HeldBody[] {
  const struck = new Map<number, number>();
  for (const deed of f.deeds) struck.set(deed.id, scene.from + deed.step / POSSESS_HZ);
  return f.bodies.map((b) => {
    const at = struck.get(b.id);
    return at === undefined ? bodyOf(b) : { ...bodyOf(b), struckAt: at };
  });
}

/** The held one as taken (null: none). */
export function heldNow(world: World): HeldNow | null {
  const h = handOf(world).held;
  if (!h) return null;
  if (h.kind === "soldier")
    return {
      kind: "soldier",
      name: h.name,
      town: h.town,
      ref: h.ref,
      battle: h.battle,
      war: h.war,
      side: h.side,
      figure: h.figure,
      most: h.most,
      per: h.per,
      from: h.from,
      second: h.scene.from,
      step: h.fight.step,
      bodies: h.fight.bodies.map((b) => b.id),
      blows: [h.scene.sides[0].blow, h.scene.sides[1].blow],
      ended: h.fight.ended,
    };
  const ctx = populationContext(world),
    v = ctx.settlements.get(h.village);
  return {
    kind: "beast",
    name: h.name,
    species: h.species,
    kindName: ctx.generated.life.species.find((s) => s.ref === h.species)?.name ?? "",
    village: h.village,
    townName: v?.name ?? "",
    from: h.from,
    step: h.wild.step,
    x: h.scene.x,
    z: h.scene.z,
    bodies: h.wild.bodies.map((b) => b.id),
    members: h.members,
    ended: h.wild.ended,
  };
}

/** What a soldier's arm strikes as, its icon and its act's label. */
function strikeLook(scene: FightScene, side: 0 | 1): { icon: string; label: string; arm: string } {
  const s = scene.sides[side];
  return s.blow === "shot"
    ? { icon: "💥", label: "Fire", arm: "his gun" }
    : s.blow === "edge"
      ? { icon: "🗡️", label: "Strike", arm: "his blade" }
      : s.blow === "point"
        ? { icon: "🔱", label: "Thrust", arm: "his point" }
        : { icon: "🔨", label: "Strike", arm: "his arm" };
}
const LOOSE_LOOK: Readonly<Record<string, readonly [string, string]>> = {
  arrows: ["🏹", "Loose"],
  darts: ["🎯", "Throw"],
  shot: ["💥", "Fire"],
};

/** A soldier held, in words: his four acts, what the last came to, the strip, the battle's tally. */
function soldierLive(world: World, h: HeldSoldier, f: FightWorld): HeldLive {
  const idx = new Map<number, number>();
  f.bodies.forEach((b, i) => idx.set(b.id, i));
  const nameOf = (id: number) => {
      const i = idx.get(id);
      return firstOf((i !== undefined ? h.names[i] : "") || "one of the host");
    },
    me = f.bodies[0]!,
    he = firstOf(h.name),
    scene = h.scene,
    look = strikeLook(scene, h.side),
    why = (w: string, act: string) =>
      w === "reach"
        ? `No foe within reach of ${look.arm}: come closer`
        : w === "range"
          ? "None within range"
          : w === "near"
            ? "No blow coming at him to turn"
            : w === "soon"
              ? act === "rally"
                ? "He rallied them just now"
                : "Not yet: his arm comes back"
              : w === "broken"
                ? "His side is broken: none will stand"
                : "",
    offers: PossessOffer[] = fightOffers(scene, f).map((o) => {
      const [icon, label] =
        o.kind === "strike"
          ? [look.icon, look.label]
          : o.kind === "loose"
            ? (LOOSE_LOOK[scene.sides[h.side].looses] ?? ["🏹", "Loose"])
            : o.kind === "parry"
              ? ["🛡️", "Parry"]
              : o.kind === "rally"
                ? ["📯", "Rally"]
                : o.kind === "fly"
                  ? ["🏃", "Fly"]
                  : ["✊", "Stand"];
      const foe = me.foe >= 0 ? f.bodies[me.foe] : undefined,
        words = !o.can
          ? why(o.why, o.kind)
          : o.kind === "strike"
            ? `${look.label} at ${foe ? nameOf(foe.id) : "the foe"} with ${look.arm}`
            : o.kind === "loose"
              ? `${label} at ${foe ? nameOf(foe.id) : "the foe"}`
              : o.kind === "parry"
                ? "Turn the blows coming at him a while"
                : o.kind === "rally"
                  ? "Rally the men about him: their hearts lift"
                  : o.kind === "fly"
                    ? "Turn and fly the field: his side's heart sinks"
                    : "Stand and fight again";
      return { act: o.act, icon, label, can: o.can, words };
    }),
    [code, step, id, more] = f.told,
    what = FIGHT_TOLD[code] ?? "",
    who = id >= 0 ? nameOf(id) : "",
    told = (words: string, good = true) => ({ words, step, good }),
    toldNow =
      what === ""
        ? null
        : what === "felled"
          ? told(`${he} struck down ${who}, dead`)
          : what === "wounded"
            ? told(`${he} struck ${who} in ${placeWords(more)}: he is down`)
            : what === "struck"
              ? told(`${he} struck ${who} in ${placeWords(more)}`)
              : what === "missed"
                ? told(`${he} struck at ${who} and missed`, false)
                : what === "parried"
                  ? more === 1
                    ? told(`${he} turned ${who}'s blow`)
                    : told(`${who} turned ${he}'s blow`, false)
                  : what === "loosed"
                    ? told(`${he} loosed at ${who}`)
                    : what === "rallied"
                      ? told(`${he} rallied ${more} about him`)
                      : what === "fled"
                        ? told(`${he} turns and flies`, false)
                        : what === "stood"
                          ? told(`${he} stands again`)
                          : what === "broke"
                            ? told("His side breaks: the day is lost", false)
                            : what === "beaten"
                              ? told("Their line breaks: the day is his side's")
                              : what === "hit"
                                ? told(`${who} struck ${he} in ${placeWords(more)}`, false)
                                : told(
                                    more === 2
                                      ? "Too soon"
                                      : more === 1
                                        ? "None in reach"
                                        : "No foe before him",
                                    false,
                                  ),
    borne = armOf(world, h),
    strip: PossessStrip = {
      name: he,
      what: `of the host of ${sideRealm(world, h)}${h.town ? `, from ${h.town}` : ""}`,
      strength: Math.max(0, 1 - me.hurt),
      carries: borne,
      body:
        me.doing === "dead"
          ? "Struck dead"
          : me.hurt <= 0
            ? "Whole"
            : `Struck in ${placeWords(me.struck)}${me.lost >= 0 ? `, ${placeWords(me.lost)} cut off` : ""}${me.doing === "down" ? ": down" : ""}`,
    };
  return {
    kind: "soldier",
    step: f.step,
    kept: h.fight.step,
    bodies: fightBodies(scene, f),
    offers,
    told: toldNow,
    strip,
    tally: tallyOf(world, h, f, nameOf),
    ended: f.ended,
  };
}

/** The realm a soldier held fights for. */
function sideRealm(world: World, h: Pick<HeldSoldier, "war" | "side">): string {
  const w = warsOf(world).get(h.war),
    p = w ? politiesOf(world).get(h.side === 0 ? w.attacker : w.defender) : undefined;
  return p ? realmName(p) : "his realm";
}

/** What a soldier held bore, and who made it (host/inspect/arm.ts armBorne), once a holding. */
const BORNE = new WeakMap<object, string>();
function armOf(world: World, h: HeldSoldier): string {
  let s = BORNE.get(h);
  if (s === undefined) {
    const a = armBorne(world, h.battle, h.side, h.ref);
    s = a ? `${a.words}${a.maker ? `, made by ${a.maker}` : ""}` : "his own hands";
    BORNE.set(h, s);
  }
  return s;
}

/** The battle as it stands: each side's men standing and fallen (so many to a figure), the last struck down named. */
function tallyOf(
  world: World,
  h: HeldSoldier,
  f: FightWorld,
  nameOf: (id: number) => string,
): HeldTally {
  const w = warsOf(world).get(h.war),
    realms = politiesOf(world),
    realm = (k: 0 | 1) => {
      const p = w ? realms.get(k === 0 ? w.attacker : w.defender) : undefined;
      return p
        ? { realm: realmName(p), short: p.town }
        : k === 0
          ? { realm: "the attackers", short: "Attackers" }
          : { realm: "the defenders", short: "Defenders" };
    },
    inFight = [0, 0],
    down = [0, 0];
  for (const b of f.bodies) {
    inFight[b.side]!++;
    if (b.doing === "dead" || b.doing === "down") down[b.side]!++;
  }
  const side = (k: 0 | 1) => {
      const s = h.scene.sides[k],
        alive = Math.max(0, s.figures - s.before),
        fell = s.before + (inFight[k] ? (down[k]! * alive) / inFight[k]! : 0);
      return {
        ...realm(k),
        standing: Math.max(0, Math.round(h.per * (s.figures - fell))),
        fallen: Math.round(h.per * fell),
      };
    },
    named: HeldFallen[] = f.deeds.slice(-4).map((d) => ({
      name: nameOf(d.id),
      side: f.bodies.find((b) => b.id === d.id)?.side ?? 0,
      dead: d.dead,
      by: nameOf(d.by),
      god: d.by === h.figure,
    }));
  return {
    sides: [side(0), side(1)],
    named,
    broke: f.broke,
    brokeAt: brokeSecond(h.scene, f),
    mine: h.side,
  };
}

/** The battle second a fight's side broke at (-1: none broke). */
const brokeSecond = (scene: FightScene, f: FightWorld): number =>
  f.broke >= 0 ? scene.from + f.brokeAt / POSSESS_HZ : -1;

/** WILD_TOLD in words for a beast held. */
function beastLive(world: World, h: HeldBeast, w: WildWorld): HeldLive {
  const ctx = populationContext(world),
    scene: WildScene = h.scene,
    me = w.bodies[0]!,
    k = scene.kinds[me.kind]!,
    nameOf = (id: number) => {
      const i = w.bodies.findIndex((x) => x.id === id);
      if (i < 0) return "one of them";
      if (h.members[i]! >= 0) return "one of the flock";
      const ref = h.kinds[w.bodies[i]!.kind],
        sp = ctx.generated.life.species.find((s) => s.ref === ref);
      return sp ? `${/^[aeiou]/i.test(sp.name) ? "an" : "a"} ${sp.name}` : "a beast";
    },
    icon: Readonly<Record<string, readonly [string, string, string]>> = {
      eat: ["🍖", "Eat", "Eat at the kill"],
      graze: [
        "🌿",
        k.frame.eats === "seeds" ? "Peck" : k.frame.eats === "leaves" ? "Browse" : "Graze",
        "Eat where it stands",
      ],
      drink: ["💧", "Drink", "Drink at the water"],
      hunt: ["🐾", "Spring", "Spring on the nearest it may take"],
      herd: ["📣", "Call", "Call its herd about it"],
      court: ["💞", "Court", "Court one of its kind near"],
      flee: ["💨", "Bolt", "Bolt from what threatens it"],
    },
    offers: PossessOffer[] = wildOffers(scene, w).map((o) => {
      const [i, label, words] = icon[o.kind]!;
      return {
        act: o.act,
        icon: i,
        label,
        can: o.can,
        words: o.can
          ? words
          : o.kind === "drink"
            ? "No water near"
            : o.kind === "hunt"
              ? "None near enough to take"
              : o.kind === "eat"
                ? "No kill near"
                : "None of its kind near",
      };
    }),
    [code, step, id, more] = w.told,
    what = WILD_TOLD[code] ?? "",
    told = (words: string, good = true) => ({ words, step, good }),
    toldNow =
      what === ""
        ? null
        : what === "grazed"
          ? told("It eats")
          : what === "ate"
            ? told("It eats at the kill")
            : what === "drank"
              ? told("It drinks")
              : what === "killed"
                ? told(`It brought down ${nameOf(id)}`)
                : what === "missed"
                  ? told(`It sprang at ${nameOf(id)} and missed`, false)
                  : what === "called"
                    ? told(`It called: ${more} come about it`)
                    : what === "courted"
                      ? told("It courts one of its kind")
                      : what === "fled"
                        ? told("It bolts", false)
                        : told(
                            [
                              "No foe near",
                              "No kill near",
                              "No water near",
                              "It hunts no one",
                              "None near enough to take",
                              "It keeps no herd",
                              "None of its kind near",
                              "Its spring is under way",
                            ][more] ?? "Nothing comes of it",
                            false,
                          ),
    mid = herdMiddle(scene, w),
    far = mid ? Math.round(Math.hypot(me.x - mid.x, me.z - mid.z)) : null,
    v = ctx.settlements.get(h.village);
  return {
    kind: "beast",
    step: w.step,
    kept: h.wild.step,
    bodies: w.bodies.map(bodyOf),
    offers,
    told: toldNow,
    strip: {
      name: cap(h.name),
      what:
        h.members[0]! >= 0
          ? `of the flock of ${v?.name ?? "the town"}`
          : `of the wild about ${v?.name ?? "the town"}`,
      strength: Math.max(0, Math.min(1, w.fed)),
      carries: `${k.frame.hunts ? "hunts" : k.frame.eats === "seeds" ? "pecks" : "grazes"} · runs ${Math.round(k.frame.run)} m/s · ${Math.round(k.frame.size)} kg`,
      body:
        far === null
          ? "No herd"
          : strayed(scene, w)
            ? `Strayed ${far} m from its herd: lost to it if let go here`
            : `${far} m from its herd`,
    },
    tally: null,
    ended: w.ended,
  };
}

/** A battle the god fought, fought on from where the hand left it, kept as last asked (the next ask steps on from it). */
const FOUGHT = new WeakMap<HandFought, FightWorld>();
function foughtAt(world: World, f: HandFought, step: number): FightWorld {
  const was = FOUGHT.get(f),
    at = Math.max(f.left.step, step);
  if (was && was.step <= at) {
    if (was.step < at) foughtOn(world, f, at - was.step, was);
    return was;
  }
  const w = foughtOn(world, f, at - f.left.step);
  FOUGHT.set(f, w);
  return w;
}

/** A battle the god fought at a step of its fight (beyond its end: as it ended). */
export function foughtNow(world: World, battle: string, step?: number): FoughtNow | null {
  const f = handOf(world).foughtOf(battle);
  if (!f) return null;
  const end = foughtAt(world, f, Infinity),
    last = end.step,
    w = step === undefined || step >= last ? end : foughtAt(world, f, step);
  return {
    battle,
    name: f.name,
    figure: f.figure,
    side: f.side,
    most: f.most,
    per: f.per,
    from: f.from,
    to: f.to,
    second: f.scene.from,
    step: w.step,
    last,
    bodies: fightBodies(f.scene, w),
    broke: w.broke,
    brokeAt: brokeSecond(f.scene, w),
    blows: [f.scene.sides[0].blow, f.scene.sides[1].blow],
  };
}

/**
 * What a battle the god fought did to one of its men (his roll's ref; null: not one of its fight):
 * whether he was the god's body, how he came out of it, and by whose hand, in words.
 */
export function foughtFate(
  world: World,
  battle: string,
  ref: string,
): {
  fate: "fell" | "hurt" | "stood";
  god: boolean;
  byGod: boolean;
  words: string;
  event: string;
} | null {
  const f = handOf(world).foughtOf(battle);
  if (!f) return null;
  const i = f.refs.indexOf(ref);
  if (i < 0) return null;
  const end = foughtAt(world, f, Infinity),
    b = end.bodies[i]!,
    deed = end.deeds.findLast((d) => d.id === b.id),
    byGod = !!deed && deed.by === f.figure && i !== 0,
    he = firstOf(f.name),
    fate: "fell" | "hurt" | "stood" =
      b.doing === "dead" ? "fell" : b.doing === "down" || b.hurt > 0 ? "hurt" : "stood";
  const words =
    i === 0
      ? `The god fought in his body${fate === "fell" ? ", and he fell" : fate === "hurt" ? ", and he was struck down" : ", and he came through"}`
      : byGod
        ? `Struck down by the god in ${he}'s body${fate === "fell" ? ", dead" : `, in ${placeWords(b.struck)}`}`
        : `In the battle the god fought in ${he}'s body, ${fate === "fell" ? "he fell" : fate === "hurt" ? `he was struck in ${placeWords(b.struck)}` : "he came through"}`;
  return { fate, god: i === 0, byGod, words, event: f.event };
}

/** A named body's actual wounds in a held or completed fight, for its inspection page. */
export function foughtBody(
  world: World,
  ref: string,
): { battle: string; struck: StruckNow[] } | null {
  const store = handOf(world),
    held = store.held;
  const record =
    held?.kind === "soldier" && held.refs.includes(ref)
      ? { battle: held.battle, refs: held.refs, bodies: held.fight.bodies }
      : (() => {
          const f = store.fought.findLast((f) => f.refs.includes(ref));
          return f
            ? { battle: f.battle, refs: f.refs, bodies: foughtAt(world, f, Infinity).bodies }
            : null;
        })();
  if (!record) return null;
  const body = record.bodies[record.refs.indexOf(ref)];
  if (!body) return null;
  const struck: StruckNow[] = [];
  if (body.struck >= 0)
    struck.push({
      member: BLOW_PLACES[body.struck]!,
      lost: body.lost === body.struck,
      fell: body.doing === "dead",
    });
  if (body.lost >= 0 && body.lost !== body.struck)
    struck.push({ member: BLOW_PLACES[body.lost]!, lost: true, fell: false });
  return { battle: record.battle, struck };
}

export const HELD_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** The soldier or beast held, as taken (null: none). */
  "held.now": (world) => heldNow(world),
  /**
   * The held one's small world stepped on by the bids of the second begun (`steps`, three letters
   * each, at most twenty), as the page draws it and in words; null: none held, or bids that are not.
   */
  "held.live": (world, args) => {
    const h = handOf(world).held;
    if (!h) return null;
    const letters =
      typeof (args as { steps?: unknown } | null)?.steps === "string"
        ? (args as { steps: string }).steps
        : "";
    if (h.kind === "soldier") {
      const f = aheadOf<FightWorld>(h, h.fight.step, letters, (l, onto) =>
        soldierAhead(world, l, onto),
      );
      return f ? soldierLive(world, h, f) : null;
    }
    const w = aheadOf<WildWorld>(h, h.wild.step, letters, (l, onto) => beastAhead(world, l, onto));
    return w ? beastLive(world, h, w) : null;
  },
  /** A battle the god fought, at a step of its fight (`step`; absent: its end); null: history's alone. */
  "held.fought": (world, args) => {
    const a = (args ?? {}) as { battle?: unknown; step?: unknown };
    return typeof a.battle === "string"
      ? foughtNow(world, a.battle, typeof a.step === "number" ? a.step : undefined)
      : null;
  },
};
