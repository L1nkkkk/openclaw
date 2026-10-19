import { afterEach, expect, it } from "vitest";
import { cleanupSolid, mountSolid } from "../test-helpers/mount-solid.ts";
import { flush } from "../test-helpers/solid-settle.ts";
import { MaidAtelierBoard } from "./maid-atelier-agents.tsx";
import { MAID_SAMPLE_FILES, maidDensitySections } from "./maid-atelier-board.ts";
import { maidPortraitSrc } from "./maid-atelier-portraits.ts";
import { MaidAtelierPreview } from "./maid-atelier-preview.tsx";
import { MaidAtelierProgress } from "./maid-atelier-progress.tsx";
import { MaidAtelierRoom } from "./maid-atelier-room.tsx";
import { MaidAtelierTaskLog } from "./maid-atelier-task-log.tsx";

afterEach(() => {
  cleanupSolid();
  delete document.documentElement.dataset.themeId;
  delete document.documentElement.dataset.theme;
});

function rowTone(root: ParentNode, name: string): string | null {
  const row = [...root.querySelectorAll<HTMLElement>("[data-maid-tone]")].find(
    (entry) => entry.querySelector(".maid-atelier-agents__name")?.textContent === name,
  );
  return row?.getAttribute("data-maid-tone") ?? null;
}

it("renders the density fixture as sidebar, checklist, and reader", () => {
  const view = mountSolid(() => <MaidAtelierPreview />);
  flush();
  const text = view.container.textContent ?? "";
  expect(text).toContain("Search");
  expect(text).toContain("New Maid");
  expect(text).toContain("Ops");
  expect(text).toContain("Field");
  expect(text).toContain("Queue");
  expect(text).toContain("5 spaces");
  expect(text).toContain("Pending");
  expect(text).toContain("Blocked");
  expect(text).toContain("Goal");
  expect(text).not.toContain("Sample");
  expect(view.container.querySelector("[data-maid-fixture='density']")).not.toBeNull();
  expect(text).not.toContain("night market");
  expect(text).not.toContain("Chapter");
  expect(text).not.toContain("volume");
  expect(text).toContain("Group · 3");
  expect(text).toContain("Pull in");
  expect(text).toContain("Harper");
  expect(text).toContain("Notes");
  expect(text).toContain("Mori");
  expect(view.container.querySelector("[data-maid-room='group']")).not.toBeNull();
  expect(view.container.querySelectorAll("[data-maid-chat='fixture'] .chat-avatar")).toHaveLength(
    5,
  );
  expect(text).toContain("gateway log");
  expect(rowTone(view.container, "gateway log")).toBe("busy");
  expect(rowTone(view.container, "config diff")).toBe("pending");
  expect(rowTone(view.container, "release cut")).toBe("blocked");
  expect(
    view.container
      .querySelector("[data-maid-tone='busy'] .maid-presence")
      ?.getAttribute("data-tone"),
  ).toBe("busy");
  expect(
    view.container
      .querySelector("[data-maid-tone='blocked'] .maid-presence")
      ?.getAttribute("data-tone"),
  ).toBe("blocked");
  expect(view.container.querySelector("[data-maid-hold='pending']")?.textContent).toContain(
    "Pending",
  );
  expect(
    view.container
      .querySelector("[data-maid-hold='pending'] .maid-presence")
      ?.getAttribute("data-tone"),
  ).toBe("pending");
  expect(
    view.container
      .querySelector("[data-maid-hold='blocked'] .maid-presence")
      ?.getAttribute("data-tone"),
  ).toBe("blocked");
  expect(text).toContain("Source");
  expect(view.container.querySelector("[aria-label='Copy path']")).not.toBeNull();
  expect(view.container.querySelector("[data-maid-fixture='density']")).not.toBeNull();
  const session = view.container.querySelector("[data-maid-kind='session']");
  expect(session?.querySelector(".maid-atelier-agents__portrait")).not.toBeNull();
  expect(session?.querySelector(".maid-presence")).not.toBeNull();
  expect(view.container.querySelectorAll("[data-maid-nav]")).toHaveLength(7);
});

it("uses an honest empty goal and log instead of a Sample stand-in", () => {
  document.documentElement.dataset.themeId = "maid";
  const progress = mountSolid(() => <MaidAtelierProgress placement="strip" />);
  flush();
  const goal = progress.container.textContent ?? "";
  expect(goal).toContain("No goal");
  expect(goal).not.toContain("Sample");
  expect(goal).not.toContain("Process");
  expect(progress.container.querySelector("[data-source='empty']")).not.toBeNull();
  expect(goal).not.toContain("rewrite");
  cleanupSolid();
  const log = mountSolid(() => <MaidAtelierTaskLog active />);
  flush();
  const line = log.container.textContent ?? "";
  expect(line).toContain("No log.");
  expect(line).not.toContain("Sample");
  expect(line).not.toContain("lint");
  expect(line).not.toContain("Chapter");
  cleanupSolid();
  const welcome = mountSolid(() => <MaidAtelierTaskLog />);
  flush();
  expect(welcome.container.textContent ?? "").toBe("");
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
  expect(center?.querySelectorAll("[data-maid-chat='fixture'] .chat-avatar")).toHaveLength(3);
});

