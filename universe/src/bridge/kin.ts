// A person's family and body as a card tells them (Phase 55 wave 5): a line each, the host's
// (host/kin.ts), and the page of one named for a seat — a maker at their trade — as the town's
// people are named for their lines (bridge/roll.ts townsfolkRef).

/** What a card says of anyone's family and body, in a line each (null where none is told). */
export type KinCard = { readonly family: string | null; readonly body: string | null };

/** A maker's page, by the seat they hold: `seat:<town>:<trade>:<seat>` (the healer's is `heal:<town>`). */
export function seatRef(town: string, trade: string, seat: number): string {
  return `seat:${town}:${trade}:${seat}`;
}
/** A seat's ref's parts (null: not one). */
export function parseSeatRef(
  ref: string,
): { readonly town: string; readonly trade: string; readonly seat: number } | null {
  const m = /^seat:(town:\d+:\d+):([a-z ]+):(\d+)$/.exec(ref);
  return m ? { town: m[1]!, trade: m[2]!, seat: Number(m[3]) } : null;
}
