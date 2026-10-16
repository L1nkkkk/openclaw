import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import type { ApplicationContext } from "../app/context.ts";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { rosterActivityStore } from "../lib/agents/roster-activity-store.ts";
import { formatRelativeTimestamp } from "../lib/format.ts";
import { projectAgents } from "../lib/reactive/domain-capabilities.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { projectSource } from "../lib/reactive/projection.ts";
import { splitMaidAgents } from "./maid-atelier-agents.ts";
import { AgentIdentityAvatar } from "./solid/identity-avatar.tsx";
import "../styles/maid-atelier-sidebar.css";

registerEnglishCatalog(registerAgentsHomeEnglish);

type MaidContext = Pick<ApplicationContext, "gateway" | "agents" | "agentIdentity" | "sessions">;

export type MaidAtelierHost = {
  readonly sessionDataContext: MaidContext | null;
  readonly sidebarAgentsMode: "chip" | "roster";
  expandedAgentId(): string;
  openMainSession(agentId: string): void;
  switchChipAgent(agentId: string): void;
  subscribe(listener: () => void): () => void;
};

const SAMPLE_TASKS = [
  { id: "notes", done: true },
  { id: "diff", done: false },
  { id: "checkpoint", done: false },
] as const;

function sampleTaskLabel(id: (typeof SAMPLE_TASKS)[number]["id"]): string {
  switch (id) {
    case "notes":
      return t("agentsHome.maidSampleNotes");
    case "diff":
      return t("agentsHome.maidSampleDiff");
    case "checkpoint":
      return t("agentsHome.maidSampleCheckpoint");
  }
}

function maidThemeSelected(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.themeId === "maid";
}

function useMaidTheme() {
  const [active, setActive] = createSignal(maidThemeSelected());
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return active;
  }
  const observer = new MutationObserver(() => setActive(maidThemeSelected()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-id"],
  });
  onCleanup(() => observer.disconnect());
  return active;
}

function MaidAgentRow(props: {
  card: {
    id: string;
    name: string;
    avatar: string | null;
    textAvatar: string | null;
    activeNow: boolean;
    unreadCount: number;
    lastActiveAt: number;
  };
  current: boolean;
  onOpen: (agentId: string) => void;
}) {
  const status = () =>
    props.card.activeNow ? t("agentsHome.maidStatusActive") : t("agentsHome.maidStatusIdle");
  const when = () =>
    props.card.lastActiveAt > 0
      ? formatRelativeTimestamp(props.card.lastActiveAt)
      : t("agentsHome.neverActive");
  return (
    <button
      type="button"
      class="maid-atelier-agents__row"
      data-maid-agent={props.card.id}
      aria-current={props.current ? "true" : undefined}
      aria-label={`${props.card.name}, ${status()}, ${when()}`}
      onClick={() => props.onOpen(props.card.id)}
    >
      <span class="maid-atelier-agents__avatar">
        <AgentIdentityAvatar
          agent={{
            id: props.card.id,
            name: props.card.name,
            avatar: props.card.avatar,
            textAvatar: props.card.textAvatar,
          }}
        />
        <span
          class="maid-atelier-agents__status"
          data-active={props.card.activeNow ? "true" : "false"}
          role="img"
          aria-label={status()}
        />
      </span>
      <span class="maid-atelier-agents__copy">
        <span class="maid-atelier-agents__name">{props.card.name}</span>
        <span class="maid-atelier-agents__meta">{when()}</span>
      </span>
      <Show when={props.card.unreadCount > 0}>
        <span class="maid-atelier-agents__unread">
          {t("agentsHome.maidUnread", { count: String(props.card.unreadCount) })}
        </span>
      </Show>
    </button>
  );
}

function MaidRoster(props: {
  context: MaidContext;
  currentId: () => string;
  onOpen: (agentId: string) => void;
}) {
  const roster = createMemo(() =>
    projectSource(rosterActivityStore(props.context), {
      read: (store) => store.snapshot,
      subscribe: (store, notify) => store.subscribe(notify),
      equality: "revision",
    }),
  );
  const agents = createMemo(() => projectAgents(props.context.agents));
  const split = createMemo(() =>
    splitMaidAgents(roster().read().cards, agents().read().agentsList?.defaultId ?? null),
  );
  return (
    <>
      <Show when={split().chief}>
        {(chief) => (
          <>
            <h2 class="maid-atelier-agents__heading">{t("agentsHome.maidSection")}</h2>
            <MaidAgentRow
              card={chief()}
              current={props.currentId() === chief().id}
              onOpen={props.onOpen}
            />
          </>
        )}
      </Show>
      <h2 class="maid-atelier-agents__heading">{t("agentsHome.independentMaids")}</h2>
      <Show
        when={split().independent.length > 0}
        fallback={<p class="maid-atelier-agents__empty">{t("agentsHome.maidNoIndependent")}</p>}
      >
        <For each={split().independent}>
          {(card) => (
            <MaidAgentRow
              card={card}
              current={props.currentId() === card.id}
              onOpen={props.onOpen}
            />
          )}
        </For>
      </Show>
    </>
  );
}

function MaidAtelierAgentsLive(props: { host: MaidAtelierHost }) {
  const host = createMemo(() =>
    projectSource(props.host, {
      read: (current) => current,
      subscribe: (current, notify) => current.subscribe(notify),
      equality: "revision",
    }),
  );
  const context = createMemo(() => host().read().sessionDataContext);
  const currentId = () => host().read().expandedAgentId();
  const [done, setDone] = createSignal<ReadonlySet<string>>(
    new Set(SAMPLE_TASKS.filter((task) => task.done).map((task) => task.id)),
  );
  const toggleTask = (id: string) => {
    const next = new Set(done());
    if (!next.delete(id)) {
      next.add(id);
    }
    setDone(next);
  };
  const open = (agentId: string) => {
    const current = host().read();
    if (current.sidebarAgentsMode === "roster") {
      current.openMainSession(agentId);
      return;
    }
    current.switchChipAgent(agentId);
  };
  return (
    <section class="maid-atelier-agents" aria-label={t("agentsHome.manage")}>
      <Show when={context()} keyed>
        {(current) => <MaidRoster context={current} currentId={currentId} onOpen={open} />}
      </Show>
      <h2 class="maid-atelier-agents__heading">{t("agentsHome.maidWorkTasks")}</h2>
      <p class="maid-atelier-agents__note">{t("agentsHome.maidWorkTasksNote")}</p>
      <For each={SAMPLE_TASKS}>
        {(task) => (
          <button
            type="button"
            class="maid-atelier-agents__task"
            role="checkbox"
            aria-checked={done().has(task.id) ? "true" : "false"}
            onClick={() => toggleTask(task.id)}
          >
            <span class="maid-atelier-agents__check" aria-hidden="true" />
            <span class="maid-atelier-agents__task-label">{sampleTaskLabel(task.id)}</span>
          </button>
        )}
      </For>
    </section>
  );
}

export function MaidAtelierAgents(props: { host: MaidAtelierHost }): JSX.Element {
  const maid = useMaidTheme();
  return (
    <Show when={maid()}>
      <MaidAtelierAgentsLive host={props.host} />
    </Show>
  );
}
