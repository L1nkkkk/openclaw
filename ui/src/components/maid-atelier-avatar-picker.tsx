import { createSignal, For, onCleanup, Show } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import "../styles/maid-atelier-chrome.css";
import {
  maidAvatarAtelierSrc,
  maidPortraitChoiceLabel,
  type MaidAvatarChoice,
  type MaidAvatarSubject,
} from "./maid-atelier-avatar.ts";
import { MAID_PORTRAIT_SRCS } from "./maid-atelier-portraits.ts";

registerEnglishCatalog(registerAgentsHomeEnglish);

export function MaidAvatarPicker(props: {
  subject: MaidAvatarSubject;
  busy: boolean;
  error: string | null;
  inline?: boolean;
  onClose: () => void;
  onChoose: (choice: MaidAvatarChoice) => void;
}) {
  const atelier = () => maidAvatarAtelierSrc(props.subject);
  return (
    <div
      class={["maid-atelier-avatar-menu", { "maid-atelier-avatar-menu--inline": props.inline }]}
      data-maid-avatar-menu="open"
      data-maid-avatar-target={props.subject.id}
      role="group"
      aria-label={t("agentsHome.maidAvatarTitle")}
    >
      <div class="maid-atelier-avatar-menu__title">
        {t("agentsHome.maidAvatarChange", { name: props.subject.name })}
      </div>
      <p class="maid-atelier-avatar-menu__note">
        {props.subject.kind === "agent"
          ? t("agentsHome.maidAvatarAtelierNote")
          : t("agentsHome.maidAvatarUserNote")}
      </p>
      <button
        type="button"
        class="maid-atelier-avatar-menu__action"
        disabled={props.busy}
        onClick={(event) => {
          const input = event.currentTarget.nextElementSibling;
          if (input instanceof HTMLInputElement) {
            input.click();
          }
        }}
      >
        {props.busy ? t("agentsHome.maidAvatarSaving") : t("agentsHome.maidAvatarUpload")}
      </button>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            props.onChoose({ kind: "file", file });
          }
        }}
      />
      <div class="maid-atelier-avatar-menu__portraits">
        <For each={MAID_PORTRAIT_SRCS}>
          {(src) => (
            <button
              type="button"
              class="maid-atelier-avatar-menu__portrait"
              data-maid-avatar-portrait={src}
              disabled={props.busy}
              aria-label={t("agentsHome.maidAvatarPortrait", {
                index: maidPortraitChoiceLabel(src),
              })}
              onClick={() => props.onChoose({ kind: "portrait", src })}
            >
              <img src={src} alt="" />
            </button>
          )}
        </For>
      </div>
      <Show when={props.subject.custom ? atelier() : null}>
        {(src) => (
          <button
            type="button"
            class="maid-atelier-avatar-menu__action"
            data-maid-avatar-atelier="true"
            disabled={props.busy}
            onClick={() => props.onChoose({ kind: "portrait", src: src() })}
          >
            {t("agentsHome.maidAvatarAtelier")}
          </button>
        )}
      </Show>
      <Show when={props.error}>
        <p class="maid-atelier-avatar-menu__error" role="alert">
          {props.error}
        </p>
      </Show>
      <button
        type="button"
        class="maid-atelier-avatar-menu__action"
        onClick={() => props.onClose()}
      >
        {t("agentsHome.maidAvatarClose")}
      </button>
    </div>
  );
}

export function MaidAvatarEditor(props: {
  subject: MaidAvatarSubject | null;
  inline?: boolean;
  onClose: () => void;
  onCommit?: (subject: MaidAvatarSubject, choice: MaidAvatarChoice) => Promise<string | null>;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  const token = () => (props.subject ? `${props.subject.kind}:${props.subject.id}` : "");
  const choose = (choice: MaidAvatarChoice) => {
    const subject = props.subject;
    const started = token();
    if (!subject || busy()) {
      return;
    }
    if (!props.onCommit) {
      setError(t("agentsHome.maidAvatarUnavailable"));
      return;
    }
    setBusy(true);
    setError(null);
    void props.onCommit(subject, choice).then(
      (message) => {
        if (!alive || token() !== started) {
          return;
        }
        setBusy(false);
        if (message) {
          setError(message);
          return;
        }
        props.onClose();
      },
      () => {
        if (alive && token() === started) {
          setBusy(false);
          setError(t("agentsHome.maidAvatarFailed"));
        }
      },
    );
  };
  return (
    <Show when={props.subject}>
      {(subject) => (
        <MaidAvatarPicker
          subject={subject()}
          busy={busy()}
          error={error()}
          inline={props.inline}
          onClose={() => props.onClose()}
          onChoose={choose}
        />
      )}
    </Show>
  );
}
