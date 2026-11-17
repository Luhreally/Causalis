// What a realm turns to arms and keeps at sea, and how a war goes besides the field (the last sweep, war). On a realm's Army tab:
// its footing (the share of what it makes turned to arms), what moves it and whom it races, the arms it sends into another's war
// or is sent, who it can send to war and why, the host a peace has it stand down, its fleet and what that costs, the blockade
// laid on it, and the fleet it could send to the stars. On a war's page: the siege of its seat or a walled land, the sea fought
// for, and who sends either side arms. Phone first: facts with what makes them one tap down, no table wider than a phone. Each
// says what, who, what it costs and what it does; never how a thing is made.
import type { World } from "../../kernel/index.ts";
import type { Block, Stat } from "../../bridge/index.ts";
import {
  armingOf,
  fieldedParts,
  fleetSentBy,
  knows,
  mobilising,
  navyOf,
  orderOf,
  politiesOf,
  populationContext,
  realmMight,
  realmName,
  siegeOf,
  type Polity,
  type War,
} from "../../sim/index.ts";
import { ARMING, starDriveFor } from "../../rules/index.ts";
import { count, part, share, stat } from "./words.ts";
import { realmLink } from "./names.ts";

const tonnes = (n: number) => `${count(n)} t`;

/** A realm's arming and its ships, for its Army tab. Nothing where it keeps neither. */
export function realmWarcraftBlocks(world: World, r: Polity): Block[] {
  const arming = armingOf(world)?.of(r.ref),
    fleet = navyOf(world)?.of(r.ref),
    realms = politiesOf(world),
    rows: Stat[] = [];
  // Who it can send to war, and why (rules/arming.ts levyShare).
  if (r.ended === null) {
    const ctx = populationContext(world),
      m = mobilising(world, r.ref),
      parts = fieldedParts(ctx, r);
    rows.push(
      stat("Sends to war", `${share(parts.share)} of its fighting men`, {
        parts: [
          part("what its people make beyond their food", share(m.spare)),
          part("their valour", share(parts.valour)),
          part(
            "how far they hold its rule rightful",
            share(orderOf(world)?.realms.get(r.ref)?.legitimacy ?? 0.6),
          ),
          ...(m.stake > 0 ? [part("what its wars put at stake", share(m.stake))] : []),
          ...(parts.standing ? [part("a standing army", "keeps them drilled")] : []),
        ],
      }),
    );
    if (m.disarm > 0 && arming)
      rows.push(
        stat(
          "Its host stood down",
          `${share(m.disarm)} of it, until year ${arming.disarmUntil}`,
          arming.disarmEvent ? { why: arming.disarmEvent } : {},
        ),
      );
    const sends = starDriveFor((id) => knows(ctx, r.seat, id)) ? fleetSentBy(ctx, r) : 0;
    if (sends > 0)
      rows.push(
        stat("A fleet to the stars", `${count(sends)} machines it could send`, {
          parts: [part("its might among the stars", realmMight(ctx, r).toFixed(1))],
        }),
      );
  }
  if (arming) {
    const against = arming.against ? realms.get(arming.against) : undefined;
    rows.push(
      stat(
        "Turned to arms",
        `${share(arming.footing)} of what it makes${arming.wanted > arming.footing + 0.005 ? `, rising toward ${share(arming.wanted)}` : arming.wanted < arming.footing - 0.005 ? `, easing toward ${share(arming.wanted)}` : ""}`,
        {
          ...(arming.race ? { why: arming.race } : {}),
          parts: [
            ...(against
              ? [
                  part(
                    ["against ", realmLink(world, against.ref)],
                    `fears it ${share(arming.threat)}`,
                  ),
                  part("its host over this realm's", `${arming.ratio.toFixed(2)} times`),
                ]
              : []),
            part("what arming costs its people", `${arming.fatigue.toFixed(1)} (1 is the least)`),
            ...(arming.war ? [part("a war asks it", share(arming.wanted))] : []),
            part("what it pays a year", count((arming.footing + arming.sends) * arming.made)),
          ],
        },
      ),
    );
    if (arming.race && against)
      rows.push(
        stat("In an arms race", ["with ", realmLink(world, against.ref)], { why: arming.race }),
      );
    if (arming.backs && arming.helps)
      rows.push(
        stat(
          "Sends arms",
          [
            "to ",
            realmLink(world, arming.helps),
            ` in its war, ${share(arming.sends)} of what it makes`,
          ],
          arming.backed ? { why: arming.backed } : {},
        ),
      );
    if (arming.gift > 0) {
      const from = (armingOf(world)?.realms() ?? []).filter(
        (k) => armingOf(world)?.of(k)?.helps === r.ref,
      );
      rows.push(
        stat("Is sent arms", `worth ${share(arming.gift)} of what it makes`, {
          parts: from.map((k) =>
            part(["from ", realmLink(world, k)], share(armingOf(world)!.of(k)!.sends)),
          ),
        }),
      );
    }
    if (arming.footing > 0)
      rows.push(
        stat(
          "What its arming does",
          `fields ${share(ARMING.fields * arming.footing)} more of its men, its arms worth ${share(ARMING.power * (arming.footing + Math.min(arming.gift, ARMING.giftMost)))} more`,
        ),
      );
  }
  if (fleet && (fleet.tons > 0 || fleet.blockaded > 0))
    rows.push(
      stat("Its ships", `${tonnes(fleet.tons)} of warships`, {
        parts: [
          part("it would keep", tonnes(fleet.wanted)),
          part("built this year", tonnes(fleet.built)),
          ...(fleet.sunk ? [part("sunk this year", tonnes(fleet.sunk))] : []),
          part("merchant ships it could press", tonnes(fleet.merchant)),
          part("its coasts' share of its people", share(fleet.coast)),
          part("what they cost a year", count(fleet.cost)),
        ],
      }),
    );
  if (fleet && fleet.blockaded > 0)
    rows.push(stat("Blockaded", `${share(fleet.blockaded)} of its sea trade cut by a foe's ships`));
  return rows.length ? [{ type: "facts", title: "Its arms and ships", rows }] : [];
}

