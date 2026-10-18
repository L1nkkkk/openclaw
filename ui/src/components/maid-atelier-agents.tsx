import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { ApplicationContext } from "../app/context.ts";
import { gatewayPresentationScope } from "../app/gateway-presentation-scope.ts";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { rosterActivityStore } from "../lib/agents/roster-activity-store.ts";
import { formatRelativeTimestamp } from "../lib/format.ts";
import { projectAgents } from "../lib/reactive/domain-capabilities.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { projectSource } from "../lib/reactive/projection.ts";
import { resolveUiSessionRowAgentId } from "../lib/sessions/session-key.ts";
import { MaidAvatarEditor } from "./maid-atelier-avatar-picker.tsx";
import { commitMaidAvatar } from "./maid-atelier-avatar-save.ts";
import type { MaidAvatarChoice, MaidAvatarSubject } from "./maid-atelier-avatar.ts";
import {
  buildMaidBoard,
  MAID_NAV,
  MAID_SAMPLE_FILE_AGE_MS,
  maidChecklistModel,
  type MaidAgentFact,
  type MaidBoardRow,
  type MaidBoardSection,
  type MaidChecklistItem,
  type MaidNavItem,
  type MaidNavRoute,
  type MaidSessionFact,
} from "./maid-atelier-board.ts";
import { maidPortraitUrl } from "./maid-atelier-chat.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";
import { MaidPresence } from "./maid-atelier-presence.tsx";
import { maidClip, maidIdentityTheme, maidTone, type MaidTone } from "./maid-atelier-status.ts";
import { useMaidTheme } from "./maid-atelier-theme.ts";
import { Icon } from "./solid/icon.tsx";
import { AgentIdentityAvatar } from "./solid/identity-avatar.tsx";
import "../styles/maid-atelier-sidebar.css";

registerEnglishCatalog(registerAgentsHomeEnglish);

type MaidContext = Pick<
  ApplicationContext,
  | "gateway"
  | "agents"
  | "agentIdentity"
  | "sessions"
  | "runtimeConfig"
  | "config"
  | "resourceBasePath"
>;

export type MaidAtelierHost = {
  readonly sessionDataContext: MaidContext | null;
  readonly sidebarAgentsMode: "chip" | "roster";
  readonly connected?: boolean;
  navigationView?: "pages" | "sessions" | "online";
  expandedAgentId(): string;
  openMainSession(agentId: string): void;
  switchChipAgent(agentId: string): void;
  subscribe(listener: () => void): () => void;
  onOpenPalette?: () => void;
  onNavigate?: (route: MaidNavRoute) => void;
  requestOpenNewSession?: (agentId: string) => void;
  requestUpdate?: () => void;
  selectSession?: (sessionKey: string) => void;
  getRouteSessionKey?: () => string;
};

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

export type MaidProfileModel = {
  name: string;
  status: string;
  portraitId: string;
  avatarUrl?: string | null;
  online: boolean;
};

function roleLine(row: MaidBoardRow, tone: MaidTone): string {
  const status = t(STATUS_KEYS[tone]);
  if (row.kind === "session") {
    return row.preview ? maidClip(row.preview) : status;
  }
  if (row.chief) {
    return `${t("agentsHome.maidRoleChief")} · ${status}`;
  }
  const theme = maidIdentityTheme(row.role);
  return theme ? `${theme} · ${status}` : status;
}

function activityLine(row: MaidBoardRow, tone: MaidTone): string {
  if (row.kind === "session") {
    return row.preview ? maidClip(row.preview) : t(ACTIVITY_KEYS[tone]);
  }
  const preview = row.preview.trim();
  if (preview) {
    return maidClip(preview);
  }
  return t(ACTIVITY_KEYS[tone]);
}

