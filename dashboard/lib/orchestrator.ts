import { getFleetConfig, getClawHealth, type AgentHealth } from "./fleet";
import { getAllFleetStats, restartContainer, type ContainerStats } from "./docker";
import { findMatchingRule, delegateToAgent } from "./routing";
import { dispatchNotification, notifyAgentDown, notifyHighCPU } from "./notifications";
import { recordSnapshot } from "./analytics";
import { tickScheduler } from "./scheduler";
import { addAuditLog } from "./audit";

// ─── Types ──────────────────────────────────────────────────────────────
export interface OrchestratorState {
  running: boolean;
  lastTick: string | null;
  tickCount: number;
  actions: OrchestratorAction[];
  healthCache: Map<string, { status: string; checkedAt: number }>;
}

export interface OrchestratorAction {
  timestamp: string;
  type: "auto_restart" | "health_alert" | "cpu_alert" | "route_task" | "schedule_run" | "analytics_snapshot";
  target: string;
  detail: string;
}

// ─── Singleton state ────────────────────────────────────────────────────
let state: OrchestratorState = {
  running: false,
  lastTick: null,
  tickCount: 0,
  actions: [],
  healthCache: new Map(),
};

let tickInterval: NodeJS.Timeout | null = null;

// ─── Orchestrator logic (runs every cycle) ──────────────────────────────
async function orchestratorTick(): Promise<void> {
  state.tickCount++;
  state.lastTick = new Date().toISOString();
  const config = getFleetConfig();

  // 1. Health check all agents
  const healthResults: AgentHealth[] = [];
  for (const instance of config.openclaw) {
    const tokenKey = `CLAW_${instance.id.split("-")[1]}_TOKEN`;
    const token = process.env[tokenKey];
    const health = await getClawHealth(instance, token);
    healthResults.push(health);

    const prev = state.healthCache.get(instance.id);

    // Detect status change
    if (prev && prev.status === "online" && health.status === "offline") {
      await notifyAgentDown(instance.name);
      logAction("health_alert", instance.id, `${instance.name} went offline`);

      // Auto-restart if was online before
      try {
        await restartContainer(instance.container);
        logAction("auto_restart", instance.id, `Auto-restarted ${instance.name}`);
        await addAuditLog({
          userId: "orchestrator",
          username: "AI Orchestrator",
          action: "agent_restart",
          target: instance.container,
          detail: "Automatic restart — agent went offline",
        });
      } catch {}
    }

    state.healthCache.set(instance.id, {
      status: health.status,
      checkedAt: Date.now(),
    });
  }

  // 2. Check resource usage
  try {
    const stats = await getAllFleetStats();
    for (const s of stats) {
      if (s.cpuPercent > 90) {
        await notifyHighCPU(s.container, s.cpuPercent);
        logAction("cpu_alert", s.container, `CPU at ${Math.round(s.cpuPercent)}%`);
      }
    }

    // 3. Record analytics snapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      agents: healthResults.map((h) => {
        const containerStats = stats.find((s) =>
          s.container?.includes(h.id) || h.id.includes(s.container?.split("-")[1] || "")
        );
        return {
          id: h.id,
          name: h.name,
          model: "unknown",
          tokensIn: 0,
          tokensOut: 0,
          costUSD: 0,
          cpu: containerStats?.cpuPercent || 0,
          ram: containerStats?.memoryUsageMB || 0,
          sessions: h.activeSessions || 0,
        };
      }),
    };
    recordSnapshot(snapshot);
    logAction("analytics_snapshot", "fleet", `Recorded snapshot for ${healthResults.length} agents`);
  } catch {}

  // 4. Run scheduled tasks
  try {
    const tasksRun = await tickScheduler();
    if (tasksRun > 0) {
      logAction("schedule_run", "scheduler", `Executed ${tasksRun} scheduled task(s)`);
    }
  } catch {}

  // Keep action log trimmed
  if (state.actions.length > 200) {
    state.actions = state.actions.slice(-200);
  }
}

function logAction(type: OrchestratorAction["type"], target: string, detail: string): void {
  state.actions.push({
    timestamp: new Date().toISOString(),
    type,
    target,
    detail,
  });
}

// ─── Start / Stop ───────────────────────────────────────────────────────
const TICK_INTERVAL_MS = 30000; // 30 seconds

export function startOrchestrator(): void {
  if (state.running) return;
  state.running = true;

  // Initial tick
  orchestratorTick().catch(() => {});

  // Recurring ticks
  tickInterval = setInterval(() => {
    orchestratorTick().catch(() => {});
  }, TICK_INTERVAL_MS);
}

export function stopOrchestrator(): void {
  state.running = false;
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

export function getOrchestratorState(): {
  running: boolean;
  lastTick: string | null;
  tickCount: number;
  recentActions: OrchestratorAction[];
} {
  return {
    running: state.running,
    lastTick: state.lastTick,
    tickCount: state.tickCount,
    recentActions: state.actions.slice(-50).reverse(),
  };
}

// ─── Orchestrator API for chat routing ──────────────────────────────────
export async function orchestrateMessage(
  sourceAgentId: string,
  message: string,
  context?: string
): Promise<{ routed: boolean; targetAgent?: string; response?: string }> {
  const rule = findMatchingRule(sourceAgentId, message);
  if (!rule) return { routed: false };

  const result = await delegateToAgent(rule, sourceAgentId, message, context);
  if (result.success) {
    logAction("route_task", rule.targetAgentId, `Routed from ${sourceAgentId}: "${message.slice(0, 60)}..."`);
  }

  return {
    routed: result.success,
    targetAgent: rule.targetAgentId,
    response: result.response,
  };
}
