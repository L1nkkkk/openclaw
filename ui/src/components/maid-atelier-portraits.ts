/** Bundled stand-in faces for maids who have no uploaded avatar. */
const MAID_PORTRAITS = [
  "/maid-avatars/01.jpg",
  "/maid-avatars/02.jpg",
  "/maid-avatars/03.jpg",
  "/maid-avatars/04.jpg",
  "/maid-avatars/05.jpg",
  "/maid-avatars/06.jpg",
  "/maid-avatars/07.jpg",
  "/maid-avatars/08.jpg",
] as const;

/** Stable portrait for an agent id. A real avatar URL still wins in the row. */
export function maidPortraitSrc(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return MAID_PORTRAITS[(hash >>> 0) % MAID_PORTRAITS.length] ?? MAID_PORTRAITS[0];
}
