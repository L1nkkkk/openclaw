import type { IconName } from "./icon-data.ts";
import { maidClip } from "./maid-atelier-status.ts";

export type MaidNavRoute = "new-session" | "approvals" | "sessions" | "plugins";

export type MaidNavItem = {
  id: "search" | "new" | "quick" | "approval" | "projects" | "services" | "more";
  icon: IconName;
  labelKey:
    | "agentsHome.maidNavSearch"
    | "agentsHome.maidNavNew"
    | "agentsHome.maidNavQuick"
    | "agentsHome.maidNavApproval"
    | "agentsHome.maidNavProjects"
    | "agentsHome.maidNavServices"
    | "agentsHome.maidNavMore";
  action: "palette" | "new" | "pages" | "route";
  route?: MaidNavRoute;
};

/** In-panel shortcuts. Each one calls a real sidebar action. */
export const MAID_NAV: readonly MaidNavItem[] = [
  { id: "search", icon: "search", labelKey: "agentsHome.maidNavSearch", action: "palette" },
  { id: "new", icon: "messageSquarePlus", labelKey: "agentsHome.maidNavNew", action: "new" },
  {
    id: "quick",
    icon: "zap",
    labelKey: "agentsHome.maidNavQuick",
    action: "route",
    route: "new-session",
  },
  {
    id: "approval",
    icon: "shield",
    labelKey: "agentsHome.maidNavApproval",
    action: "route",
    route: "approvals",
  },
  {
    id: "projects",
    icon: "folder",
    labelKey: "agentsHome.maidNavProjects",
    action: "route",
    route: "sessions",
  },
  {
    id: "services",
    icon: "server",
    labelKey: "agentsHome.maidNavServices",
    action: "route",
    route: "plugins",
  },
  { id: "more", icon: "moreHorizontal", labelKey: "agentsHome.maidNavMore", action: "pages" },
];

export type MaidAgentFact = {
  id: string;
  name: string;
  avatar: string | null;
  textAvatar: string | null;
  activeNow: boolean;
  unreadCount: number;
  lastActiveAt: number;
  preview?: string;
  role?: string;
};

export type MaidSessionFact = {
  key: string;
  agentId: string;
  archived?: boolean;
  category?: string | null;
  label?: string | null;
  displayName?: string | null;
  lastMessagePreview?: string | null;
  updatedAt?: number | null;
  status?: string | null;
  lastRunError?: string | null;
  pinned?: boolean;
};

export type MaidBoardRow = {
  kind: "agent" | "session";
  id: string;
  name: string;
  avatar: string | null;
  textAvatar: string | null;
  activeNow: boolean;
  unreadCount: number;
  lastActiveAt: number;
  preview: string;
  role: string;
  spaces: number;
  sessionKey?: string;
  /** Owning maid id for a session row, so the face matches that maid. */
  faceId?: string;
  chief: boolean;
  marked: boolean;
  status?: string;
  failed: boolean;
};

export type MaidBoardSection = {
  id: string;
  label: string;
  labelKey?: "agentsHome.independentMaids";
  sample: boolean;
  rows: MaidBoardRow[];
};

const SESSION_CAP = 6;

function sessionTitle(session: MaidSessionFact): string {
  const name = session.displayName?.trim() || session.label?.trim();
  if (name) {
    return name;
  }
  const tail = session.key.split(":").pop()?.trim();
  return tail || session.key;
}

function agentRow(agent: MaidAgentFact, spaces: number, chief: boolean): MaidBoardRow {
  return {
    kind: "agent",
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar,
    textAvatar: agent.textAvatar,
    activeNow: agent.activeNow,
    unreadCount: agent.unreadCount,
    lastActiveAt: agent.lastActiveAt,
    preview: agent.preview?.trim() ?? "",
    role: agent.role?.trim() ?? "",
    spaces,
    chief,
    marked: chief,
    failed: false,
  };
}

function sessionRow(
  session: MaidSessionFact,
  agents: ReadonlyMap<string, MaidAgentFact>,
): MaidBoardRow {
  const status = session.status ?? undefined;
  const owner = agents.get(session.agentId);
  return {
    kind: "session",
    id: session.key,
    name: sessionTitle(session),
    avatar: owner?.avatar ?? null,
    textAvatar: owner?.textAvatar ?? null,
    activeNow: status === "running" || status === "queued",
    unreadCount: 0,
    lastActiveAt: session.updatedAt ?? 0,
    preview: session.lastMessagePreview?.trim() ?? "",
    role: owner?.name ?? "",
    faceId: session.agentId,
    spaces: 0,
    sessionKey: session.key,
    chief: false,
    marked: session.pinned === true,
    status,
    failed: Boolean(session.lastRunError),
  };
}

/**
 * Category names become project groups. Each maid with her own chats becomes
 * a section; quiet maids share Independent Maids. Archived rows stay out.
 */
