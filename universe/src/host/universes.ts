// Every kind of universe this build can run, by name.
import type { Universe } from "./host.ts";
import { SANDBOX } from "./sandbox.ts";

export const UNIVERSES: Readonly<Record<string, Universe>> = {
  sandbox: SANDBOX,
};
