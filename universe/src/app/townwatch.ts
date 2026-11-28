// A town watched (town mode; asked 2026-11-25: "a gameplay mode where i just observe the sim too"), the page's part:
// where the eye goes while no order is given. The host says what happened in the place since it was last asked and how
// seldom each kind of thing comes there (host/placewatch.ts); the eye goes to the seldomest, stays the time a line
// takes to read, and where that was of someone living goes on with them a while; with nothing new it goes from one of
// the town's people who is up and about to the next. A tap on one of them, or the stay key, keeps it with that one
// whatever else happens; steering the view by hand lets them go, and the next key leads it again. The eye is kept by
// the rig's own follow (render/orbit.ts), as one followed in the god game is.
import {
  PLACE_ACT,
  PLACE_AT,
  type HostClient,
  type PlaceFrame,
  type PlaceSight,
  type PlaceWatch,
  type PlaceWatched,
  type VillagePlan,
} from "../bridge/index.ts";
import { VILLAGE_METRE, type OrbitRig, type VillageScene } from "../render/index.ts";
import type { PlaceCaption } from "../ui/index.ts";

export type WatchDeps = {
  readonly client: HostClient;
  readonly village: VillageScene;
  readonly rig: OrbitRig;
  readonly plan: () => VillagePlan | null;
  /** The plan's people by who they are in the place (null: not of it), and where the place last told them to be. */
  readonly ids: () => readonly (number | null)[] | null;
  readonly told: () => PlaceFrame | null;
  /** Where its walls' site is now (metres from its square; null: none going up). */
  readonly wallsAt: () => { x: number; z: number } | null;
  readonly caption: (c: PlaceCaption | null) => void;
  /** What the host tells of the town besides what is worth the eye (its mode, its head, the orders its head would give). */
  readonly heard?: (w: PlaceWatch) => void;
};
export type WatchFlow = {
  readonly on: boolean;
  start(town: string): void;
  stop(): void;
  /** Called every frame: a view steered by hand has let go of whom it was with. */
  frame(): void;
  /** Stay with the one the eye is with, or be led again. */
  stay(on: boolean): void;
  /** On to what happened next, or to another of its people. */
  next(): void;
  /** One of its people tapped: the eye goes with them, and stays. */
  goWith(id: number): void;
  /** The eye let go of whom or what it is with, as a drag over the land does: nothing takes it back till asked. */
  letGo(): void;
  /** What it is with now (the look tools). */
  readonly now: {
    readonly id: number | null;
    readonly title: string;
    readonly words: string;
    readonly stay: boolean;
    readonly free: boolean;
    readonly sight: boolean;
    readonly waiting: number;
  } | null;
};

/** What the eye is with: one of its people, or a happening at a lot. */
type Subject = {
  id: number | null;
  ref: string | null;
  title: string;
  words: string;
  lot: number;
  rare: number;
  /** A happening, told in its own words (else one of its people, told by what they are at). */
  sight: boolean;
  until?: number;
  key?: string;
};

/** How often the place is asked (ms); how long the eye stays with a happening, and with one of its people, at the least. */
const ASK_EVERY = 1000,
  SIGHT_MS = 7000,
  PERSON_MS = 20_000,
  /** Happenings waiting for the eye: no more than so many, none older than a day of the town's clock. */
  WAIT_MOST = 12,
  DAY = 86_400;
/** Doings seen out of doors: one at any of these is gone to before one asleep or at home. */
const ABOUT: ReadonlySet<number> = new Set([
  PLACE_ACT.work,
  PLACE_ACT.fetch,
  PLACE_ACT.carry,
  PLACE_ACT.visit,
  PLACE_ACT.haul,
  PLACE_ACT.build,
  PLACE_ACT.stuff,
  PLACE_ACT.brigade,
  PLACE_ACT.guard,
  PLACE_ACT.mourn,
]);

