import { handleComposerMenuKeydown } from "../../../components/composer-menu.ts";
import {
  applyMaidMention,
  findMaidMentionTarget,
  maidMentionChoices,
  type MaidMentionAgent,
  type MaidMentionTarget,
} from "../../../components/maid-atelier-mentions.ts";
import type { HumanMention } from "../../../lib/chat/chat-types.ts";
import { updateHumanMentions } from "../../../lib/chat/human-mentions.ts";
import { paneDomId } from "./chat-composer-dom.ts";
import type { HumanMentionMenu } from "./chat-composer-mention-menu.tsx";

export type MaidMentionHost = {
  paneId: string;
  getDraft: () => string;
  getMentions: () => readonly HumanMention[];
  getTextarea: () => HTMLTextAreaElement | null;
  commitDraft: (value: string, mentions?: readonly HumanMention[]) => void;
};

type MentionIntent = "input" | "trigger" | "selection";

/** One @ picker for agents already in a maid group. It never writes a profile id. */
export class MaidAgentMentionMenu {
  private agents: readonly MaidMentionAgent[] = [];
  private target: MaidMentionTarget | null = null;
  private matched: readonly MaidMentionAgent[] = [];
  private cursor = 0;
  private selectedId: string | undefined;

  get open(): boolean {
    return this.target !== null && this.matched.length > 0;
  }

  /** True for the whole @ span, including a query that matches nobody. */
  get ownsInvocation(): boolean {
    return this.target !== null;
  }

  get choices(): readonly MaidMentionAgent[] {
    return this.matched;
  }

  get index(): number {
    return this.cursor;
  }

  syncAgents(agents: readonly MaidMentionAgent[] | undefined) {
    const next = agents ?? [];
    if (
      next.length === this.agents.length &&
      next.every((agent, index) => {
        const current = this.agents[index];
        return (
          current?.id === agent.id &&
          current.name === agent.name &&
          current.portraitUrl === agent.portraitUrl
        );
      })
    ) {
      return;
    }
    this.agents = next;
    if (!next.length) {
      this.close();
      return;
    }
    if (this.target) {
      this.refresh();
    }
  }

  close() {
    this.target = null;
    this.matched = [];
    this.cursor = 0;
    this.selectedId = undefined;
  }

  update(
    input: Pick<HTMLTextAreaElement, "value" | "selectionStart" | "selectionEnd">,
    requestUpdate: () => void,
    intent: MentionIntent = "selection",
  ) {
    if (!this.agents.length) {
      if (this.target) {
        this.close();
        requestUpdate();
      }
      return;
    }
    const { value, selectionStart: caret, selectionEnd } = input;
    const target = findMaidMentionTarget(value, caret);
    const leftTarget =
      intent === "selection" &&
      this.target !== null &&
      (value !== this.target.value ||
        target?.start !== this.target.start ||
        selectionEnd > this.target.end);
    if (!target || leftTarget || (!this.target && intent !== "trigger")) {
      if (this.target) {
        this.close();
        requestUpdate();
      }
      return;
    }
    const previous = this.target;
    if (previous?.start === target.start && intent !== "trigger") {
      target.end = Math.max(target.end, previous.end + value.length - previous.value.length);
    }
    if (previous?.start !== target.start) {
      this.selectedId = undefined;
    }
    const same =
      previous?.start === target.start &&
      previous.query === target.query &&
      previous.value === target.value &&
      previous.end === target.end;
    this.target = target;
    if (same) {
      return;
    }
    const wasOpen = this.open;
    this.refresh();
    if (this.open || wasOpen) {
      requestUpdate();
    }
  }

  hover(index: number, requestUpdate: () => void) {
    if (index === this.cursor || !this.matched[index]) {
      return;
    }
    this.cursor = index;
    this.selectedId = this.matched[index]?.id;
    requestUpdate();
  }

  activeId(paneId: string): string | null {
    return this.open ? paneDomId(paneId, `maid-mention-option-${this.cursor}`) : null;
  }

  activeLabel(): string {
    return this.matched[this.cursor]?.name ?? "";
  }

