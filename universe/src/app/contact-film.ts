// A first meeting watched (Phase 69, asked for 2026-11-03: "i wanna see the star wars and landing in planets and
// colonization and all that stuff"): the ship history sent, over a world it has never seen; then down on its
// engines beside the people there, in their own camp or town as it found them, on their own ground, under their
// own sky; those aboard about it; and a card telling what the two can say, breathe, eat and catch. History holds
// the ship's coming and no more of the meeting, and the card says so. The world's clock is held all the while.
import "./film.css";
import "./contact.css";
import type { FolkNear, HostClient, Visitor } from "../bridge/index.ts";
import { ShipMark, type GlobeScene, type OrbitRig, type Stage } from "../render/index.ts";
import type { TimeBar } from "../ui/index.ts";
import { descentAt } from "../view/index.ts";

type Point = { readonly x: number; readonly y: number; readonly z: number };

export type ContactFilmDeps = {
  readonly stage: Stage;
  readonly hud: HTMLElement;
  readonly client: HostClient;
  readonly time: TimeBar;
  readonly rig: OrbitRig;
  readonly world: GlobeScene;
  readonly toWorld: (star: string, index: number) => Promise<void>;
  /** Down to their ground, read at a year (undefined: now). */
  readonly toGround: (star: string, index: number, at?: number) => Promise<unknown>;
  /** Those who came, about their ship on the ground shown; and where that is (scene units). */
  readonly comers: (v: Visitor | null) => void;
  readonly comersSpot: () => { readonly x: number; readonly z: number } | null;
  readonly cut: (what: string, work: () => Promise<void>) => Promise<void>;
  readonly toOrbit: () => void;
};

