// Commands (docs/architecture §3, §3.1): the only way anything outside the
// simulation changes it — a divine act, laying or lifting the hand, a time-control
// boundary. Each is validated, given a minted reference, stamped with the moment
// after now, logged, and applied first in that moment. Replaying the log from the
// seed reproduces the world bit for bit.
import type { Hasher } from "./hash.ts";
import { COMMAND } from "./history.ts";
import type { Minter, Ref } from "./ref.ts";
import type { SimTime } from "./time.ts";

export type Command = {
  readonly id: Ref;
  readonly t: number;
  readonly type: string;
  readonly args: unknown;
};

export type CommandSpec = {
  readonly type: string;
  /** Returns an error message, or null when the arguments are acceptable. */
  readonly validate: (args: unknown) => string | null;
  /** Apply the command at its moment. Cite `command.id` (role "agent") in whatever it causes. */
  readonly apply: (command: Command, t: SimTime) => void;
};

export class CommandLog {
  readonly name = "commands.log";
  private list: Command[] = [];
  private readonly specs = new Map<string, CommandSpec>();
  private readonly minter: Minter;

  constructor(minter: Minter) {
    this.minter = minter;
  }

  define(spec: CommandSpec): void {
    if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(spec.type))
      throw new Error(`command type ${spec.type}`);
    if (this.specs.has(spec.type)) throw new Error(`command ${spec.type} is defined twice`);
    this.specs.set(spec.type, spec);
  }

  spec(type: string): CommandSpec | undefined {
    return this.specs.get(type);
  }

  /** Validate and record a command for moment t; returns it (the caller schedules it). */
  record(type: string, args: unknown, t: number): Command {
    const spec = this.specs.get(type);
    if (!spec) throw new Error(`no command ${type}`);
    const problem = spec.validate(args);
    if (problem) throw new Error(`${type}: ${problem}`);
    const command: Command = {
      id: this.minter.mint(COMMAND),
      t,
      type,
      args: structuredCloneJson(args),
    };
    this.list.push(command);
    return command;
  }

  get(id: Ref): Command | undefined {
    return this.list.find((c) => c.id === id);
  }

  all(): readonly Command[] {
    return this.list;
  }

  hashInto(h: Hasher): void {
    h.int(this.list.length);
    for (const c of this.list) h.string(c.id).int(c.t).string(c.type).value(c.args);
  }

  save(): unknown {
    return { commands: this.list };
  }

  load(state: unknown): void {
    this.list = [...(state as { commands: Command[] }).commands];
  }
}

/** A deep copy through JSON: commands carry plain data only. */
function structuredCloneJson(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
