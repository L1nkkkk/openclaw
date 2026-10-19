import { describe, expect, it } from "vitest";
import {
  acceptedMaidPortrait,
  maidAvatarAtelierSrc,
  maidPortraitChoiceLabel,
} from "./maid-atelier-avatar.ts";
import { maidPortraitSrc, MAID_PORTRAIT_SRCS } from "./maid-atelier-portraits.ts";

describe("maid avatar choices", () => {
  it("accepts only the bundled portraits", () => {
    expect(acceptedMaidPortrait(MAID_PORTRAIT_SRCS[0] ?? "")).toBe(MAID_PORTRAIT_SRCS[0]);
    expect(acceptedMaidPortrait("https://example.test/face.jpg")).toBeNull();
    expect(acceptedMaidPortrait("/maid-avatars/99.jpg")).toBeNull();
  });

  it("offers the agent's atelier portrait and no portrait for the user", () => {
    const agent = { kind: "agent" as const, id: "harper", name: "Harper", custom: true };
    expect(maidAvatarAtelierSrc(agent)).toBe(maidPortraitSrc("harper"));
    expect(
      maidAvatarAtelierSrc({ kind: "user", id: "mori", name: "Mori", custom: true }),
    ).toBeNull();
    expect(maidPortraitChoiceLabel(MAID_PORTRAIT_SRCS[2] ?? "")).toBe("3");
  });
});
