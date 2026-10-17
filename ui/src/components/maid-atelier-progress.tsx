import type { ProgressCard } from "@openclaw/gateway-protocol";
import type { JSX } from "@solidjs/web";
import { createMemo, Show } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { resolveSessionDisplayName } from "../lib/session-display.ts";
import { MaidPresence } from "./maid-atelier-presence.tsx";
import {
  readMaidGoal,
  resolveMaidProgress,
  type MaidProgressTone,
  type MaidTone,
} from "./maid-atelier-status.ts";
import { useMaidTheme } from "./maid-atelier-theme.ts";
import { Icon } from "./solid/icon.tsx";
import "../styles/maid-atelier-chrome.css";

registerEnglishCatalog(registerAgentsHomeEnglish);

type MaidProgressSession = {
  key?: string;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  status?: string | null;
};

export function MaidAtelierProgress(props: {
  placement: "chip" | "strip";
  card?: Pick<ProgressCard, "markdown" | "steps"> | null;
  session?: MaidProgressSession | null;
  title?: string;
  activeRun?: boolean;
}): JSX.Element {
  const maid = useMaidTheme();
  return (
    <Show when={maid()}>
      <MaidAtelierProgressLive
        placement={props.placement}
        card={props.card}
        session={props.session}
        title={props.title}
        activeRun={props.activeRun}
      />
    </Show>
  );
}

const PROGRESS_STATUS_KEYS = {
  working: "agentsHome.maidStatusWorking",
  completed: "agentsHome.maidProgressCompleted",
  attention: "agentsHome.maidStatusAttention",
  idle: "agentsHome.maidStatusIdle",
} as const satisfies Record<MaidProgressTone, string>;

const LAMP_TONES = {
  working: "busy",
  completed: "success",
  attention: "attention",
  idle: "idle",
} as const satisfies Record<MaidProgressTone, MaidTone>;

function MaidAtelierProgressLive(props: {
  placement: "chip" | "strip";
  card?: Pick<ProgressCard, "markdown" | "steps"> | null;
  session?: MaidProgressSession | null;
  title?: string;
  activeRun?: boolean;
}) {
  const model = createMemo(() => {
    const session = props.session;
    const title =
      props.title?.trim() || (session?.key ? resolveSessionDisplayName(session.key, session) : "");
    return resolveMaidProgress({
      steps: props.card?.steps,
      markdown: props.card?.markdown,
      goal: readMaidGoal(session),
      title,
      sessionStatus: session?.status,
      activeRun: props.activeRun,
    });
  });
  const target = () => {
    const value = model().target.trim();
    if (value) {
      return value;
    }
    return model().source === "sample"
      ? t("agentsHome.maidSampleTarget")
      : t("agentsHome.maidCurrentSession");
  };
  const status = () => t(PROGRESS_STATUS_KEYS[model().tone]);
  const fraction = () => `${model().completed}/${model().total}`;
  return (
    <div
      class={`maid-atelier-progress maid-atelier-progress--${props.placement}`}
      role="status"
      data-tone={model().tone}
      data-source={model().source}
      aria-label={t("agentsHome.maidProgressLabel")}
    >
      <MaidPresence tone={LAMP_TONES[model().tone]} class="maid-atelier-progress__lamp" />
      <Show when={props.placement === "chip"}>
        <span class="maid-atelier-progress__status">{status()}</span>
      </Show>
      <span class="maid-atelier-progress__target" title={target()}>
        {props.placement === "strip"
          ? t("agentsHome.maidProgressTarget", { target: target(), status: status() })
          : target()}
      </span>
      <Show when={props.placement === "strip" && model().tone === "completed"}>
        <span class="maid-atelier-progress__check" aria-hidden="true">
          <Icon name="check" />
        </span>
      </Show>
      <Show when={model().source === "sample"}>
        <span class="maid-atelier-progress__sample">{t("agentsHome.maidProgressSample")}</span>
      </Show>
      <span class="maid-atelier-progress__fraction">
        {props.placement === "strip"
          ? t("agentsHome.maidProgressProcess", {
              completed: String(model().completed),
              total: String(model().total),
            })
          : fraction()}
      </span>
    </div>
  );
}