function MaidHeading(props: {
  label: string;
  count: number;
  chief?: boolean;
  sample?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <h2 class="maid-atelier-agents__heading">
      <button
        type="button"
        class="maid-atelier-agents__heading-button"
        aria-expanded={props.onToggle ? (props.expanded ? "true" : "false") : undefined}
        onClick={() => props.onToggle?.()}
      >
        <Show when={props.onToggle}>
          <span
            class="maid-atelier-agents__chevron"
            data-expanded={props.expanded ? "true" : "false"}
            aria-hidden="true"
          />
        </Show>
        <span class="maid-atelier-agents__heading-label">
          <Show when={props.chief}>
            <span class="maid-atelier-agents__mark" aria-hidden="true">
              <Icon name="star" />
            </span>
          </Show>
          <span>{props.label}</span>
        </span>
      </button>
      <span class="maid-atelier-agents__count">
        <Show when={props.sample}>
          <span class="maid-atelier-agents__sample">{t("agentsHome.maidWorkTasksNote")}</span>
        </Show>
        ({props.count})
      </span>
    </h2>
  );
}

function MaidAgentRow(props: {
  row: MaidBoardRow;
  current: boolean;
  faceSrc?: string;
  onOpen: () => void;
  onEditAvatar?: () => void;
}) {
  const tone = () =>
    maidTone({
      activeNow: props.row.activeNow,
      unreadCount: props.row.unreadCount,
      status: props.row.status,
      failed: props.row.failed,
    });
  const role = () => roleLine(props.row, tone());
  const activity = () => activityLine(props.row, tone());
  const detail = () => {
    if (props.row.kind === "session" || !props.row.preview.trim()) {
      return props.row.kind === "session" ? activity() : role();
    }
    return `${role()} · ${activity()}`;
  };
  const when = () =>
    props.row.lastActiveAt > 0
      ? formatRelativeTimestamp(props.row.lastActiveAt)
      : t("agentsHome.neverActive");
  const spaces = () =>
    props.row.spaces > 0 ? t("agentsHome.maidSpaces", { count: String(props.row.spaces) }) : "";
  return (
    <button
      type="button"
      class="maid-atelier-agents__row"
      data-maid-kind={props.row.kind}
      data-maid-agent={props.row.kind === "agent" ? props.row.id : undefined}
      data-maid-tone={tone()}
      aria-current={props.current ? "true" : undefined}
      aria-label={`${props.row.name}, ${detail()}, ${spaces()} ${when()}`.replace(/\s+/g, " ")}
      onClick={(event) => {
        const target = event.target;
        if (
          props.onEditAvatar &&
          target instanceof Element &&
          target.closest("[data-maid-avatar-edit]")
        ) {
          props.onEditAvatar();
          return;
        }
        props.onOpen();
      }}
    >
      <span
        class="maid-atelier-agents__avatar"
        data-maid-avatar-edit={props.onEditAvatar ? props.row.id : undefined}
        data-maid-mark={props.row.kind === "agent" ? props.row.name.slice(0, 1) : undefined}
      >
        <Show
          when={props.row.kind === "agent"}
          fallback={<MaidPresence tone={tone()} label={t(STATUS_KEYS[tone()])} />}
        >
          <Show
            when={props.faceSrc || props.row.avatar}
            fallback={
              <img
                class="maid-atelier-agents__portrait"
                src={maidPortraitSrc(props.row.id)}
                alt=""
              />
            }
          >
            <Show
              when={props.faceSrc}
              fallback={
                <AgentIdentityAvatar
                  agent={{
                    id: props.row.id,
                    name: props.row.name,
                    avatar: props.row.avatar,
                    textAvatar: props.row.textAvatar,
                  }}
                />
              }
            >
              <img class="maid-atelier-agents__portrait" src={props.faceSrc ?? ""} alt="" />
            </Show>
          </Show>
          <MaidPresence tone={tone()} label={t(STATUS_KEYS[tone()])} />
        </Show>
      </span>
      <span class="maid-atelier-agents__copy">
        <span class="maid-atelier-agents__title">
          <span class="maid-atelier-agents__name">{props.row.name}</span>
          <Show when={props.row.marked}>
            <span class="maid-atelier-agents__pin" aria-hidden="true">
              <Icon name="star" />
            </span>
          </Show>
        </span>
        <span class="maid-atelier-agents__activity" title={detail()}>
          {detail()}
        </span>
      </span>
      <span class="maid-atelier-agents__aside">
        <Show when={props.row.kind === "agent"}>
          <span class="maid-atelier-agents__plate" data-maid-tone={tone()}>
            {t(STATUS_KEYS[tone()])}
          </span>
        </Show>
        <Show when={props.row.unreadCount > 0}>
          <span class="maid-atelier-agents__unread">
            {t("agentsHome.maidUnread", { count: String(props.row.unreadCount) })}
          </span>
        </Show>
        <span class="maid-atelier-agents__meta">{when()}</span>
        <Show when={spaces()}>
          <span class="maid-atelier-agents__spaces">{spaces()}</span>
        </Show>
      </span>
    </button>
  );
}

