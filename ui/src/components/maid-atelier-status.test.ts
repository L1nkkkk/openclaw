import { describe, expect, it } from "vitest";
import {
  maidClip,
  maidIdentityTheme,
  maidPresenceHold,
  maidSessionSummaries,
  maidTone,
  readMaidGoal,
  resolveMaidProgress,
  summarizeMaidSessions,
} from "./maid-atelier-status.ts";

describe("maidTone", () => {
  it("marks a live run busy ahead of unread or a finished status", () => {
    expect(maidTone({ activeNow: true, unreadCount: 3, status: "done" })).toBe("busy");
    expect(maidTone({ activeNow: false, unreadCount: 0, status: "queued" })).toBe("busy");
  });

  it("marks unread and failed runs as attention", () => {
    expect(maidTone({ activeNow: false, unreadCount: 1 })).toBe("attention");
    expect(maidTone({ activeNow: false, unreadCount: 0, status: "failed" })).toBe("attention");
    expect(maidTone({ activeNow: false, unreadCount: 0, failed: true })).toBe("attention");
  });

  it("marks a finished quiet run as success and everything else idle", () => {
    expect(maidTone({ activeNow: false, unreadCount: 0, status: "done" })).toBe("success");
    expect(maidTone({ activeNow: false, unreadCount: 0 })).toBe("idle");
  });

  it("keeps blocked and pending approval off the busy pip", () => {
    expect(maidTone({ activeNow: true, unreadCount: 0, status: "blocked" })).toBe("blocked");
    expect(maidTone({ activeNow: true, unreadCount: 1, status: "pending_approval" })).toBe(
      "pending",
    );
    expect(maidTone({ activeNow: false, unreadCount: 0, status: "pending-approval" })).toBe(
      "pending",
    );
    expect(maidPresenceHold("pending_approval")).toBe("pending");
    expect(maidPresenceHold("blocked")).toBe("blocked");
    expect(maidTone({ activeNow: true, unreadCount: 0, status: "running" })).toBe("busy");
  });
});

describe("maid session facts", () => {
  const rows = [
    {
      key: "agent:harper:main",
      agentId: "harper",
      pinned: true,
      status: "done",
      updatedAt: 10,
      displayName: "Chapter notes",
      lastMessagePreview: "ignored",
    },
    {
      key: "agent:harper:side",
      agentId: "harper",
      status: "failed",
      lastRunError: "stopped",
      updatedAt: 4,
    },
    { key: "agent:notes:main", agentId: "notes", archived: true, pinned: true, updatedAt: 30 },
    { key: "agent:archive:main", agentId: "archive", updatedAt: 1, label: "14 open tabs" },
  ];

  it("keeps the latest row and any pin for each agent", () => {
    const summaries = maidSessionSummaries(rows, "main", (row) => row.agentId ?? "main");
    expect(summaries.get("harper")).toEqual({
      pinned: true,
      status: "done",
      failed: false,
      label: "Chapter notes",
    });
    expect(summaries.get("archive")).toMatchObject({ pinned: false, label: "14 open tabs" });
    expect(summaries.has("notes")).toBe(false);
  });

  it("treats a latest failed run as attention even without unread", () => {
    expect(
      summarizeMaidSessions([{ key: "a", status: "failed", lastRunError: "no", updatedAt: 2 }]),
    ).toMatchObject({ failed: true, status: "failed" });
  });
});

describe("maid progress", () => {
  it("uses progress-card steps for the fraction and current target", () => {
    expect(
      resolveMaidProgress({
        steps: [
          { step: "Outline the volume", status: "completed" },
          { step: "Rewrite chapter four", status: "in_progress" },
          { step: "Check the diff", status: "pending" },
        ],
        title: "Ignored title",
      }),
    ).toEqual({
      source: "progress",
      target: "Rewrite chapter four",
      tone: "working",
      completed: 1,
      total: 3,
    });
  });

  it("marks a finished card completed", () => {
    expect(
      resolveMaidProgress({
        steps: [{ step: "Ship the notes", status: "completed" }],
        activeRun: true,
      }).tone,
    ).toBe("completed");
  });

  it("prefers a goal over the session title", () => {
    expect(
      resolveMaidProgress({
        goal: { objective: "Finish the rewrite", status: "complete", lastStatusNote: "Volume 1" },
        title: "Chat",
      }),
    ).toMatchObject({
      source: "goal",
      target: "Volume 1",
      tone: "completed",
      completed: 1,
      total: 1,
    });
  });

  it("falls back to the session title, then an empty strip", () => {
    expect(resolveMaidProgress({ title: "Harper", sessionStatus: "done" })).toMatchObject({
      source: "session",
      target: "Harper",
      tone: "completed",
      completed: 1,
      total: 1,
    });
    expect(resolveMaidProgress({})).toEqual({
      source: "empty",
      target: "",
      tone: "idle",
      completed: 0,
      total: 0,
    });
  });

  it("reads a goal object without requiring it on the list row type", () => {
    expect(readMaidGoal({ goal: { objective: "  Keep going  ", status: "active" } })).toEqual({
      objective: "Keep going",
      status: "active",
      lastStatusNote: undefined,
    });
    expect(readMaidGoal({ status: "done" })).toBeNull();
  });
});

describe("maid copy helpers", () => {
  it("drops theme tokens and clips a long snippet", () => {
    expect(maidIdentityTheme("manuscript editor")).toBe("manuscript editor");
    expect(maidIdentityTheme("maid-light")).toBeNull();
    expect(maidClip("one two three", 7)).toBe("one tw…");
  });
});
