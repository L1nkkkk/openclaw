import { describe, expect, it, vi } from "vitest";
import {
  dispatchMaidMentionTurn,
  resolveMaidMentionRoute,
  type MaidMentionDispatch,
} from "./maid-atelier-mention-route.ts";
import type { MaidMentionAgent } from "./maid-atelier-mentions.ts";

const agents: MaidMentionAgent[] = [
  { id: "harper", name: "Harper" },
  { id: "notes", name: "Notes" },
  { id: "ann", name: "Ann" },
  { id: "anna", name: "Anna" },
];

function dispatch(): MaidMentionDispatch & { request: ReturnType<typeof vi.fn> } {
  return { request: vi.fn(async () => ({ ok: true })) };
}

describe("resolveMaidMentionRoute", () => {
  it("routes the first other agent and prefers that agent's child session", () => {
    expect(
      resolveMaidMentionRoute({
        message: "Ask @Notes then @Harper",
        agents,
        currentAgentId: "harper",
        children: [{ key: "agent:notes:room", agentId: "notes" }],
      }),
    ).toEqual({ agent: agents[1], childKey: "agent:notes:room" });
  });

  it("leaves the current agent, slash commands, and unknown names on this session", () => {
    expect(
      resolveMaidMentionRoute({
        message: "@Harper please",
        agents,
        currentAgentId: "harper",
      }),
    ).toBeNull();
    expect(
      resolveMaidMentionRoute({
        message: "/ask @Notes",
        agents,
        currentAgentId: "harper",
      }),
    ).toBeNull();
    expect(
      resolveMaidMentionRoute({
        message: "@Mori",
        agents,
        currentAgentId: "harper",
      }),
    ).toBeNull();
  });

  it("uses a child key whose agent id matches, including keys listed only on the session", () => {
    expect(
      resolveMaidMentionRoute({
        message: "@Anna",
        agents,
        currentAgentId: "harper",
        children: [{ key: "agent:harper:subagent:anna", agentId: "harper" }],
        childKeys: ["agent:anna:main"],
      })?.childKey,
    ).toBe("agent:anna:main");
  });
});

describe("dispatchMaidMentionTurn", () => {
  it("sends an existing child session and does not also create one", async () => {
    const client = dispatch();
    await expect(
      dispatchMaidMentionTurn({
        route: { agent: agents[1]!, childKey: "agent:notes:room" },
        message: "@Notes look",
        parentSessionKey: "agent:harper:main",
        dispatch: client,
      }),
    ).resolves.toBe("child");
    expect(client.request).toHaveBeenCalledExactlyOnceWith("sessions.send", {
      key: "agent:notes:room",
      message: "@Notes look",
      idempotencyKey: expect.any(String),
    });
  });

  it("creates a child of the open room when the agent has none", async () => {
    const client = dispatch();
    await expect(
      dispatchMaidMentionTurn({
        route: { agent: agents[1]! },
        message: "@Notes look",
        parentSessionKey: "agent:harper:main",
        dispatch: client,
      }),
    ).resolves.toBe("created");
    expect(client.request).toHaveBeenCalledExactlyOnceWith("sessions.create", {
      agentId: "notes",
      parentSessionKey: "agent:harper:main",
      message: "@Notes look",
      idempotencyKey: expect.any(String),
    });
  });

  it("sends the agent's main session when creating a child fails", async () => {
    const client = dispatch();
    client.request.mockRejectedValueOnce(new Error("parent busy"));
    await expect(
      dispatchMaidMentionTurn({
        route: { agent: agents[1]! },
        message: "@Notes look",
        parentSessionKey: "agent:harper:main",
        dispatch: client,
      }),
    ).resolves.toBe("main");
    expect(client.request.mock.calls.map((call) => call[0])).toEqual([
      "sessions.create",
      "sessions.send",
    ]);
    expect(client.request.mock.calls[1]?.[1]).toMatchObject({
      key: "agent:notes:main",
      message: "@Notes look",
    });
  });

  it("does not create a session when the existing child send fails", async () => {
    const client = dispatch();
    client.request.mockRejectedValueOnce(new Error("missing"));
    await expect(
      dispatchMaidMentionTurn({
        route: { agent: agents[1]!, childKey: "agent:notes:room" },
        message: "@Notes look",
        parentSessionKey: "agent:harper:main",
        dispatch: client,
      }),
    ).rejects.toThrow("missing");
    expect(client.request).toHaveBeenCalledOnce();
  });
});
