/**
 * Group @mentions name an agent already in the room. The token is ordinary
 * draft text. chat.send records human profile mentions, not an agent route,
 * so the session agent reads @Name and this does not open a separate turn.
 */

export type MaidMentionAgent = {
  id: string;
  name: string;
  portraitUrl?: string | null;
};

export type MaidMentionTarget = {
  start: number;
  end: number;
  query: string;
  value: string;
};

export type MaidMentionToken = {
  agent: MaidMentionAgent;
  start: number;
  end: number;
};

const MENTION_BOUNDARY = /[\s([{]/u;

/** Same invocation boundaries as the people picker, so code and slash commands stay text. */
export function findMaidMentionTarget(value: string, caret: number): MaidMentionTarget | null {
  if (value.trimStart().startsWith("/")) {
    return null;
  }
  const beforeCaret = value.slice(0, caret);
  const line = beforeCaret.slice(beforeCaret.lastIndexOf("\n") + 1);
  if (
    /^\s*>/u.test(line) ||
    (beforeCaret.match(/```/gu)?.length ?? 0) % 2 !== 0 ||
    (line.match(/`/gu)?.length ?? 0) % 2 !== 0
  ) {
    return null;
  }
  const match = /(?:^|[\s([{])@(?! )([\p{L}\p{N}\p{M}_. -]{0,128})$/u.exec(beforeCaret);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  const start = caret - query.length - 1;
  let end = caret;
  while (end < value.length && /[\p{L}\p{N}\p{M}_.-]/u.test(value[end] ?? "")) {
    end += 1;
  }
  return { start, end, query, value };
}

/** Empty query lists the room. A trailing space ends the picker so the sentence can continue. */
export function maidMentionChoices(
  agents: readonly MaidMentionAgent[],
  query: string,
): MaidMentionAgent[] {
  const needle = query.toLowerCase();
  if (needle.endsWith(" ")) {
    return [];
  }
  return agents.filter((agent) => agent.name.toLowerCase().startsWith(needle));
}

export function applyMaidMention(
  value: string,
  target: Pick<MaidMentionTarget, "start" | "end">,
  agent: Pick<MaidMentionAgent, "name">,
): { value: string; caret: number } {
  const boundary = value[target.end];
  const spacer = boundary === " " || boundary === "\n" ? "" : " ";
  const replacement = `@${agent.name}${spacer}`;
  return {
    value: `${value.slice(0, target.start)}${replacement}${value.slice(target.end)}`,
    caret: target.start + replacement.length + (spacer === "" && boundary === " " ? 1 : 0),
  };
}

export function removeMaidMention(
  value: string,
  token: Pick<MaidMentionToken, "start" | "end">,
): string {
  let start = token.start;
  let end = token.end;
  if (value[end] === " ") {
    end += 1;
  } else if (start > 0 && value[start - 1] === " ") {
    start -= 1;
  }
  return `${value.slice(0, start)}${value.slice(end)}`;
}

function inCode(value: string, index: number): boolean {
  if ((value.slice(0, index).match(/```/gu)?.length ?? 0) % 2 === 1) {
    return true;
  }
  const lineStart = value.lastIndexOf("\n", index - 1) + 1;
  return (value.slice(lineStart, index).match(/`/gu)?.length ?? 0) % 2 === 1;
}

/** Longest roster name wins, so @Anna is not also @Ann. */
export function maidMentionTokens(
  value: string,
  agents: readonly MaidMentionAgent[],
): MaidMentionToken[] {
  const ranked = agents
    .map((agent, order) => ({ agent, order }))
    .filter((entry) => entry.agent.name.trim())
    .toSorted(
      (left, right) => right.agent.name.length - left.agent.name.length || left.order - right.order,
    );
  const tokens: MaidMentionToken[] = [];
  let index = 0;
  while (index < value.length) {
    const boundary = index === 0 || MENTION_BOUNDARY.test(value[index - 1] ?? "");
    if (value[index] === "@" && boundary && !inCode(value, index)) {
      const rest = value.slice(index + 1);
      const match = ranked.find((entry) => {
        if (!rest.toLowerCase().startsWith(entry.agent.name.toLowerCase())) {
          return false;
        }
        const after = rest[entry.agent.name.length];
        return after === undefined || !/[\p{L}\p{N}\p{M}_.-]/u.test(after);
      });
      if (match) {
        const end = index + 1 + match.agent.name.length;
        tokens.push({ agent: match.agent, start: index, end });
        index = end;
        continue;
      }
    }
    index += 1;
  }
  return tokens;
}
