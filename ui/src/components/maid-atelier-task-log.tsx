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
  /** Sample files stay off an empty welcome thread. Real steps still show. */
  active?: boolean;
}): JSX.Element {
  const maid = useMaidTheme();
  return (
    <Show when={maid()}>
      <MaidAtelierTaskLogLive card={props.card} active={props.active} />
    </Show>
  );
}

function MaidAtelierTaskLogLive(props: {
  card?: Pick<ProgressCard, "markdown" | "steps"> | null;
  active?: boolean;
}) {
  const model = createMemo(() =>
    maidChecklistModel({
      steps: props.card?.steps,
      markdown: props.card?.markdown,
    }),
  );
  const visible = () => !model().sample || props.active === true;
  const [flipped, setFlipped] = createSignal<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(flipped());
    if (!next.delete(id)) {
      next.add(id);
    }
    setFlipped(next);
  };
  const log = () => model().log || (model().sample ? t("agentsHome.maidTaskLogSample") : "");
  return (
    <Show when={visible() && model().items.length > 0}>
      <section class="maid-atelier-log" aria-label={t("agentsHome.maidChecklist")}>
        <Show when={log()}>
          <p class="maid-atelier-log__line">
            {log()}
            <Show when={model().sample}>
              <span class="maid-atelier-log__sample">{t("agentsHome.maidProgressSample")}</span>
            </Show>
          </p>
        </Show>
        <ul class="maid-atelier-log__list">
          <For each={model().items}>
            {(item) => (
              <li>
                <button
                  type="button"
                  class="maid-atelier-log__item"
                  role="checkbox"
                  aria-checked={checked(flipped, item) ? "true" : "false"}
                  onClick={() => toggle(item.id)}
                >
                  <span class="maid-atelier-log__check" aria-hidden="true" />
                  <span class="maid-atelier-log__label">{item.label}</span>
                  <Show when={item.refine}>
                    <span class="maid-atelier-log__refine">{t("agentsHome.maidRefine")}</span>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
