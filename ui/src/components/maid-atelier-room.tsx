import { For, Show, createSignal } from "solid-js";
import { t } from "../lib/reactive/i18n.ts";
import "../styles/maid-atelier-chrome.css";
import type { MaidRoom, MaidRoomAgent, MaidRoomMember } from "./maid-atelier-chat.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";

export function MaidAtelierRoom(props: {
  room: MaidRoom;
  candidates: readonly MaidRoomAgent[];
  sample?: boolean;
  /** Screenshot fixture keeps the agent list open. Live starts closed. */
  menuPinned?: boolean;
  portrait: (member: MaidRoomMember) => string | null;
  onPull?: (agent: MaidRoomAgent) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const shown = () => Boolean(props.menuPinned) || open();
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
        <div class="maid-atelier-room__faces" aria-hidden="true">
          <For each={faces()}>
            {(member) => {
              const src = () => props.portrait(member);
              return (
                <Show
                  when={src()}
                  fallback={
                    <span class="maid-atelier-room__face" data-maid-member={member.id}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                  }
                >
                  <img
                    class="maid-atelier-room__face"
                    data-maid-member={member.id}
                    src={src() ?? undefined}
                    alt=""
                  />
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
          disabled={props.candidates.length === 0}
          aria-expanded={shown() ? "true" : "false"}
          aria-label={t(
            props.candidates.length === 0
              ? "agentsHome.maidRoomPullEmpty"
              : "agentsHome.maidRoomPull",
          )}
          onClick={() => {
            if (props.candidates.length > 0) {
              setOpen((value) => !value);
            }
          }}
        >
          {t("agentsHome.maidRoomPull")}
        </button>
      </header>
      <Show when={shown() && props.candidates.length > 0}>
        <div class="maid-atelier-room__menu" data-maid-room-menu="open" role="group">
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
