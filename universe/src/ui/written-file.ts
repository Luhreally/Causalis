// A world's history as one file a person can keep (B1, classic 66): plain HTML with its own small sheet, no script and
// nothing fetched, and the same in plain words. It holds the pages' own words (host/inspect/written.ts); only the shape is
// made here. A name links to its entry where the file has one, and is only words where it has none.
import type { Line, WrittenEntry, WrittenIndex, WrittenYear } from "../bridge/index.ts";

const SHEET = `body{margin:0 auto;max-width:46rem;padding:12px;background:#0d1838;color:#e8eefb;font:16px/1.45 Verdana,Tahoma,sans-serif}
h1{margin:.2em 0 0;font-size:1.5rem;color:#ffd98a}h2{margin:1.4em 0 .4em;padding:4px 8px;font-size:1.1rem;background:#27418c;border:1px solid #6f8fd8;border-radius:6px}
h3{margin:0;font-size:1rem;color:#ffd98a}a{color:#7fe3ff}section>div{margin:0 0 10px;padding:8px 10px;background:#15234f;border:1px solid #33487f;border-radius:6px}
p{margin:.25em 0}ul{margin:.25em 0;padding-left:1.2em}.m{color:#a9b8dd}.r b{color:#a9dcc9;font-weight:600}.y b{color:#ffd98a}
:target{outline:2px solid #6ff0cf}nav a{display:inline-block;margin:0 .6em .3em 0;padding:3px 0}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** A ref as a place in the file. */
export const anchorOf = (ref: string) => ref.replace(/[^a-zA-Z0-9]+/g, "-");
const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

/** Builds the file a slice at a time, so nothing stands still long to do it. */
export class HistoryFile {
  private readonly known = new Map<string, string>();
  private readonly index: WrittenIndex;
  private readonly html = new Map<string, string[]>();
  private readonly text = new Map<string, string[]>();

  constructor(index: WrittenIndex) {
    this.index = index;
    for (const ref of [...index.realms, ...index.wars, ...index.people])
      this.known.set(ref, anchorOf(ref));
    for (const kind of ["realms", "wars", "people", "years"]) {
      this.html.set(kind, []);
      this.text.set(kind, []);
    }
  }

  /** A year told, and the events it tells (a name that opens one comes here). */
  years(rows: readonly WrittenYear[]): void {
    for (const y of rows) {
      for (const e of y.events) this.known.set(e, `y${y.year}`);
      this.html
        .get("years")!
        .push(
          `<div class="y" id="y${y.year}"><b>${y.year}</b>${y.lines.map((l) => `<p>${this.line(l)}</p>`).join("")}</div>`,
        );
      this.text.get("years")!.push(`${y.year}\n${y.lines.map((l) => `  ${plain(l)}`).join("\n")}`);
    }
  }

  /** A realm's, a war's or a person's page, cut. */
  entries(kind: "realms" | "wars" | "people", rows: readonly WrittenEntry[]): void {
    for (const e of rows) {
      const facts = e.rows.map((r) => `<b>${esc(r.label)}:</b> ${this.line(r.value)}`).join(" · "),
        lists = e.lists
          .map(
            (l) =>
              `<p class="m">${esc(l.title)}</p><ul>${l.items.map((i) => `<li>${this.line(i)}</li>`).join("")}${l.more > 0 ? `<li class="m">and ${l.more.toLocaleString("en-US")} more</li>` : ""}</ul>`,
          )
          .join("");
      this.html
        .get(kind)!
        .push(
          `<div id="${anchorOf(e.ref)}"><h3>${esc(e.title)}</h3><p class="m">${this.line(e.sub)}</p><p class="r">${facts}</p>${lists}</div>`,
        );
      this.text
        .get(kind)!
        .push(
          [
            e.title,
            `  ${plain(e.sub)}`,
            ...e.rows.map((r) => `  ${r.label}: ${plain(r.value)}`),
            ...e.lists.flatMap((l) => [
              `  ${l.title}:`,
              ...l.items.map((i) => `    ${plain(i)}`),
              ...(l.more > 0 ? [`    and ${l.more.toLocaleString("en-US")} more`] : []),
            ]),
          ].join("\n"),
        );
    }
  }

  /** The whole file, as parts ready for a Blob. */
  finish(): { html: string[]; text: string[] } {
    const { title, sub, left } = this.index,
      kinds = [
        ["realms", "Realms and their rulers"],
        ["wars", "Wars, and how they ended"],
        ["people", "People who mattered"],
        ["years", "The great deeds, year by year"],
      ] as const,
      count = (k: string) => this.html.get(k)!.length,
      nav = kinds
        .map(([k, name]) => `<a href="#${k}">${name} (${count(k).toLocaleString("en-US")})</a>`)
        .join(""),
      head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}: ${esc(sub)}</title><style>${SHEET}</style></head><body><h1>${esc(title)}</h1><p class="m">${esc(sub)}. Written out of Causalis: the world's own pages, and nothing else.</p><nav>${nav}</nav><h2>What was left out</h2>${left.map((l) => `<p>${esc(l)}</p>`).join("")}`,
      html: string[] = [head],
      text: string[] = [
        `${title}\n${sub}. Written out of Causalis: the world's own pages, and nothing else.\n\nWHAT WAS LEFT OUT\n${left.join("\n")}\n`,
      ];
    for (const [k, name] of kinds) {
      html.push(`<h2 id="${k}">${name}</h2><section>`, ...this.html.get(k)!, "</section>");
      text.push(`\n${name.toUpperCase()}\n`, this.text.get(k)!.join("\n\n"), "\n");
    }
    html.push("</body></html>");
    return { html, text };
  }

  /** A line's words, each name a link where the file holds its thing. */
  private line(l: Line): string {
    return l
      .map((s) => {
        if (typeof s === "string") return esc(s);
        const to = this.known.get(s.ref);
        return to ? `<a href="#${to}">${esc(s.text)}</a>` : esc(s.text);
      })
      .join("");
  }
}
