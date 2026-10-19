import type { ProgressCard } from "@openclaw/gateway-protocol";
import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { maidChecklistModel, type MaidChecklistItem } from "./maid-atelier-board.ts";
import { useMaidTheme } from "./maid-atelier-theme.ts";
import "../styles/maid-atelier-chrome.css";

registerEnglishCatalog(registerAgentsHomeEnglish);

function checked(flipped: () => ReadonlySet<string>, item: MaidChecklistItem): boolean {
  return flipped().has(item.id) !== item.done;
}

export function MaidAtelierTaskLog(props: {
  card?: Pick<ProgressCard, "markdown" | "steps"> | null;
  /** An empty welcome thread stays blank. A thread with messages says No log. */
  active?: boolean;
  /** Writes the progress card. Without it, a preview click only flips local memory. */
  onToggleStep?: (index: number) => void;
}): JSX.Element {
  const maid = useMaidTheme();
  return (
    <Show when={maid()}>
      <MaidAtelierTaskLogLive
        card={props.card}
        active={props.active}
        onToggleStep={props.onToggleStep}
      />
    </Show>
  );
}

function MaidAtelierTaskLogLive(props: {
  card?: Pick<ProgressCard, "markdown" | "steps"> | null;
  active?: boolean;
  onToggleStep?: (index: number) => void;
}) {
  const model = createMemo(() =>
    maidChecklistModel({
      steps: props.card?.steps,
      markdown: props.card?.markdown,
    }),
  );
  const visible = () => model().items.length > 0 || props.active === true;
  const [flipped, setFlipped] = createSignal<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(flipped());
    if (!next.delete(id)) {
      next.add(id);
    }
    setFlipped(next);
  };
  const log = () =>
    model().log || (model().items.length === 0 ? t("agentsHome.maidTaskLogSample") : "");
  return (
    <Show when={visible()}>
      <section class="maid-atelier-log" aria-label={t("agentsHome.maidChecklist")}>
        <Show when={log()}>
          <p class="maid-atelier-log__line">{log()}</p>
        </Show>
        <Show when={model().items.length > 0}>
          <ul class="maid-atelier-log__list">
            <For each={model().items}>
              {(item) => {
                const live = () => props.onToggleStep !== undefined;
                const marked = () => (live() ? item.done : checked(flipped, item));
                return (
                  <li>
                    <button
                      type="button"
                      class="maid-atelier-log__item"
                      role="checkbox"
                      aria-checked={marked() ? "true" : "false"}
                      onClick={() => {
                        if (live()) {
                          if (item.stepIndex !== undefined) {
                            props.onToggleStep?.(item.stepIndex);
                          }
                          return;
                        }
                        toggle(item.id);
                      }}
                    >
                      <span class="maid-atelier-log__check" aria-hidden="true" />
                      <span class="maid-atelier-log__label">{item.label}</span>
                      <Show when={item.refine}>
                        <span class="maid-atelier-log__refine">{t("agentsHome.maidRefine")}</span>
                      </Show>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </section>
    </Show>
  );
}
