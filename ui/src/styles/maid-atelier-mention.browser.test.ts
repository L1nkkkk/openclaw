import { afterEach, describe, expect, it } from "vitest";
import "./base.css";
import "./chat/composer-surface.css";
import "./maid-atelier-chrome.css";
import "./maid-atelier-presence.css";
import "./maid-atelier-sidebar.css";

const root = document.documentElement;

afterEach(() => {
  document.body.replaceChildren();
  delete root.dataset.themeId;
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
  expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(1);
  expect(Math.abs(actual[2] - expected[2])).toBeLessThanOrEqual(1);
}

function overlaps(left: DOMRect, right: DOMRect): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

describe.runIf("__vitest_browser__" in globalThis)("maid atelier mention layout", () => {
  it("keeps Goal and Process visible when the @ menu opens on a narrow composer", () => {
    root.dataset.themeId = "maid";
    root.dataset.themeMode = "dark";
    document.body.innerHTML = `
      <div class="agent-chat__composer-shell" style="width: 420px">
        <div class="chat-footer__context">
          <div class="agent-chat__goal-float"><div class="agent-chat__goal">Keep the rewrite</div></div>
          <div class="agent-chat__progress-float">Running</div>
        </div>
        <div class="agent-chat__input agent-chat__input--chat agent-chat__input--mobile-toolbar">
          <div class="maid-atelier-mention-menu" data-maid-mention-menu="open">
            <button type="button" class="maid-atelier-mention-menu__option">Notes</button>
          </div>
          <div class="agent-chat__composer-footer">
            <div class="agent-chat__composer-lead">+</div>
            <div class="agent-chat__composer-trail">
              <span class="maid-atelier-mention">@Notes</span>
              <span class="maid-atelier-mention">@Harper</span>
            </div>
            <div class="maid-atelier-progress maid-atelier-progress--strip">
              <span class="maid-atelier-progress__target">Goal lint · Working</span>
              <span class="maid-atelier-progress__fraction">Process 4/5</span>
            </div>
          </div>
        </div>
      </div>
      <div class="maid-atelier-agents__avatar">
        <span class="maid-presence" data-tone="busy"><span class="maid-presence__core"></span></span>
      </div>
      <div class="maid-atelier-agents__avatar">
        <span class="maid-presence" data-tone="idle"><span class="maid-presence__core"></span></span>
      </div>
      <span class="maid-presence" data-tone="pending"><span class="maid-presence__core"></span></span>
      <span class="maid-presence" data-tone="blocked"><span class="maid-presence__core"></span></span>
    `;
    const shell = document.querySelector<HTMLElement>(".agent-chat__composer-shell")!;
    const input = shell.querySelector<HTMLElement>(".agent-chat__input")!;
    const footer = shell.querySelector<HTMLElement>(".agent-chat__composer-footer")!;
    const strip = shell.querySelector<HTMLElement>(".maid-atelier-progress--strip")!;
    const menu = shell.querySelector<HTMLElement>(".maid-atelier-mention-menu")!;
    const goal = shell.querySelector<HTMLElement>(".agent-chat__goal-float")!;
    const footerStyle = getComputedStyle(footer);
    const stripBox = strip.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();
    const goalBox = goal.getBoundingClientRect();
    expect(getComputedStyle(input).position).toBe("static");
    expect(footerStyle.display).toBe("grid");
    expect(footerStyle.gridTemplateRows.startsWith("0px")).toBe(false);
    expect(getComputedStyle(strip).gridRowStart).toBe("1");
    expect(stripBox.height).toBeGreaterThan(10);
    expect(stripBox.width).toBeGreaterThan(footer.getBoundingClientRect().width * 0.9);
    expect(overlaps(menuBox, stripBox)).toBe(false);
    expect(overlaps(menuBox, goalBox)).toBe(false);
    expect(menuBox.bottom).toBeLessThanOrEqual(goalBox.top + 1);

    const fill = (tone: string) =>
      rgb(
        getComputedStyle(
          document.querySelector(`.maid-presence[data-tone="${tone}"] .maid-presence__core`)!,
        ).backgroundColor,
      );
    const busy = fill("busy");
    const idle = fill("idle");
    const pending = fill("pending");
    const blocked = fill("blocked");
    expect(busy[0] - busy[2]).toBeGreaterThan(120);
    expect(idle[1] - idle[0]).toBeGreaterThan(70);
    expect(Math.abs(busy[0] - idle[0])).toBeGreaterThan(80);
    near(pending, [91, 141, 239]);
    near(blocked, [212, 84, 106]);
    const outline = getComputedStyle(
      document.querySelector(".maid-presence[data-tone='busy'] .maid-presence__core")!,
    );
    expect(outline.borderTopStyle).toBe("solid");
    expect(parseFloat(outline.borderTopWidth)).toBeGreaterThan(0);
    expect(rgb(outline.borderTopColor)[0]).toBeLessThan(busy[0] - 40);
  });
});
