// A part played for a group of one's town, in a life lived (asked 2026-11-18): what a collector, a lookout, a seller, a guard,
// a head, an officer of a crew, a member, a giver and a judge can spend hours on, and what each comes to. Pure: a part's
// outcome is read from what the world keeps of the group in this land (its hold, its war, soldiers sent against it) and a few
// draws; it is written on the life alone (coin, standing with the group, a wound), and nothing of the group moves by it.
// Words say what was done, to whom, at what cost and with what effect: never how.
import { dmath } from "../kernel/index.ts";

export const PART_IDS = [
  "rounds",
  "watch",
  "sell",
  "lielow",
  "door",
  "receive",
  "settle",
  "send",
  "answer",
  "paywatch",
  "patrol",
  "lead",
  "attend",
  "alms",
  "judge",
] as const;
export type PartId = (typeof PART_IDS)[number];

/** A part's sign and name on the tray. */
export const PARTS: Readonly<Record<PartId, { readonly icon: string; readonly label: string }>> = {
  rounds: { icon: "🧾", label: "Make the rounds" },
  watch: { icon: "👀", label: "Hold the corner" },
  sell: { icon: "🌒", label: "Sell in the lane" },
  lielow: { icon: "🤫", label: "Lie low" },
  door: { icon: "🚪", label: "Hold the door" },
  receive: { icon: "🪑", label: "Receive at the house" },
  settle: { icon: "🤝", label: "Settle a dispute" },
  send: { icon: "🧾", label: "Send the collector" },
  answer: { icon: "⚔️", label: "Answer the rival" },
  paywatch: { icon: "🪙", label: "Pay the watch" },
  patrol: { icon: "🛡️", label: "Walk the round" },
  lead: { icon: "🗣️", label: "Lead the meeting" },
  attend: { icon: "🪑", label: "Go to the meeting" },
  alms: { icon: "🍞", label: "Give alms" },
  judge: { icon: "⚖️", label: "Hear the case" },
};

/**
 * Whose each part is: by what one is for a thing of the town (a going's kind, as host/inspect/townlife.ts reads who is of it),
 * its head ("head": of an underworld group; "leads": of a lawful one), or the court's judge.
 */
export type PartOf =
  | "collect"
  | "corner"
  | "seller"
  | "guard"
  | "patrol"
  | "meeting"
  | "alms"
  | "head"
  | "leads"
  | "judge";
export const PARTS_OF: Readonly<Record<PartOf, readonly PartId[]>> = {
  collect: ["rounds", "lielow"],
  corner: ["watch"],
  seller: ["sell", "lielow"],
  guard: ["door"],
  patrol: ["patrol"],
  meeting: ["attend"],
  alms: ["alms"],
  head: ["receive", "settle", "send", "answer", "paywatch", "lielow"],
  leads: ["lead"],
  judge: ["judge"],
};

/** What a judge may lay on one brought for a small wrong, by the court's form (host/inspect/justice.ts sentenceOf). */
export const JUDGE_SENTENCES: Readonly<Record<string, readonly string[]>> = {
  magistrate: ["fine", "stocks", "cell", "labour", "banish", "bribe"],
  bench: ["free", "fine", "cell", "labour"],
};
/** How long each holds one (days), and what it is called on the tray. */
export const JUDGED: Readonly<Record<string, { readonly days: number; readonly label: string }>> = {
  free: { days: 1, label: "Let them go" },
  fine: { days: 1, label: "A fine" },
  stocks: { days: 3, label: "Three days in the stocks" },
  cell: { days: 90, label: "Three months in the cell" },
  labour: { days: 180, label: "Six months at the works" },
  banish: { days: 730, label: "Send them away" },
  bribe: { days: 1, label: "Take what is offered" },
};

