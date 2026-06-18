import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEVELS,
  childLevelKey,
  isLeafLevel,
  isValidParentLevel,
  leafLevel,
  parentLevelKey,
  resolveLevels,
  type WorkspaceLevel,
} from "./levels.js";

const TWO_LEVEL: WorkspaceLevel[] = [
  { key: "epic", label: "Epic", position: 0, isLeaf: false },
  { key: "story", label: "Story", position: 1, isLeaf: true },
];

describe("resolveLevels", () => {
  it("falls back to the default hierarchy when none configured", () => {
    expect(resolveLevels().map((l) => l.key)).toEqual([
      "initiative",
      "epic",
      "feature",
    ]);
    expect(resolveLevels(null)).toEqual(resolveLevels([]));
  });

  it("sorts by position and marks only the deepest as leaf", () => {
    const scrambled: WorkspaceLevel[] = [
      { key: "feature", label: "Feature", position: 2, isLeaf: false },
      { key: "initiative", label: "Initiative", position: 0, isLeaf: true },
      { key: "epic", label: "Epic", position: 1, isLeaf: false },
    ];
    const resolved = resolveLevels(scrambled);
    expect(resolved.map((l) => l.key)).toEqual(["initiative", "epic", "feature"]);
    expect(resolved.filter((l) => l.isLeaf).map((l) => l.key)).toEqual(["feature"]);
  });
});

describe("leafLevel / isLeafLevel", () => {
  it("identifies the deepest level as the leaf", () => {
    expect(leafLevel().key).toBe("feature");
    expect(leafLevel(TWO_LEVEL).key).toBe("story");
    expect(isLeafLevel("feature")).toBe(true);
    expect(isLeafLevel("epic")).toBe(false);
    expect(isLeafLevel("story", TWO_LEVEL)).toBe(true);
  });
});

describe("parentLevelKey / childLevelKey", () => {
  it("returns the adjacent level keys", () => {
    expect(parentLevelKey("feature")).toBe("epic");
    expect(parentLevelKey("epic")).toBe("initiative");
    expect(parentLevelKey("initiative")).toBeNull();
    expect(childLevelKey("initiative")).toBe("epic");
    expect(childLevelKey("feature")).toBeNull();
  });

  it("returns null for unknown keys", () => {
    expect(parentLevelKey("nope")).toBeNull();
    expect(childLevelKey("nope")).toBeNull();
  });
});

describe("isValidParentLevel", () => {
  it("allows a null parent at any level (orphans)", () => {
    expect(isValidParentLevel("feature", null)).toBe(true);
    expect(isValidParentLevel("initiative", null)).toBe(true);
  });

  it("requires the parent to be exactly one level up", () => {
    expect(isValidParentLevel("feature", "epic")).toBe(true);
    expect(isValidParentLevel("feature", "initiative")).toBe(false);
    expect(isValidParentLevel("epic", "initiative")).toBe(true);
  });

  it("rejects any parent for a top-level item", () => {
    expect(isValidParentLevel("initiative", "epic")).toBe(false);
  });
});

describe("DEFAULT_LEVELS", () => {
  it("has a single leaf", () => {
    expect(DEFAULT_LEVELS.filter((l) => l.isLeaf)).toHaveLength(1);
    expect(DEFAULT_LEVELS.at(-1)?.isLeaf).toBe(true);
  });
});
