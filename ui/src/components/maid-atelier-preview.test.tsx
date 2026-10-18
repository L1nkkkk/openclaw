import { afterEach, expect, it } from "vitest";
import { cleanupSolid, mountSolid } from "../test-helpers/mount-solid.ts";
import { flush } from "../test-helpers/solid-settle.ts";
import { MaidAtelierPreview } from "./maid-atelier-preview.tsx";
import { MaidAtelierRoom } from "./maid-atelier-room.tsx";

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
  expect(text).toContain("Sample");
  expect(text).toContain("Group · 3");
  expect(text).toContain("Pull in");
  expect(text).toContain("Harper");
  expect(text).toContain("Notes");
  expect(text).toContain("Mori");
  expect(view.container.querySelector("[data-maid-room='group']")).not.toBeNull();
  expect(view.container.querySelectorAll("[data-maid-chat='sample'] .chat-avatar")).toHaveLength(5);
  expect(text).toContain("The night market");
  expect(text).toContain("Source");
  expect(view.container.querySelector("[aria-label='Copy path']")).not.toBeNull();
  expect(view.container.querySelector("[data-maid-fixture='density']")).not.toBeNull();
  expect(view.container.querySelectorAll("[data-maid-nav]")).toHaveLength(7);
});

it("renders a private chat with only the user and the main agent", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="dm" />);
  flush();
  const center = view.container.querySelector("[data-maid-shot='center']");
  const text = center?.textContent ?? "";
  expect(center?.querySelector("[data-maid-room='dm']")).not.toBeNull();
  expect(text).toContain("Private");
  expect(text).toContain("Harper");
  expect(text).toContain("Mori");
  expect(text).not.toContain("Notes");
  expect(center?.querySelectorAll("[data-maid-chat='sample'] .chat-avatar")).toHaveLength(3);
});

it("lists real other agents to pull in, and stays labeled Sample", () => {
  let pulled = "";
  const view = mountSolid(() => (
    <MaidAtelierRoom
      room={{
        kind: "dm",
        title: "Harper",
        memberCount: 2,
        members: [
          { id: "mori", name: "Mori", kind: "user" },
          { id: "harper", name: "Harper", kind: "agent" },
        ],
      }}
      candidates={[
        { id: "notes", name: "Notes" },
        { id: "archive", name: "Archive" },
      ]}
      sample
      menuPinned
      portrait={() => null}
      onPull={(agent) => {
        pulled = agent.name;
      }}
    />
  ));
  flush();
  const notes = view.container.querySelector<HTMLButtonElement>("[data-maid-candidate='notes']");
  notes?.click();
  flush();
  expect(pulled).toBe("Notes");
  expect(view.container.textContent).toContain("Sample");
  expect(view.container.textContent).toContain("Archive");
});
