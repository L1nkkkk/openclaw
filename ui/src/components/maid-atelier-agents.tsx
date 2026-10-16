import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { ApplicationContext } from "../app/context.ts";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { rosterActivityStore } from "../lib/agents/roster-activity-store.ts";
import { formatRelativeTimestamp } from "../lib/format.ts";
import { projectAgents } from "../lib/reactive/domain-capabilities.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { projectSource } from "../lib/reactive/projection.ts";
import { resolveUiSessionRowAgentId } from "../lib/sessions/session-key.ts";
import { splitMaidAgents } from "./maid-atelier-agents.ts";
import {
  maidClip,
  maidIdentityTheme,
  maidSessionSummaries,
  maidTone,
  type MaidSessionSummary,
  type MaidTone,
} from "./maid-atelier-status.ts";
import { useMaidTheme } from "./maid-atelier-theme.ts";
import { Icon } from "./solid/icon.tsx";
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

const MINUTE_MS = 60_000;
const SAMPLE_TASKS = [
  { id: "notes", done: true, ageMs: 15 * MINUTE_MS },
  { id: "diff", done: false, ageMs: 2 * 60 * MINUTE_MS },
  { id: "checkpoint", done: false, ageMs: 26 * 60 * MINUTE_MS },
] as const;

type MaidCard = {
  id: string;
  name: string;
  avatar: string | null;
  textAvatar: string | null;
  activeNow: boolean;
  unreadCount: number;
  lastActiveAt: number;
  preview?: string;
  role?: string;
};

const SAMPLE_TASK_LABELS = {
  notes: "agentsHome.maidSampleNotes",
  diff: "agentsHome.maidSampleDiff",
  checkpoint: "agentsHome.maidSampleCheckpoint",
} as const;

const STATUS_KEYS = {
  busy: "agentsHome.maidStatusWorking",
  attention: "agentsHome.maidStatusAttention",
  success: "agentsHome.maidStatusDone",
  idle: "agentsHome.maidStatusIdle",
} as const satisfies Record<MaidTone, string>;

const ACTIVITY_KEYS = {
  busy: "agentsHome.maidActivityWorking",
  attention: "agentsHome.maidActivityUnread",
  success: "agentsHome.maidActivityDone",
  idle: "agentsHome.noMessage",
} as const satisfies Record<MaidTone, string>;

function roleLine(chief: boolean, tone: MaidTone, theme: string | null): string {
  const status = t(STATUS_KEYS[tone]);
  if (chief) {
    return `${t("agentsHome.maidRoleChief")} · ${status}`;
  }
  return theme ? `${theme} · ${status}` : status;
}

function activityLine(
  card: MaidCard,
  tone: MaidTone,
  summary: MaidSessionSummary | undefined,
): string {
  const preview = card.preview?.trim();
  if (preview) {
    return maidClip(preview);
  }
  const label = summary?.label?.trim();
  if (label && label !== card.name) {
    return maidClip(label);
  }
  return t(ACTIVITY_KEYS[tone]);
}

function MaidHeading(props: { label: string; count: number }) {
  return (
    <h2 class="maid-atelier-agents__heading">
      <span>{props.label}</span>
      <span class="maid-atelier-agents__count">({props.count})</span>
    </h2>
  );
}

function MaidAgentRow(props: {
  card: MaidCard;
  chief: boolean;
  summary: MaidSessionSummary | undefined;
  current: boolean;
  onOpen: (agentId: string) => void;
}) {
  const tone = () =>
    maidTone({
      activeNow: props.card.activeNow,
      unreadCount: props.card.unreadCount,
      status: props.summary?.status,
      failed: props.summary?.failed,
    });
  const role = () => roleLine(props.chief, tone(), maidIdentityTheme(props.card.role));
  const activity = () => activityLine(props.card, tone(), props.summary);
  const when = () =>
    props.card.lastActiveAt > 0
      ? formatRelativeTimestamp(props.card.lastActiveAt)
      : t("agentsHome.neverActive");
  const pinned = () => props.summary?.pinned === true;
  return (
    <button
      type="button"
      class="maid-atelier-agents__row"
      data-maid-agent={props.card.id}
      data-maid-tone={tone()}
      aria-current={props.current ? "true" : undefined}
      aria-label={`${props.card.name}, ${role()}, ${activity()}, ${when()}${pinned() ? `, ${t("agentsHome.maidPinned")}` : ""}`}
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
          data-tone={tone()}
          role="img"
          aria-label={t(STATUS_KEYS[tone()])}
        />
      </span>
      <span class="maid-atelier-agents__copy">
        <span class="maid-atelier-agents__title">
          <span class="maid-atelier-agents__name">{props.card.name}</span>
          <Show when={pinned()}>
            <span class="maid-atelier-agents__pin" aria-hidden="true">
              <Icon name="star" />
            </span>
          </Show>
        </span>
        <span class="maid-atelier-agents__role">{role()}</span>
        <span class="maid-atelier-agents__activity" title={activity()}>
          {activity()}
        </span>
      </span>
      <span class="maid-atelier-agents__aside">
        <Show when={props.card.unreadCount > 0}>
          <span class="maid-atelier-agents__unread">
            {t("agentsHome.maidUnread", { count: String(props.card.unreadCount) })}
          </span>
        </Show>
        <span class="maid-atelier-agents__meta">{when()}</span>
      </span>
    </button>
  );
}

