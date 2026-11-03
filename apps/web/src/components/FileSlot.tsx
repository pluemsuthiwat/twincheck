import { useRef, useState } from "react";

export interface LoadedFile {
  name: string;
  text: string;
  size: number;
}

interface Props {
  side: "a" | "b";
  file?: LoadedFile;
  error?: string;
  large?: boolean;
  onLoad: (f: LoadedFile) => void;
}

const formatSize = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function FileSlot({ side, file, error, large, onLoad }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const read = async (f?: File) => {
    if (f) onLoad({ name: f.name, text: await f.text(), size: f.size });
  };

  const sideColor = side === "a" ? "bg-side-a" : "bg-side-b";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void read(e.dataTransfer.files[0]);
      }}
      className={`group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border bg-surface transition-colors
        ${large ? "flex-col justify-center border-2 border-dashed p-10 text-center" : "px-3 py-2"}
        ${over ? "border-accent bg-mod-bg" : error ? "border-del" : "border-line hover:border-side-b"}`}
    >
      <input
        ref={input}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => {
          void read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span
        className={`flex shrink-0 items-center justify-center rounded-md font-bold text-white ${sideColor} ${large ? "size-12 text-xl" : "size-7 text-sm"}`}
      >
        {side.toUpperCase()}
      </span>
      {file ? (
        <span className={`min-w-0 ${large ? "" : "flex-1"}`}>
          <span className="block truncate font-medium" title={file.name}>
            {file.name}
          </span>
          <span className={`block text-xs ${error ? "text-del" : "text-muted"}`}>
            {error ?? `${formatSize(file.size)} · Click or drop a file to replace`}
          </span>
        </span>
      ) : (
        <span className={large ? "" : "flex-1"}>
          <span className="block font-medium">{side === "a" ? "File A (baseline)" : "File B (compare)"}</span>
          <span className="block text-xs text-muted">Drop an XML file here, or click to browse</span>
        </span>
      )}
    </div>
  );
}
