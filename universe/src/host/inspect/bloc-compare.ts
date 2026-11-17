// An alliance's members compared on every system the Ledger compares the world's realms on (asked 2026-11-16: "don't forget to add
// all the new stat tabs on the blocs/alliance tab"): its underworld, groups, houses and powers; its treasuries, trade, making and
// tastes; its people's lives, culture, arms and nature. Each tab is the Ledger's own table read of the alliance's realms alone
// (ledger-kit.ts ledgerCtxOf), each row a link to the member realm's tab; and like the Ledger's, each is read only while it is open,
// so an alliance's page costs no more than it did until one is pressed.
import type { World } from "../../kernel/index.ts";
import type { Block, Tab } from "../../bridge/index.ts";
import { link } from "./words.ts";
import { ledgerCtxOf, type LedgerCtx } from "./ledger-kit.ts";
import { groupsLedger, housesLedger, underworldLedger } from "./ledger-order.ts";
import { cultureLedger, powersLedger, societyLedger, tradeLedger } from "./ledger-realm.ts";
import { armsLedger, makingLedger, natureLedger } from "./ledger-nature.ts";
import { treasuryLedger } from "./ledger-money.ts";
import { intoxLedger, tastesLedger } from "./ledger-tastes.ts";

type Builder = (world: World, lc: LedgerCtx) => Block[];

/** The sections of an alliance's comparison, in their order, and each tab's name, the Ledger's tab it reads, and its builder. */
export const BLOC_SECTIONS: readonly (readonly [
  string,
  readonly (readonly [id: string, name: string, ledger: string, build: Builder])[],
])[] = [
  [
    "Order",
    [
      ["underworld", "Underworld", "underworld", underworldLedger],
      ["groups", "Groups", "groups", groupsLedger],
      ["houses", "Houses", "houses", housesLedger],
      ["powers", "Powers", "powers", powersLedger],
    ],
  ],
  [
    "Wealth",
    [
      ["treasury", "Treasury", "treasury", treasuryLedger],
      ["trade", "Trade", "trade", tradeLedger],
      ["making", "Making", "making", makingLedger],
      ["tastes", "Tastes", "tastes", tastesLedger],
    ],
  ],
  [
    "Life",
    [
      ["society", "Society", "society", societyLedger],
      ["culture", "Culture", "culture", cultureLedger],
      ["intox", "Intoxicants", "intox", intoxLedger],
      ["arms", "Arms", "arms", armsLedger],
      ["nature", "Nature", "nature", natureLedger],
    ],
  ],
];

/** An alliance's comparison tabs: each built only while it is open (`tab`), the others kept in their place empty. */
export function blocCompareTabs(
  world: World,
  members: readonly string[],
  tab: string | undefined,
): Tab[] {
  const out: Tab[] = [];
  for (const [group, tabs] of BLOC_SECTIONS)
    for (const [id, name, ledger, build] of tabs) {
      if (tab !== id) {
        out.push({ id, name, group, blocks: [], later: true });
        continue;
      }
      const lc = ledgerCtxOf(world, members);
      out.push({
        id,
        name,
        group,
        blocks: [
          {
            type: "text",
            lines: [
              [
                `Its ${members.length} realms side by side, as `,
                link(`the Ledger's ${name} tab`, `world:ledger#${ledger}`),
                " sets every realm of the world. Press a realm for its own.",
              ],
            ],
          },
          ...build(world, lc),
        ],
      });
    }
  return out;
}
