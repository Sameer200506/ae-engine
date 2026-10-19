/**
 * Plan definitions.
 *
 * This module must stay free of server-only imports (no `node:sqlite`) because
 * the public pricing page renders it on the client.
 */

export type PlanId = "free" | "pro" | "scale";

export interface PlanLimits {
  /** User messages allowed per calendar month. */
  monthlyMessages: number;
  maxAgents: number;
  maxDocuments: number;
  /** Can publish a share page + embeddable widget. */
  canShare: boolean;
  /** Can use the admin conversation viewer (only meaningful with role=admin). */
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number;
  limits: PlanLimits;
  features: string[];
  highlight?: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Kick the tyres",
    priceMonthly: 0,
    limits: {
      monthlyMessages: envInt("FREE_MONTHLY_MESSAGES", 25),
      maxAgents: envInt("FREE_MAX_AGENTS", 1),
      maxDocuments: envInt("FREE_MAX_DOCUMENTS", 3),
      canShare: false,
      prioritySupport: false,
    },
    features: [
      "1 agent with an editable system prompt",
      "3 knowledge-base documents",
      "25 messages / month",
      "Streaming chat",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For solo operators",
    priceMonthly: 19,
    limits: {
      monthlyMessages: 2000,
      maxAgents: 10,
      maxDocuments: 100,
      canShare: true,
      prioritySupport: false,
    },
    features: [
      "10 agents",
      "100 knowledge-base documents",
      "2,000 messages / month",
      "Shareable + embeddable widget",
      "Multi-conversation history & saved prompts",
    ],
    highlight: true,
  },
  scale: {
    id: "scale",
    name: "Scale",
    tagline: "For agencies",
    priceMonthly: 79,
    limits: {
      monthlyMessages: 10000,
      maxAgents: 50,
      maxDocuments: 1000,
      canShare: true,
      prioritySupport: true,
    },
    features: [
      "50 agents",
      "1,000 knowledge-base documents",
      "10,000 messages / month",
      "Everything in Pro",
      "Priority support",
    ],
  },
};

export const PAID_PLANS: PlanId[] = ["pro", "scale"];

export function getPlan(id: string | null | undefined): Plan {
  if (id === "pro" || id === "scale" || id === "free") return PLANS[id];
  return PLANS.free;
}

export function isPaidPlan(id: string | null | undefined): boolean {
  return id === "pro" || id === "scale";
}

/** Start of the current UTC month, in ms. Used for usage windows. */
export function currentPeriodStart(reference = Date.now()): number {
  const d = new Date(reference);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * Usage snapshot shape. Declared here (rather than in usage.ts) so client
 * components can import the type without touching a server-only module.
 */
export interface UsageSnapshot {
  messagesUsed: number;
  messageLimit: number;
  messagesRemaining: number;
  documentsUsed: number;
  documentLimit: number;
  agentsUsed: number;
  agentLimit: number;
  periodStart: number;
  percentUsed: number;
}

export function formatLimit(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}
