// bridge: the protocol between the page and the simulation host — message types,
// the client, the worker port and the in-thread pair. May import: kernel.
// See README.md and docs/architecture/universe-architecture.md §30.
export { HostClient, type CommandReceipt } from "./client.ts";
export {
  frameTransfer,
  type FrameArray,
  type FrameMessage,
  type Interest,
  type Port,
  type Query,
  type Status,
  type ToHost,
  type ToMain,
} from "./protocol.ts";
export { inlinePair, workerPort } from "./transport.ts";
