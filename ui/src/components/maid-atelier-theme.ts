import { createSignal, onCleanup } from "solid-js";

export function maidThemeSelected(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.themeId === "maid";
}

/** Follow the document theme. Maid chrome stays unmounted for every other theme. */
export function useMaidTheme() {
  const [active, setActive] = createSignal(maidThemeSelected());
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return active;
  }
  const observer = new MutationObserver(() => setActive(maidThemeSelected()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-id"],
  });
  onCleanup(() => observer.disconnect());
  return active;
}
