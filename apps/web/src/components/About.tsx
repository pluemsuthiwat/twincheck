import { useEffect, useRef } from "react";
import license from "../../../../LICENSE?raw";
import { RELEASES_URL, type UpdateStatus } from "../lib/updater";

interface Props {
  open: boolean;
  onClose: () => void;
  update: UpdateStatus;
  onCheck: () => void;
  onInstall: () => void;
}

/** Version, updates, copyright and the full license text. Esc or a click outside closes it. */
export function About({ open, onClose, update, onCheck, onInstall }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <img src="./icon.png" alt="" className="size-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">TwinCheck</h2>
            <p className="text-sm text-muted">Semantic config compare · Processed locally</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Version</dt>
          <dd className="font-mono">{__APP_VERSION__}</dd>
          <dt className="text-muted">License</dt>
          <dd>MIT</dd>
          <dt className="text-muted">Copyright</dt>
          <dd>© 2026 Suthiwat Srisen</dd>
        </dl>
        <Updates status={update} onCheck={onCheck} onInstall={onInstall} />
        <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
          {license.trim()}
        </pre>
      </div>
    </dialog>
  );
}

const BUTTON = "rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

function Updates({ status, onCheck, onInstall }: { status: UpdateStatus; onCheck: () => void; onInstall: () => void }) {
  if (status.kind === "unsupported") {
    return (
      <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
        Automatic updates are available in the desktop app. Latest builds:{" "}
        <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-side-b underline">
          GitHub Releases
        </a>
      </p>
    );
  }
  if (status.kind === "available") {
    return (
      <div className="space-y-2 rounded-lg border border-add bg-add-bg px-3 py-2">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm font-semibold text-add">Version {status.version} is available</p>
          <button type="button" onClick={onInstall} className={BUTTON}>
            Download &amp; restart
          </button>
        </div>
        {status.notes && <p className="text-xs whitespace-pre-wrap text-muted">{status.notes}</p>}
      </div>
    );
  }
  const message = {
    idle: "",
    checking: "Checking…",
    latest: "You're on the latest version",
    installing: `Downloading update…${"percent" in status && status.percent !== undefined ? ` ${status.percent}%` : ""}`,
    error: `Could not check for updates: ${"message" in status ? status.message : ""}`,
  }[status.kind];
  const busy = status.kind === "checking" || status.kind === "installing";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
      <p className={`min-w-0 flex-1 text-sm ${status.kind === "error" ? "text-del" : "text-muted"}`}>{message}</p>
      <button type="button" onClick={onCheck} disabled={busy} className={BUTTON}>
        Check for updates
      </button>
    </div>
  );
}
