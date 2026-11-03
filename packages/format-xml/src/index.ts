import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { TNode } from "@twincheck/core";

export class XmlParseError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(line ? `${message} (line ${line}, column ${column})` : message);
  }
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

type Raw = Record<string, unknown> & { ":@"?: Record<string, string> };

/** Parses XML text into the format-neutral tree. Namespace prefixes and `xmlns` attributes are dropped. */
export function parseXml(text: string): TNode {
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new XmlParseError(valid.err.msg, valid.err.line, valid.err.col);
  const roots = (parser.parse(text) as Raw[]).map(toNode).filter((n): n is TNode => !!n);
  if (roots.length !== 1) throw new XmlParseError("Expected exactly one root element");
  return roots[0];
}

function toNode(raw: Raw): TNode | undefined {
  const name = Object.keys(raw).find((k) => k !== ":@");
  if (!name || name.startsWith("#") || name.startsWith("?")) return undefined;
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw[":@"] ?? {})) {
    if (k !== "xmlns" && !k.startsWith("xmlns:")) attrs[k] = String(v);
  }
  const children: TNode[] = [];
  const texts: string[] = [];
  for (const child of raw[name] as Raw[]) {
    if ("#text" in child) texts.push(String(child["#text"]));
    else {
      const node = toNode(child);
      if (node) children.push(node);
    }
  }
  const text = texts.join("").trim();
  return { name, attrs, text: text || undefined, children };
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

/** Pretty-prints a tree as XML, one element per line. */
export function serializeXml(root: TNode, indent = "    "): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const visit = (n: TNode, depth: number) => {
    const pad = indent.repeat(depth);
    const attrs = Object.entries(n.attrs)
      .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
      .join("");
    if (n.children.length === 0) {
      lines.push(n.text === undefined ? `${pad}<${n.name}${attrs}/>` : `${pad}<${n.name}${attrs}>${escapeText(n.text)}</${n.name}>`);
      return;
    }
    lines.push(`${pad}<${n.name}${attrs}>`);
    if (n.text !== undefined) lines.push(`${pad}${indent}${escapeText(n.text)}`);
    for (const c of n.children) visit(c, depth + 1);
    lines.push(`${pad}</${n.name}>`);
  };
  visit(root, 0);
  return lines.join("\n") + "\n";
}