/** What a part is played against: read from what the world keeps of the group and its land, the same for the same world. */
export type PartFacts = {
  /** Those it touches: who pay, who come, who are given to. */
  readonly n: number;
  /** The group's hold on this land, and the share of its trade under a protector (0 … 1). */
  readonly hold: number;
  readonly share: number;
  /** Its power among its realm's groups (0 … 1). */
  readonly strength: number;
  /** It is at war with another group; soldiers are sent into this land; a crew of the realm's enforcers works it. */
  readonly war: boolean;
  readonly soldiers: boolean;
  readonly crew: boolean;
  /** A crew that is paid by those it leaves alone. */
  readonly takes: boolean;
  /** A person's bread for a day, in coin. */
  readonly bread: number;
};

/** How one stands in one's part: with the group (0 … 100), wounds taken at it, times played, and until when the watch is paid. */
export type PartState = {
  standing: number;
  wounds: number;
  done: number;
  paid: number;
};
export const newPart = (): PartState => ({ standing: 30, wounds: 0, done: 0, paid: 0 });

/** What a part came to. */
export type PartCame = {
  /** Coin to the purse (less than nothing: paid out, or taken). */
  readonly coin: number;
  /** Standing with the group, and before the town. */
  readonly group: number;
  readonly standing: number;
  readonly heart: number;
  readonly wound: boolean;
  /** The watch paid, for so many days. */
  readonly paid: number;
  readonly words: string;
};

const came = (words: string, more: Partial<PartCame> = {}): PartCame => ({
  coin: 0,
  group: 0,
  standing: 0,
  heart: 0,
  wound: false,
  paid: 0,
  words,
  ...more,
});
const were = (n: number) => (n === 1 ? "was" : "were");

/**
 * What a part comes to: by the group's kept state in this land and draws `u(n)` (0 … 1, the same for the same life and
 * moment). `name`: the group as its pages name it ("the Bothaath family"). `purse`: what the life has; `paid`: the watch is
 * paid now. A judge's is `judgeCame`.
 */
