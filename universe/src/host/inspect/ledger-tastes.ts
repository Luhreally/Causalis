// The ledger's Tastes and Intoxicants tabs (asked 2026-11-16: "add what's popular in different realms ... on the ledger"; "what
// calms, what wakes, what eases pain, what gives visions: let me see the different stats of these in the ledger"). Each realm's most
// loved things a head against the world's middle and what crosses its borders unseen; each thing, who loves it most and who bars or
// lays on it; and each kind of intoxicant, realm beside realm. Pure reads (host/inspect/tastes.ts), only while the tab is open.
import type { World } from "../../kernel/index.ts";
import type { Block, Line, Row } from "../../bridge/index.ts";
import { INTOX_KINDS, INTOX_WORDS, WARE_INTOX, wareName } from "../../rules/index.ts";
import {
  INTOX,
  INTOX_STORE,
  KINDS_STORE,
  KIND_ROW,
  contrabandOf,
  moneyStore,
  politiesOf,
} from "../../sim/index.ts";
import { count, link } from "./words.ts";
import { LEDGER_ROWS, honest, listedOf, pct, type LedgerCtx } from "./ledger-kit.ts";
import {
  KIND_COLUMNS,
  TASTES,
  contraWhy,
  kindAbsent,
  kindCells,
  kindRead,
  lovedOf,
  lovedWords,
  tastesRead,
  mostTaken,
  mostTakenWords,
} from "./tastes.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Every realm's most loved things and its wares smuggled; and every thing, who loves it most and who bars or lays on it. */
export function tastesLedger(world: World, lc: LedgerCtx): Block[] {
  const t = tastesRead(world),
    rows: Row[] = [];
  let shown = 0,
    all = 0;
  for (const r of lc.standing) {
    if (!t.realms.has(r.ref)) continue;
    const loved = lovedOf(world, r.ref),
      wares = contrabandOf(world, r.ref);
    if (!loved.length && !wares.length) continue;
    all++;
    if (shown >= LEDGER_ROWS) continue;
    shown++;
    rows.push({
      ref: `${r.ref}#treasury`,
      cells: [
        [link(r.town, `${r.ref}#treasury`)],
        [loved.map(lovedWords).join("; ") || "nothing beyond the world's middle"],
        [mostTakenWords(world, r.ref) || "—"],
        [
          wares
            .slice(0, 3)
            .map((w) => `${wareName(w.ware)} ${pct(w.share)} (${contraWhy(w)})`)
            .join("; ") || "—",
        ],
      ],
      keys: [
        r.town,
        loved[0]?.ratio ?? 0,
        mostTaken(world, r.ref, 1)[0]?.name ?? "",
        wares[0]?.share ?? 0,
      ],
    });
  }
  if (!rows.length)
    return honest(
      "No realm's people yet take anything beyond the world's middle, and nothing crosses a border unseen.",
    );
  // Each thing: who loves it most, and who bars or lays on it (the most of it unseen).
  const these = new Set<string>(lc.standing.map((r) => r.ref)),
    things: Row[] = TASTES.map((taste, i) => {
      // (The first of those this ledger reads: the world's, or an alliance's.)
      const first = t.order[i]!.find((ref) => these.has(ref)),
        r = first ? lc.standing.find((x) => x.ref === first) : undefined,
        v = first ? t.realms.get(first)!.v[i]! : 0,
        ware = taste.good ?? (taste.kind !== undefined ? WARE_INTOX + taste.kind : -1);
      let barring = 0,
        most: { town: string; ref: string; share: number; why: string } | null = null;
      if (ware >= 0)
        for (const q of lc.standing) {
          const w = contrabandOf(world, q.ref).find((x) => x.ware === ware);
          if (!w) continue;
          barring++;
          if (!most || w.share > most.share)
            most = { town: q.town, ref: q.ref, share: w.share, why: contraWhy(w) };
        }
      return {
        cells: [
          [cap(taste.name)],
          r ? [link(r.town, `${r.ref}#treasury`), `: ${taste.say(v)}`] : ["no one takes it"],
          [t.middle[i]! > 0 ? taste.say(t.middle[i]!) : "—"],
          most
            ? [
                `smuggled into ${count(barring)} ${barring === 1 ? "realm" : "realms"}; most unseen in `,
                link(most.town, `${most.ref}#treasury`),
                ` (${pct(most.share)}: ${most.why})`,
              ]
            : ware < 0
              ? ["no market sells it"]
              : ["no realm bars or lays on it enough to smuggle it"],
        ],
        keys: [taste.name, v, t.middle[i]!, barring],
      };
    });
  return [
    {
      type: "table",
      title: "What each realm's people love, against the world's middle realm",
      columns: ["Realm", "Loves most", "Most taken, and its law", "Crosses its borders unseen"],
      rows,
      fit: true,
    },
    ...listedOf(shown, all, "most peopled realms"),
    {
      type: "table",
      title: "Each thing: who loves it most, and who bars or lays on it",
      columns: ["What", "Loves it most", "The world's middle", "Bars or lays on it"],
      rows: things,
      fit: true,
    },
    {
      type: "text",
      lines: [
        [
          `"Loves" is what a realm's people take a head, at least ${"1.25"} times the middle realm of those that take any. What crosses a border unseen is the wedge its law or its war lays on a ware against the risk of carrying it: what is worth much for its bulk slips past first.`,
        ],
      ],
    },
  ];
}

