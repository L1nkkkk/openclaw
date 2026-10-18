import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../api/gateway.ts";
import type { ApplicationContext } from "../app/context.ts";
import * as avatarImage from "../pages/agents/avatar-image.ts";
import * as profileAvatar from "../pages/profile/avatar-processing.ts";
import { commitMaidAvatar } from "./maid-atelier-avatar-save.ts";

beforeEach(() => {
  vi.spyOn(avatarImage, "fileToAvatarDataUrl");
  vi.spyOn(profileAvatar, "processProfileAvatar");
});

afterEach(() => {
  vi.restoreAllMocks();
});

function context(request: GatewayBrowserClient["request"]) {
  const client = { request } as GatewayBrowserClient;
  const updateSelfUser = vi.fn();
  return {
    updateSelfUser,
    context: {
      resourceBasePath: "",
      config: { current: { uploadsEnabled: true } },
      gateway: {
        snapshot: { client, selfUser: null },
        connection: { gatewayUrl: "https://gateway.example.test" },
        loadSelfProfile: async () => ({ id: "profile-mori" }),
        updateSelfUser,
      },
      agents: { refreshList: vi.fn(async () => undefined) },
      agentIdentity: {
        invalidate: vi.fn(),
        ensure: vi.fn(async () => undefined),
      },
      runtimeConfig: {
        runExternalMutation: async (task: (next: GatewayBrowserClient) => Promise<void>) => {
          await task(client);
          return { ok: true, refresh: { ok: true } };
        },
      },
    } as unknown as Pick<
      ApplicationContext,
      "gateway" | "agents" | "agentIdentity" | "runtimeConfig" | "config" | "resourceBasePath"
    >,
  };
}

describe("commitMaidAvatar", () => {
  it("stores an agent face through agents.update and refreshes identity", async () => {
    vi.mocked(avatarImage.fileToAvatarDataUrl).mockResolvedValue({
      ok: true,
      dataUrl: "data:image/png;base64,aA==",
    });
    const request = vi.fn(async () => ({ ok: true }));
    const harness = context(request);
    const error = await commitMaidAvatar(
      harness.context,
      { kind: "agent", id: "harper", name: "Harper", custom: false },
      { kind: "file", file: new File(["face"], "face.png", { type: "image/png" }) },
    );
    expect(error).toBeNull();
    expect(request).toHaveBeenCalledWith("agents.update", {
      agentId: "harper",
      avatar: "data:image/png;base64,aA==",
    });
    expect(harness.context.agentIdentity.invalidate).toHaveBeenCalledWith(["harper"]);
    expect(harness.context.agents.refreshList).toHaveBeenCalled();
  });

  it("stores the signed-in user's face through users.setAvatar", async () => {
    vi.mocked(profileAvatar.processProfileAvatar).mockResolvedValue({
      mime: "image/png",
      avatarBase64: "aA==",
      byteLength: 2,
    });
    const request = vi.fn(async () => ({
      profile: { id: "profile-mori" },
      avatarRevision: "3",
    }));
    const harness = context(request);
    const error = await commitMaidAvatar(
      harness.context,
      { kind: "user", id: "mori", name: "Mori", custom: false },
      { kind: "file", file: new File(["face"], "face.png", { type: "image/png" }) },
    );
    expect(error).toBeNull();
    expect(request).toHaveBeenCalledWith("users.setAvatar", {
      profileId: "profile-mori",
      mime: "image/png",
      avatarBase64: "aA==",
    });
    expect(harness.updateSelfUser).toHaveBeenCalled();
    const patch = harness.updateSelfUser.mock.calls[0]?.[0] as { avatarUrl?: string };
    expect(patch.avatarUrl).toContain("profile-mori");
  });

  it("refuses a portrait that is not one of the bundled atelier faces", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const request = vi.fn();
    const harness = context(request);
    const error = await commitMaidAvatar(
      harness.context,
      { kind: "agent", id: "harper", name: "Harper", custom: true },
      { kind: "portrait", src: "https://example.test/face.jpg" },
    );
    expect(error).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