/** Ids in the set are local flips. The source row stays the unchecked baseline. */
function taskChecked(flipped: () => ReadonlySet<string>, item: MaidChecklistItem): boolean {
  return flipped().has(item.id) !== item.done;
}

export function MaidAtelierBoard(props: {
  sections: readonly MaidBoardSection[];
  tasks: { sample: boolean; items: readonly MaidChecklistItem[] };
  profile: MaidProfileModel;
  currentId: string;
  currentSessionKey: string;
  onOpenAgent: (id: string) => void;
  onOpenSession: (key: string) => void;
  onNav: (item: MaidNavItem) => void;
  navDisabled?: (item: MaidNavItem) => boolean;
  done: () => ReadonlySet<string>;
  onToggleTask: (id: string) => void;
  faces?: Readonly<Record<string, string>>;
  onCommit?: (subject: MaidAvatarSubject, choice: MaidAvatarChoice) => Promise<string | null>;
}): JSX.Element {
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = createSignal<MaidAvatarSubject | null>(null);
  const toggleSection = (id: string) => {
    const next = new Set(collapsed());
    if (!next.delete(id)) {
      next.add(id);
    }
    setCollapsed(next);
  };
  const sectionLabel = (section: MaidBoardSection) =>
    section.labelKey ? t(section.labelKey) : section.label;
  return (
    <section class="maid-atelier-agents" aria-label={t("agentsHome.manage")}>
      <nav class="maid-atelier-nav" aria-label={t("agentsHome.manage")}>
        <For each={MAID_NAV}>
          {(item) => (
            <button
              type="button"
              class="maid-atelier-nav__item"
              data-maid-nav={item.id}
              disabled={props.navDisabled?.(item) === true}
              onClick={() => props.onNav(item)}
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </button>
          )}
        </For>
      </nav>
      <div class="maid-atelier-agents__scroll">
        <Show
          when={props.sections.length > 0}
          fallback={<p class="maid-atelier-agents__empty">{t("agentsHome.maidNoIndependent")}</p>}
        >
          <For each={props.sections}>
            {(section) => {
              const expanded = () => !collapsed().has(section.id);
              const chief = () => section.rows.some((row) => row.chief);
              return (
                <div class="maid-atelier-agents__section" data-maid-section={section.id}>
                  <MaidHeading
                    label={sectionLabel(section)}
                    count={section.rows.length}
                    chief={chief()}
                    sample={section.sample}
                    expanded={expanded()}
                    onToggle={() => toggleSection(section.id)}
                  />
                  <Show when={expanded()}>
                    <For each={section.rows}>
                      {(row) => (
                        <MaidAgentRow
                          row={row}
                          faceSrc={props.faces?.[row.id]}
                          current={
                            row.kind === "session"
                              ? row.sessionKey === props.currentSessionKey
                              : props.currentId === row.id
                          }
                          onEditAvatar={
                            props.onCommit && row.kind === "agent"
                              ? () =>
                                  setEditing({
                                    kind: "agent",
                                    id: row.id,
                                    name: row.name,
                                    custom: Boolean(maidPortraitUrl(row.avatar)),
                                  })
                              : undefined
                          }
                          onOpen={() => {
                            if (row.kind === "session" && row.sessionKey) {
                              props.onOpenSession(row.sessionKey);
                              return;
                            }
                            props.onOpenAgent(row.id);
                          }}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
        <MaidHeading
          label={t("agentsHome.maidWorkTasks")}
          count={props.tasks.items.length}
          sample={props.tasks.sample}
        />
        <For each={props.tasks.items}>
          {(item) => {
            const checked = () => taskChecked(props.done, item);
            const when = () => {
              if (item.at && item.at > 0) {
                return formatRelativeTimestamp(item.at);
              }
              const age = MAID_SAMPLE_FILE_AGE_MS[item.id];
              return age ? formatRelativeTimestamp(Date.now() - age) : "";
            };
            return (
              <button
                type="button"
                class="maid-atelier-agents__task"
                role="checkbox"
                aria-checked={checked() ? "true" : "false"}
                onClick={() => props.onToggleTask(item.id)}
              >
                <span class="maid-atelier-agents__check" aria-hidden="true" />
                <span class="maid-atelier-agents__task-copy">
                  <span class="maid-atelier-agents__task-label">{item.label}</span>
                  <Show when={item.refine}>
                    <span class="maid-atelier-agents__refine">{t("agentsHome.maidRefine")}</span>
                  </Show>
                </span>
                <span class="maid-atelier-agents__task-time">{when()}</span>
              </button>
            );
          }}
        </For>
      </div>
      <MaidAvatarEditor
        subject={editing()}
        onClose={() => setEditing(null)}
        onCommit={props.onCommit}
      />
      <Show
        when={props.onCommit}
        fallback={
          <div class="maid-atelier-profile">
            <ProfileFace profile={props.profile} />
          </div>
        }
      >
        <button
          type="button"
          class="maid-atelier-profile"
          aria-label={t("agentsHome.maidAvatarChange", { name: props.profile.name })}
          onClick={() =>
            setEditing({
              kind: "user",
              id: props.profile.portraitId,
              name: props.profile.name,
              custom: Boolean(maidPortraitUrl(props.profile.avatarUrl)),
            })
          }
        >
          <ProfileFace profile={props.profile} />
        </button>
      </Show>
    </section>
  );
}

function ProfileFace(props: { profile: MaidProfileModel }) {
  return (
    <>
      <span class="maid-atelier-agents__avatar" data-maid-mark={props.profile.name.slice(0, 1)}>
        <Show
          when={props.profile.avatarUrl}
          fallback={
            <img
              class="maid-atelier-agents__portrait"
              src={maidPortraitSrc(props.profile.portraitId)}
              alt=""
            />
          }
        >
          <img class="maid-atelier-agents__portrait" src={props.profile.avatarUrl ?? ""} alt="" />
        </Show>
        <MaidPresence
          tone={props.profile.online ? "success" : "idle"}
          label={props.profile.status}
        />
      </span>
      <span class="maid-atelier-agents__copy">
        <span class="maid-atelier-agents__name">{props.profile.name}</span>
        <span class="maid-atelier-agents__activity">
          {props.profile.status} · {t("agentsHome.maidProfileAtelier")}
        </span>
      </span>
    </>
  );
}

function navDisabled(host: MaidAtelierHost, item: MaidNavItem): boolean {
  switch (item.action) {
    case "palette":
      return !host.onOpenPalette;
    case "new":
      return !host.requestOpenNewSession;
    case "route":
      return !host.onNavigate;
    case "pages":
      return host.navigationView === undefined;
    default:
      return false;
  }
}

function runNav(host: MaidAtelierHost, item: MaidNavItem) {
  switch (item.action) {
    case "palette":
      host.onOpenPalette?.();
      break;
    case "new":
      host.requestOpenNewSession?.(host.expandedAgentId());
      break;
    case "route":
      if (item.route) {
        host.onNavigate?.(item.route);
      }
      break;
    case "pages":
      host.navigationView = "pages";
      host.requestUpdate?.();
      break;
    default:
      break;
  }
}

function sessionFacts(
  rows: readonly {
    key: string;
    agentId?: string;
    archived?: boolean;
    category?: string | null;
    label?: string | null;
    displayName?: string | null;
    lastMessagePreview?: string | null;
    updatedAt?: number | null;
    status?: string | null;
    lastRunError?: string | null;
    pinned?: boolean;
  }[],
  fallbackAgentId: string,
): MaidSessionFact[] {
  return rows.map((row) => ({
    key: row.key,
    agentId: resolveUiSessionRowAgentId(row, fallbackAgentId),
    archived: row.archived,
    category: row.category,
    label: row.label,
    displayName: row.displayName,
    lastMessagePreview: row.lastMessagePreview,
    updatedAt: row.updatedAt,
    status: row.status,
    lastRunError: row.lastRunError,
    pinned: row.pinned,
  }));
}

function MaidRoster(props: {
  context: MaidContext;
  host: MaidAtelierHost;
  currentId: () => string;
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
  const facts = createMemo(() => {
    const list = agents().read().agentsList;
    const cards = roster().read().cards;
    const agentFacts: MaidAgentFact[] = cards.map((card) => ({
      id: card.id,
      name: card.name,
      avatar: card.avatar,
      textAvatar: card.textAvatar,
      activeNow: card.activeNow,
      unreadCount: card.unreadCount,
      lastActiveAt: card.lastActiveAt,
      preview: card.preview,
      role: card.role,
    }));
    const sessions = sessionFacts(roster().read().result?.sessions ?? [], list?.defaultId ?? "");
    return {
      sections: buildMaidBoard(agentFacts, sessions, list?.defaultId ?? null),
      tasks: maidChecklistModel({ sessions }),
    };
  });
  const profile = createMemo((): MaidProfileModel => {
    const user = gatewayPresentationScope(props.context.gateway).displayUser;
    const online = props.host.connected === true;
    return {
      name: user?.name?.trim() || user?.email?.trim() || t("nav.owner"),
      status: t(online ? "agentsHome.maidProfileOnline" : "agentsHome.maidProfileOffline"),
      portraitId: user?.id || "atelier",
      avatarUrl: user?.avatarUrl,
      online,
    };
  });
  const openAgent = (agentId: string) => {
    if (props.host.sidebarAgentsMode === "roster") {
      props.host.openMainSession(agentId);
      return;
    }
    props.host.switchChipAgent(agentId);
  };
  return (
    <MaidAtelierBoard
      sections={facts().sections}
      tasks={facts().tasks}
      profile={profile()}
      currentId={props.currentId()}
      currentSessionKey={props.host.getRouteSessionKey?.() ?? ""}
      onCommit={(subject, choice) => commitMaidAvatar(props.context, subject, choice)}
      onOpenAgent={openAgent}
      onOpenSession={(key) => props.host.selectSession?.(key)}
      onNav={(item) => runNav(props.host, item)}
      navDisabled={(item) => navDisabled(props.host, item)}
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
  const [done, setDone] = createSignal<ReadonlySet<string>>(new Set());
  const toggleTask = (id: string) => {
    const next = new Set(done());
    if (!next.delete(id)) {
      next.add(id);
    }
    setDone(next);
  };
  const emptyProfile = (): MaidProfileModel => ({
    name: t("nav.owner"),
    status: t("agentsHome.maidProfileOffline"),
    portraitId: "atelier",
    online: false,
  });
  return (
    <Show
      when={context()}
      keyed
      fallback={
        <MaidAtelierBoard
          sections={[]}
          tasks={maidChecklistModel({})}
          profile={emptyProfile()}
          currentId={currentId()}
          currentSessionKey=""
          onOpenAgent={() => undefined}
          onOpenSession={() => undefined}
          onNav={(item) => runNav(host().read(), item)}
          navDisabled={(item) => navDisabled(host().read(), item)}
          done={done}
          onToggleTask={toggleTask}
        />
      }
    >
      {(current) => (
        <MaidRoster
          context={current}
          host={host().read()}
          currentId={currentId}
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