/** A war's siege, its sea and the arms sent either side, for its page. Nothing where it has none of these. */
export function warWarcraftBlocks(world: World, w: War): Block[] {
  const realms = politiesOf(world),
    a = realms.get(w.attacker),
    b = realms.get(w.defender),
    blocks: Block[] = [];
  if (!a || !b) return blocks;
  const siege = siegeOf(world, w.ref);
  if (siege)
    blocks.push({
      type: "facts",
      title: siege.seat ? "The siege of its seat" : "A siege of a walled land",
      rows: [
        stat("Laid", `in year ${siege.since}, by ${realmName(a)}`, { why: siege.event }),
        stat("Its stores", `${Math.round(siege.months)} months left`, {
          parts: [
            part("brought in by sea this year", share(siege.relief)),
            part("its walls broken", share(siege.breach)),
          ],
        }),
        stat("Dead of sickness and hunger", `${count(siege.campDead + siege.townDead)}`, {
          parts: [
            part("of the besiegers' camp", count(siege.campDead)),
            part("of the town", count(siege.townDead)),
          ],
        }),
      ],
    });
  const sea = navyOf(world)?.sea(w.ref);
  if (sea)
    blocks.push({
      type: "facts",
      title: "The sea",
      rows: [
        stat(`${realmName(a)} holds`, share(sea.command[0]), {
          ...(sea.won ? { why: sea.won } : {}),
          parts: [part("ships sunk", tonnes(sea.sunk[0]))],
        }),
        stat(`${realmName(b)} holds`, share(sea.command[1]), {
          ...(sea.blockade ? { why: sea.blockade } : {}),
          parts: [part("ships sunk", tonnes(sea.sunk[1]))],
        }),
      ],
    });
  const store = armingOf(world);
  if (store) {
    const sent = store
      .realms()
      .map((k) => store.of(k)!)
      .filter((f) => f.backs === w.ref && f.helps);
    if (sent.length)
      blocks.push({
        type: "facts",
        title: "Arms sent into it",
        rows: sent.map((f) =>
          stat(
            realmName(realms.get(f.realm) ?? a),
            ["to ", realmLink(world, f.helps), `, ${share(f.sends)} of what it makes`],
            f.backed ? { why: f.backed } : {},
          ),
        ),
      });
  }
  return blocks;
}
