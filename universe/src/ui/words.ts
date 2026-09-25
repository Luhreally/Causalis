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

const DAY = 86_400;
const YEAR = 365 * DAY;

/** "year 3, day 41" */
export function when(t: number): string {
  return `year ${Math.floor(t / YEAR)}, day ${Math.floor((t % YEAR) / DAY)}`;
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

/** Sim seconds per real second as words: "30 days a second". */
export function speedWords(secondsPerSecond: number): string {
  if (secondsPerSecond <= 0) return "paused";
  if (secondsPerSecond >= YEAR)
    return `${Math.round(secondsPerSecond / YEAR)} year${secondsPerSecond >= 2 * YEAR ? "s" : ""} a second`;
  const days = Math.round(secondsPerSecond / DAY);
  return `${days} day${days === 1 ? "" : "s"} a second`;
}
