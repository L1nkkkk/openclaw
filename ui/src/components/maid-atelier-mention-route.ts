import { buildAgentMainSessionKey, parseAgentSessionKey } from "../lib/sessions/session-key.ts";
import { generateUUID } from "../lib/uuid.ts";
import { maidMentionTokens, type MaidMentionAgent } from "./maid-atelier-mentions.ts";

/**
 * A group room has one owning agent. @Name starts that other agent's turn on
 * their child of this room, or on their main session when a child cannot be
 * created. The group transcript cannot show the reply. The first matching
 * name wins. Later names, agents outside the room, slash commands, attachments,
 * and replies stay with the current session. Session members are access, not
 * a turn, so this path does not call sessions.members.add.
 */
export type MaidMentionRoute = {
  agent: MaidMentionAgent;
  childKey?: string;
};

export type MaidMentionDispatch = {
  request: (method: string, params: unknown) => Promise<unknown>;
  newIdempotencyKey?: () => string;
  mainSessionKey?: (agentId: string) => string;
};

type ChildRef = {
  key: string;
  agentId?: string | null;
};

function sameAgent(left: string | null | undefined, right: string): boolean {
  const id = left?.trim().toLowerCase();
  return Boolean(id) && id === right.trim().toLowerCase();
}

function childSessionKey(
  agentId: string,
  children: readonly ChildRef[],
  childKeys: readonly string[],
): string | undefined {
  for (const child of children) {
    const key = child.key.trim();
    const owner = child.agentId ?? parseAgentSessionKey(key)?.agentId;
    if (key && sameAgent(owner, agentId)) {
      return key;
    }
  }
  for (const key of childKeys) {
    const trimmed = key.trim();
    if (trimmed && sameAgent(parseAgentSessionKey(trimmed)?.agentId, agentId)) {
      return trimmed;
    }
  }
  return undefined;
}

/** First @ that names another agent already in the room. */
export function resolveMaidMentionRoute(input: {
  message: string;
  agents: readonly MaidMentionAgent[];
  currentAgentId: string;
  children?: readonly ChildRef[];
  childKeys?: readonly string[];
}): MaidMentionRoute | null {
  if (input.message.trimStart().startsWith("/")) {
    return null;
  }
  const token = maidMentionTokens(input.message, input.agents)[0];
  if (!token || sameAgent(token.agent.id, input.currentAgentId)) {
    return null;
  }
  const childKey = childSessionKey(token.agent.id, input.children ?? [], input.childKeys ?? []);
  return childKey ? { agent: token.agent, childKey } : { agent: token.agent };
}

/** Child send, else create a child of this room, else that agent's main session. */
export async function dispatchMaidMentionTurn(input: {
  route: MaidMentionRoute;
  message: string;
  parentSessionKey: string;
  dispatch: MaidMentionDispatch;
}): Promise<"child" | "created" | "main"> {
  const idempotencyKey = () => input.dispatch.newIdempotencyKey?.() ?? generateUUID();
  const mainKey =
    input.dispatch.mainSessionKey?.(input.route.agent.id) ??
    buildAgentMainSessionKey({ agentId: input.route.agent.id });
  if (input.route.childKey) {
    const qualified = parseAgentSessionKey(input.route.childKey);
    await input.dispatch.request("sessions.send", {
      key: input.route.childKey,
      message: input.message,
      idempotencyKey: idempotencyKey(),
      ...(qualified ? {} : { agentId: input.route.agent.id }),
    });
    return "child";
  }
  try {
    await input.dispatch.request("sessions.create", {
      agentId: input.route.agent.id,
      parentSessionKey: input.parentSessionKey,
      message: input.message,
      idempotencyKey: idempotencyKey(),
    });
    return "created";
  } catch {
    await input.dispatch.request("sessions.send", {
      key: mainKey,
      message: input.message,
      idempotencyKey: idempotencyKey(),
    });
    return "main";
  }
}
