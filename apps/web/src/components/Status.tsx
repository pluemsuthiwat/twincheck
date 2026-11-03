import type { DiffStats, DiffStatus } from "@twincheck/core";

const STYLE: Record<DiffStatus, { text: string; cls: string; dot: string }> = {
  added: { text: "Only in B", cls: "bg-add-bg text-add", dot: "bg-add" },
  removed: { text: "Only in A", cls: "bg-del-bg text-del", dot: "bg-del" },
  modified: { text: "Changed", cls: "bg-mod-bg text-mod", dot: "bg-mod" },
  unchanged: { text: "Same", cls: "bg-surface-2 text-muted", dot: "bg-line" },
};

export function StatusBadge({ status, moved }: { status: DiffStatus; moved?: boolean }) {
  const s = STYLE[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span>
      {moved && <span className="rounded bg-mod-bg px-1.5 py-0.5 text-[11px] font-semibold text-mod">Moved</span>}
    </span>
  );
}

export const StatusDot = ({ status }: { status: DiffStatus }) => (
  <span className={`inline-block size-2 shrink-0 rounded-full ${STYLE[status].dot}`} />
);

/** Compact "+1 −2 ~3" counter; zero parts are hidden. */
export function Counts({ stats, className = "" }: { stats: DiffStats; className?: string }) {
  return (
    <span className={`inline-flex gap-1.5 font-mono text-[11px] tabular-nums ${className}`}>
      {stats.added > 0 && <span className="text-add">+{stats.added}</span>}
      {stats.removed > 0 && <span className="text-del">−{stats.removed}</span>}
      {stats.modified > 0 && <span className="text-mod">~{stats.modified}</span>}
    </span>
  );
}
