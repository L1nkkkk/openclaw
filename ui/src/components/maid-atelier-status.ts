import { truncateUtf16Safe } from "@openclaw/normalization-core/utf16-slice";

export type MaidTone = "busy" | "idle" | "success" | "attention" | "blocked" | "pending";
export type MaidProgressTone = "working" | "idle" | "completed" | "attention";
export type MaidProgressSource = "progress" | "goal" | "session" | "sample";

const BUSY_STATUSES = new Set(["running", "queued"]);
const ATTENTION_STATUSES = new Set(["failed", "timeout", "interrupted", "killed"]);
const GOAL_ATTENTION = new Set(["blocked", "paused", "usage_limited", "budget_limited"]);
const PENDING_APPROVAL_STATUSES = new Set(["pending_approval", "pending-approval"]);

/** Pending approval and blocked are separate presences. Neither is a busy run. */
export function maidPresenceHold(status: string | undefined): "blocked" | "pending" | null {
  if (!status) {
    return null;
  }
  if (PENDING_APPROVAL_STATUSES.has(status)) {
    return "pending";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return null;
}

export type MaidSessionSource = {
  key: string;
  agentId?: string;
  archived?: boolean;
  pinned?: boolean;
  status?: string;
  lastRunError?: string;
  updatedAt?: number | null;
  label?: string;
  displayName?: string;
};

export type MaidSessionSummary = {
  pinned: boolean;
  status?: string;
  failed: boolean;
  label?: string;
};

export type MaidProgressStep = {
  step: string;
  status: "pending" | "in_progress" | "completed";
};

export type MaidGoalFacts = {
  objective: string;
  status?: string;
  lastStatusNote?: string;
};

export type MaidProgressFacts = {
  steps?: readonly MaidProgressStep[] | null;
  markdown?: string | null;
  goal?: MaidGoalFacts | null;
  title?: string | null;
  sessionStatus?: string | null;
  activeRun?: boolean;
};

export type MaidProgressModel = {
  source: MaidProgressSource;
  target: string;
  tone: MaidProgressTone;
  completed: number;
  total: number;
};

export function maidTone(input: {
  activeNow: boolean;
  unreadCount: number;
  status?: string;
  failed?: boolean;
}): MaidTone {
  const hold = maidPresenceHold(input.status);
  if (hold) {
    return hold;
  }
  if (input.activeNow || (input.status ? BUSY_STATUSES.has(input.status) : false)) {
    return "busy";
  }
  if (
    input.unreadCount > 0 ||
    input.failed ||
    (input.status ? ATTENTION_STATUSES.has(input.status) : false)
  ) {
    return "attention";
  }
  if (input.status === "done") {
    return "success";
  }
  return "idle";
}

/** A short identity theme can read as a role. Theme ids and paths stay off the row. */
export function maidIdentityTheme(theme: string | undefined): string | null {
  const value = theme?.trim();
  if (!value || value.length < 2 || value.length > 28) {
    return null;
  }
  if (/[/#]/.test(value) || value.endsWith("-light") || value.endsWith("-dark")) {
    return null;
  }
  return value;
}

export function maidClip(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) {
    return flat;
  }
  return `${truncateUtf16Safe(flat, max - 1).trimEnd()}…`;
}

export function maidSessionSummaries(
  rows: readonly MaidSessionSource[],
  fallbackAgentId: string,
  agentIdFor: (row: MaidSessionSource, fallbackAgentId: string) => string,
): ReadonlyMap<string, MaidSessionSummary> {
  const grouped = new Map<string, MaidSessionSource[]>();
  for (const row of rows) {
    if (row.archived) {
      continue;
    }
    const agentId = agentIdFor(row, fallbackAgentId);
    const list = grouped.get(agentId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(agentId, [row]);
    }
  }
  const summaries = new Map<string, MaidSessionSummary>();
  for (const [agentId, list] of grouped) {
    summaries.set(agentId, summarizeMaidSessions(list));
  }
  return summaries;
}

export function summarizeMaidSessions(rows: readonly MaidSessionSource[]): MaidSessionSummary {
  let pinned = false;
  let latest: MaidSessionSource | undefined;
  for (const row of rows) {
    if (row.archived) {
      continue;
    }
    if (row.pinned) {
      pinned = true;
    }
    const at = row.updatedAt ?? 0;
    if (!latest || at >= (latest.updatedAt ?? 0)) {
      latest = row;
    }
  }
  const status = latest?.status;
  const label = latest?.displayName?.trim() || latest?.label?.trim() || undefined;
  return {
    pinned,
    status,
    failed: Boolean(latest?.lastRunError) || (status ? ATTENTION_STATUSES.has(status) : false),
    label: label || undefined,
  };
}

export function readMaidGoal(session: object | null | undefined): MaidGoalFacts | null {
  if (session == null) {
    return null;
  }
  const goal = Reflect.get(session, "goal");
  if (typeof goal !== "object" || goal == null) {
    return null;
  }
  const objective = readString(goal, "objective")?.trim();
  if (!objective) {
    return null;
  }
  return {
    objective,
    status: readString(goal, "status"),
    lastStatusNote: readString(goal, "lastStatusNote")?.trim() || undefined,
  };
}

/**
 * Prefer a real progress card, then the session goal, then the session title.
 * The sample stand-in is only for a maid composer that has none of those.
 */
export function resolveMaidProgress(facts: MaidProgressFacts): MaidProgressModel {
  const steps = (facts.steps ?? []).filter((step) => step.step.trim().length > 0);
  if (steps.length > 0) {
    const completed = steps.filter((step) => step.status === "completed").length;
    const current =
      steps.find((step) => step.status === "in_progress") ??
      steps.find((step) => step.status === "pending") ??
      steps[steps.length - 1];
    const allDone = completed === steps.length;
    return {
      source: "progress",
      target: maidClip(current?.step ?? "", 80),
      tone: progressTone(
        allDone,
        steps.some((step) => step.status === "in_progress") || facts.activeRun === true,
        facts.sessionStatus,
      ),
      completed,
      total: steps.length,
    };
  }
  const markdown = facts.markdown ? markdownTarget(facts.markdown) : "";
  if (markdown) {
    return {
      source: "progress",
      target: markdown,
      tone: progressTone(false, facts.activeRun === true, facts.sessionStatus),
      completed: 0,
      total: 1,
    };
  }
  const goal = facts.goal;
  if (goal?.objective.trim()) {
    const done = goal.status === "complete";
    const attention = goal.status ? GOAL_ATTENTION.has(goal.status) : false;
    return {
      source: "goal",
      target: maidClip(goal.lastStatusNote || goal.objective, 80),
      tone: done
        ? "completed"
        : attention
          ? "attention"
          : goal.status === "active" || facts.activeRun
            ? "working"
            : "idle",
      completed: done ? 1 : 0,
      total: 1,
    };
  }
  const title = facts.title?.trim() ?? "";
  if (title || facts.sessionStatus || facts.activeRun) {
    const done = facts.sessionStatus === "done" && facts.activeRun !== true;
    return {
      source: "session",
      target: maidClip(title, 80),
      tone: progressTone(
        done,
        facts.activeRun === true ||
          (facts.sessionStatus ? BUSY_STATUSES.has(facts.sessionStatus) : false),
        facts.sessionStatus,
      ),
      completed: done ? 1 : 0,
      total: 1,
    };
  }
  return { source: "sample", target: "", tone: "working", completed: 4, total: 5 };
}

function progressTone(
  done: boolean,
  working: boolean,
  sessionStatus?: string | null,
): MaidProgressTone {
  if (done) {
    return "completed";
  }
  if (working) {
    return "working";
  }
  if (sessionStatus && ATTENTION_STATUSES.has(sessionStatus)) {
    return "attention";
  }
  return "idle";
}

function markdownTarget(markdown: string): string {
  for (const raw of markdown.split("\n")) {
    const line = raw
      .replace(/^[#>*\-\d.)\s]+/, "")
      .replace(/`/g, "")
      .trim();
    if (line) {
      return maidClip(line, 80);
    }
  }
  return "";
}

function readString(record: object, key: string): string | undefined {
  const value = Reflect.get(record, key);
  return typeof value === "string" ? value : undefined;
}
