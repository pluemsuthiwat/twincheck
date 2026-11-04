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

export const StatusDot = ({ status, inline }: { status: DiffStatus; inline?: boolean }) => (
  <span className={`inline-block size-2 shrink-0 rounded-full ${STYLE[status].dot} ${inline ? "mr-1 align-[1px]" : ""}`} />
);

/** Marks a category (top-level section) so it never shares a status color with the objects inside. */
export const FolderIcon = () => (
  <svg viewBox="0 0 16 16" className="inline-block size-3.5 shrink-0 align-[-2px] text-side-b" fill="currentColor" aria-hidden="true">
    <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.5 1.5H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12z" />
  </svg>
);

/** Compact "+1 −2 ~3" counter; zero parts are hidden. */
export function Counts({ stats, className = "", title }: { stats: DiffStats; className?: string; title?: string }) {
  return (
    <span className={`inline-flex gap-1.5 font-mono text-[11px] tabular-nums ${className}`} title={title}>
      {stats.added > 0 && <span className="text-add">+{stats.added}</span>}
      {stats.removed > 0 && <span className="text-del">−{stats.removed}</span>}
      {stats.modified > 0 && <span className="text-mod">~{stats.modified}</span>}
    </span>
  );
}
