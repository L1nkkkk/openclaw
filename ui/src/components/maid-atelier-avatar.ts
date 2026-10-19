import { maidPortraitSrc, MAID_PORTRAIT_SRCS } from "./maid-atelier-portraits.ts";

export type MaidAvatarSubject = {
  kind: "user" | "agent";
  id: string;
  name: string;
  /** True when a saved image already wins over the atelier fallback. */
  custom: boolean;
};

export type MaidAvatarChoice = { kind: "file"; file: File } | { kind: "portrait"; src: string };

/** Bundled portraits the picker can store. Anything else is refused. */
export function acceptedMaidPortrait(src: string): string | null {
  return (MAID_PORTRAIT_SRCS as readonly string[]).includes(src) ? src : null;
}

/** Agents can store the hash fallback as their face. Users have no such portrait. */
export function maidAvatarAtelierSrc(subject: MaidAvatarSubject): string | null {
  return subject.kind === "agent" && subject.id.trim() ? maidPortraitSrc(subject.id) : null;
}

export function maidPortraitChoiceLabel(src: string): string {
  const index = (MAID_PORTRAIT_SRCS as readonly string[]).indexOf(src);
  return String(index + 1);
}
