// Dense tables for aggregate state (docs/architecture §4): rows × columns of
// numbers in one typed array. CountTable holds integers (people, goods, ships —
// counted things are integers and are conserved); FieldTable holds floats
// (prices, rates, temperatures). Both hash and save themselves.
import type { Hasher } from "./hash.ts";

function checkShape(rows: number, cols: number): void {
  if (!Number.isInteger(rows) || rows < 0 || !Number.isInteger(cols) || cols < 1)
    throw new Error(`table shape ${rows} × ${cols}`);
}

abstract class Table {
  readonly rows: number;
  readonly cols: number;
  protected readonly data: Float64Array;
  constructor(rows: number, cols: number) {
    checkShape(rows, cols);
    this.rows = rows;
    this.cols = cols;
    this.data = new Float64Array(rows * cols);
  }
  get(row: number, col: number): number {
    return this.data[row * this.cols + col]!;
  }
  /** The sum of one row. */
  rowSum(row: number): number {
    let s = 0;
    for (let c = 0, i = row * this.cols; c < this.cols; c++, i++) s += this.data[i]!;
    return s;
  }
  /** The sum of one column. */
  colSum(col: number): number {
    let s = 0;
    for (let r = 0, i = col; r < this.rows; r++, i += this.cols) s += this.data[i]!;
    return s;
  }
  /** The sum of everything. */
  total(): number {
    let s = 0;
    for (let i = 0; i < this.data.length; i++) s += this.data[i]!;
    return s;
  }
  /** A copy of one row. */
  row(row: number): number[] {
    return Array.from(this.data.subarray(row * this.cols, (row + 1) * this.cols));
  }
  hashInto(h: Hasher): void {
    h.int(this.rows).int(this.cols);
    for (let i = 0; i < this.data.length; i++) h.float(this.data[i]!);
  }
  save(): { rows: number; cols: number; data: number[] } {
    return { rows: this.rows, cols: this.cols, data: Array.from(this.data) };
  }
  load(state: { rows: number; cols: number; data: readonly number[] }): void {
    if (state.rows !== this.rows || state.cols !== this.cols)
      throw new Error(
        `table shape ${state.rows} × ${state.cols} does not match ${this.rows} × ${this.cols}`,
      );
    this.data.set(state.data);
  }
}

/** Integer counts. Writes must be integers and may never go negative. */
export class CountTable extends Table {
  set(row: number, col: number, value: number): void {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`count ${value} at ${row},${col}`);
    this.data[row * this.cols + col] = value;
  }
  add(row: number, col: number, delta: number): void {
    this.set(row, col, this.get(row, col) + delta);
  }
  /** Move `amount` from one cell to another; throws rather than going negative. */
  move(fromRow: number, fromCol: number, toRow: number, toCol: number, amount: number): void {
    if (amount === 0) return;
    this.add(fromRow, fromCol, -amount);
    this.add(toRow, toCol, amount);
  }
}

/** Real-valued fields. */
export class FieldTable extends Table {
  set(row: number, col: number, value: number): void {
    if (!Number.isFinite(value)) throw new Error(`field value ${value} at ${row},${col}`);
    this.data[row * this.cols + col] = value;
  }
  add(row: number, col: number, delta: number): void {
    this.set(row, col, this.get(row, col) + delta);
  }
}

/**
 * Integer changes gathered while reading a CountTable, applied afterwards
 * (compute-then-commit): every cell's change is computed from the same state,
 * so the order the cells are visited in cannot matter.
 */
export class CountDeltas {
  private readonly deltas: Float64Array;
  private readonly cols: number;
  constructor(table: CountTable) {
    this.cols = table.cols;
    this.deltas = new Float64Array(table.rows * table.cols);
  }
  add(row: number, col: number, delta: number): void {
    if (!Number.isSafeInteger(delta)) throw new Error(`delta ${delta} is not an integer`);
    this.deltas[row * this.cols + col] = this.deltas[row * this.cols + col]! + delta;
  }
  move(fromRow: number, fromCol: number, toRow: number, toCol: number, amount: number): void {
    this.add(fromRow, fromCol, -amount);
    this.add(toRow, toCol, amount);
  }
  /** Apply every change to the table, in index order. */
  commit(table: CountTable): void {
    for (let i = 0; i < this.deltas.length; i++) {
      const d = this.deltas[i]!;
      if (d !== 0) table.add(Math.floor(i / this.cols), i % this.cols, d);
    }
    this.deltas.fill(0);
  }
}
