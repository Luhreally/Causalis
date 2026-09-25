// The why-tree (docs/architecture §13, §31): an explanation that opens one cause
// at a time. Every node is asked for on demand, so a chain that runs from a
// person to the geology under them costs only the steps the viewer takes.
import type { HostClient } from "../bridge/index.ts";
import { claimWords, roleWords } from "./words.ts";

export type WhyNode = {
  ref: string;
  claim: string;
  basis: string;
  t: number | null;
  causes: { ref: string; role: string; weight: number; node: WhyNode | null }[];
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const BASIS_NOTES: Record<string, string> = {
  command: "A deliberate act, not caused by anything in the world.",
  generated: "",
  forgotten: "",
  unknown: "Nothing records why.",
};

export class WhyTree {
  private readonly client: HostClient;
  constructor(client: HostClient) {
    this.client = client;
  }

  /** Show why `ref` is so, in `into`, replacing what was there. */
  async show(ref: string, into: HTMLElement): Promise<void> {
    into.replaceChildren(el("p", "muted", "…"));
    const node = await this.client.query<WhyNode>({ type: "why", args: { ref, depth: 1 } });
    into.replaceChildren(this.node(node));
  }

  private node(node: WhyNode): HTMLElement {
    const box = el("div", "why-node");
    box.append(el("div", `claim basis-${node.basis}`, claimWords(node.claim, node.ref)));
    if (node.causes.length) {
      const list = el("ul");
      for (const c of node.causes) {
        const item = el("li"),
          open = el("button", "cause", `${roleWords(c.role)} ▸`);
        open.onclick = async () => {
          open.disabled = true;
          const child = await this.client.query<WhyNode>({
            type: "why",
            args: { ref: c.ref, depth: 1 },
          });
          open.remove();
          item.append(el("span", "role", roleWords(c.role)), this.node(child));
        };
        item.append(open);
        list.append(item);
      }
      box.append(list);
    } else if (BASIS_NOTES[node.basis]) box.append(el("p", "muted", BASIS_NOTES[node.basis]));
    else if (node.basis === "generated")
      box.append(el("p", "muted", "How this universe was made from its seed."));
    return box;
  }
}
