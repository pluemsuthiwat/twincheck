import { compare, CompareError, type CompareRequest } from "./engine";

export type WorkerRequest = CompareRequest & { id: number };
export type WorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof compare> }
  | { id: number; ok: false; error: { message: string; side?: "a" | "b" } };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, ...req } = e.data;
  let res: WorkerResponse;
  try {
    res = { id, ok: true, result: compare(req) };
  } catch (err) {
    const side = err instanceof CompareError ? err.side : undefined;
    res = { id, ok: false, error: { message: (err as Error).message, side } };
  }
  self.postMessage(res);
};