/** Of each kind, over the whole world: the lands that grow it, the realms whose people take it, whether trade carries it. */
function kindsInWorld(world: World): { lands: number; takers: number; traded: boolean }[] {
  const out = INTOX_KINDS.map(() => ({ lands: 0, takers: 0, traded: false })),
    lands = moneyStore(world, INTOX_STORE),
    kinds = moneyStore(world, KINDS_STORE),
    realms = politiesOf(world);
  const taking = INTOX_KINDS.map(() => new Set<string>());
  for (const key of lands?.keys() ?? []) {
    const row = lands!.get(key)!,
      r = realms.of(Number(key));
    INTOX_KINDS.forEach((_, k) => {
      if (row[INTOX.have + k]! > 0) out[k]!.lands++;
      if (row[INTOX.use + k]! > 0 && r) taking[k]!.add(r.ref);
    });
  }
  INTOX_KINDS.forEach((_, k) => (out[k]!.takers = taking[k]!.size));
  for (const key of kinds?.keys() ?? [])
    INTOX_KINDS.forEach((_, k) => {
      if ((kinds!.at(key, KIND_ROW.width * k + KIND_ROW.imported) ?? 0) > 0) out[k]!.traded = true;
    });
  return out;
}

/** Each kind of what calms, wakes, brings visions and eases pain, realm beside realm; and a line on each kind for the whole world. */
export function intoxLedger(world: World, lc: LedgerCtx): Block[] {
  const blocks: Block[] = [],
    kinds = moneyStore(world, KINDS_STORE),
    worldKinds = kindsInWorld(world);
  INTOX_KINDS.forEach((kind, k) => {
    const rows: Row[] = [];
    let lands = 0,
      takers = 0,
      traded = false,
      most: { town: string; ref: string; taken: number } | null = null;
    for (const r of lc.standing) {
      const read = kindRead(world, r, k);
      if (!read) continue;
      lands += read.grown;
      if (read.taken > 0) takers++;
      if ((kinds?.at(r.ref, KIND_ROW.width * k + KIND_ROW.imported) ?? 0) > 0) traded = true;
      if (read.taken > 0 && (!most || read.taken > most.taken))
        most = { town: r.town, ref: r.ref, taken: read.taken };
      if ((read.grown || read.taken > 0) && rows.length < LEDGER_ROWS)
        rows.push({
          ref: `${r.ref}#treasury`,
          cells: [[link(r.town, `${r.ref}#treasury`)], ...kindCells(read)],
          keys: [
            r.town,
            read.grown,
            read.taken,
            read.reach,
            read.barred,
            read.unseen,
            read.cost.dependent,
          ],
        });
    }
    const name = INTOX_WORDS[kind].name,
      // (Why it is absent, said of the whole world; of some realms only, said of them first.)
      whole = worldKinds[k]!,
      absent = kindAbsent(world, k, whole.lands, whole.takers, whole.traded),
      some = lc.standing.length < politiesOf(world).living().length,
      world_: Line = most
        ? [
            `Grown in ${count(lands)} ${lands === 1 ? "land" : "lands"}, taken in ${count(takers)} ${takers === 1 ? "realm" : "realms"}; taken most in `,
            link(most.town, `${most.ref}#treasury`),
            ` (${pct(most.taken)} of its people). ${cap(INTOX_WORDS[kind].does)}.`,
            ...(absent ? [` ${absent}`] : []),
          ]
        : [
            some ? `None of them takes ${name}. ` : "",
            absent ?? (some ? "Elsewhere it is taken." : `No one takes ${name}.`),
          ];
    blocks.push({ type: "text", title: cap(name), lines: [world_] });
    if (rows.length)
      blocks.push({
        type: "table",
        columns: ["Realm", ...KIND_COLUMNS],
        rows: rows.sort((a, b) => (b.keys![2] as number) - (a.keys![2] as number)),
        fit: true,
      });
  });
  return blocks;
}
