import { parseAgentSessionKey } from "../lib/sessions/session-key.ts";

export type MaidChatPlacement = "none" | "footer" | "gutter";

/**
 * Maid conversations keep the real user and the real agents on the avatar
 * layout, whether the room is a private chat or a group. Subagent rows stay
 * avatarless. Other themes are unchanged.
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

export type MaidRoomMember = {
  id: string;
  name: string;
  kind: "user" | "agent";
};

export type MaidRoom = {
  kind: "dm" | "group";
  title: string;
  memberCount: number;
  members: readonly MaidRoomMember[];
};

export type MaidRoomAgent = {
  id: string;
  name: string;
};

type AgentRef = {
  id: string;
  name?: string;
  kind?: string;
  identity?: { name?: string };
};

type PersonRef = {
  identity: { type: string; id: string };
  label?: string;
};

type ChildRef = {
  key: string;
  agentId?: string;
};

function named(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function agentLabel(agents: readonly AgentRef[], id: string): string | undefined {
  const agent = agents.find((entry) => entry.id === id);
  return named(agent?.name) ?? named(agent?.identity?.name);
}

/** A portrait URL the room can show. Emoji and initials are not images. */
export function maidPortraitUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }
  return null;
}

/** Append the ask to an in-progress draft. The user still sends it. */
export function maidPullDraft(current: string, ask: string): string {
  return current.trim() ? `${current.replace(/\s+$/, "")}\n${ask}` : ask;
}

/**
 * Private chat is the selected agent and the user. A group is that pair plus
 * agents this session has actually pulled in, or a session that is already shared.
 */
export function maidRoomPresentation(input: {
  agentId: string;
  assistantName: string;
  userName: string;
  userId?: string | null;
  sessionTitle: string;
  agents: readonly AgentRef[];
  children: readonly ChildRef[];
  childKeys: readonly string[];
  kind?: string | null;
  chatType?: string | null;
  participants?: readonly PersonRef[] | null;
  participantCount?: number;
}): { room: MaidRoom; candidates: readonly MaidRoomAgent[] } | null {
  const agentId = input.agentId.trim();
  const assistantName = named(input.assistantName);
  if (!agentId && !assistantName) {
    return null;
  }
  const id = agentId || "assistant";
  const name = assistantName || agentLabel(input.agents, id) || id;
  const pulled = new Map<string, MaidRoomAgent>();
  const addAgent = (rawId: string | undefined) => {
    const next = named(rawId);
    if (!next) {
      return;
    }
    const key = next.toLowerCase();
    if (key === id.toLowerCase() || pulled.has(key)) {
      return;
    }
    pulled.set(key, { id: next, name: agentLabel(input.agents, next) ?? next });
  };
  for (const child of input.children) {
    addAgent(child.agentId ?? parseAgentSessionKey(child.key)?.agentId);
  }
  for (const key of input.childKeys) {
    addAgent(parseAgentSessionKey(key)?.agentId);
  }
  const others: MaidRoomMember[] = [];
  for (const person of input.participants ?? []) {
    if (person.identity.type === "agent") {
      addAgent(person.identity.id);
      continue;
    }
    if (person.identity.type === "profile" && person.identity.id === input.userId) {
      continue;
    }
    if (others.some((entry) => entry.id === person.identity.id)) {
      continue;
    }
    others.push({
      id: person.identity.id,
      name: named(person.label) ?? person.identity.id,
      kind: "user",
    });
  }
  const members: MaidRoomMember[] = [
    { id: named(input.userId) || "user", name: named(input.userName) || "You", kind: "user" },
    { id, name, kind: "agent" },
  ];
  for (const agent of pulled.values()) {
    members.push({ id: agent.id, name: agent.name, kind: "agent" });
  }
  members.push(...others);
  const grouped =
    input.kind === "group" ||
    input.chatType === "group" ||
    input.chatType === "channel" ||
    pulled.size > 0 ||
    others.length > 0;
  const reported = input.participantCount;
  const present = new Set(
    members.filter((member) => member.kind === "agent").map((member) => member.id.toLowerCase()),
  );
  const candidates: MaidRoomAgent[] = [];
  for (const agent of input.agents) {
    if (agent.kind === "system" || present.has(agent.id.toLowerCase())) {
      continue;
    }
    const label = agentLabel(input.agents, agent.id);
    if (!label) {
      continue;
    }
    candidates.push({ id: agent.id, name: label });
  }
  return {
    room: {
      kind: grouped ? "group" : "dm",
      title: grouped ? named(input.sessionTitle) || name : name,
      memberCount: reported != null && reported > members.length ? reported : members.length,
      members,
    },
    candidates,
  };
}
