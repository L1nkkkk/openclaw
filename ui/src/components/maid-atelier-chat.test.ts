import { describe, expect, it } from "vitest";
import { maidPullDraft, maidRoomPresentation, presentMaidChat } from "./maid-atelier-chat.ts";

describe("presentMaidChat", () => {
  it("leaves other themes on the transcript's own placement", () => {
    expect(
      presentMaidChat({
        maid: false,
        avatarPlacement: "footer",
        showOwnSenderName: false,
      }),
    ).toEqual({
      avatarPlacement: "footer",
      isDirectThread: true,
      showOwnSenderName: false,
    });
  });

  it("keeps avatars for a private chat and a group", () => {
    expect(
      presentMaidChat({
        maid: true,
        avatarPlacement: "footer",
        showOwnSenderName: false,
      }),
    ).toEqual({
      avatarPlacement: "gutter",
      isDirectThread: false,
      showOwnSenderName: true,
    });
  });

  it("keeps avatarless subagent rows avatarless", () => {
    expect(
      presentMaidChat({
        maid: true,
        avatarPlacement: "none",
        showOwnSenderName: false,
      }),
    ).toEqual({
      avatarPlacement: "none",
      isDirectThread: true,
      showOwnSenderName: false,
    });
  });
});

const agents = [
  { id: "harper", name: "Harper" },
  { id: "notes", name: "Notes" },
  { id: "archive", name: "Archive" },
  { id: "system", name: "System", kind: "system" as const },
];

describe("maidRoomPresentation", () => {
  it("starts as a private chat with the selected agent", () => {
    const presented = maidRoomPresentation({
      agentId: "harper",
      assistantName: "Harper",
      userName: "Mori",
      userId: "mori",
      sessionTitle: "Chapter seven",
      agents,
      children: [{ key: "agent:harper:subagent:self", agentId: "harper" }],
      childKeys: [],
      kind: "direct",
    });
    expect(presented?.room).toMatchObject({
      kind: "dm",
      title: "Harper",
      memberCount: 2,
    });
    expect(presented?.room.members.map((member) => member.name)).toEqual(["Mori", "Harper"]);
    expect(presented?.candidates.map((agent) => agent.name)).toEqual(["Notes", "Archive"]);
  });

  it("becomes a group once another agent has been pulled in", () => {
    const presented = maidRoomPresentation({
      agentId: "harper",
      assistantName: "",
      userName: "Mori",
      sessionTitle: "Chapter seven",
      agents,
      children: [],
      childKeys: ["agent:notes:subagent:margin"],
      kind: "direct",
    });
    expect(presented?.room).toMatchObject({
      kind: "group",
      title: "Chapter seven",
      memberCount: 3,
    });
    expect(presented?.room.members.map((member) => member.id)).toEqual(["user", "harper", "notes"]);
    expect(presented?.candidates.map((agent) => agent.id)).toEqual(["archive"]);
  });

  it("counts a shared session as a group without inventing members", () => {
    const presented = maidRoomPresentation({
      agentId: "harper",
      assistantName: "Harper",
      userName: "Mori",
      userId: "mori",
      sessionTitle: "",
      agents,
      children: [],
      childKeys: [],
      kind: "group",
      participants: [
        { identity: { type: "profile", id: "mori" }, label: "Mori" },
        { identity: { type: "profile", id: "ada" }, label: "Ada" },
      ],
      participantCount: 6,
    });
    expect(presented?.room.kind).toBe("group");
    expect(presented?.room.title).toBe("Harper");
    expect(presented?.room.memberCount).toBe(6);
    expect(presented?.room.members.map((member) => member.name)).toEqual(["Mori", "Harper", "Ada"]);
  });

  it("returns nothing until an agent is selected", () => {
    expect(
      maidRoomPresentation({
        agentId: "",
        assistantName: "  ",
        userName: "Mori",
        sessionTitle: "",
        agents,
        children: [],
        childKeys: [],
      }),
    ).toBeNull();
  });
});

describe("maidPullDraft", () => {
  it("asks the main agent without erasing an existing draft", () => {
    expect(maidPullDraft("", "Pull Notes into this conversation.")).toBe(
      "Pull Notes into this conversation.",
    );
    expect(maidPullDraft("Leave the ending.", "Pull Notes into this conversation.")).toBe(
      "Leave the ending.\nPull Notes into this conversation.",
    );
  });
});
