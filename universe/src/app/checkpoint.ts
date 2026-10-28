// One automatic save at a time: a phone going into the background may ask again while
// the regular save is still compressing. Never build two copies of a large world at once.
export class Checkpoint {
  private pending: Promise<boolean> | null = null;
  private readonly keep: () => Promise<unknown>;
  private readonly report: (error: unknown | null) => void;
  constructor(keep: () => Promise<unknown>, report: (error: unknown | null) => void) {
    this.keep = keep;
    this.report = report;
  }

  save(): Promise<boolean> {
    if (this.pending) return this.pending;
    this.pending = this.write();
    return this.pending;
  }

  private async write(): Promise<boolean> {
    try {
      await Promise.resolve().then(this.keep);
      this.report(null);
      return true;
    } catch (error) {
      this.report(error);
      return false;
    } finally {
      this.pending = null;
    }
  }
}
