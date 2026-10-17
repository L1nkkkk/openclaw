import { afterEach, expect, it } from "vitest";
import { cleanupSolid, mountSolid } from "../test-helpers/mount-solid.ts";
import { flush } from "../test-helpers/solid-settle.ts";
import { MaidAtelierPreview } from "./maid-atelier-preview.tsx";

afterEach(() => {
  cleanupSolid();
  delete document.documentElement.dataset.themeId;
  delete document.documentElement.dataset.theme;
});

it("renders the density fixture as sidebar, checklist, and reader", () => {
  const view = mountSolid(() => <MaidAtelierPreview />);
  flush();
  const text = view.container.textContent ?? "";
  expect(text).toContain("Search");
  expect(text).toContain("New Maid");
  expect(text).toContain("SCP");
  expect(text).toContain("IFM");
  expect(text).toContain("Sides");
  expect(text).toContain("5 spaces");
  expect(text).toContain("Refine");
  expect(text).toContain("ch07_mud-and-whispers.md");
  expect(text).toContain("Goal");
  expect(text).toContain("The night market");
  expect(text).toContain("Source");
  expect(view.container.querySelector("[aria-label='Copy path']")).not.toBeNull();
  expect(view.container.querySelector("[data-maid-fixture='density']")).not.toBeNull();
  expect(view.container.querySelectorAll("[data-maid-nav]")).toHaveLength(7);
});
