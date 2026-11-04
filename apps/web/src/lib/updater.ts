import { isTauri } from "@tauri-apps/api/core";
import type { Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type UpdateStatus =
  | { kind: "unsupported" } // browser build: updates come with the desktop app only
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "installing"; percent?: number }
  | { kind: "error"; message: string };

export const RELEASES_URL = "https://github.com/pluemsuthiwat/twincheck/releases";

/**
 * Checks GitHub Releases (endpoint in tauri.conf.json) once at startup, quietly, and on demand.
 * Updates are signature-checked by the Tauri updater before they are installed.
 */
export function useUpdater() {
  const desktop = isTauri();
  const [status, setStatus] = useState<UpdateStatus>(desktop ? { kind: "idle" } : { kind: "unsupported" });
  const update = useRef<Update | null>(null);

  const run = useCallback(
    async (quiet: boolean) => {
      if (!desktop) return;
      if (!quiet) setStatus({ kind: "checking" });
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const found = await check();
        update.current = found;
        if (found) setStatus({ kind: "available", version: found.version, notes: found.body });
        else setStatus({ kind: quiet ? "idle" : "latest" });
      } catch (e) {
        // The startup check stays silent, e.g. when offline.
        setStatus(quiet ? { kind: "idle" } : { kind: "error", message: String(e) });
      }
    },
    [desktop],
  );

  const install = useCallback(async () => {
    const found = update.current;
    if (!found) return;
    setStatus({ kind: "installing" });
    let total = 0;
    let done = 0;
    try {
      await found.downloadAndInstall((ev) => {
        if (ev.event === "Started") total = ev.data.contentLength ?? 0;
        if (ev.event === "Progress" && total) {
          done += ev.data.chunkLength;
          setStatus({ kind: "installing", percent: Math.min(100, Math.round((done / total) * 100)) });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    void run(true);
  }, [run]);

  return { status, check: () => run(false), install };
}
