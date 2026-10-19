import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { MaidAtelierBoard } from "./maid-atelier-agents.tsx";
import type { MaidAvatarSubject } from "./maid-atelier-avatar.ts";
import { MAID_SAMPLE_FILES, maidDensitySections } from "./maid-atelier-board.ts";
import { maidRoomPresentation } from "./maid-atelier-chat.ts";
import {
  MaidMentionChip,
  MaidMentionPicker,
  MaidMentionText,
} from "./maid-atelier-mention-picker.tsx";
import type { MaidMentionAgent } from "./maid-atelier-mentions.ts";
import { maidPortraitSrc, MAID_PORTRAIT_SRCS } from "./maid-atelier-portraits.ts";
import { MaidPresence } from "./maid-atelier-presence.tsx";
import { MaidAtelierProgress } from "./maid-atelier-progress.tsx";
import { MaidAtelierRoom } from "./maid-atelier-room.tsx";
import type { MaidTone } from "./maid-atelier-status.ts";
import { MaidAtelierTaskLog } from "./maid-atelier-task-log.tsx";
import { Icon } from "./solid/icon.tsx";

registerEnglishCatalog(registerAgentsHomeEnglish);

const PREVIEW_CARD = {
  markdown: "Queue idle.",
  steps: [
    { step: "lint", status: "completed" as const },
    { step: "typecheck", status: "completed" as const },
    { step: "approval", status: "in_progress" as const },
    { step: "build", status: "completed" as const },
    { step: "deploy", status: "completed" as const },
  ],
};

function SampleChatRow(props: {
  side: "assistant" | "user";
  name: string;
  portraitId: string;
  src?: string;
  tone: MaidTone;
  when: string;
  text: string;
  agents?: readonly MaidMentionAgent[];
}) {
  return (
    <div class={`chat-group ${props.side} chat-group--with-footer`} data-maid-speaker={props.name}>
      <span class="chat-avatar-slot maid-atelier-chat__avatar">
        <img
          class={`chat-avatar ${props.side}`}
          data-maid-face={props.portraitId}
          src={props.src ?? maidPortraitSrc(props.portraitId)}
          alt=""
        />
        <MaidPresence tone={props.tone} label={props.name} />
      </span>
      <div class="chat-group-messages">
        <div class="chat-bubble">
          <Show when={props.agents?.length} fallback={props.text}>
            <MaidMentionText text={props.text} agents={props.agents ?? []} />
          </Show>
        </div>
      </div>
      <div class="chat-group-footer">
        <div class="chat-group-footer__meta">
          <span class="chat-sender-name">{props.name}</span>
          <time class="chat-group-timestamp">{props.when}</time>
        </div>
      </div>
    </div>
  );
}

const FIXTURE_AGENTS = [
  { id: "harper", name: "Harper" },
  { id: "notes", name: "Notes" },
  { id: "archive", name: "Archive" },
];

export type MaidAtelierPreviewScene =
  | "dm"
  | "group"
  | "invite"
  | "mention"
  | "mentioned"
  | "avatar"
  | "avatar-set";

function groupScene(scene: MaidAtelierPreviewScene): boolean {
  return (
    scene === "group" ||
    scene === "mention" ||
    scene === "mentioned" ||
    scene === "avatar" ||
    scene === "avatar-set"
  );
}

function changedPortrait(id: string): string {
  const current = maidPortraitSrc(id);
  return MAID_PORTRAIT_SRCS.find((src) => src !== current) ?? current;
}

function fixtureRoom(scene: MaidAtelierPreviewScene) {
  return maidRoomPresentation({
    agentId: "harper",
    assistantName: "Harper",
    userName: "Mori",
    userId: "mori",
    sessionTitle: "deploy check",
    agents: FIXTURE_AGENTS,
    children: groupScene(scene) ? [{ key: "agent:notes:subagent:margin", agentId: "notes" }] : [],
    childKeys: [],
    kind: "direct",
  });
}

