import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { About } from "./components/About";
import { Detail, Overview, type ViewOptions } from "./components/Detail";
import { FileSlot, type LoadedFile } from "./components/FileSlot";
import { Counts } from "./components/Status";
import { TreeNav } from "./components/TreeNav";
import { UpdateToast } from "./components/UpdateToast";
import { PROFILES, type CompareResult } from "./engine";
import { findTrail, maskXml } from "./lib/tree";
import { useUpdater } from "./lib/updater";
import { useCompare } from "./useCompare";

const RawDiff = lazy(() => import("./components/RawDiff"));

type Files = { a?: LoadedFile; b?: LoadedFile };

export default function App() {
  const [files, setFiles] = useState<Files>({});
  const [profile, setProfile] = useState("auto");
  const state = useCompare(files.a?.text, files.b?.text, profile);

  // Keep showing the previous result while a new comparison runs.
  const last = useRef<CompareResult | undefined>(undefined);
  if (state.status === "done") last.current = state.result;
  if (state.status === "idle" || state.status === "error") last.current = undefined;
  const result = last.current;

  const [view, setView] = useState<"diff" | "raw">("diff");
  const [rawMode, setRawMode] = useState<"normalized" | "original">("normalized");
  const [selected, setSelected] = useState<{ id: string; focus?: string }>({ id: "" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [changesOnly, setChangesOnly] = useState(true);
  const [showSecrets, setShowSecrets] = useState(false);
  const [query, setQuery] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const updater = useUpdater();

  useEffect(() => {
    if (!result) return;
    setSelected({ id: "" });
    setExpanded(new Set(result.root.children.filter((c) => c.status !== "unchanged").map((c) => c.id)));
  }, [result]);

  const select = (id: string, focus?: string) => {
    setSelected({ id, focus });
    if (!result || !id) return;
    const trail = findTrail(result.root, id) ?? [];
    setExpanded((prev) => new Set([...prev, ...trail.map((t) => t.id)]));
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const raw = useMemo(() => {
    if (!result || !files.a || !files.b) return { a: "", b: "" };
    const src = rawMode === "normalized" ? result.normalized : { a: files.a.text, b: files.b.text };
    return showSecrets ? src : { a: maskXml(src.a), b: maskXml(src.b) };
  }, [result, files, rawMode, showSecrets]);

  const options: ViewOptions = {
    changesOnly,
    showSecrets,
    labels: { a: files.a?.name ?? "A", b: files.b?.name ?? "B" },
  };
  const trail = result && selected.id ? findTrail(result.root, selected.id) : undefined;
  const sideError = (side: "a" | "b") => (state.status === "error" && state.side === side ? state.message : undefined);
  const load = (side: "a" | "b") => (f: LoadedFile) => setFiles((prev) => ({ ...prev, [side]: f }));
  const comparing = !!(files.a && files.b);

  /** Back to the start screen with both slots empty. */
  const reset = () => {
    setFiles({});
    setSelected({ id: "" });
    setQuery("");
    setView("diff");
  };

  // Cmd+N (macOS) / Ctrl+N starts a new comparison.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-brand px-4 py-2.5 text-white">
        <button
          type="button"
          onClick={reset}
          title="Back to start"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <img src="./icon.png" alt="" className="size-8 rounded-lg" />
          <span className="min-w-0">
            <span className="block text-lg leading-tight font-bold">TwinCheck</span>
            <span className="block truncate text-xs text-white/60">
              Config Compare · Processed locally, nothing leaves this machine
            </span>
          </span>
        </button>
        {(files.a || files.b) && (
          <button
            type="button"
            onClick={reset}
            title="New comparison (⌘N)"
            className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M8 3v10M3 8h10" />
            </svg>
            New comparison
          </button>
        )}
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span className="hidden sm:inline">Profile</span>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white"
          >
            <option value="auto" className="text-ink">
              Auto-detect
            </option>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id} className="text-ink">
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          title="About TwinCheck: version and license"
          className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/20"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7v4M8 4.8v.1" strokeLinecap="round" />
          </svg>
          v{__APP_VERSION__}
          {updater.status.kind === "available" && (
            <span className="rounded bg-add px-1.5 font-semibold text-white">Update {updater.status.version}</span>
          )}
        </button>
        <About
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          update={updater.status}
          onCheck={updater.check}
          onInstall={updater.install}
        />
        <UpdateToast status={updater.status} onInstall={updater.install} />
      </header>

      {!comparing ? (
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-4 py-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Compare two config files</h2>
            <p className="mt-2 text-muted">
              Supports ClearPass Policy Manager exports (Services, Policies, Profiles, etc.) and generic XML
              <br />
              Semantic comparison: objects that only changed order are not reported as differences
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <FileSlot side="a" file={files.a} large onLoad={load("a")} />
            <FileSlot side="b" file={files.b} large onLoad={load("b")} />
          </div>
        </main>
      ) : (
        <>
          <div className="flex flex-col gap-2 border-b border-line bg-surface-2 px-4 py-2 sm:flex-row sm:items-center">
            <FileSlot side="a" file={files.a} error={sideError("a")} onLoad={load("a")} />
            <button
              type="button"
              title="Swap A ↔ B"
              onClick={() => setFiles({ a: files.b, b: files.a })}
              className="self-center rounded-md border border-line bg-surface px-2 py-1 text-muted hover:text-ink"
            >
              ⇄
            </button>
            <FileSlot side="b" file={files.b} error={sideError("b")} onLoad={load("b")} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 text-sm">
            <div className="flex rounded-md border border-line p-0.5">
              {(["diff", "raw"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded px-3 py-1 ${view === v ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                >
                  {v === "diff" ? "Differences" : "Raw XML"}
                </button>
              ))}
            </div>
            {state.status === "running" && <span className="text-muted">Comparing…</span>}
            {state.status === "error" && <span className="text-del">Could not read file: {state.message}</span>}
            {result && (
              <span className="flex items-center gap-2 text-muted">
                <Counts stats={result.root.stats} className="text-sm" />
                <span className="hidden md:inline">
                  · {result.profile.name} · {result.ms.toFixed(0)} ms
                </span>
              </span>
            )}
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} />
              Show passwords / secrets
            </label>
          </div>

          {result &&
            (view === "diff" ? (
              <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,40%)_1fr] lg:grid-cols-[360px_1fr] lg:grid-rows-1">
                <aside className="flex min-h-0 flex-col border-b border-line bg-surface lg:border-r lg:border-b-0">
                  <div className="space-y-2 border-b border-line p-2">
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search services, policies, profiles…"
                      className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-side-b"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={changesOnly} onChange={(e) => setChangesOnly(e.target.checked)} />
                      Show differences only
                    </label>
                    <p
                      className="flex flex-wrap gap-x-3 text-[11px] text-muted"
                      title="Each row counts every change inside it, so a row equals the sum of its children"
                    >
                      <span>
                        <span className="font-mono text-add">+</span> only in B
                      </span>
                      <span>
                        <span className="font-mono text-del">−</span> only in A
                      </span>
                      <span>
                        <span className="font-mono text-mod">~</span> changed / moved
                      </span>
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <TreeNav
                      root={result.root}
                      selectedId={selected.id}
                      expanded={expanded}
                      changesOnly={changesOnly}
                      query={query}
                      showSecrets={showSecrets}
                      onSelect={(id) => select(id)}
                      onToggle={toggle}
                    />
                  </div>
                </aside>
                <main className="min-h-0 overflow-auto p-4">
                  {trail ? (
                    <Detail key={selected.id} trail={trail} focusId={selected.focus} options={options} onSelect={(id) => select(id)} />
                  ) : (
                    <Overview root={result.root} options={options} onOpen={select} />
                  )}
                </main>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-1.5 text-xs text-muted">
                  {(["normalized", "original"] as const).map((m) => (
                    <label key={m} className="flex items-center gap-1.5">
                      <input type="radio" checked={rawMode === m} onChange={() => setRawMode(m)} />
                      {m === "normalized" ? "Normalized (sorted, irrelevant fields removed)" : "Original files"}
                    </label>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  <Suspense fallback={<p className="p-4 text-sm text-muted">Loading editor…</p>}>
                    <RawDiff a={raw.a} b={raw.b} />
                  </Suspense>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
