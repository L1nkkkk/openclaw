import type { ProgressCard, ProgressCardGetParams } from "@openclaw/gateway-protocol";
import type { GatewaySessionRow } from "../../api/types.ts";
import type { ApplicationGateway } from "../../app/gateway.ts";
import { maidToggledProgressPlan } from "../../components/maid-atelier-board.ts";
import { maidRoomPresentation } from "../../components/maid-atelier-chat.ts";
import {
  dispatchMaidMentionTurn,
  resolveMaidMentionRoute,
  type MaidMentionRoute,
} from "../../components/maid-atelier-mention-route.ts";
import { maidThemeSelected } from "../../components/maid-atelier-theme.ts";
import { t } from "../../i18n/index.ts";
import { registerAgentsHomeEnglish } from "../../i18n/locales/en-agents-home.ts";
import { sessionProgressCardsForGateway } from "../../lib/session-progress-cards.ts";
import { showToast } from "../../lib/toast.ts";
import { setChatError } from "./chat-history-state.ts";
import { clearSubmittedComposerState } from "./chat-send-composer.ts";
import type { ChatPageHost } from "./chat-state-host.ts";

registerAgentsHomeEnglish();

export function maidChatPaneBindings(input: {
  nativeConversation: boolean;
  gateway: ApplicationGateway;
  card: () => ProgressCard | null;
  target: () => ProgressCardGetParams | undefined;
  state: ChatPageHost;
  currentAgentId: string;
  userId?: string | null;
  userName?: string | null;
  session?: GatewaySessionRow | null;
  children?: readonly { key: string; agentId?: string }[];
}): {
  onToggleProgressStep: (index: number) => void;
  routeMention?: () => Promise<boolean>;
} {
  return {
    onToggleProgressStep: (index) => {
      const card = input.card();
      const target = input.target();
      const steps = card?.steps;
      if (!card || !target || !steps) {
        showToast({ message: t("agentsHome.maidTaskToggleFailed") });
        return;
      }
      const plan = maidToggledProgressPlan(steps, index);
      if (!plan) {
        return;
      }
      void sessionProgressCardsForGateway(input.gateway)
        .replace(target, card, plan)
        .then((saved) => {
          if (!saved) {
            showToast({ message: t("agentsHome.maidTaskToggleFailed") });
          }
        });
    },
    routeMention:
      input.nativeConversation && maidThemeSelected()
        ? () =>
            routeMaidGroupMention({
              state: input.state,
              currentAgentId: input.currentAgentId,
              userId: input.userId,
              userName: input.userName,
              session: input.session,
              children: input.children,
            })
        : undefined,
  };
}

/**
 * Claims a Maid group send when the draft @-mentions another room agent.
 * Returns true when this path owns the turn, including a Gateway failure.
 * The current session is not also sent the message.
 */
export async function routeMaidGroupMention(input: {
  state: ChatPageHost;
  currentAgentId: string;
  userId?: string | null;
  userName?: string | null;
  session?: GatewaySessionRow | null;
  children?: readonly { key: string; agentId?: string }[];
}): Promise<boolean> {
  const state = input.state;
  if (state.chatAttachments.length > 0 || state.chatReplyTarget) {
    return false;
  }
  const presented = maidRoomPresentation({
    agentId: input.currentAgentId,
    assistantName: state.assistantName,
    userName: input.userName?.trim() || t("agentsHome.maidRoomYou"),
    userId: input.userId,
    sessionTitle: "",
    agents: state.agentsList?.agents ?? [],
    children: input.children ?? [],
    childKeys: input.session?.childSessions ?? [],
    kind: input.session?.kind,
    chatType: input.session?.chatType,
    participants: input.session?.expandedParticipants ?? input.session?.participants,
    participantCount: input.session?.participantCount,
  });
  if (presented?.room.kind !== "group") {
    return false;
  }
  const route = resolveMaidMentionRoute({
    message: state.chatMessage,
    agents: presented.room.members.flatMap((member) =>
      member.kind === "agent" ? [{ id: member.id, name: member.name }] : [],
    ),
    currentAgentId: input.currentAgentId,
    children: input.children,
    childKeys: input.session?.childSessions,
  });
  if (!route) {
    return false;
  }
  const client = state.client;
  if (!state.connected || !client) {
    setChatError(state, t("agentsHome.maidMentionOffline", { name: route.agent.name }), true);
    return true;
  }
  return sendRoutedMention(state, route, client);
}

async function sendRoutedMention(
  state: ChatPageHost,
  route: MaidMentionRoute,
  client: NonNullable<ChatPageHost["client"]>,
): Promise<boolean> {
  const draft = state.chatMessage;
  const cleared = clearSubmittedComposerState(
    state,
    draft,
    state.chatAttachments,
    state.chatMentions,
    state.chatReplyTarget,
  );
  if (!("previousDraft" in cleared)) {
    return false;
  }
  try {
    const outcome = await dispatchMaidMentionTurn({
      route,
      message: draft,
      parentSessionKey: state.sessionKey,
      dispatch: { request: (method, params) => client.request(method, params) },
    });
    showToast({
      message: t(
        outcome === "main" ? "agentsHome.maidMentionSentMain" : "agentsHome.maidMentionSent",
        { name: route.agent.name },
      ),
    });
    setChatError(state, null, true);
  } catch {
    if (state.chatMessage === "") {
      state.chatMessage = cleared.previousDraft ?? draft;
      state.chatMentions = cleared.previousMentions ?? [];
      state.chatReplyTarget = cleared.previousReplyTarget ?? null;
      if (cleared.previousAttachments) {
        state.chatAttachments = cleared.previousAttachments;
      }
    }
    setChatError(state, t("agentsHome.maidMentionFailed", { name: route.agent.name }), true);
  }
  return true;
}