export function buildMaidBoard(
  agents: readonly MaidAgentFact[],
  sessions: readonly MaidSessionFact[],
  defaultId: string | null,
): MaidBoardSection[] {
  if (agents.length === 0) {
    return [];
  }
  const known = new Map(agents.map((agent) => [agent.id, agent]));
  const chiefId = defaultId && known.has(defaultId) ? defaultId : (agents[0]?.id ?? null);
  const live = sessions.filter((session) => !session.archived);
  const byAgent = new Map<string, MaidSessionFact[]>();
  const byCategory = new Map<string, MaidSessionFact[]>();
  for (const session of live) {
    const own = byAgent.get(session.agentId) ?? [];
    own.push(session);
    byAgent.set(session.agentId, own);
    const category = session.category?.trim();
    if (category) {
      const grouped = byCategory.get(category) ?? [];
      grouped.push(session);
      byCategory.set(category, grouped);
    }
  }
  const categorized = new Set<string>();
  const categories: MaidBoardSection[] = [];
  for (const [label, rows] of [...byCategory.entries()].toSorted((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const sorted = rows.toSorted((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
    for (const row of sorted) {
      categorized.add(row.key);
    }
    categories.push({
      id: `category:${label}`,
      label,
      sample: false,
      rows: sorted.slice(0, SESSION_CAP).map((row) => sessionRow(row, known)),
    });
  }

  const quiet: MaidAgentFact[] = [];
  const featured: MaidAgentFact[] = [];
  for (const agent of agents) {
    const own = byAgent.get(agent.id) ?? [];
    const local = own.some((row) => !categorized.has(row.key));
    if (agent.id === chiefId || local) {
      featured.push(agent);
    } else if (own.length === 0) {
      quiet.push(agent);
    }
  }
  const chief = featured.find((agent) => agent.id === chiefId);
  const rest = featured
    .filter((agent) => agent.id !== chiefId)
    .toSorted((left, right) => right.lastActiveAt - left.lastActiveAt);
  const agentSections: MaidBoardSection[] = [];
  for (const maid of [chief, ...rest].filter((entry): entry is MaidAgentFact => Boolean(entry))) {
    const own = byAgent.get(maid.id) ?? [];
    const local = own
      .filter((row) => !categorized.has(row.key))
      .toSorted((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
    agentSections.push({
      id: `agent:${maid.id}`,
      label: maid.name,
      sample: false,
      rows: [
        agentRow(maid, own.length, maid.id === chiefId),
        ...local.slice(0, SESSION_CAP).map((row) => sessionRow(row, known)),
      ],
    });
  }
  const independent: MaidBoardSection[] =
    quiet.length > 0
      ? [
          {
            id: "independent",
            label: "",
            labelKey: "agentsHome.independentMaids",
            sample: false,
            rows: quiet.map((agent) => agentRow(agent, byAgent.get(agent.id)?.length ?? 0, false)),
          },
        ]
      : [];
  return categories.length > 0
    ? [...categories, ...agentSections, ...independent]
    : [...agentSections, ...independent];
}

export type MaidChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  refine: boolean;
  sample: boolean;
  at: number | null;
  /** Sample queue only. Live steps do not invent a hold. */
  hold?: "blocked" | "pending";
};

const MINUTE_MS = 60_000;

export const MAID_SAMPLE_FILES: readonly MaidChecklistItem[] = [
  { id: "lint", label: "lint", done: true, refine: false, sample: true, at: null },
  { id: "typecheck", label: "typecheck", done: true, refine: false, sample: true, at: null },
  {
    id: "approval",
    label: "approval",
    done: false,
    refine: false,
    sample: true,
    at: null,
    hold: "pending",
  },
  {
    id: "deploy",
    label: "deploy",
    done: false,
    refine: false,
    sample: true,
    at: null,
    hold: "blocked",
  },
];

export const MAID_SAMPLE_FILE_AGE_MS: Readonly<Record<string, number>> = {
  lint: 18 * MINUTE_MS,
  typecheck: 2 * 60 * MINUTE_MS,
  approval: 26 * MINUTE_MS,
  deploy: 40 * MINUTE_MS,
};

export function maidManuscriptFile(label: string): boolean {
  return /(?:^|[\\/])ch\d{2,}[_-]/i.test(label) || /\.(?:md|markdown)$/i.test(label);
}

export function maidLogLine(markdown: string | null | undefined): string {
  if (!markdown) {
    return "";
  }
  for (const raw of markdown.split("\n")) {
    const line = raw
      .replace(/^[#>*\-\d.)\s]+/, "")
      .replace(/`/g, "")
      .trim();
    if (line) {
      return maidClip(line, 180);
    }
  }
  return "";
}

function refineFor(label: string, done: boolean): boolean {
  return !done && (maidManuscriptFile(label) || /\brefine\b/i.test(label));
}

export function maidChecklistModel(input: {
  steps?: readonly { step: string; status: "pending" | "in_progress" | "completed" }[] | null;
  markdown?: string | null;
  sessions?: readonly MaidSessionFact[];
}): { sample: boolean; log: string; items: readonly MaidChecklistItem[] } {
  const log = maidLogLine(input.markdown);
  const steps = (input.steps ?? []).filter((step) => step.step.trim().length > 0);
  if (steps.length > 0) {
    return {
      sample: false,
      log,
      items: steps.map((step, index) => {
        const label = step.step.trim();
        const done = step.status === "completed";
        return {
          id: `step:${index}:${label}`,
          label,
          done,
          refine: refineFor(label, done),
          sample: false,
          at: null,
        };
      }),
    };
  }
  const files = (input.sessions ?? [])
    .filter((session) => !session.archived)
    .flatMap((session) => {
      const label = session.displayName?.trim() || session.label?.trim() || "";
      return maidManuscriptFile(label) ? [{ session, label }] : [];
    })
    .toSorted((left, right) => (right.session.updatedAt ?? 0) - (left.session.updatedAt ?? 0))
    .slice(0, SESSION_CAP);
  if (files.length > 0) {
    return {
      sample: false,
      log,
      items: files.map((row) => {
        const done = row.session.status === "done";
        return {
          id: row.session.key,
          label: row.label,
          done,
          refine: refineFor(row.label, done),
          sample: false,
          at: row.session.updatedAt ?? null,
        };
      }),
    };
  }
  return {
    sample: true,
    log,
    items: MAID_SAMPLE_FILES,
  };
}

function fixtureRow(
  row: Pick<MaidBoardRow, "id" | "name" | "kind"> &
    Partial<Omit<MaidBoardRow, "id" | "name" | "kind">>,
  now: number,
): MaidBoardRow {
  return {
    avatar: null,
    textAvatar: null,
    activeNow: false,
    unreadCount: 0,
    lastActiveAt: now - 60 * MINUTE_MS,
    preview: "",
    role: "",
    spaces: 0,
    chief: false,
    marked: false,
    failed: false,
    ...row,
  };
}

/** Screenshot density only. Live boards never invent these session names. */
export function maidDensitySections(now: number): MaidBoardSection[] {
  const minute = (count: number) => now - count * MINUTE_MS;
  return [
    {
      id: "ops",
      label: "Ops",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "gateway-log",
            kind: "session",
            name: "gateway log",
            preview: "Tail quiet",
            activeNow: true,
            lastActiveAt: minute(4),
            status: "running",
          },
          now,
        ),
        fixtureRow(
          {
            id: "config-diff",
            kind: "session",
            name: "config diff",
            preview: "Pending approval",
            lastActiveAt: minute(48),
            status: "pending_approval",
          },
          now,
        ),
      ],
    },
    {
      id: "desk",
      label: "Desk",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "harper",
            kind: "agent",
            name: "Harper",
            role: "Chief Maid",
            chief: true,
            marked: true,
            spaces: 5,
            preview: "Reviewing the queue",
            activeNow: true,
            lastActiveAt: minute(2),
            status: "running",
          },
          now,
        ),
        fixtureRow(
          {
            id: "deploy-check",
            kind: "session",
            name: "deploy check",
            preview: "Build green",
            lastActiveAt: minute(12),
            sessionKey: "fixture:deploy-check",
          },
          now,
        ),
        fixtureRow(
          {
            id: "plugin-notes",
            kind: "session",
            name: "plugin notes",
            preview: "Two checks open",
            lastActiveAt: minute(90),
          },
          now,
        ),
      ],
    },
    {
      id: "field",
      label: "Field",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "field-agent",
            kind: "agent",
            name: "Field",
            spaces: 2,
            preview: "Indexing logs",
            lastActiveAt: minute(15),
          },
          now,
        ),
      ],
    },
    {
      id: "catalog",
      label: "Catalog",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "catalog-pass",
            kind: "session",
            name: "catalog pass",
            preview: "Idle",
            lastActiveAt: minute(180),
          },
          now,
        ),
      ],
    },
    {
      id: "queue",
      label: "Queue",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "release-cut",
            kind: "session",
            name: "release cut",
            preview: "Blocked",
            status: "blocked",
            lastActiveAt: minute(35),
          },
          now,
        ),
        fixtureRow(
          {
            id: "run-failed",
            kind: "session",
            name: "run failed",
            preview: "Exit 1",
            failed: true,
            status: "failed",
            lastActiveAt: minute(20),
          },
          now,
        ),
      ],
    },
    {
      id: "independent",
      label: "Independent Maids",
      sample: true,
      rows: [
        fixtureRow(
          {
            id: "notes",
            kind: "agent",
            name: "Notes",
            role: "Editor",
            preview: "No messages yet",
            spaces: 1,
            lastActiveAt: minute(8),
          },
          now,
        ),
        fixtureRow(
          {
            id: "archive",
            kind: "agent",
            name: "Archive",
            role: "Keeper",
            preview: "Last run finished",
            spaces: 3,
            lastActiveAt: minute(140),
            status: "done",
          },
          now,
        ),
      ],
    },
  ];
}