export function installWatch(d: WatchDeps): WatchFlow {
  let town: string | null = null,
    timer: ReturnType<typeof setTimeout> | null = null,
    since: number | undefined,
    subject: Subject | null = null,
    stay = false,
    free = false,
    heldUntil = 0,
    waiting: PlaceSight[] = [],
    /** What goes on that the eye has been told of already (a fire is told at every asking while it burns). */
    going = new Set<string>(),
    turn = -1,
    clock = 0,
    mine: (() => { x: number; y: number; z: number } | null) | null = null,
    last = { x: 0, z: 0 };

  const lotPoint = (lot: number): { x: number; z: number } | null => {
    if (lot === PLACE_AT.square || lot === PLACE_AT.none) return { x: 0, z: 0 };
    if (lot === PLACE_AT.fields) return d.plan()?.pasture ?? null;
    if (lot === PLACE_AT.walls) return d.wallsAt();
    return d.village.townLot(lot);
  };
  /** Where the one the eye is with stands: as drawn, or within, at the lot the place has them at. */
  const point = (): { x: number; y: number; z: number } | null => {
    const s = subject;
    if (!s) return null;
    let at: { x: number; z: number } | null = null;
    if (s.id !== null) {
      const ids = d.ids(),
        k = ids ? ids.indexOf(s.id) : -1,
        person = k >= 0 ? d.plan()?.people[k] : undefined;
      if (person) at = d.village.personAt(person.ref);
    }
    at ??= lotPoint(s.lot);
    if (at) last = { x: at.x, z: at.z };
    return { x: last.x * VILLAGE_METRE, y: 0, z: last.z * VILLAGE_METRE };
  };
  const tell = (): void => {
    if (!town) return;
    if (free)
      return d.caption({
        title: "Looking about",
        words: "The view is yours. ⏭ leads it to what happens again.",
        ref: null,
        stay: false,
        one: false,
        id: null,
      });
    const s = subject;
    d.caption(
      s
        ? {
            title: s.title,
            words: s.words,
            ref: s.ref,
            stay,
            one: s.id !== null && !s.sight,
            id: s.id,
          }
        : null,
    );
  };
  const take = (s: Subject, ms: number): void => {
    subject = s;
    heldUntil = performance.now() + ms;
    free = false;
    mine = point;
    d.rig.follow = mine;
    tell();
  };
  /** One of its people, by who they are in the place: named and told of as soon as the host answers. */
  const person = (id: number, ms = PERSON_MS): void => {
    take({ id, ref: null, title: "…", words: "", lot: PLACE_AT.square, rare: 0, sight: false }, ms);
    void one();
  };
  /** The next of its people drawn who is up and about; any of them where none is. */
  const another = (): void => {
    const ids = d.ids(),
      f = d.told();
    if (!ids || !ids.length) return;
    // (The place tells of those asked after in the order they stand in the plan, those not of it left out.)
    const asked = new Map<number, number>();
    let n = 0;
    ids.forEach((id, k) => {
      if (id !== null) asked.set(k, n++);
    });
    let any = -1;
    for (let step = 1; step <= ids.length; step++) {
      const k = (turn + step + ids.length) % ids.length,
        id = ids[k];
      if (id === null || id === undefined || id === subject?.id) continue;
      const a = asked.get(k);
      if (f && a !== undefined && f.at[a] === PLACE_AT.none) continue;
      if (any < 0) any = k;
      if (f && a !== undefined && ABOUT.has(f.act[a]!)) {
        any = k;
        break;
      }
    }
    if (any < 0) return;
    turn = any;
    person(ids[any]!);
  };
  /** The one the eye is with asked after: their name, what they are at, where. Gone from the town: on to another. */
  const one = async (): Promise<void> => {
    const s = subject,
      ref = town;
    if (!s || s.id === null || !ref) return;
    let rows: PlaceWatched[] = [];
    try {
      rows = await d.client.query<PlaceWatched[]>({
        type: "place.watched",
        args: { ref, ids: [s.id] },
      });
    } catch {
      return;
    }
    if (subject !== s || town !== ref) return;
    const row = rows[0];
    if (!row) {
      // (Dead, or left the town.)
      if (s.sight) return void (s.id = null);
      stay = false;
      subject = null;
      return choose();
    }
    s.lot = row.lot;
    s.ref ??= row.ref;
    if (!s.sight) {
      s.title = row.name;
      s.words = row.words;
    }
    tell();
  };
  /** Where the eye goes now: to the seldomest thing waiting, on with whom it is with, or to another. */
  const choose = (): void => {
    if (!town || free) return;
    const now = performance.now(),
      s = subject;
    // (A happening that goes on keeps the eye while it does, unless something waits.)
    if (s?.until !== undefined && clock >= s.until) s.until = undefined;
    if (stay && s) return;
    waiting.sort((a, b) => b.rare - a.rare || a.t - b.t);
    const best = waiting[0],
      due = !s || now >= heldUntil;
    // (A happening is left for a seldomer one at once, for any other when its line has been read; one of its people the
    // eye was only led to, for any happening.)
    if (best && (due || !s.sight || best.rare > s.rare)) {
      waiting.shift();
      const goesOn = best.until !== undefined && best.id === null;
      return take(
        {
          id: best.id,
          ref: best.ref,
          title: best.words,
          words: best.where,
          lot: best.lot,
          rare: best.rare,
          sight: true,
          ...(best.until === undefined ? {} : { until: best.until }),
          ...(goesOn ? { key: `${best.until}|${best.lot}` } : {}),
        },
        SIGHT_MS,
      );
    }
    if (!s) return another();
    if (!due || (s.sight && s.until !== undefined)) return;
    // (A happening of someone living: on with them a while.)
    if (s.sight && s.id !== null) return person(s.id);
    another();
  };

  const ask = async (): Promise<void> => {
    timer = null;
    const ref = town;
    if (!ref) return;
    try {
      const w = await d.client.query<PlaceWatch | null>({
        type: "place.watch",
        args: since === undefined ? { ref } : { ref, since },
      });
      if (town !== ref) return;
      if (w) {
        since = clock = w.t;
        d.heard?.(w);
        const live = new Set<string>();
        for (const x of w.sights) {
          // (What goes on is told at every asking: taken once, and its words kept up where the eye is with it.)
          if (x.until !== undefined && x.id === null) {
            const key = `${x.until}|${x.lot}`;
            live.add(key);
            if (subject?.key === key) subject.title = x.words;
            if (going.has(key)) continue;
            going.add(key);
            waiting.push({ ...x });
            continue;
          }
          waiting.push(x);
        }
        for (const key of going) if (!live.has(key)) going.delete(key);
        waiting = waiting.filter((x) => (x.until ?? x.t + DAY) >= w.t).slice(-WAIT_MOST);
        if (subject && subject.id !== null) await one();
        if (town !== ref) return;
        choose();
        tell();
      }
    } catch {
      // (Asked again in a moment.)
    }
    if (town === ref) timer = setTimeout(() => void ask(), ASK_EVERY);
  };

  return {
    get on() {
      return town !== null;
    },
    get now() {
      return town
        ? {
            id: subject?.id ?? null,
            title: subject?.title ?? "",
            words: subject?.words ?? "",
            stay,
            free,
            sight: !!subject?.sight,
            waiting: waiting.length,
          }
        : null;
    },
    start: (ref) => {
      if (town === ref) return;
      town = ref;
      since = undefined;
      subject = null;
      stay = free = false;
      waiting = [];
      going = new Set();
      turn = -1;
      d.caption(null);
      void ask();
    },
    stop: () => {
      if (!town) return;
      town = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (mine && d.rig.follow === mine) d.rig.follow = null;
      mine = null;
      subject = null;
      d.caption(null);
    },
    frame: () => {
      if (!town || free || !subject || d.rig.follow === mine) return;
      // (The view steered by hand: whom it was with is let go, and nothing takes it back until it is asked to.)
      free = true;
      stay = false;
      tell();
    },
    stay: (on) => {
      if (!town || !subject || subject.id === null) return;
      stay = on;
      // (Staying with one a happening was of: told of by what they are at from here on.)
      if (on && subject.sight) return person(subject.id, 0);
      if (!on) heldUntil = 0;
      tell();
    },
    next: () => {
      if (!town) return;
      free = false;
      stay = false;
      heldUntil = 0;
      if (subject) subject.until = undefined;
      if (waiting.length) {
        // (What waits is gone to before another of its people.)
        if (subject && !subject.sight) subject = null;
        choose();
      } else another();
      tell();
    },
    goWith: (id) => {
      if (!town) return;
      stay = true;
      person(id, 0);
    },
    letGo: () => {
      if (!town) return;
      if (mine && d.rig.follow === mine) d.rig.follow = null;
      free = true;
      stay = false;
      tell();
    },
  };
}
