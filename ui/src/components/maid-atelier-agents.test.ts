import { describe, expect, it } from "vitest";
import { splitMaidAgents } from "./maid-atelier-agents.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";

describe("splitMaidAgents", () => {
  const cards = [{ id: "main" }, { id: "harper" }, { id: "notes" }];

  it("keeps the default agent as chief and the rest independent", () => {
    expect(splitMaidAgents(cards, "main")).toEqual({
      chief: { id: "main" },
      independent: [{ id: "harper" }, { id: "notes" }],
    });
  });

  it("uses the first card when the default id is missing", () => {
    expect(splitMaidAgents(cards, "missing").chief).toEqual({ id: "main" });
    expect(splitMaidAgents(cards, null).independent.map((card) => card.id)).toEqual([
      "harper",
      "notes",
    ]);
  });

  it("returns an empty independent list for a single maid", () => {
    expect(splitMaidAgents([{ id: "main" }], "main")).toEqual({
      chief: { id: "main" },
      independent: [],
    });
  });
});

describe("maidPortraitSrc", () => {
  it("picks a bundled portrait and keeps it for the same id", () => {
    const first = maidPortraitSrc("harper");
    expect(first).toMatch(/^\/maid-avatars\/0[1-8]\.jpg$/);
    expect(maidPortraitSrc("harper")).toBe(first);
    const faces = new Set(
      ["harper", "archive", "notes", "chief", "quill", "ink"].map((id) => maidPortraitSrc(id)),
    );
    expect(faces.size).toBeGreaterThan(1);
  });
});
