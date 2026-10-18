import { describe, expect, it } from "vitest";
import type { MaidMentionAgent } from "../../../components/maid-atelier-mentions.ts";
import { MaidAgentMentionMenu, maintainComposerMentions } from "./maid-agent-mention-menu.ts";

const agents: MaidMentionAgent[] = [
  { id: "harper", name: "Harper" },
  { id: "notes", name: "Notes" },
];

function host(
  draft = "@",
  initialMentions: { profileId: string; start: number; end: number }[] = [],
) {
  let value = draft;
  let mentions = initialMentions;
  return {
    paneId: "pane",
    getDraft: () => value,
    getMentions: () => mentions,
    getTextarea: () => null,
    commitDraft: (next: string, nextMentions?: typeof mentions) => {
      value = next;
      if (nextMentions) {
        mentions = [...nextMentions];
      }
    },
    read: () => ({ value, mentions }),
  };
}

function human() {
  const calls: string[] = [];
  return {
    open: false,
    calls,
    close() {
      this.open = false;
    },
    update(_input: unknown, _request: () => void, intent: string) {
      this.open = true;
      calls.push(intent);
    },
  };
}

describe("MaidAgentMentionMenu", () => {
  it("lists group agents from @ and inserts the name without a profile mention", () => {
    const menu = new MaidAgentMentionMenu();
    menu.syncAgents(agents);
    const updates: number[] = [];
    menu.update(
      { value: "@", selectionStart: 1, selectionEnd: 1 },
      () => updates.push(1),
      "trigger",
    );
    expect(menu.open).toBe(true);
    expect(menu.choices.map((agent) => agent.id)).toEqual(["harper", "notes"]);

    const event = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
    const draft = host("@");
    expect(menu.handleKeydown(event, draft, () => undefined)).toBe(true);
    expect(menu.index).toBe(1);
    menu.commit(draft, () => undefined);
    expect(draft.read().value).toBe("@Notes ");
    expect(draft.read().mentions).toEqual([]);
    expect(menu.open).toBe(false);
  });

  it("keeps an existing human mention and does not add the agent as a profile", () => {
    const menu = new MaidAgentMentionMenu();
    const draft = host("@Mori @N", [{ profileId: "profile-mori", start: 0, end: 5 }]);
    menu.syncAgents(agents);
    const caret = draft.getDraft().length;
    menu.update(
      { value: draft.getDraft(), selectionStart: caret, selectionEnd: caret },
      () => undefined,
      "trigger",
    );
    menu.commit(draft, () => undefined);
    expect(draft.read().value).toBe("@Mori @Notes ");
    expect(draft.read().mentions.map((mention) => mention.profileId)).toEqual(["profile-mori"]);
  });
});

describe("maintainComposerMentions", () => {
  it("gives a group @ to the agent picker and leaves private @ on the people menu", () => {
    const maid = new MaidAgentMentionMenu();
    const people = human();
    const state = { mentionMenu: people, maidMentionMenu: maid };
    const input = { value: "@", selectionStart: 1, selectionEnd: 1 };
    maintainComposerMentions(state, agents, input, () => undefined, "trigger");
    expect(maid.open).toBe(true);
    expect(people.calls).toEqual([]);

    people.open = true;
    maid.close();
    maid.syncAgents([]);
    maintainComposerMentions(state, [], input, () => undefined, "trigger");
    expect(maid.open).toBe(false);
    expect(people.calls).toEqual(["trigger"]);
  });
});
