import { describe, expect, it } from "vitest";
import {
  applyMaidMention,
  findMaidMentionTarget,
  maidMentionChoices,
  maidMentionTokens,
  removeMaidMention,
  type MaidMentionAgent,
} from "./maid-atelier-mentions.ts";

const agents: MaidMentionAgent[] = [
  { id: "harper", name: "Harper" },
  { id: "notes", name: "Notes" },
  { id: "ann", name: "Ann" },
  { id: "anna", name: "Anna" },
];

describe("findMaidMentionTarget", () => {
  it("opens on @ and keeps a name prefix", () => {
    expect(findMaidMentionTarget("@", 1)).toMatchObject({ start: 0, end: 1, query: "" });
    expect(findMaidMentionTarget("Ask @Not", 8)).toMatchObject({ start: 4, end: 8, query: "Not" });
  });

  it("ignores slash commands, quotes, code, and a space right after @", () => {
    expect(findMaidMentionTarget("/ask @Notes", 10)).toBeNull();
    expect(findMaidMentionTarget("> @Notes", 7)).toBeNull();
    expect(findMaidMentionTarget("`@Notes", 6)).toBeNull();
    expect(findMaidMentionTarget("@ Notes", 2)).toBeNull();
  });
});

describe("maidMentionChoices", () => {
  it("lists the room, then filters by prefix, and stops after a space", () => {
    expect(maidMentionChoices(agents, "").map((agent) => agent.id)).toEqual([
      "harper",
      "notes",
      "ann",
      "anna",
    ]);
    expect(maidMentionChoices(agents, "n").map((agent) => agent.id)).toEqual(["notes"]);
    expect(maidMentionChoices(agents, "Notes ")).toEqual([]);
    expect(maidMentionChoices(agents, "archive")).toEqual([]);
  });
});

describe("maid mention tokens", () => {
  it("inserts, finds, and removes the longest exact name", () => {
    const value = "See @An later";
    const caret = "See @An".length;
    const target = findMaidMentionTarget(value, caret);
    expect(target).not.toBeNull();
    const applied = applyMaidMention(value, target!, agents[3]!);
    expect(applied.value).toBe("See @Anna later");
    expect(applied.caret).toBe("See @Anna ".length);

    const tokens = maidMentionTokens("@Anna and @Ann then @Notes,", agents);
    expect(tokens.map((token) => token.agent.id)).toEqual(["anna", "ann", "notes"]);
    expect(maidMentionTokens("email@Notes and ` @Harper `", agents)).toEqual([]);
    expect(
      removeMaidMention("See @Notes now", tokens[2] ? { start: 4, end: 10 } : tokens[0]!),
    ).toBe("See now");
  });
});
