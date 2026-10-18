import type { JSX } from "@solidjs/web";
import { createSignal } from "solid-js";
import { registerAgentsHomeEnglish } from "../i18n/locales/en-agents-home.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { MaidAtelierBoard } from "./maid-atelier-agents.tsx";
import { MAID_SAMPLE_FILES, maidDensitySections } from "./maid-atelier-board.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";
import { MaidPresence } from "./maid-atelier-presence.tsx";
import { MaidAtelierProgress } from "./maid-atelier-progress.tsx";
import type { MaidTone } from "./maid-atelier-status.ts";
import { MaidAtelierTaskLog } from "./maid-atelier-task-log.tsx";
import { Icon } from "./solid/icon.tsx";

registerEnglishCatalog(registerAgentsHomeEnglish);

const PREVIEW_CARD = {
  markdown: "Chapter files are open in the reader. Leave the ending where it is.",
  steps: [
    { step: "ch03_dawn-wind.md", status: "completed" as const },
    { step: "ch04_in-the-dark.md", status: "completed" as const },
    { step: "ch07_mud-and-whispers.md", status: "in_progress" as const },
    { step: "ch10_open-air.md", status: "completed" as const },
    { step: "Finish the rewrite of volume 1", status: "completed" as const },
  ],
};

function SampleChatRow(props: {
  side: "assistant" | "user";
  name: string;
  portraitId: string;
  tone: MaidTone;
  when: string;
  text: string;
}) {
  return (
    <div class={`chat-group ${props.side} chat-group--with-footer`} data-maid-speaker={props.name}>
      <span class="chat-avatar-slot maid-atelier-chat__avatar">
        <img class={`chat-avatar ${props.side}`} src={maidPortraitSrc(props.portraitId)} alt="" />
        <MaidPresence tone={props.tone} label={props.name} />
      </span>
      <div class="chat-group-messages">
        <div class="chat-bubble">{props.text}</div>
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

/** Density stand-in for screenshots. Project names and lines here are not live data. */
export function MaidAtelierPreview(): JSX.Element {
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
  const sections = maidDensitySections(Date.now());
  for (const section of sections) {
    section.sample = false;
  }
  return (
    <div class="maid-atelier-preview" data-maid-fixture="density">
      <p class="maid-atelier-preview__note">
        Density fixture for the maid atelier. These project names are not live sessions.
      </p>
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
          currentId="harper"
          currentSessionKey="fixture:chapter-seven"
          onOpenAgent={() => undefined}
          onOpenSession={() => undefined}
          onNav={() => undefined}
          done={flipped}
          onToggleTask={toggle}
        />
      </aside>
      <div class="maid-atelier-preview__center" data-maid-shot="center">
        <header class="chat-pane__header maid-atelier-preview__header">
          <span class="chat-pane__session-title">manuscript / Chapter seven</span>
          <MaidAtelierProgress placement="chip" card={PREVIEW_CARD} activeRun={true} />
        </header>
        <div class="maid-atelier-preview__thread" data-maid-chat="sample">
          <MaidAtelierTaskLog card={PREVIEW_CARD} active={true} />
          <p class="maid-atelier-chat__sample">{t("agentsHome.maidProgressSample")}</p>
          <SampleChatRow
            side="assistant"
            name="Harper"
            portraitId="harper"
            tone="busy"
            when="2m ago"
            text="The draft is open in the reader. I kept the chapter title and loosened the first two paragraphs. The ending stays where it was."
          />
          <SampleChatRow
            side="assistant"
            name="Notes"
            portraitId="notes"
            tone="idle"
            when="8m ago"
            text="The margin can wait. I will file it once the ending stays put."
          />
          <SampleChatRow
            side="user"
            name="Mori"
            portraitId="mori"
            tone="success"
            when="1m ago"
            text="Keep going from the checkpoint, and leave the ending alone."
          />
          <SampleChatRow
            side="assistant"
            name="Harper"
            portraitId="harper"
            tone="busy"
            when="Just now"
            text="I shortened the lamp line and left the last page face down. The crossed-out sentence stays in the margin."
          />
          <SampleChatRow
            side="user"
            name="Mori"
            portraitId="mori"
            tone="success"
            when="Just now"
            text="That is enough for this pass. File the chapter where it is."
          />
        </div>
        <div class="agent-chat__input maid-atelier-preview__composer">
          <div class="maid-atelier-preview__draft">Message Harper…</div>
          <div class="maid-atelier-preview__composer-bar">
            <span class="maid-atelier-preview__model">gemini-3.1-flash-lite</span>
            <button type="button" class="maid-atelier-preview__send">
              Send
            </button>
          </div>
          <MaidAtelierProgress placement="strip" card={PREVIEW_CARD} activeRun={true} />
        </div>
      </div>
      <aside class="maid-atelier-preview__reader" data-maid-shot="reader">
        <section class="sidebar-markdown-shell">
          <div class="sidebar-file-view__path-bar">
            <div class="sidebar-file-view__path-field">
              <span class="sidebar-file-view__path" title="manuscript/chapter-07.md">
                manuscript/chapter-07.md
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
            <h1>The night market</h1>
            <p>
              The stall lights came on one row at a time. Harper waited at the last table, a
              marked-up chapter folded under one hand, and listened to the oil pop in the pans.
            </p>
            <p>
              Chief Maid read the note twice. The ending stayed where it was. Everything before it
              could still move: the first paragraph, the title, the line about the lamps.
            </p>
            <h2>After the checkpoint</h2>
            <p>
              She crossed out the sentence that explained the trick and left the smell of sugar and
              iron. A boy at the next table counted coins into a tin. Nobody looked up when the
              chapter changed hands.
            </p>
            <p>
              By the time the last lamp took, the page was shorter and the night was not. Harper
              slid the draft back across the wood. “Keep the ending,” the note said. She already
              had.
            </p>
            <p>
              The market kept its own hours. When the row went dark, the only thing still bright was
              the margin she had refused to touch.
            </p>
            <h2>What still moved</h2>
            <p>
              The title lost two words and gained a lamp. The first paragraph stopped explaining who
              had arrived and let the oil do it. A crossed-out line about the trick stayed in the
              margin, smaller than the sentence it used to be.
            </p>
            <p>
              Harper counted the open files the way the boy counted coins: three still warm, one
              already filed, and the last page left face down. Chief Maid did not ask for that page.
              The note under the folded chapter said the same thing it had said at dusk.
            </p>
            <p>
              Outside, the row went dark from the far end inward. The wood kept the heat of the
              pans. She slid the draft back, set her hand on the untouched ending, and waited for
              the next instruction to be shorter than the one before it.
            </p>
          </article>
        </section>
      </aside>
    </div>
  );
}