export function partOutcome(
  id: Exclude<PartId, "judge">,
  name: string,
  f: PartFacts,
  u: (n: number) => number,
  purse: number,
  paid: boolean,
): PartCame {
  const n = Math.max(1, Math.min(8, Math.round(f.n))),
    coin = (x: number) => Math.max(1, Math.round(x * Math.max(0.5, f.bread))),
    // (What one who trades gives at a round: some days' bread, the more the more of the land's trade is under the group.)
    per = coin(dmath.clamp(4 + 40 * f.share, 4, 20)),
    watched = f.soldiers || f.crew,
    who = f.soldiers ? "Soldiers posted in the streets" : "The realm's enforcers",
    seenAt = paid ? 0 : f.soldiers ? 0.3 : f.crew ? 0.15 : 0;
  switch (id) {
    case "rounds":
    case "send": {
      let paying = 0;
      for (let i = 0; i < n; i++) if (u(10 + i) < 0.5 + 0.45 * f.hold) paying++;
      const short = n - paying,
        take = paying * per,
        mine = id === "send" ? Math.round(take * 0.7) : Math.round(take * 0.3),
        rest = take - mine,
        tally = `${paying} of ${n} paid${short ? `, ${short} ${were(short)} short` : ""}`;
      if (watched && u(1) < seenAt)
        return came(
          id === "send"
            ? `You sent your collector round for ${name}: ${who.toLowerCase()} stopped them on the way back, and the ${take} coin taken went with them. Nothing came to the house.`
            : `You made the rounds for ${name}: ${tally}. ${who} stopped you on the way back: the ${take} coin you carried was taken, and ${name} is out its share.`,
          { group: -3, heart: -0.1 },
        );
      if (id === "rounds" && f.war && u(2) < 0.15)
        return came(
          `You made the rounds for ${name}: ${tally}. Men of the group it is at war with met you on the way: you were hurt, and the ${take} coin you carried is theirs.`,
          { group: -1, heart: -0.2, wound: true },
        );
      return came(
        id === "send"
          ? `You sent your collector round for ${name}: ${tally}. ${take} coin taken: ${rest} the collector's, ${mine} to the house.`
          : `You made the rounds for ${name}: ${tally}. ${take} coin taken: ${rest} for ${name}, ${mine} yours to keep.`,
        { coin: mine, group: short ? 1 : 2 },
      );
    }
    case "watch": {
      const a = u(1);
      if (f.war && a < 0.2)
        return u(2) < 0.6
          ? came(
              `You held the corner for ${name}. Youths of a rival street came down on it: you saw them and gave warning in time, and no one of yours was there when they reached it.`,
              { group: 3, heart: 0.05 },
            )
          : came(
              `You held the corner for ${name}. Youths of a rival street came down on it before you could give warning: you were hurt, and it is remembered that the corner was caught out.`,
              { group: -2, heart: -0.2, wound: true },
            );
      if (watched && a < 0.45)
        return u(2) < 0.7
          ? came(
              `You held the corner for ${name}. ${who} came by: you gave warning, and they found no one there to take.`,
              { group: 2 },
            )
          : came(
              `You held the corner for ${name}. ${who} came by and you did not see them in time: the corner was caught out, and it is remembered of you.`,
              { group: -3, standing: -1, heart: -0.1 },
            );
      return came(
        `You held the corner for ${name} until dark: nothing passed that mattered. ${coin(1)} coin for the hours.`,
        { coin: coin(1), group: 1 },
      );
    }
    case "sell": {
      const take = n * coin(3 + 8 * f.share),
        mine = Math.round(take * 0.4);
      if (u(1) < (paid ? 0.02 : f.soldiers ? 0.35 : f.crew ? 0.2 : 0.08)) {
        const lost = Math.min(Math.floor(purse), take);
        return came(
          `You sold what the realm bars in the back lane, and were seen at it: what you carried was taken${lost ? `, and ${lost} coin of your own with it` : ""}. You were let go this time.`,
          { coin: -lost, group: -2, heart: -0.1 },
        );
      }
      return came(
        `You sold what the realm bars in the back lane to ${n} who came for it: ${take} coin taken, ${mine} yours, the rest theirs who carry it in.`,
        { coin: mine, group: 1 },
      );
    }
    case "lielow":
      return came(
        watched
          ? `You kept out of sight while ${who.toLowerCase()} are about: nothing earned, and nothing of yours found.`
          : "You kept out of sight: nothing earned, nothing risked.",
        { group: watched ? 1 : 0, heart: -0.02 },
      );
    case "door": {
      const pay = coin(4);
      if (f.war && u(1) < 0.12) {
        const held = u(2) < 0.5 + 0.4 * f.strength,
          hurt = !held || u(3) < 0.4;
        return came(
          held
            ? `You held the door of the house ${name} is headed from. Men of the group it is at war with came at it: the door held${hurt ? ", and you were hurt holding it" : ""}. ${pay} coin from the house.`
            : `You held the door of the house ${name} is headed from. Men of the group it is at war with came at it and got past you: you were hurt, and it is remembered.`,
          { coin: held ? pay : 0, group: held ? 5 : -4, heart: held ? 0.05 : -0.2, wound: hurt },
        );
      }
      return came(
        `You held the door of the house ${name} is headed from: no one came in who was not let in. ${pay} coin from the house.`,
        { coin: pay, group: 1 },
      );
    }
    case "receive": {
      const mine = coin(3 + 12 * f.strength + 6 * f.hold);
      return came(
        `You received those who came to the house: ${n} of them, each with what they owe or what they ask of ${name}. ${mine} coin came to you.`,
        { coin: mine, standing: 1, group: 1 },
      );
    }
    case "settle":
      return u(1) < 0.6 + 0.3 * f.hold
        ? came(
            `You heard two of ${name}'s own who were at odds, and said how it would be: both took it. ${name} holds together the better for it.`,
            { group: 3, heart: 0.05 },
          )
        : came(
            `You heard two of ${name}'s own who were at odds, and said how it would be: one would not take it, and it is not over.`,
            { group: -2, heart: -0.05 },
          );
    case "answer": {
      if (!f.war)
        return came(
          `${name.replace(/^./, (c) => c.toUpperCase())} is at war with no one: there is no rival to answer.`,
        );
      const won = u(1) < dmath.clamp(0.3 + 1.2 * f.strength, 0.2, 0.8);
      if (won)
        return came(
          `You answered the group ${name} is at war with: it gave ground in this town, and your people saw you do it.`,
          { group: 6, standing: 2, heart: 0.1 },
        );
      const lost = Math.min(Math.floor(purse), coin(20)),
        hurt = u(2) < 0.3;
      return came(
        `You answered the group ${name} is at war with, and your people came off the worse${lost ? `: it cost you ${lost} coin to make good to them` : ""}${hurt ? ", and you were hurt yourself" : ""}.`,
        { coin: -lost, group: -5, heart: -0.15, wound: hurt },
      );
    }
    case "paywatch": {
      const cost = coin(10 + 30 * f.strength);
      if (paid) return came("The watch is paid already: it looks elsewhere for now.");
      if (purse < cost)
        return came(`The watch asks ${cost} coin to look elsewhere: you have not got it.`);
      return came(
        `You paid the watch ${cost} coin: for thirty days it looks elsewhere when ${name}'s people are about.`,
        { coin: -cost, paid: 30 },
      );
    }
    case "patrol": {
      const pay = coin(5);
      if (!f.takes)
        return came(
          `You walked the round of the streets with ${name}: the town saw you pass. ${pay} coin of the realm's pay.`,
          { coin: pay, group: 1 },
        );
      const take = n * coin(2 + 10 * f.share),
        mine = Math.round(take * 0.3);
      return came(
        `You walked the round of the streets with ${name}: ${n} who trade paid to be left alone, ${take} coin in all, ${mine} of it yours beside ${pay} of the realm's pay. The town does not love you for it.`,
        { coin: pay + mine, group: 1, standing: -1 },
      );
    }
    case "lead":
      return came(
        `You led the meeting of ${name}: ${n} came, and what was to be settled among them was settled.`,
        { group: 2, standing: 2, heart: 0.08 },
      );
    case "attend":
      return came(`You were at the meeting of ${name} with ${n} others of it.`, {
        group: 1,
        heart: 0.05,
      });
    case "alms": {
      const cost = Math.min(Math.floor(purse), coin(n));
      return came(
        cost
          ? `You gave out bread for ${name} to ${n} of its own in need: it cost you ${cost} coin of your own beside what ${name} pools.`
          : `You gave out bread for ${name} to ${n} of its own in need, from what ${name} pools: you had nothing of your own to add.`,
        { coin: -cost, group: 2, standing: cost ? 2 : 1, heart: 0.1 },
      );
    }
  }
}

