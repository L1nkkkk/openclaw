import { describe, expect, it } from "vitest";
import {
  MAID_NAV,
  MAID_SAMPLE_FILES,
  buildMaidBoard,
  maidChecklistModel,
  maidDensitySections,
  maidManuscriptFile,
  maidOpenSessionQueue,
  type MaidAgentFact,
  type MaidSessionFact,
} from "./maid-atelier-board.ts";

const harper: MaidAgentFact = {
  id: "harper",
  name: "Harper",
  avatar: null,
  textAvatar: null,
  activeNow: true,
  unreadCount: 1,
  lastActiveAt: 50,
  preview: "Reading the draft",
  role: "Chief Maid",
};
const notes: MaidAgentFact = {
  id: "notes",
  name: "Notes",
  avatar: null,
  textAvatar: null,
  activeNow: false,
  unreadCount: 0,
  lastActiveAt: 10,
  role: "Editor",
};
const archive: MaidAgentFact = {
  id: "archive",
  name: "Archive",
  avatar: null,
  textAvatar: null,
  activeNow: false,
  unreadCount: 0,
  lastActiveAt: 4,
};

function session(partial: Partial<MaidSessionFact> & Pick<MaidSessionFact, "key" | "agentId">) {
  return partial;
}

describe("maid navigation", () => {
  it("lists the atelier shortcuts in reference order", () => {
    expect(MAID_NAV.map((item) => item.id)).toEqual([
      "search",
      "new",
      "quick",
      "approval",
      "projects",
      "services",
      "more",
    ]);
    expect(MAID_NAV.find((item) => item.id === "approval")?.route).toBe("approvals");
    expect(MAID_NAV.find((item) => item.id === "services")?.route).toBe("plugins");
  });
});

describe("buildMaidBoard", () => {
  it("puts the chief first and quiet maids in one independent section", () => {
    const board = buildMaidBoard([notes, harper, archive], [], "harper");
    expect(board.map((section) => section.id)).toEqual(["agent:harper", "independent"]);
    expect(board[0]?.rows.map((row) => row.id)).toEqual(["harper"]);
    expect(board[0]?.rows[0]).toMatchObject({ chief: true, spaces: 0 });
    expect(board[1]?.labelKey).toBe("agentsHome.independentMaids");
    expect(board[1]?.rows.map((row) => row.id)).toEqual(["notes", "archive"]);
  });

  it("nests a maid's chats under her name and counts every space", () => {
    const board = buildMaidBoard(
      [harper, notes],
      [
        session({
          key: "agent:harper:old",
          agentId: "harper",
          displayName: "Old pass",
          updatedAt: 2,
          lastMessagePreview: "Earlier",
        }),
        session({
          key: "agent:harper:chapter",
          agentId: "harper",
          displayName: "Chapter seven",
          updatedAt: 9,
          status: "running",
          lastMessagePreview: "The night market",
        }),
        session({
          key: "agent:harper:gone",
          agentId: "harper",
          archived: true,
          updatedAt: 30,
        }),
      ],
      "harper",
    );
    const chief = board.find((section) => section.id === "agent:harper");
    expect(chief?.rows.map((row) => row.name)).toEqual(["Harper", "Chapter seven", "Old pass"]);
    expect(chief?.rows[0]).toMatchObject({ spaces: 2, kind: "agent" });
    expect(chief?.rows[1]).toMatchObject({
      kind: "session",
      activeNow: true,
      preview: "The night market",
      sessionKey: "agent:harper:chapter",
      faceId: "harper",
      avatar: null,
    });
    expect(board.some((section) => section.id === "agent:notes")).toBe(false);
  });

  it("lifts category names into their own groups", () => {
    const board = buildMaidBoard(
      [harper, notes],
      [
        session({
          key: "agent:harper:site",
          agentId: "harper",
          category: "SCP",
          displayName: "Site log",
          updatedAt: 8,
        }),
        session({
          key: "agent:notes:ifm",
          agentId: "notes",
          category: "IFM",
          label: "Field notes",
          updatedAt: 3,
        }),
        session({
          key: "agent:harper:local",
          agentId: "harper",
          displayName: "Desk",
          updatedAt: 1,
        }),
      ],
      "harper",
    );
    expect(board.map((section) => section.label || section.id)).toEqual(["IFM", "SCP", "Harper"]);
    expect(board.find((section) => section.label === "SCP")?.rows[0]?.name).toBe("Site log");
    expect(
      board.find((section) => section.id === "agent:harper")?.rows.map((row) => row.name),
    ).toEqual(["Harper", "Desk"]);
    expect(board.find((section) => section.id === "agent:harper")?.rows[0]?.spaces).toBe(2);
  });
});

