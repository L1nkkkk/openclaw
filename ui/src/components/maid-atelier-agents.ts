export type MaidAgentSplit<T extends { id: string }> = {
  chief: T | null;
  independent: readonly T[];
};

/** The default agent is the chief maid. Every other roster card is independent. */
export function splitMaidAgents<T extends { id: string }>(
  cards: readonly T[],
  defaultId: string | null,
): MaidAgentSplit<T> {
  if (cards.length === 0) {
    return { chief: null, independent: [] };
  }
  const chiefIndex = defaultId ? cards.findIndex((card) => card.id === defaultId) : 0;
  const index = Math.max(chiefIndex, 0);
  return {
    chief: cards[index] ?? null,
    independent: cards.filter((_, cardIndex) => cardIndex !== index),
  };
}
