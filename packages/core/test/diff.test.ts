import { describe, expect, it } from "vitest";
import { canonicalize, collectChanges, diffTrees, type Profile, type TNode } from "../src";

const el = (name: string, attrs: Record<string, string> = {}, ...children: (TNode | string)[]): TNode => {
  const text = children.find((c): c is string => typeof c === "string");
  return { name, attrs, text, children: children.filter((c): c is TNode => typeof c !== "string") };
};

const plain: Profile = { id: "t", name: "test" };
const ordered: Profile = { id: "t", name: "test", rules: [{ match: "**/Rule", ordered: true }] };

const changedIds = (a: TNode, b: TNode, p = plain) =>
  collectChanges(diffTrees(a, b, p)).map((c) => `${c.node.status} ${c.node.id}`);

describe("diffTrees", () => {
  it("ignores reordering of named siblings", () => {
    const a = el("Root", {}, el("Item", { name: "x", v: "1" }), el("Item", { name: "y", v: "2" }));
    const b = el("Root", {}, el("Item", { name: "y", v: "2" }), el("Item", { name: "x", v: "1" }));
    const d = diffTrees(a, b, plain);
    expect(d.status).toBe("unchanged");
    expect(d.stats).toEqual({ added: 0, removed: 0, modified: 0 });
  });

  it("reports attribute changes on the matched object", () => {
    const a = el("Root", {}, el("Item", { name: "x", vlan: "10" }));
    const b = el("Root", {}, el("Item", { name: "x", vlan: "20" }));
    const [change] = collectChanges(diffTrees(a, b, plain));
    expect(change.node.id).toBe("Root/Item");
    expect(change.node.attrs.find((x) => x.name === "vlan")).toMatchObject({ a: "10", b: "20", status: "modified" });
  });

  it("reports added and removed objects", () => {
    const a = el("Root", {}, el("Item", { name: "x" }), el("Item", { name: "gone" }));
    const b = el("Root", {}, el("Item", { name: "x" }), el("Item", { name: "new" }));
    expect(changedIds(a, b).sort()).toEqual(["added Root/Item[new]", "removed Root/Item[gone]"]);
  });

  it("finds an inserted rule in an ordered list without flagging the rules after it", () => {
    const rule = (v: string) => el("Rule", {}, el("Cond", { v }));
    const a = el("Root", {}, el("List", {}, rule("1"), rule("2"), rule("3")));
    const b = el("Root", {}, el("List", {}, rule("1"), rule("new"), rule("2"), rule("3")));
    const changes = collectChanges(diffTrees(a, b, ordered));
    expect(changes).toHaveLength(1);
    expect(changes[0].node).toMatchObject({ status: "added", pos: { b: 2 } });
  });

  it("pairs a changed rule in place instead of add+remove", () => {
    const rule = (v: string) => el("Rule", {}, el("Cond", { v }));
    const a = el("Root", {}, el("List", {}, rule("1"), rule("2"), rule("3")));
    const b = el("Root", {}, el("List", {}, rule("1"), rule("two"), rule("3")));
    const [change, ...rest] = collectChanges(diffTrees(a, b, ordered));
    expect(rest).toHaveLength(0);
    expect(change.node.name).toBe("Cond");
    expect(change.trail.at(-1)).toMatchObject({ name: "Rule", pos: { a: 2, b: 2 } });
  });

  it("flags moves in ordered keyed lists", () => {
    const p: Profile = { id: "t", name: "t", rules: [{ match: "**/string", ordered: true, key: (n) => n.text }] };
    const list = (...xs: string[]) => el("Root", {}, el("List", {}, ...xs.map((x) => el("string", {}, x))));
    const changes = collectChanges(diffTrees(list("a", "b", "c"), list("b", "a", "c"), p));
    expect(changes).toHaveLength(1);
    expect(changes[0].node.moved).toBe(true);
  });

  it("treats order as irrelevant for unordered lists without keys", () => {
    const a = el("Root", {}, el("Entry", { v: "1" }), el("Entry", { v: "2" }));
    const b = el("Root", {}, el("Entry", { v: "2" }), el("Entry", { v: "1" }));
    expect(changedIds(a, b)).toEqual([]);
  });

  it("keeps duplicate keys apart", () => {
    const a = el("Root", {}, el("Attr", { name: "AVPair", value: "x" }), el("Attr", { name: "AVPair", value: "y" }));
    const b = el("Root", {}, el("Attr", { name: "AVPair", value: "x" }), el("Attr", { name: "AVPair", value: "z" }));
    expect(changedIds(a, b)).toEqual(["modified Root/Attr[AVPair#2]"]);
  });

  it("applies ignore patterns and per-element ignoreAttrs", () => {
    const p: Profile = {
      id: "t",
      name: "t",
      ignore: ["Root/Header/@time"],
      rules: [{ match: "**/Result", ignoreAttrs: (n) => (n.attrs.display ? ["id"] : []) }],
    };
    const a = el("Root", {}, el("Header", { time: "1" }), el("Result", { id: "7", display: "Allow" }));
    const b = el("Root", {}, el("Header", { time: "2" }), el("Result", { id: "9", display: "Allow" }));
    expect(diffTrees(a, b, p).status).toBe("unchanged");
  });

  it("marks secret-looking attributes", () => {
    const a = el("Root", {}, el("Proxy", { secret: "a", allowPasswords: "true" }), el("NVPair", { name: "password", value: "x" }));
    const d = diffTrees(a, a, plain);
    const secrets = d.children.flatMap((c) => c.attrs.filter((x) => x.secret).map((x) => `${c.name}@${x.name}`));
    expect(secrets).toEqual(["Proxy@secret", "NVPair@value"]);
  });
});

describe("canonicalize", () => {
  it("produces identical trees for reordered unordered content", () => {
    const a = el("Root", {}, el("Item", { name: "b" }), el("Item", { name: "a" }), el("Rule", { v: "2" }), el("Rule", { v: "1" }));
    const b = el("Root", {}, el("Rule", { v: "2" }), el("Item", { name: "a" }), el("Rule", { v: "1" }), el("Item", { name: "b" }));
    expect(canonicalize(a, ordered)).toEqual(canonicalize(b, ordered));
    expect(canonicalize(a, ordered).children.filter((c) => c.name === "Rule").map((c) => c.attrs.v)).toEqual(["2", "1"]);
  });
});
