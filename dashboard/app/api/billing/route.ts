import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import { getFleetConfig } from "@/lib/fleet";
import { notifyBudgetThreshold } from "@/lib/notifications";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Model pricing per 1K tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  "claude-opus-4-20250514": { input: 0.015, output: 0.075, label: "Opus 4" },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015, label: "Sonnet 4" },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004, label: "Haiku 4.5" },
  "gpt-4o": { input: 0.0025, output: 0.01, label: "GPT-4o" },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006, label: "4o Mini" },
};

const THB_RATE = 34.5;

// Budget config file
const BUDGET_FILE =
  process.env.BUDGET_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "budget.json");

function ensureDir() {
  const dir = path.dirname(BUDGET_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface BudgetConfig {
  budgetTHB: number;
  alertThresholds: number[]; // e.g. [50, 75, 90, 100]
  alertsSent: number[]; // which thresholds already triggered
  lastReset: string;
}

function loadBudget(): BudgetConfig {
  ensureDir();
  if (!fs.existsSync(BUDGET_FILE)) {
    const defaults: BudgetConfig = {
      budgetTHB: 5000,
      alertThresholds: [50, 75, 90, 100],
      alertsSent: [],
      lastReset: new Date().toISOString(),
    };
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(fs.readFileSync(BUDGET_FILE, "utf-8"));
}

function saveBudget(config: BudgetConfig): void {
  ensureDir();
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(config, null, 2));
}

// Usage tracking file (daily token counts per agent)
const USAGE_FILE =
  process.env.USAGE_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "usage-today.json");

interface AgentUsage {
  agentId: string;
  agentName: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

function loadUsage(): AgentUsage[] {
  ensureDir();
  if (!fs.existsSync(USAGE_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8"));
    // Reset if it's a new day
    if (data.date !== new Date().toISOString().slice(0, 10)) return [];
    return data.agents || [];
  } catch {
    return [];
  }
}

function saveUsage(agents: AgentUsage[]): void {
  ensureDir();
  fs.writeFileSync(
    USAGE_FILE,
    JSON.stringify({ date: new Date().toISOString().slice(0, 10), agents }, null, 2)
  );
}

export function recordTokenUsage(
  agentId: string,
  agentName: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): void {
  const usage = loadUsage();
  const existing = usage.find((u) => u.agentId === agentId);
  if (existing) {
    existing.tokensIn += tokensIn;
    existing.tokensOut += tokensOut;
    existing.model = model;
  } else {
    usage.push({ agentId, agentName, model, tokensIn, tokensOut });
  }
  saveUsage(usage);
}

function calculateCosts(usage: AgentUsage[]): {
  agents: (AgentUsage & { costUSD: number; costTHB: number; modelLabel: string })[];
  totalUSD: number;
  totalTHB: number;
} {
  const agents = usage.map((u) => {
    const pricing = MODEL_PRICING[u.model] || { input: 0.003, output: 0.015, label: u.model };
    const costUSD = (u.tokensIn / 1000) * pricing.input + (u.tokensOut / 1000) * pricing.output;
    return {
      ...u,
      costUSD,
      costTHB: costUSD * THB_RATE,
      modelLabel: pricing.label,
    };
  });

  const totalUSD = agents.reduce((s, a) => s + a.costUSD, 0);
  return { agents, totalUSD, totalTHB: totalUSD * THB_RATE };
}

// GET /api/billing — current costs + budget
export async function GET() {
  const { auth, error } = requireAuth("view:billing");
  if (error) return error;

  const budget = loadBudget();
  const usage = loadUsage();
  const costs = calculateCosts(usage);

  const budgetPercent =
    budget.budgetTHB > 0
      ? Math.round((costs.totalTHB / budget.budgetTHB) * 100)
      : 0;

  // Check and fire budget alerts
  for (const threshold of budget.alertThresholds) {
    if (budgetPercent >= threshold && !budget.alertsSent.includes(threshold)) {
      budget.alertsSent.push(threshold);
      saveBudget(budget);
      // Fire notification (async, don't block response)
      notifyBudgetThreshold(threshold, costs.totalTHB, budget.budgetTHB).catch(() => {});
    }
  }

  return NextResponse.json({
    budget: {
      budgetTHB: budget.budgetTHB,
      thresholds: budget.alertThresholds,
      alertsSent: budget.alertsSent,
      lastReset: budget.lastReset,
    },
    costs: {
      agents: costs.agents.sort((a, b) => b.costUSD - a.costUSD),
      totalUSD: costs.totalUSD,
      totalTHB: costs.totalTHB,
      budgetPercent,
    },
    models: Object.entries(MODEL_PRICING).map(([id, p]) => ({
      id,
      label: p.label,
      inputPer1K: p.input,
      outputPer1K: p.output,
    })),
    timestamp: Date.now(),
  });
}

// POST /api/billing — update budget, reset usage
export async function POST(req: Request) {
  const { auth, error } = requireAuth("action:set-budget");
  if (error) return error;

  const body = await req.json();
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  if (body.action === "set-budget") {
    const budget = loadBudget();
    const oldBudget = budget.budgetTHB;
    budget.budgetTHB = body.budgetTHB;
    budget.alertsSent = []; // reset alerts when budget changes
    saveBudget(budget);

    await addAuditLog({
      userId: auth!.userId,
      username,
      action: "budget_changed",
      target: "billing",
      detail: `Budget changed: ฿${oldBudget.toLocaleString()} → ฿${body.budgetTHB.toLocaleString()}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "reset-usage") {
    saveUsage([]);
    const budget = loadBudget();
    budget.alertsSent = [];
    budget.lastReset = new Date().toISOString();
    saveBudget(budget);

    await addAuditLog({
      userId: auth!.userId,
      username,
      action: "budget_changed",
      target: "billing",
      detail: "Usage reset to zero",
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