it("opens the group @ picker for agents already in the room", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="mention" />);
  flush();
  const center = view.container.querySelector("[data-maid-shot='center']");
  const options = [...(center?.querySelectorAll("[data-maid-mention-option]") ?? [])].map(
    (option) => option.getAttribute("data-maid-mention-option"),
  );
  expect(options).toEqual(["harper", "notes"]);
  expect(center?.querySelector("[data-maid-mention-menu='open']")).not.toBeNull();
  expect(center?.querySelector("[data-maid-mention='notes']")).not.toBeNull();
  const strip = center?.querySelector(
    ".maid-atelier-preview__composer .maid-atelier-progress--strip",
  );
  expect(strip?.textContent).toContain("Goal");
  expect(strip?.textContent).toContain("Process 4/5");
  expect(center?.querySelector("[data-maid-mention-menu='open']")?.contains(strip ?? null)).toBe(
    false,
  );
  expect(center?.textContent).not.toContain("Sample");
  expect(center?.textContent).toContain("Agents in this group");
  expect(center?.querySelector("[data-maid-room='group']")).not.toBeNull();
});

it("shows a composed @mention chip without the picker", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="mentioned" />);
  flush();
  const center = view.container.querySelector("[data-maid-shot='center']");
  expect(center?.querySelector("[data-maid-mention-menu]")).toBeNull();
  expect(center?.querySelector("[data-maid-mention='notes']")).not.toBeNull();
  expect(center?.textContent).toContain("review the diff.");
  expect(center?.textContent).not.toContain("Sample");
});

it("does not open the multi-agent picker in a private chat", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="dm" />);
  flush();
  expect(view.container.querySelector("[data-maid-mention-menu]")).toBeNull();
  expect(view.container.querySelector("[data-maid-mention]")).toBeNull();
});

it("keeps the face panel in the chat column and off the reader title", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="avatar" />);
  flush();
  const reader = view.container.querySelector("[data-maid-shot='reader']");
  const menu = view.container.querySelector("[data-maid-avatar-menu='open']");
  expect(reader?.querySelector("[data-maid-avatar-menu]")).toBeNull();
  expect(menu?.closest("[data-maid-shot='center']")).not.toBeNull();
  expect(reader?.querySelector(".sidebar-file-view__path")?.textContent).toContain(
    "logs/gateway.log",
  );
  expect(reader?.querySelector("h1")?.textContent).toContain("gateway log");
});

it("opens the face picker for an agent without a Sample badge", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="avatar" />);
  flush();
  const center = view.container.querySelector("[data-maid-shot='center']");
  expect(center?.querySelector("[data-maid-avatar-menu='open']")).not.toBeNull();
  expect(center?.querySelector("[data-maid-avatar-target='harper']")).not.toBeNull();
  expect(center?.querySelector("[data-maid-avatar-atelier='true']")).not.toBeNull();
  expect(center?.querySelectorAll("[data-maid-avatar-portrait]")).toHaveLength(8);
  expect(center?.textContent).toContain("Change Harper's face");
  expect(center?.textContent).toContain("Upload a picture");
  expect(center?.textContent).not.toContain("Sample");
  expect(center?.querySelector("[data-maid-room='group']")).not.toBeNull();
  expect(view.container.textContent).not.toContain("Wardrobe");
  expect(view.container.querySelector(".maid-atelier-agents__plate")).toBeNull();
});

it("shows a replaced agent face in the room and the thread", () => {
  const view = mountSolid(() => <MaidAtelierPreview scene="avatar-set" />);
  flush();
  const faces = [...view.container.querySelectorAll<HTMLImageElement>("[data-maid-face='harper']")];
  expect(faces.length).toBeGreaterThan(0);
  const src = faces[0]?.getAttribute("src");
  expect(src).toMatch(/^\/maid-avatars\/\d+\.jpg$/u);
  expect(src).not.toBe(maidPortraitSrc("harper"));
  expect(faces.every((face) => face.getAttribute("src") === src)).toBe(true);
  expect(view.container.querySelector("[data-maid-agent='harper'] img")?.getAttribute("src")).toBe(
    src,
  );
  expect(view.container.querySelector("[data-maid-member='harper'] img")?.getAttribute("src")).toBe(
    src,
  );
  expect(view.container.querySelector("[data-maid-avatar-menu]")).toBeNull();
  expect(view.container.textContent).not.toContain("Sample");
});

it("opens the face picker from a sidebar portrait and the profile strip", () => {
  const view = mountSolid(() => (
    <MaidAtelierBoard
      sections={maidDensitySections(1)}
      tasks={{ sample: true, items: MAID_SAMPLE_FILES }}
      profile={{ name: "Mori", status: "Online", portraitId: "mori", online: true }}
      currentId="harper"
      currentSessionKey=""
      onOpenAgent={() => undefined}
      onOpenSession={() => undefined}
      onNav={() => undefined}
      done={() => new Set()}
      onToggleTask={() => undefined}
      onCommit={() => Promise.resolve("stay open")}
    />
  ));
  flush();
  expect(view.container.querySelector("[data-maid-avatar-menu]")).toBeNull();
  view.container.querySelector<HTMLElement>("[data-maid-avatar-edit='harper']")?.click();
  flush();
  expect(view.container.querySelector("[data-maid-avatar-target='harper']")).not.toBeNull();
  expect(view.container.textContent).toContain("Change Harper's face");
  view.container.querySelector<HTMLButtonElement>(".maid-atelier-profile")?.click();
  flush();
  expect(view.container.querySelector("[data-maid-avatar-target='mori']")).not.toBeNull();
  expect(view.container.textContent).toContain("A saved picture stays until you choose another.");
});

it("opens the face picker from a room face", () => {
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
      candidates={[]}
      portrait={() => "/maid-avatars/01.jpg"}
      onCommit={() => Promise.resolve(null)}
    />
  ));
  flush();
  view.container.querySelector<HTMLButtonElement>("[data-maid-member='harper']")?.click();
  flush();
  expect(view.container.querySelector("[data-maid-avatar-target='harper']")).not.toBeNull();
  expect(view.container.querySelector("[data-maid-avatar-atelier]")).toBeNull();
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