describe("maid checklist", () => {
  it("treats chapter files as manuscript rows", () => {
    expect(maidManuscriptFile("ch07_mud-and-whispers.md")).toBe(true);
    expect(maidManuscriptFile("notes.txt")).toBe(false);
  });

  it("prefers progress steps, then real chapter titles, and leaves an empty queue unlabeled", () => {
    expect(
      maidChecklistModel({
        markdown: "# Pass\nLeave the ending alone.",
        steps: [
          { step: "ch03_dawn-wind.md", status: "completed" },
          { step: "ch07_mud-and-whispers.md", status: "in_progress" },
          { step: "Refine the close", status: "pending" },
        ],
      }),
    ).toMatchObject({
      sample: false,
      log: "Pass",
      items: [
        { label: "ch03_dawn-wind.md", done: true, refine: false },
        { label: "ch07_mud-and-whispers.md", done: false, refine: true },
        { label: "Refine the close", done: false, refine: true },
      ],
    });
    expect(
      maidChecklistModel({
        sessions: [
          session({
            key: "a",
            agentId: "harper",
            displayName: "ch04_in-the-dark.md",
            status: "done",
            updatedAt: 2,
          }),
          session({
            key: "b",
            agentId: "harper",
            label: "Morning",
            updatedAt: 9,
          }),
        ],
      }).items.map((item) => item.label),
    ).toEqual(["ch04_in-the-dark.md"]);
    expect(
      maidChecklistModel({
        sessions: [
          session({
            key: "agent:harper:ch04",
            agentId: "harper",
            displayName: "ch04_in-the-dark.md",
            status: "done",
            updatedAt: 2,
          }),
        ],
      }).items[0],
    ).toMatchObject({
      sessionKey: "agent:harper:ch04",
      label: "ch04_in-the-dark.md",
      done: true,
    });
    expect(
      maidOpenSessionQueue({
        openSessionKey: "agent:harper:main",
        cardReadable: true,
        card: {
          steps: [{ step: "Rewrite the close", status: "pending" }],
        },
        sessions: [
          session({
            key: "agent:harper:ch04",
            agentId: "harper",
            displayName: "ch04_in-the-dark.md",
            updatedAt: 2,
          }),
        ],
      }).items.map((item) => item.label),
    ).toEqual(["Rewrite the close"]);
    expect(
      maidOpenSessionQueue({
        openSessionKey: "agent:harper:main",
        cardReadable: true,
        sessions: [
          session({
            key: "agent:harper:ch04",
            agentId: "harper",
            displayName: "ch04_in-the-dark.md",
            updatedAt: 2,
          }),
        ],
      }).items,
    ).toEqual([]);
    expect(
      maidOpenSessionQueue({
        openSessionKey: "agent:harper:main",
        cardReadable: true,
        card: null,
        sessions: [
          session({
            key: "agent:harper:ch04",
            agentId: "harper",
            displayName: "ch04_in-the-dark.md",
            updatedAt: 2,
          }),
        ],
      }).items[0]?.sessionKey,
    ).toBe("agent:harper:ch04");
    expect(maidChecklistModel({}).sample).toBe(false);
    expect(maidChecklistModel({})).toEqual({ sample: false, log: "", items: [] });
    expect(MAID_SAMPLE_FILES.map((item) => [item.id, item.hold ?? null])).toEqual([
      ["lint", null],
      ["typecheck", null],
      ["approval", "pending"],
      ["deploy", "blocked"],
    ]);
  });
});

describe("maid density fixture", () => {
  it("fills the reference groups without being a live board", () => {
    const sections = maidDensitySections(1_700_000_000_000);
    expect(sections.map((section) => section.label)).toEqual([
      "Ops",
      "Desk",
      "Field",
      "Catalog",
      "Queue",
      "Independent Maids",
    ]);
    expect(sections.every((section) => section.sample)).toBe(true);
    expect(sections.find((section) => section.id === "desk")?.rows[0]).toMatchObject({
      name: "Harper",
      spaces: 5,
      chief: true,
    });
    expect(sections.find((section) => section.id === "ops")?.rows[1]).toMatchObject({
      name: "config diff",
      status: "pending_approval",
    });
    expect(sections.find((section) => section.id === "queue")?.rows[0]).toMatchObject({
      name: "release cut",
      status: "blocked",
    });
  });
});