/** Density stand-in for screenshots. Project names and lines here are not live data. */
export function MaidAtelierPreview(props: { scene?: MaidAtelierPreviewScene }): JSX.Element {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.themeId = "maid";
    document.documentElement.dataset.theme = "maid";
  }
  const [flipped, setFlipped] = createSignal<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(flipped());
    if (!next.delete(id)) {
      next.add(id);
    }
    setFlipped(next);
  };
  const scene = () => props.scene ?? "group";
  const presented = () => fixtureRoom(scene());
  const grouped = () => groupScene(scene());
  const mentioning = () => scene() === "mention" || scene() === "mentioned";
  const avatarSubject = (): MaidAvatarSubject | undefined =>
    scene() === "avatar"
      ? { kind: "agent", id: "harper", name: "Harper", custom: true }
      : undefined;
  const harperFace = () => (scene() === "avatar-set" ? changedPortrait("harper") : undefined);
  const mentionAgents = (): MaidMentionAgent[] => {
    const room = presented();
    if (!room || room.room.kind !== "group") {
      return [];
    }
    return room.room.members.flatMap((member) =>
      member.kind === "agent"
        ? [{ id: member.id, name: member.name, portraitUrl: maidPortraitSrc(member.id) }]
        : [],
    );
  };
  const sections = maidDensitySections(Date.now());
  for (const section of sections) {
    section.sample = false;
  }
  return (
    <div class="maid-atelier-preview" data-maid-fixture="density">
      <p class="maid-atelier-preview__note">Sample. These names are not live sessions.</p>
      <aside class="maid-atelier-preview__sidebar" data-maid-shot="sidebar">
        <MaidAtelierBoard
          sections={sections}
          tasks={{ sample: false, items: MAID_SAMPLE_FILES }}
          profile={{
            name: "Mori",
            status: t("agentsHome.maidProfileOnline"),
            portraitId: "mori",
            online: true,
          }}
          faces={harperFace() ? { harper: harperFace() ?? "" } : undefined}
          currentId="harper"
          currentSessionKey="fixture:deploy-check"
          onOpenAgent={() => undefined}
          onOpenSession={() => undefined}
          onNav={() => undefined}
          done={flipped}
          onToggleTask={toggle}
        />
      </aside>
      <div class="maid-atelier-preview__center" data-maid-shot="center">
        <header class="chat-pane__header maid-atelier-preview__header">
          <span class="chat-pane__session-title">desk / deploy check</span>
          <MaidAtelierProgress placement="chip" card={PREVIEW_CARD} activeRun={true} />
        </header>
        <Show when={presented()}>
          {(room) => (
            <MaidAtelierRoom
              room={room().room}
              candidates={room().candidates}
              sample
              menuPinned={scene() === "invite"}
              avatarPinned={avatarSubject()}
              portrait={(member) => {
                const face = harperFace();
                return member.id === "harper" && face
                  ? face
                  : maidPortraitSrc(member.kind === "user" ? "mori" : member.id);
              }}
            />
          )}
        </Show>
        <div class="maid-atelier-preview__thread" data-maid-chat="sample">
          <MaidAtelierTaskLog card={PREVIEW_CARD} active={true} />
          <p class="maid-atelier-chat__sample">{t("agentsHome.maidProgressSample")}</p>
          <SampleChatRow
            side="assistant"
            name="Harper"
            portraitId="harper"
            src={harperFace()}
            tone="busy"
            when="2m ago"
            text="Run started."
          />
          <Show when={grouped()}>
            <SampleChatRow
              side="assistant"
              name="Notes"
              portraitId="notes"
              tone="idle"
              when="8m ago"
              text="Waiting."
            />
          </Show>
          <SampleChatRow
            side="user"
            name="Mori"
            portraitId="mori"
            tone="success"
            when="1m ago"
            text="Continue."
          />
          <Show
            when={grouped()}
            fallback={
              <SampleChatRow
                side="assistant"
                name="Harper"
                portraitId="harper"
                src={harperFace()}
                tone="busy"
                when="Just now"
                text="Diff ready."
              />
            }
          >
            <SampleChatRow
              side="assistant"
              name="Harper"
              portraitId="harper"
              src={harperFace()}
              tone="busy"
              when="Just now"
              text="Diff ready."
            />
            <SampleChatRow
              side="user"
              name="Mori"
              portraitId="mori"
              tone="success"
              when="Just now"
              text={mentioning() ? "@Notes, review the diff." : "Stop here."}
              agents={mentioning() ? mentionAgents() : undefined}
            />
          </Show>
        </div>
        <div class="agent-chat__input maid-atelier-preview__composer">
          <Show when={scene() === "mention"}>
            <MaidMentionPicker agents={mentionAgents()} activeIndex={0} />
          </Show>
          <div class={["maid-atelier-preview__draft", { "is-filled": mentioning() }]}>
            {scene() === "mention"
              ? "@"
              : scene() === "mentioned"
                ? "review the diff."
                : grouped()
                  ? "Message the group…"
                  : "Message Harper…"}
          </div>
          <MaidAtelierProgress placement="strip" card={PREVIEW_CARD} activeRun={true} />
          <div class="maid-atelier-preview__composer-bar">
            <div class="maid-atelier-preview__composer-lead">
              <Show
                when={
                  scene() === "mentioned"
                    ? mentionAgents().find((agent) => agent.id === "notes")
                    : undefined
                }
              >
                {(agent) => <MaidMentionChip agent={agent()} />}
              </Show>
              <span class="maid-atelier-preview__model">gemini-3.1-flash-lite</span>
            </div>
            <button type="button" class="maid-atelier-preview__send">
              Send
            </button>
          </div>
        </div>
      </div>
      <aside class="maid-atelier-preview__reader" data-maid-shot="reader">
        <section class="sidebar-markdown-shell">
          <div class="sidebar-file-view__path-bar">
            <div class="sidebar-file-view__path-field">
              <span class="sidebar-file-view__path" title="logs/gateway.log">
                logs/gateway.log
              </span>
            </div>
            <div class="sidebar-file-view__actions">
              <button
                type="button"
                class="btn btn--sm sidebar-file-view__action maid-atelier-source"
              >
                <Icon name="scrollText" />
                Source
              </button>
              <button
                type="button"
                class="btn btn--sm sidebar-file-view__action chat-copy-btn"
                aria-label="Copy path"
              >
                <span class="chat-copy-btn__icon" aria-hidden="true">
                  <Icon name="copy" />
                </span>
              </button>
            </div>
          </div>
          <article class="sidebar-markdown-reader sidebar-markdown">
            <h1>gateway log</h1>
            <p>status: running</p>
            <p>approval: pending</p>
            <p>last: lint passed</p>
          </article>
        </section>
      </aside>
    </div>
  );
}