export type ContactFilm = {
  /** Play the first meeting on a people's world (false: no one has come). */
  play(star: string, index: number): Promise<boolean>;
  skip(): void;
  readonly playing: boolean;
  state(): {
    stage: "over" | "down" | "met" | null;
    k: number;
    words: string;
    card: boolean;
    /** Where the ship stands now, on the screen. */
    ship: Point | null;
  };
};

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function installContactFilm(d: ContactFilmDeps): ContactFilm {
  const { stage, rig, time, client } = d,
    ui = document.createElement("div"),
    yearBox = document.createElement("div"),
    words = document.createElement("div"),
    skipButton = document.createElement("button"),
    card = document.createElement("div");
  ui.className = "colony-film contact-film";
  ui.hidden = true;
  yearBox.className = "film-year";
  words.className = "film-words";
  skipButton.className = "film-skip";
  skipButton.textContent = "Skip ›";
  card.className = "contact-card";
  card.hidden = true;
  ui.append(yearBox, skipButton, words, card);
  d.hud.append(ui);
  let ship: ShipMark | null = null,
    playing = false,
    skipped = false,
    stageNow: "over" | "down" | "met" | null = null,
    shotK = 0,
    shotT = 0,
    shotS = 1,
    frame: ((k: number, dt: number) => void) | null = null,
    shotEnd: (() => void) | null = null,
    shipAt: Point | null = null;
  const view = (e: Point, at: Point) => {
    stage.camera.setPosition(e.x, e.y, e.z);
    stage.camera.lookAt(at.x, at.y, at.z);
  };
  stage.onUpdate((dt) => {
    if (!playing || !frame) return;
    shotT += dt;
    shotK = clamp01(shotT / shotS);
    frame(shotK, dt);
    if (shotK >= 1 && shotEnd) {
      const end = shotEnd;
      shotEnd = null;
      end();
    }
  });
  const run = (seconds: number, f: (k: number, dt: number) => void) =>
    new Promise<void>((done) => {
      shotT = 0;
      shotK = 0;
      shotS = seconds;
      frame = f;
      shotEnd = done;
    });
  const end = () => {
    if (shotEnd) {
      const e = shotEnd;
      shotEnd = null;
      e();
    }
  };
  skipButton.onclick = () => film.skip();
  const showCard = (near: FolkNear) => {
    const c = near.contact!,
      r = c.reading,
      row = (head: string, can: boolean, text: string) => {
        const e = document.createElement("div"),
          b = document.createElement("b"),
          t = document.createElement("span");
        e.className = `contact-row ${can ? "yes" : "no"}`;
        b.textContent = head;
        t.textContent = cap(text);
        e.append(b, t);
        return e;
      },
      h = document.createElement("h3"),
      rows = document.createElement("div"),
      go = document.createElement("button"),
      foot = document.createElement("div");
    h.textContent = `The first meeting: ${c.who} and the ${near.name}, year ${c.year}`;
    rows.className = "contact-rows";
    rows.append(
      row(`🗣 Speak: ${r.speak.can ? "yes" : "no"}`, r.speak.can, r.speak.words),
      row(`🫁 Breathe there: ${r.airThere.can ? "yes" : "no"}`, r.airThere.can, r.airThere.words),
      row(
        `🫁 Breathe the other's: ${r.airHome.can ? "yes" : "no"}`,
        r.airHome.can,
        r.airHome.words,
      ),
      row(`🍲 Eat there: ${r.foodThere.can ? "yes" : "no"}`, r.foodThere.can, r.foodThere.words),
      row(`🍲 Eat the other's: ${r.foodHome.can ? "yes" : "no"}`, r.foodHome.can, r.foodHome.words),
      row(`🦠 Catch: ${r.sickness.can ? "yes" : "no"}`, r.sickness.can, r.sickness.words),
    );
    foot.className = "contact-foot";
    foot.textContent = "History holds that they came, and no more of what passed.";
    go.className = "contact-go";
    go.textContent = "Stay here ›";
    go.onclick = () => film.skip();
    card.replaceChildren(h, rows, foot, go);
    card.hidden = false;
  };
  const film: ContactFilm = {
    get playing() {
      return playing;
    },
    state: () => ({
      stage: stageNow,
      k: shotK,
      words: words.textContent ?? "",
      card: !card.hidden,
      ship: shipAt,
    }),
    skip() {
      if (!playing) return;
      skipped = true;
      end();
    },
    async play(star, index) {
      if (playing) return false;
      const now = await client.query<FolkNear | null>({
        type: "folk.near",
        args: { star, index },
      });
      const c = now?.contact;
      if (!now || !c) return false;
      const then = await client.query<FolkNear | null>({
        type: "folk.near",
        args: { star, index, at: c.year },
      });
      if (!then) return false;
      ship ??= new ShipMark(stage);
      playing = true;
      skipped = false;
      d.toOrbit();
      time.hold("film");
      rig.enabled = false;
      document.body.classList.add("filming");
      ui.hidden = false;
      card.hidden = true;
      yearBox.textContent = `YEAR ${c.year}`;
      const of = c.sentBy ? `, sent by ${c.sentBy},` : "";
      try {
        // Over their world: the ship comes in from afar to where the people live.
        let site: Point = { x: 0, y: 0, z: 1 },
          side: Point = { x: 1, y: 0, z: 0 };
        stageNow = "over";
        frame = null;
        shotK = 0;
        await d.cut("that world", async () => {
          await d.toWorld(star, index);
          d.world.setHalls([]);
          site = d.world.wayOf(Math.max(0, then.look.hall));
          const l = Math.hypot(site.z, site.x) || 1;
          side = { x: site.z / l, y: 0, z: -site.x / l };
          ship!.visible = true;
          words.textContent = `A ship of ${c.who}${of} comes over a world none of them has seen. The ${then.name} live below, ${then.stageWords}, and know nothing of it.`;
        });
        if (!skipped)
          await run(7, (k, dt) => {
            const e = ease(k),
              off = 1 - e,
              dir = {
                x: site.x + side.x * off * 0.9,
                y: site.y + 0.25 * off,
                z: site.z + side.z * off * 0.9,
              },
              l = Math.hypot(dir.x, dir.y, dir.z) || 1,
              far = lerp(4.6, 1.9, e),
              high = 1 + 0.9 * Math.pow(1 - k, 1.6) + 0.06,
              across = 0.8 * (1 - k) * (1 - k),
              p = {
                x: site.x * high + side.x * across,
                y: site.y * high,
                z: site.z * high + side.z * across,
              };
            ship!.at(
              p.x,
              p.y,
              p.z,
              site.x - p.x,
              site.y - p.y,
              site.z - p.z,
              lerp(0.05, 0.03, e),
              1,
              dt,
            );
            view(
              { x: (dir.x / l) * far, y: (dir.y / l) * far, z: (dir.z / l) * far },
              { x: site.x * 0.55 * e, y: site.y * 0.55 * e, z: site.z * 0.55 * e },
            );
          });
        // Down on them, on its own ground and under its own sky, as the ship found them.
        stageNow = "down";
        frame = null;
        shotK = 0;
        ship.visible = false;
        let pad = { x: 6, z: 0 };
        await d.cut("their ground", async () => {
          await d.toGround(star, index, c.year);
          rig.enabled = false;
          const v: Visitor = {
            civ: now.ref,
            name: c.who,
            kind: "",
            body: c.figure ?? (then.camp?.figure as Visitor["body"]),
            color: c.color,
            why: "landing",
            year: c.year,
            event: c.event ?? now.ref,
            count: 6,
            theirs: null,
            ours: null,
            shipless: true,
          };
          d.comers(c.figure ? v : null);
          pad = d.comersSpot() ?? pad;
          ship!.visible = true;
          words.textContent = `It comes down on its engines beside them. Their hands hold ${then.arms[0] ?? "nothing made"}.`;
        });
        const l = Math.hypot(pad.x, pad.z) || 1,
          out = { x: pad.x / l, z: pad.z / l },
          // (The eye on the far side of the ship from them, a little aside: they beyond it.)
          from = { x: pad.x + out.x * 9 - out.z * 7, z: pad.z + out.z * 9 + out.x * 7 };
        if (!skipped)
          await run(9, (k, dt) => {
            const fall = descentAt(k),
              y = fall.high * 0.12 + 1.5,
              e = ease(k);
            ship!.at(pad.x, y, pad.z, 0.02, 1, 0.02, 1.1, fall.burn, dt);
            shipAt = { x: pad.x, y, z: pad.z };
            view(
              { x: from.x, y: lerp(3, 2.2, e), z: from.z },
              {
                x: lerp(pad.x, pad.x * 0.72, e),
                y: lerp(y * 0.8, 1.6, e),
                z: lerp(pad.z, pad.z * 0.72, e),
              },
            );
          });
        // The two, and what they can be to each other: until it is closed.
        stageNow = "met";
        ship!.at(pad.x, 1.5, pad.z, 0.02, 1, 0.02, 1.1, 0, 0.016);
        words.textContent = "";
        if (!skipped) {
          showCard(then);
          frame = null;
          await new Promise<void>((done) => {
            shotEnd = done;
          });
        }
      } finally {
        card.hidden = true;
        ship!.visible = false;
        d.comers(null);
        frame = null;
        shotEnd = null;
        stageNow = null;
        shipAt = null;
        ui.hidden = true;
        document.body.classList.remove("filming");
        // (As they are now, whatever they were when the ship came.)
        await d.toGround(star, index).catch(() => undefined);
        rig.enabled = true;
        rig.halt();
        time.release("film");
        playing = false;
      }
      return true;
    },
  };
  return film;
}
