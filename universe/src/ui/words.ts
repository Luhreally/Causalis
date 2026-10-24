// Plain words for what the host reports (docs/architecture §31: text is plain
// words, not engine words). Phase 0 knows only the sandbox's vocabulary; the
// narrative module grows from here.
const EVENT_WORDS: Record<string, string> = {
  "toy.flood": "A flood",
  "toy.exodus": "People left for cheaper land",
  "toy.blessing": "A blessing",
};

const RULE_WORDS: Record<string, string> = {
  "toy.leave": "The decision to leave",
};

const ROLE_WORDS: Record<string, string> = {
  trigger: "set off by",
  enabler: "made possible by",
  pressure: "pressed by",
  constraint: "held back by",
  agent: "done by",
};

const MINUTE = 60,
  HOUR = 3600,
  DAY = 86_400,
  YEAR = 365 * DAY;

/** "year 3, day 41" */
export function when(t: number): string {
  return `year ${Math.floor(t / YEAR)}, day ${Math.floor((t % YEAR) / DAY)}`;
}

/** "year 240, day 185, 07:40" */
export function clockWords(t: number): string {
  const year = Math.floor(t / YEAR),
    day = Math.floor((t % YEAR) / DAY),
    s = t % DAY,
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return `year ${year}, day ${day}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function eventWords(type: string): string {
  return EVENT_WORDS[type] ?? type;
}

export function roleWords(role: string): string {
  return ROLE_WORDS[role] ?? role;
}

/** A why-node's claim in plain words where the vocabulary allows. */
export function claimWords(claim: string, ref: string): string {
  const event = /^([a-z.]+)(?: at (\S+))? \(t=(\d+)\)(, since forgotten)?$/.exec(claim);
  if (event) {
    const [, type, place, t, forgotten] = event;
    const where = place?.startsWith("tcell:") ? ` in cell ${place.split(":")[2]}` : "";
    return `${eventWords(type!)}${where}, ${when(Number(t))}${forgotten ? " (the details are forgotten)" : ""}`;
  }
  const rule = /^([a-z.]+) for (\S+): (.*)$/.exec(claim);
  if (rule) return `${RULE_WORDS[rule[1]!] ?? rule[1]} (${rule[3]})`;
  if (claim.startsWith("the god's act")) return "Your act";
  if (ref.startsWith("tfld:")) return "The floodplain, as the land was made";
  return claim;
}

/** Sim seconds per real second as words: "30 days a second", "1 hour a second". */
export function speedWords(secondsPerSecond: number): string {
  const s = secondsPerSecond,
    say = (n: number, unit: string) => {
      const v = Math.max(1, Math.round(n));
      return `${v} ${unit}${v === 1 ? "" : "s"} a second`;
    };
  if (s <= 0) return "paused";
  // (Near enough a year, a day, an hour is said as one: the clock measures, it does not count.)
  if (s >= 0.95 * YEAR) return say(s / YEAR, "year");
  if (s >= 0.95 * DAY) return say(s / DAY, "day");
  if (s >= 0.95 * HOUR) return say(s / HOUR, "hour");
  if (s >= 0.95 * MINUTE) return say(s / MINUTE, "minute");
  return say(s, "second");
}