/** What hearing a case came to for the one who judged it: their standing before the town, and coin where they took it. */
export function judgeCame(sentence: string, accused: string, bread: number): PartCame {
  const who = accused.replace(/^./, (c) => c.toUpperCase());
  switch (sentence) {
    case "bribe": {
      const got = Math.max(1, Math.round(25 * Math.max(0.5, bread)));
      return came(
        `You heard the case of ${accused} and took what was offered: ${got} coin, and they went home. It is said in the town.`,
        { coin: got, standing: -3, heart: -0.05 },
      );
    }
    case "free":
      return came(
        `You heard the case of ${accused} and found nothing to hold them for: ${who} went home.`,
        { standing: 1 },
      );
    case "fine":
      return came(`You heard the case of ${accused} and laid a fine on them, paid at the bench.`, {
        standing: 1,
      });
    case "stocks":
      return came(
        `You heard the case of ${accused} and gave three days in the stocks, in the square.`,
        { standing: 1 },
      );
    case "cell":
      return came(`You heard the case of ${accused} and gave three months in the town's cell.`, {
        standing: 1,
      });
    case "labour":
      return came(`You heard the case of ${accused} and gave six months at the realm's works.`, {
        standing: 1,
      });
    default:
      return came(
        `You heard the case of ${accused} and sent them away from the town for two years.`,
        { standing: 1, heart: -0.02 },
      );
  }
}
