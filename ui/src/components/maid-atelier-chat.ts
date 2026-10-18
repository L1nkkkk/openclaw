export type MaidChatPlacement = "none" | "footer" | "gutter";

/**
 * Maid conversations keep the real user and the real agents, and present them
 * as a group chat. Subagent rows stay avatarless. Other themes are unchanged.
 */
export function presentMaidChat(input: {
  maid: boolean;
  avatarPlacement: MaidChatPlacement;
  showOwnSenderName: boolean;
}): {
  avatarPlacement: MaidChatPlacement;
  isDirectThread: boolean;
  showOwnSenderName: boolean;
} {
  if (!input.maid || input.avatarPlacement === "none") {
    return {
      avatarPlacement: input.avatarPlacement,
      isDirectThread: input.avatarPlacement !== "gutter",
      showOwnSenderName: input.showOwnSenderName,
    };
  }
  return {
    avatarPlacement: "gutter",
    isDirectThread: false,
    showOwnSenderName: true,
  };
}
