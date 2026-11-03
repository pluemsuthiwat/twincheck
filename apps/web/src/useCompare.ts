import { useEffect, useRef, useState } from "react";
import type { WorkerRequest, WorkerResponse } from "./compare.worker";
import type { CompareResult } from "./engine";

export type CompareState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: CompareResult }
  | { status: "error"; message: string; side?: "a" | "b" };

/** Runs the comparison in a Web Worker so large exports never block the UI. */
export function useCompare(a: string | undefined, b: string | undefined, profile: string): CompareState {
  const [state, setState] = useState<CompareState>({ status: "idle" });
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("./compare.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== seq.current) return; // stale response
      setState(e.data.ok ? { status: "done", result: e.data.result } : { status: "error", ...e.data.error });
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (a === undefined || b === undefined || !worker.current) {
      setState({ status: "idle" });
      return;
    }
    const id = ++seq.current;
    setState({ status: "running" });
    worker.current.postMessage({ id, a, b, profile } satisfies WorkerRequest);
  }, [a, b, profile]);

  return state;
}
