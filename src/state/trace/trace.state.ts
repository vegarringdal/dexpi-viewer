import { createStore } from "../../lib/createStore.ts";

export type TraceMode = "off" | "upstream" | "downstream" | "both";

export type TraceState = Readonly<{
  mode: TraceMode;
  originId: string | null;
  upstreamIds: readonly string[];
  downstreamIds: readonly string[];
}>;

export const traceState = createStore<TraceState>({
  mode: "off",
  originId: null,
  upstreamIds: [],
  downstreamIds: [],
});