type MaidAtelierRosterViewProps = {
  chief: MaidCard | null;
  independent: readonly MaidCard[];
  summaryFor: (id: string) => MaidSessionSummary | undefined;
  currentId: string;
  onOpen: (agentId: string) => void;
  done: () => ReadonlySet<string>;
  onToggleTask: (id: string) => void;
};

/** Shared maid roster body. The live sidebar fills it from the roster store. */
function MaidAtelierRosterView(props: MaidAtelierRosterViewProps): JSX.Element {
  return (
    <section class="maid-atelier-agents" aria-label={t("agentsHome.manage")}>
      <Show when={props.chief}>
        {(chief) => (
          <>
            <MaidHeading label={t("agentsHome.maidSection")} count={1} />
            <MaidAgentRow
              card={chief()}
              chief={true}
              summary={props.summaryFor(chief().id)}
              current={props.currentId === chief().id}
              onOpen={props.onOpen}
            />
          </>
        )}
      </Show>
      <MaidHeading label={t("agentsHome.independentMaids")} count={props.independent.length} />
      <Show
        when={props.independent.length > 0}
        fallback={<p class="maid-atelier-agents__empty">{t("agentsHome.maidNoIndependent")}</p>}
      >
        <For each={props.independent}>
          {(card) => (
            <MaidAgentRow
              card={card}
              chief={false}
              summary={props.summaryFor(card.id)}
              current={props.currentId === card.id}
              onOpen={props.onOpen}
            />
          )}
        </For>
      </Show>
      <MaidHeading label={t("agentsHome.maidWorkTasks")} count={SAMPLE_TASKS.length} />
      <p class="maid-atelier-agents__note">{t("agentsHome.maidWorkTasksNote")}</p>
      <For each={SAMPLE_TASKS}>
        {(task) => (
          <button
            type="button"
            class="maid-atelier-agents__task"
            role="checkbox"
            aria-checked={props.done().has(task.id) ? "true" : "false"}
            onClick={() => props.onToggleTask(task.id)}
          >
            <span class="maid-atelier-agents__check" aria-hidden="true" />
            <span class="maid-atelier-agents__task-label">{t(SAMPLE_TASK_LABELS[task.id])}</span>
            <span class="maid-atelier-agents__task-time">
              {formatRelativeTimestamp(Date.now() - task.ageMs, { suffix: false })}
            </span>
          </button>
        )}
      </For>
    </section>
  );
}

function MaidRoster(props: {
  context: MaidContext;
  currentId: () => string;
  onOpen: (agentId: string) => void;
  done: () => ReadonlySet<string>;
  onToggleTask: (id: string) => void;
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
  const summaries = createMemo(() =>
    maidSessionSummaries(
      roster().read().result?.sessions ?? [],
      agents().read().agentsList?.defaultId ?? "",
      resolveUiSessionRowAgentId,
    ),
  );
  return (
    <MaidAtelierRosterView
      chief={split().chief}
      independent={split().independent}
      summaryFor={(id) => summaries().get(id)}
      currentId={props.currentId()}
      onOpen={props.onOpen}
      done={props.done}
      onToggleTask={props.onToggleTask}
    />
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
    <Show
      when={context()}
      keyed
      fallback={
        <MaidAtelierRosterView
          chief={null}
          independent={[]}
          summaryFor={() => undefined}
          currentId={currentId()}
          onOpen={open}
          done={done}
          onToggleTask={toggleTask}
        />
      }
    >
      {(current) => (
        <MaidRoster
          context={current}
          currentId={currentId}
          onOpen={open}
          done={done}
          onToggleTask={toggleTask}
        />
      )}
    </Show>
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
