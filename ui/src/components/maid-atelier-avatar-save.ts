import type { UsersSetAvatarResult } from "../../../packages/gateway-protocol/src/index.ts";
import type { ApplicationContext } from "../app/context.ts";
import { registerProfileEnglish } from "../i18n/locales/en-profile.ts";
import { formatUiError } from "../lib/format-error.ts";
import { registerEnglishCatalog, t } from "../lib/reactive/i18n.ts";
import { uploadsDisabledMessage, uploadsEnabled } from "../lib/uploads.ts";
import { fileToAvatarDataUrl } from "../pages/agents/avatar-image.ts";
import { saveIdentityDraft } from "../pages/agents/identity-actions.ts";
import { processProfileAvatar, ProfileAvatarError } from "../pages/profile/avatar-processing.ts";
import { userProfileAvatarUrl } from "../pages/profile/profile-avatar-url.ts";
import {
  acceptedMaidPortrait,
  type MaidAvatarChoice,
  type MaidAvatarSubject,
} from "./maid-atelier-avatar.ts";

registerEnglishCatalog(registerProfileEnglish);

type MaidAvatarContext = Pick<
  ApplicationContext,
  "gateway" | "agents" | "agentIdentity" | "runtimeConfig" | "config" | "resourceBasePath"
>;

const AVATAR_REJECTION = {
  unusable: "agents.identity.imageUnusable",
  "too-detailed": "agents.identity.imageTooDetailed",
} as const;

/**
 * Persist a Maid Atelier face through the existing identity owners.
 * `agents.update` and `users.setAvatar` only replace an image. An empty
 * avatar is dropped, and IDENTITY.md keeps the previous line, so choosing
 * the atelier portrait stores that bundled picture. With no saved face, the
 * shell still falls back to `maidPortraitSrc`.
 */
export async function commitMaidAvatar(
  context: MaidAvatarContext,
  subject: MaidAvatarSubject,
  choice: MaidAvatarChoice,
): Promise<string | null> {
  if (!uploadsEnabled(context.config)) {
    return uploadsDisabledMessage();
  }
  try {
    const file = choice.kind === "file" ? choice.file : await fileForPortrait(choice.src);
    return subject.kind === "agent"
      ? await saveAgentFace(context, subject.id, file)
      : await saveUserFace(context, file);
  } catch (error) {
    return avatarError(error);
  }
}

async function fileForPortrait(src: string): Promise<File> {
  const allowed = acceptedMaidPortrait(src);
  if (!allowed) {
    throw new Error(t("agentsHome.maidAvatarFailed"));
  }
  const response = await fetch(allowed);
  if (!response.ok) {
    throw new Error(t("agentsHome.maidAvatarFailed"));
  }
  const blob = await response.blob();
  return new File([blob], "atelier-portrait.jpg", { type: blob.type || "image/jpeg" });
}

async function saveAgentFace(
  context: MaidAvatarContext,
  agentId: string,
  file: File,
): Promise<string | null> {
  const id = agentId.trim();
  const client = context.gateway.snapshot.client;
  if (!id || !client) {
    return t("agentsHome.maidAvatarUnavailable");
  }
  const encoded = await fileToAvatarDataUrl(file, context.config);
  if (!encoded.ok) {
    return t(AVATAR_REJECTION[encoded.reason]);
  }
  const host = {
    identityDraft: { name: null, emoji: null, avatar: encoded.dataUrl },
    identitySaving: false,
    identityError: null as string | null,
  };
  await saveIdentityDraft({
    host,
    config: context.config,
    expectedClient: client,
    agentId: id,
    agents: context.agents,
    agentIdentity: context.agentIdentity,
    runtimeConfig: context.runtimeConfig,
    canDispatch: () => context.gateway.snapshot.client === client,
    isCurrent: () => context.gateway.snapshot.client === client,
    onSaved: () => undefined,
  });
  return host.identityError;
}

async function saveUserFace(context: MaidAvatarContext, file: File): Promise<string | null> {
  const client = context.gateway.snapshot.client;
  const profile = await context.gateway.loadSelfProfile();
  if (!client || !profile) {
    return t("agentsHome.maidAvatarUnavailable");
  }
  if (!uploadsEnabled(context.config) || context.gateway.snapshot.client !== client) {
    return uploadsEnabled(context.config)
      ? t("agentsHome.maidAvatarUnavailable")
      : uploadsDisabledMessage();
  }
  const avatar = await processProfileAvatar(file);
  if (context.gateway.snapshot.client !== client) {
    return t("agentsHome.maidAvatarUnavailable");
  }
  const selfBefore =
    context.gateway.snapshot.selfUser?.id === profile.id
      ? context.gateway.snapshot.selfUser.avatarUrl
      : undefined;
  const result = await client.request<UsersSetAvatarResult>("users.setAvatar", {
    profileId: profile.id,
    mime: avatar.mime,
    avatarBase64: avatar.avatarBase64,
  });
  if (context.gateway.snapshot.client !== client) {
    return null;
  }
  const avatarUrl = userProfileAvatarUrl(
    context.gateway.connection.gatewayUrl,
    result.profile.id,
    result.avatarRevision,
    context.resourceBasePath,
  );
  const presenceChanged =
    context.gateway.snapshot.selfUser?.id === result.profile.id &&
    context.gateway.snapshot.selfUser.avatarUrl !== selfBefore;
  if (avatarUrl && !presenceChanged) {
    context.gateway.updateSelfUser?.({ avatarUrl });
  }
  return null;
}

function avatarError(error: unknown): string {
  if (error instanceof ProfileAvatarError) {
    return t(
      error.code === "too-large"
        ? "profilePage.identity.avatarErrors.tooLarge"
        : error.code === "source-too-large"
          ? "profilePage.identity.avatarErrors.sourceTooLarge"
          : "profilePage.identity.avatarErrors.invalid",
    );
  }
  return formatUiError(error, t("agentsHome.maidAvatarFailed"));
}
