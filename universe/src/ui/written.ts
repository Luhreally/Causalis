// One press writes the world's whole history out (B1, classic 66): read in slices, with how far along it is, then kept by
// the phone's or the desk's own way: a press on a link saves it, and where the browser can hand a file to the share sheet,
// a press there does. Each is a press of its own, since a share must come straight from a finger, not after a long read.
import type { HostClient, WrittenEntry, WrittenIndex, WrittenYear } from "../bridge/index.ts";
import { HistoryFile } from "./written-file.ts";
import { el } from "./why.ts";

/** How many of each are read at once: each slice a small fraction of a second of the worker's. */
const SLICE = { realms: 10, wars: 24, people: 12, years: 60 } as const;

/** The clock held while it reads, so it all tells one year. */
let holdClock: (on: boolean) => void = () => {};
export function setWrittenHold(f: (on: boolean) => void): void {
  holdClock = f;
}

const sizeOf = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

/** Read the whole history in slices, telling how far along it is. */
export async function writeHistory(
  client: HostClient,
  told: (done: number, all: number, words: string) => void,
): Promise<{ html: string[]; text: string[]; index: WrittenIndex }> {
  const index = await client.query<WrittenIndex>({ type: "written.index" }),
    file = new HistoryFile(index),
    all = index.realms.length + index.wars.length + index.people.length + index.years.length,
    n = (x: number) => x.toLocaleString("en-US");
  let done = 0;
  // (The years first: what they tell is what a name elsewhere can link to.)
  for (let i = 0; i < index.years.length; i += SLICE.years) {
    const years = index.years.slice(i, i + SLICE.years),
      got = await client.query<WrittenYear[]>({
        type: "written.read",
        args: { kind: "years", years },
      });
    file.years(got);
    done += years.length;
    told(done, all, `Reading its years: ${n(i + years.length)} of ${n(index.years.length)}`);
  }
  const parts = [
    ["realms", "realms", index.realms],
    ["wars", "wars", index.wars],
    ["people", "people", index.people],
  ] as const;
  for (const [kind, word, refs] of parts)
    for (let i = 0; i < refs.length; i += SLICE[kind]) {
      const slice = refs.slice(i, i + SLICE[kind]),
        got = await client.query<WrittenEntry[]>({
          type: "written.read",
          args: { kind, refs: slice },
        });
      file.entries(kind, got);
      done += slice.length;
      told(done, all, `Reading its ${word}: ${n(i + slice.length)} of ${n(refs.length)}`);
    }
  return { ...file.finish(), index };
}

/** The press, how far along it is, and the ways to keep it. */
export function drawWritten(into: HTMLElement, client: HostClient): void {
  const box = el("div", "written"),
    go = el("button", "act written-go", "📜 Write the whole history out"),
    far = el("div", "written-far"),
    fill = el("div", "written-fill"),
    says = el("p", "muted written-says"),
    keeps = el("div", "written-keeps");
  far.hidden = true;
  says.hidden = true;
  far.append(fill);
  box.append(go, far, says, keeps);
  into.append(box);
  let urls: string[] = [];
  const stem = () =>
    `causalis-${(location.search.match(/seed=([^&]*)/)?.[1] ?? "world").replace(/[^a-zA-Z0-9]+/g, "-")}`;

  /** A link pressed saves it; the share sheet too, where the browser takes a file. */
  const offer = (parts: string[], kind: string, words: string, name: string) => {
    const blob = new Blob(parts, { type: `${kind};charset=utf-8` }),
      url = URL.createObjectURL(blob),
      a = el("a", "act written-keep", `⤓ ${words}, ${sizeOf(blob.size)}`);
    urls.push(url);
    a.href = url;
    a.download = name;
    keeps.append(a);
    const shared = new File([blob], name, { type: kind }),
      nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [shared] })) {
      const b = el("button", "act written-share", `📤 Share ${words.toLowerCase()}`);
      b.onclick = () => {
        // (Put by, or a browser that changed its mind: the link still keeps it.)
        void navigator.share({ files: [shared], title: name }).catch(() => undefined);
      };
      keeps.append(b);
    }
    return blob.size;
  };

  go.onclick = async () => {
    go.disabled = true;
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
    keeps.replaceChildren();
    far.hidden = says.hidden = false;
    fill.style.width = "0%";
    says.textContent = "Reading the years…";
    holdClock(true);
    try {
      const got = await writeHistory(client, (done, all, words) => {
        fill.style.width = `${Math.round((done / Math.max(1, all)) * 100)}%`;
        says.textContent = words;
      });
      far.hidden = true;
      const name = `${stem()}-year-${got.index.year}`,
        h = offer(got.html, "text/html", "The page", `${name}.html`);
      offer(got.text, "text/plain", "Plain words", `${name}.txt`);
      says.textContent = `Written, ${sizeOf(h)}. It opens in any browser with no network, and says at its head what it leaves out.`;
      go.textContent = "📜 Write it out again";
    } catch (error) {
      far.hidden = true;
      says.textContent = `It could not be written: ${(error as Error).message}`;
    } finally {
      holdClock(false);
      go.disabled = false;
    }
  };
}
