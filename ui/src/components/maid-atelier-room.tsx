import { For, Show, createSignal } from "solid-js";
import { t } from "../lib/reactive/i18n.ts";
import "../styles/maid-atelier-chrome.css";
import { MaidAvatarEditor } from "./maid-atelier-avatar-picker.tsx";
import type { MaidAvatarChoice, MaidAvatarSubject } from "./maid-atelier-avatar.ts";
import type { MaidRoom, MaidRoomAgent, MaidRoomMember } from "./maid-atelier-chat.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";

export function MaidAtelierRoom(props: {
  room: MaidRoom;
  candidates: readonly MaidRoomAgent[];
  sample?: boolean;
  /** Screenshot fixture keeps the agent list open. Live starts closed. */
  menuPinned?: boolean;
  /** Screenshot fixture keeps the face picker open for this person. */
  avatarPinned?: MaidAvatarSubject;
  portrait: (member: MaidRoomMember) => string | null;
  custom?: (member: MaidRoomMember) => boolean;
  onPull?: (agent: MaidRoomAgent) => void;
  onCommit?: (subject: MaidAvatarSubject, choice: MaidAvatarChoice) => Promise<string | null>;
}) {
  const [open, setOpen] = createSignal(false);
  const [editing, setEditing] = createSignal<string | null>(null);
  const shown = () => Boolean(props.menuPinned) || open();
  const subjectFor = (member: MaidRoomMember): MaidAvatarSubject => ({
    kind: member.kind,
    id: member.id,
    name: member.name,
    custom: props.custom?.(member) === true,
  });
  const editingSubject = (): MaidAvatarSubject | null => {
    const id = editing();
    const member = id ? props.room.members.find((entry) => entry.id === id) : undefined;
    return member ? subjectFor(member) : (props.avatarPinned ?? null);
  };
  const faces = () => {
    if (props.room.kind === "dm") {
      return props.room.members.filter((member) => member.kind === "agent").slice(0, 1);
    }
    return props.room.members.slice(0, 4);
  };
  const subtitle = () =>
    props.room.kind === "dm"
      ? t("agentsHome.maidRoomPrivate")
      : t("agentsHome.maidRoomGroup", { count: String(props.room.memberCount) });
  return (
    <div class="maid-atelier-room-wrap">
      <header class="maid-atelier-room" data-maid-room={props.room.kind}>
        <div class="maid-atelier-room__faces" aria-hidden={props.onCommit ? undefined : "true"}>
          <For each={faces()}>
            {(member) => {
              const src = () => props.portrait(member);
              const face = () => (
                <Show
                  when={src()}
                  fallback={
                    <span class="maid-atelier-room__initial">
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                  }
                >
                  <img src={src() ?? undefined} alt="" />
                </Show>
              );
              return (
                <Show
                  when={props.onCommit}
                  fallback={
                    <span class="maid-atelier-room__face" data-maid-member={member.id}>
                      {face()}
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="maid-atelier-room__face"
                    data-maid-member={member.id}
                    aria-label={t("agentsHome.maidAvatarChange", { name: member.name })}
                    onClick={() => setEditing(member.id)}
                  >
                    {face()}
                  </button>
                </Show>
              );
            }}
          </For>
        </div>
        <div class="maid-atelier-room__copy">
          <div class="maid-atelier-room__title">{props.room.title}</div>
          <div class="maid-atelier-room__meta">
            <span>{subtitle()}</span>
            <Show when={props.sample}>
              <span class="maid-atelier-room__sample">{t("agentsHome.maidProgressSample")}</span>
            </Show>
          </div>
        </div>
        <button
          type="button"
          class="maid-atelier-room__pull"
          data-maid-pull="draft"
          disabled={props.candidates.length === 0}
          aria-expanded={shown() ? "true" : "false"}
          aria-label={t(
            props.candidates.length === 0
              ? "agentsHome.maidRoomPullEmpty"
              : "agentsHome.maidRoomPullHint",
          )}
          title={props.candidates.length === 0 ? undefined : t("agentsHome.maidRoomPullHint")}
          onClick={() => {
            if (props.candidates.length > 0) {
              setOpen((value) => !value);
            }
          }}
        >
          {t("agentsHome.maidRoomPull")}
        </button>
      </header>
      <MaidAvatarEditor
        subject={editingSubject()}
        onClose={() => setEditing(null)}
        onCommit={props.onCommit}
      />
      <Show when={shown() && props.candidates.length > 0}>
        <div class="maid-atelier-room__menu" data-maid-room-menu="open" role="group">
          <p class="maid-atelier-room__pull-note">{t("agentsHome.maidRoomPullHint")}</p>
          <For each={props.candidates}>
            {(agent) => (
              <button
                type="button"
                class="maid-atelier-room__candidate"
                data-maid-candidate={agent.id}
                onClick={() => {
                  props.onPull?.(agent);
                  setOpen(false);
                }}
              >
                <img src={maidPortraitSrc(agent.id)} alt="" />
                <span>{agent.name}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
