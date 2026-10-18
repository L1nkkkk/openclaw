import { describe, expect, it } from "vitest";
import { presentMaidChat } from "./maid-atelier-chat.ts";

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

  it("shows the real user and agent as a group chat", () => {
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
