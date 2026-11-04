import { useState } from "react";
import type { UpdateStatus } from "../lib/updater";

/** Pops up in the corner when a newer version is found; "Later" hides it until the next launch. */
export function UpdateToast({ status, onInstall }: { status: UpdateStatus; onInstall: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const installing = status.kind === "installing";
  if (dismissed || (status.kind !== "available" && !installing)) return null;

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100%-2rem)] space-y-2 rounded-xl border border-line bg-surface p-4 text-ink shadow-lg"
    >
      <div className="flex items-start gap-3">
        <img src="./icon.png" alt="" className="size-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Update available</p>
          <p className="text-xs text-muted">
            {status.kind === "available"
              ? `TwinCheck ${status.version} is ready to install (you have ${__APP_VERSION__})`
              : `Downloading…${status.percent !== undefined ? ` ${status.percent}%` : ""} The app restarts when done.`}
          </p>
        </div>
      </div>
      {status.kind === "available" && status.notes && (
        <p className="max-h-24 overflow-auto text-xs whitespace-pre-wrap text-muted">{status.notes}</p>
      )}
      {installing ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-brand transition-all" style={{ width: `${status.percent ?? 5}%` }} />
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-ink"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onInstall}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Update &amp; restart
          </button>
        </div>
      )}
    </div>
  );
}
