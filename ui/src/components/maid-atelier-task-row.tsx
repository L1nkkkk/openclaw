import { Show } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { formatRelativeTimestamp } from "../lib/format.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { MAID_SAMPLE_FILE_AGE_MS, type MaidChecklistItem } from "./maid-atelier-board.ts";
import { MaidPresence } from "./maid-atelier-presence.tsx";

registerEnglishCatalog(registerAgentsHomeEnglish);

const HOLD_KEYS = {
  blocked: "agentsHome.maidStatusBlocked",
  pending: "agentsHome.maidStatusPending",
} as const;

/** Sample fixture only. A local flip is not a progress-card write. */
function taskChecked(flipped: () => ReadonlySet<string>, item: MaidChecklistItem): boolean {
  return flipped().has(item.id) !== item.done;
}

function holdLabel(hold: "blocked" | "pending"): string {
  return t(HOLD_KEYS[hold]);
}

function TaskCopy(props: { item: MaidChecklistItem; checked: boolean; when: string }) {
  return (
    <>
      <span class="maid-atelier-agents__check" aria-hidden="true" />
      <span class="maid-atelier-agents__task-copy">
        <span class="maid-atelier-agents__task-label">{props.item.label}</span>
        <Show when={!props.checked ? props.item.hold : undefined}>
          {(hold) => (
            <span class="maid-atelier-agents__hold" data-maid-hold={hold()}>
              <MaidPresence tone={hold()} label={holdLabel(hold())} />
              {holdLabel(hold())}
            </span>
          )}
        </Show>
        <Show when={props.item.refine}>
          <span class="maid-atelier-agents__refine">{t("agentsHome.maidRefine")}</span>
        </Show>
      </span>
      <span class="maid-atelier-agents__task-time">{props.when}</span>
    </>
  );
}

export function MaidTaskRow(props: {
  item: MaidChecklistItem;
  done: () => ReadonlySet<string>;
  onOpenSession: (key: string) => void;
  onToggleTask: (id: string) => void;
}) {
  const localOnly = () => props.item.sample;
  const checked = () => (localOnly() ? taskChecked(props.done, props.item) : props.item.done);
  const sessionKey = () => props.item.sessionKey;
  const kind = () => (sessionKey() ? "session" : localOnly() ? "sample" : "step");
  const when = () => {
    if (props.item.at && props.item.at > 0) {
      return formatRelativeTimestamp(props.item.at);
    }
    const age = MAID_SAMPLE_FILE_AGE_MS[props.item.id];
    return age ? formatRelativeTimestamp(Date.now() - age) : "";
  };
  return (
    <Show
      when={sessionKey() || localOnly()}
      fallback={
        <div
          class="maid-atelier-agents__task"
          data-maid-task={kind()}
          data-maid-done={checked() ? "true" : "false"}
        >
          <TaskCopy item={props.item} checked={checked()} when={when()} />
        </div>
      }
    >
      <button
        type="button"
        class="maid-atelier-agents__task"
        data-maid-task={kind()}
        data-maid-done={checked() ? "true" : "false"}
        role={localOnly() ? "checkbox" : undefined}
        aria-checked={localOnly() ? (checked() ? "true" : "false") : undefined}
        onClick={() => {
          const key = sessionKey();
          if (key) {
            props.onOpenSession(key);
            return;
          }
          if (props.item.sample) {
            props.onToggleTask(props.item.id);
          }
        }}
      >
        <TaskCopy item={props.item} checked={checked()} when={when()} />
      </button>
    </Show>
  );
}
