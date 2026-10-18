import { createMemo, For, Show } from "solid-js";
import { t } from "../lib/reactive/i18n.ts";
import "../styles/maid-atelier-chrome.css";
import {
  maidMentionTokens,
  type MaidMentionAgent,
  type MaidMentionToken,
} from "./maid-atelier-mentions.ts";

export function MaidMentionChip(props: { agent: MaidMentionAgent; onRemove?: () => void }) {
  const face = () => props.agent.portraitUrl;
  const body = () => (
    <>
      <Show
        when={face()}
        fallback={
          <span class="maid-atelier-mention__face" aria-hidden="true">
            {props.agent.name.slice(0, 1).toUpperCase()}
          </span>
        }
      >
        <img class="maid-atelier-mention__face" src={face() ?? undefined} alt="" />
      </Show>
      <span>@{props.agent.name}</span>
    </>
  );
  return (
    <Show
      when={props.onRemove}
      fallback={
        <span class="maid-atelier-mention" data-maid-mention={props.agent.id}>
          {body()}
        </span>
      }
    >
      <button
        type="button"
        class="maid-atelier-mention"
        data-maid-mention={props.agent.id}
        aria-label={t("agentsHome.maidMentionRemove", { name: props.agent.name })}
        onClick={() => props.onRemove?.()}
      >
        {body()}
      </button>
    </Show>
  );
}

export function MaidMentionText(props: { text: string; agents: readonly MaidMentionAgent[] }) {
  const parts = createMemo(() => {
    const tokens = maidMentionTokens(props.text, props.agents);
    if (!tokens.length) {
      return [{ kind: "text" as const, text: props.text, key: "text" }];
    }
    const rendered: Array<
      | { kind: "text"; text: string; key: string }
      | { kind: "mention"; agent: MaidMentionAgent; key: string }
    > = [];
    let cursor = 0;
    for (const token of tokens) {
      if (token.start > cursor) {
        rendered.push({
          kind: "text",
          text: props.text.slice(cursor, token.start),
          key: `t${cursor}`,
        });
      }
      rendered.push({ kind: "mention", agent: token.agent, key: `m${token.start}` });
      cursor = token.end;
    }
    if (cursor < props.text.length) {
      rendered.push({ kind: "text", text: props.text.slice(cursor), key: `t${cursor}` });
    }
    return rendered;
  });
  return (
    <For each={parts()}>
      {(part) => (part.kind === "text" ? part.text : <MaidMentionChip agent={part.agent} />)}
    </For>
  );
}

export function MaidMentionDraftChips(props: {
  text: string;
  agents?: readonly MaidMentionAgent[];
  onRemove?: (token: MaidMentionToken) => void;
}) {
  const tokens = createMemo(() => maidMentionTokens(props.text, props.agents ?? []));
  return (
    <Show when={tokens().length > 0}>
      <div class="maid-atelier-mention-chips">
        <For each={tokens()}>
          {(token) => (
            <MaidMentionChip
              agent={token.agent}
              onRemove={props.onRemove ? () => props.onRemove?.(token) : undefined}
            />
          )}
        </For>
      </div>
    </Show>
  );
}

export function MaidMentionPicker(props: {
  agents: readonly MaidMentionAgent[];
  activeIndex: number;
  id?: string;
  optionId?: (index: number) => string;
  onSelect?: (agent: MaidMentionAgent) => void;
  onHover?: (index: number) => void;
}) {
  return (
    <div
      id={props.id}
      class="maid-atelier-mention-menu"
      role="listbox"
      aria-label={t("agentsHome.maidMentionMenu")}
      data-maid-mention-menu="open"
    >
      <div class="maid-atelier-mention-menu__label">{t("agentsHome.maidMentionMenu")}</div>
      <For each={props.agents}>
        {(agent, index) => (
          <button
            type="button"
            id={props.optionId?.(index())}
            class="maid-atelier-mention-menu__option"
            role="option"
            data-maid-mention-option={agent.id}
            aria-selected={index() === props.activeIndex ? "true" : "false"}
            onMouseDown={(event: MouseEvent) => event.preventDefault()}
            onClick={() => props.onSelect?.(agent)}
            onPointerMove={() => {
              if (index() !== props.activeIndex) {
                props.onHover?.(index());
              }
            }}
          >
            <Show
              when={agent.portraitUrl}
              fallback={
                <span class="maid-atelier-mention__face" aria-hidden="true">
                  {agent.name.slice(0, 1).toUpperCase()}
                </span>
              }
            >
              <img class="maid-atelier-mention__face" src={agent.portraitUrl ?? undefined} alt="" />
            </Show>
            <span>{agent.name}</span>
          </button>
        )}
      </For>
    </div>
  );
}
