import { DiffEditor, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { useEffect, useState } from "react";

// Bundle Monaco locally instead of loading it from a CDN: config files never leave the machine.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export default function RawDiff({ a, b }: { a: string; b: string }) {
  const [dark, setDark] = useState(darkQuery.matches);
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    darkQuery.addEventListener("change", onChange);
    return () => darkQuery.removeEventListener("change", onChange);
  }, []);

  return (
    <DiffEditor
      original={a}
      modified={b}
      language="xml"
      theme={dark ? "vs-dark" : "vs"}
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "off",
        fontSize: 12,
        hideUnchangedRegions: { enabled: true },
      }}
    />
  );
}