  handleKeydown(event: KeyboardEvent, host: MaidMentionHost, requestUpdate: () => void): boolean {
    if (!this.open || event.defaultPrevented || event.isComposing || event.keyCode === 229) {
      return false;
    }
    const choices = this.matched;
    return handleComposerMenuKeydown(event, {
      count: choices.length,
      index: this.cursor,
      consumeEmpty: true,
      close: () => {
        this.close();
        requestUpdate();
      },
      move: (index) => {
        this.cursor = index;
        this.selectedId = choices[index]?.id;
        requestUpdate();
        return this.activeId(host.paneId);
      },
      select: () => this.commit(host, requestUpdate),
    });
  }

  commit(host: MaidMentionHost, requestUpdate: () => void) {
    const agent = this.matched[this.cursor];
    const textarea = host.getTextarea();
    const current = textarea?.value ?? host.getDraft();
    this.update(
      textarea ?? { value: current, selectionStart: current.length, selectionEnd: current.length },
      requestUpdate,
    );
    const target = this.target;
    if (!agent || !target) {
      return;
    }
    const applied = applyMaidMention(current, target, agent);
    const mentions = host.getMentions();
    host.commitDraft(
      applied.value,
      mentions.length
        ? updateHumanMentions(current, applied.value, mentions, {
            value: current,
            start: target.start,
            end: target.end,
            inputType: "insertReplacementText",
          })
        : undefined,
    );
    this.close();
    requestUpdate();
    queueMicrotask(() => {
      const node = host.getTextarea();
      node?.focus({ preventScroll: true });
      node?.setSelectionRange(applied.caret, applied.caret);
    });
  }

  private refresh() {
    const query = this.target?.query ?? "";
    const choices = maidMentionChoices(this.agents, query);
    this.matched = choices;
    const found = choices.findIndex((agent) => agent.id === this.selectedId);
    this.cursor = Math.max(found, 0);
    this.selectedId = choices[this.cursor]?.id;
  }
}

export function maidMentionComposerHost(
  props: {
    paneId: string;
    draft: string;
    getDraft?: () => string;
    mentions?: readonly HumanMention[];
    getMentions?: () => readonly HumanMention[];
    onTypingChange?: (typing: boolean, preview?: string) => void;
  },
  state: { composerTextarea: HTMLTextAreaElement | null },
  commitDraft: (value: string, mentions?: readonly HumanMention[]) => void,
): MaidMentionHost {
  return {
    paneId: props.paneId,
    getDraft: () => state.composerTextarea?.value ?? props.getDraft?.() ?? props.draft,
    getMentions: () => props.getMentions?.() ?? props.mentions ?? [],
    getTextarea: () => state.composerTextarea,
    commitDraft: (value, mentions) => {
      commitDraft(value, mentions);
      props.onTypingChange?.(Boolean(value.trim()), value);
    },
  };
}

type MentionMenus = {
  mentionMenu: Pick<HumanMentionMenu, "open" | "close" | "update">;
  maidMentionMenu: MaidAgentMentionMenu;
};

/** The group picker owns an @ invocation so the people menu does not stack on it. */
export function maintainComposerMentions(
  state: MentionMenus,
  agents: readonly MaidMentionAgent[] | undefined,
  target: Pick<HTMLTextAreaElement, "value" | "selectionStart" | "selectionEnd"> | null,
  requestUpdate: () => void,
  intent: MentionIntent | "close",
): void {
  if (intent === "close" || !target) {
    const open = state.mentionMenu.open || state.maidMentionMenu.open;
    state.mentionMenu.close();
    state.maidMentionMenu.close();
    if (open) {
      requestUpdate();
    }
    return;
  }
  state.maidMentionMenu.syncAgents(agents);
  if ((agents?.length ?? 0) > 0) {
    state.maidMentionMenu.update(target, requestUpdate, intent);
  } else if (state.maidMentionMenu.ownsInvocation) {
    state.maidMentionMenu.close();
    requestUpdate();
  }
  if (state.maidMentionMenu.ownsInvocation) {
    if (state.mentionMenu.open) {
      state.mentionMenu.close();
      requestUpdate();
    }
    return;
  }
  state.mentionMenu.update(target, requestUpdate, intent);
}
