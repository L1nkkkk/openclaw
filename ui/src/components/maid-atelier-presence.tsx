import type { JSX } from "@solidjs/web";
import type { MaidTone } from "./maid-atelier-status.ts";
import "../styles/maid-atelier-presence.css";

/** Avatar-corner and chip presence badge. The label is the accessible name. */
export function MaidPresence(props: {
  tone: MaidTone;
  label?: string;
  class?: string;
}): JSX.Element {
  return (
    <span
      class={["maid-presence", props.class]}
      data-tone={props.tone}
      role={props.label ? "img" : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <span class="maid-presence__ping" />
      <span class="maid-presence__core" />
    </span>
  );
}
