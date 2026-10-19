import { afterEach, describe, expect, it } from "vitest";
import "../../public/themes/maid.css";
import "./base.css";
import "./maid-atelier-chrome.css";
import "./maid-atelier-presence.css";
import "./maid-atelier-shell.css";
import "./maid-atelier-sidebar.css";

const root = document.documentElement;

afterEach(() => {
  document.body.replaceChildren();
  delete root.dataset.themeId;
  delete root.dataset.theme;
  delete root.dataset.themeMode;
});

function rgb(color: string): [number, number, number] {
  const channels = /rgba?\((\d+),\s*(\d+),\s*(\d+)/u.exec(color);
  if (channels) {
    return [Number(channels[1]), Number(channels[2]), Number(channels[3])];
  }
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/u.exec(color);
  if (!srgb) {
    throw new Error(color);
  }
  return [1, 2, 3].map((index) => Math.round(Number(srgb[index]) * 255)) as [
    number,
    number,
    number,
  ];
}

function near(actual: readonly number[], expected: readonly number[]): void {
  expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(2);
  expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(2);
  expect(Math.abs(actual[2] - expected[2])).toBeLessThanOrEqual(2);
}

function hit(element: Element): boolean {
  const box = element.getBoundingClientRect();
  const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return target === element || element.contains(target);
}

describe.runIf("__vitest_browser__" in globalThis)("maid atelier polish", () => {
  it("brightens the mention bar, darkens pip rings, and shares the Goal accent", () => {
    root.dataset.themeId = "maid";
    root.dataset.theme = "maid";
    root.dataset.themeMode = "dark";
    document.body.innerHTML = `
      <span id="accent-probe" style="color: var(--accent)">accent</span>
      <div class="chat-bubble chat-bubble--mention" id="mentioned">@Notes</div>
      <div class="chat-bubble" id="plain">Continue.</div>
      <div class="maid-atelier-agents__avatar">
        <span class="maid-presence" data-tone="busy"><span class="maid-presence__core"></span></span>
      </div>
      <div class="maid-atelier-agents__avatar">
        <span class="maid-presence" data-tone="idle"><span class="maid-presence__core"></span></span>
      </div>
      <span class="maid-presence" data-tone="pending"><span class="maid-presence__core"></span></span>
      <span class="maid-presence" data-tone="blocked"><span class="maid-presence__core"></span></span>
      <div class="maid-atelier-progress maid-atelier-progress--strip" id="goal">Goal</div>
      <article class="sidebar-markdown-reader sidebar-markdown">
        <h1 id="chapter">gateway log</h1>
        <h2>later</h2>
      </article>
    `;
    const mention = getComputedStyle(document.querySelector("#mentioned")!);
    const accent = rgb(getComputedStyle(document.querySelector("#accent-probe")!).color);
    const bar = rgb(mention.borderInlineStartColor);
    expect(mention.borderInlineStartStyle).toBe("solid");
    expect(parseFloat(mention.borderInlineStartWidth)).toBe(2);
    expect(bar[0]).toBeGreaterThan(accent[0]);
    expect(bar[1]).toBeGreaterThan(accent[1]);
    expect(bar[2]).toBeGreaterThan(accent[2]);
    expect(getComputedStyle(document.querySelector("#plain")!).borderInlineStartWidth).toBe("0px");

    const core = (tone: string) =>
      document.querySelector(`.maid-presence[data-tone="${tone}"] .maid-presence__core`)!;
    const fill = (tone: string) => rgb(getComputedStyle(core(tone)).backgroundColor);
    near(fill("pending"), [91, 141, 239]);
    near(fill("blocked"), [212, 84, 106]);
    const busy = fill("busy");
    const idle = fill("idle");
    expect(busy[0]).toBeGreaterThan(busy[2]);
    expect(idle[1]).toBeGreaterThan(idle[0]);
    const ring = getComputedStyle(core("busy"));
    expect(ring.borderTopStyle).toBe("solid");
    // Chromium reports the used border width, which can round 1.5px down to 1px.
    expect(parseFloat(ring.borderTopWidth)).toBeGreaterThanOrEqual(1);
    const ringColor = rgb(ring.borderTopColor);
    // 74% black over the maid surface is darker than the previous 58% mix (~12, 12, 14).
    expect(ringColor[0]).toBeLessThan(12);
    expect(ringColor[1]).toBeLessThan(12);
    expect(ringColor[2]).toBeLessThan(14);
    expect(rgb(getComputedStyle(core("idle")).borderTopColor)).toEqual(ringColor);

    const goal = rgb(getComputedStyle(document.querySelector("#goal")!).borderInlineStartColor);
    const chapter = rgb(
      getComputedStyle(document.querySelector("#chapter")!).borderInlineStartColor,
    );
    expect(chapter).toEqual(goal);
    near(goal, [96, 165, 250]);
    expect(getComputedStyle(document.querySelector("h2")!).borderInlineStartStyle).not.toBe(
      "solid",
    );
  });

  it("keeps the face-drawer title and the room title uncovered", () => {
    root.dataset.themeId = "maid";
    root.dataset.theme = "maid";
    root.dataset.themeMode = "dark";
    document.body.innerHTML = `
      <section class="maid-atelier-agents" style="height: 280px; width: 280px">
        <nav class="maid-atelier-nav"><button type="button" class="maid-atelier-nav__item">Home</button></nav>
        <div class="maid-atelier-agents__scroll"></div>
        <div class="maid-atelier-avatar-menu" data-maid-avatar-menu="open">
          <div class="maid-atelier-avatar-menu__title" id="drawer-title">Change Harper's face</div>
          <div class="maid-atelier-avatar-menu__portraits">
            ${Array.from({ length: 8 }, () => `<button type="button" class="maid-atelier-avatar-menu__portrait"></button>`).join("")}
          </div>
        </div>
        <div class="maid-atelier-profile"><span class="maid-atelier-agents__name" id="profile-name">Mori</span></div>
      </section>
      <div class="chat-main" style="position: relative; width: 420px; margin-top: 12px">
        <div class="chat-main__conversation" style="position: relative">
          <div id="fade" style="position: absolute; z-index: 2; inset: 0 0 auto; height: 24px; background: rgb(255, 0, 0)"></div>
          <div class="maid-atelier-room-wrap">
            <header class="maid-atelier-room"><div class="maid-atelier-room__title" id="room-title">deploy check</div></header>
            <div class="maid-atelier-avatar-menu" data-maid-avatar-menu="open">
              <div class="maid-atelier-avatar-menu__title" id="room-drawer-title">Change Harper's face</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const drawerTitle = document.querySelector("#drawer-title")!;
    const profile = document.querySelector("#profile-name")!;
    const roomTitle = document.querySelector("#room-title")!;
    const roomDrawer = document.querySelector("#room-drawer-title")!;
    const section = document.querySelector(".maid-atelier-agents")!;
    expect(hit(drawerTitle)).toBe(true);
    expect(hit(profile)).toBe(true);
    expect(profile.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      section.getBoundingClientRect().bottom + 1,
    );
    expect(hit(roomTitle)).toBe(true);
    expect(hit(roomDrawer)).toBe(true);
    const roomBox = roomTitle.getBoundingClientRect();
    const drawerBox = roomDrawer.getBoundingClientRect();
    expect(roomBox.bottom).toBeLessThanOrEqual(drawerBox.top + 1);
  });
});
