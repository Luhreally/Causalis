// A binary heap with a total order: equal priorities are broken by the item's
// integer id, so the pop order is fully determined (flood fills, pathfinding,
// plate growth and the event agenda all depend on this).
export class MinHeap {
  private readonly keys: number[] = [];
  private readonly ids: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  private less(i: number, j: number): boolean {
    const a = this.keys[i]!,
      b = this.keys[j]!;
    return a < b || (a === b && this.ids[i]! < this.ids[j]!);
  }

  private swap(i: number, j: number): void {
    const k = this.keys[i]!,
      d = this.ids[i]!;
    this.keys[i] = this.keys[j]!;
    this.ids[i] = this.ids[j]!;
    this.keys[j] = k;
    this.ids[j] = d;
  }

  push(key: number, id: number): void {
    this.keys.push(key);
    this.ids.push(id);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** The smallest key's id (ties: the smallest id), or -1 when empty. */
  peekId(): number {
    return this.ids.length ? this.ids[0]! : -1;
  }

  peekKey(): number {
    return this.keys.length ? this.keys[0]! : Infinity;
  }

  pop(): number {
    const n = this.ids.length;
    if (n === 0) return -1;
    const top = this.ids[0]!;
    this.swap(0, n - 1);
    this.keys.pop();
    this.ids.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1,
        r = l + 1;
      let m = i;
      if (l < this.ids.length && this.less(l, m)) m = l;
      if (r < this.ids.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}
