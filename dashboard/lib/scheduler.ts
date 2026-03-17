import fs from "fs";
import path from "path";
import { addAuditLog } from "./audit";
import { fetchWithTimeout, getFleetConfig } from "./fleet";
import { dispatchNotification } from "./notifications";

// ─── Types ──────────────────────────────────────────────────────────────
export interface ScheduledTask {
  id: string;
  name: string;
  enabled: boolean;
  agentId: string;
  // Cron expression (min hour dom month dow)
  cron: string;
  // Human-readable schedule description
  cronDescription: string;
  // What to send to the agent
  message: string;
  // Optional: system prompt override for this task
  systemPromptOverride?: string;
  // Execution tracking
  lastRun?: string;
  lastStatus?: "success" | "failed" | "running";
  lastError?: string;
  nextRun?: string;
  runCount: number;
  createdAt: string;
  createdBy: string;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  taskName: string;
  agentId: string;
  startedAt: string;
  finishedAt?: string;
  status: "success" | "failed" | "running";
  response?: string;
  error?: string;
  tokensUsed?: number;
}

// ─── Config store ───────────────────────────────────────────────────────
const TASKS_FILE =
  process.env.TASKS_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "scheduled-tasks.json");

const TASK_LOG_FILE =
  process.env.TASK_LOG_PATH ||
  path.join(process.cwd(), "..", "data", "task-executions.jsonl");

function ensureDir() {
  const dir = path.dirname(TASKS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadTasks(): ScheduledTask[] {
  ensureDir();
  if (!fs.existsSync(TASKS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
}

export function saveTasks(tasks: ScheduledTask[]): void {
  ensureDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export function addTask(task: Omit<ScheduledTask, "id" | "createdAt" | "runCount">): ScheduledTask {
  const tasks = loadTasks();
  const full: ScheduledTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    runCount: 0,
    nextRun: computeNextRun(task.cron),
  };
  tasks.push(full);
  saveTasks(tasks);
  return full;
}

export function updateTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | null {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...updates, id: tasks[idx].id };
  if (updates.cron) {
    tasks[idx].nextRun = computeNextRun(updates.cron);
  }
  saveTasks(tasks);
  return tasks[idx];
}

export function deleteTask(id: string): boolean {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  saveTasks(tasks);
  return true;
}

// ─── Execution log ──────────────────────────────────────────────────────
function appendExecution(exec: TaskExecution): void {
  ensureDir();
  fs.appendFileSync(TASK_LOG_FILE, JSON.stringify(exec) + "\n", "utf-8");
}

export function getTaskExecutions(taskId?: string, limit = 50): TaskExecution[] {
  ensureDir();
  if (!fs.existsSync(TASK_LOG_FILE)) return [];
  const lines = fs.readFileSync(TASK_LOG_FILE, "utf-8").split("\n").filter(Boolean);
  let entries: TaskExecution[] = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch {}
  }
  if (taskId) entries = entries.filter((e) => e.taskId === taskId);
  return entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}

// ─── Cron helpers ───────────────────────────────────────────────────────
// Simple cron parser — supports: "0 7 * * *" (daily 7am), "*/30 * * * *" (every 30min), etc.

export function computeNextRun(cron: string): string {
  // Simplified: just compute rough next run from now
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return new Date(Date.now() + 3600000).toISOString();

  const [min, hour] = parts;
  const now = new Date();
  const next = new Date(now);

  if (hour !== "*" && min !== "*") {
    next.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (min.startsWith("*/")) {
    const interval = parseInt(min.slice(2), 10);
    const currentMin = now.getMinutes();
    const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
    next.setMinutes(nextMin, 0, 0);
    if (next <= now) next.setMinutes(nextMin + interval, 0, 0);
  } else {
    next.setTime(now.getTime() + 3600000);
  }

  return next.toISOString();
}

export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [min, hour, dom, month, dow] = parts;

  if (min.startsWith("*/")) {
    return `Every ${min.slice(2)} minutes`;
  }
  if (hour === "*" && min !== "*") {
    return `Every hour at :${min.padStart(2, "0")}`;
  }
  if (hour !== "*" && min !== "*" && dom === "*" && dow === "*") {
    return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dow !== "*" && dom === "*") {
    const days: Record<string, string> = {
      "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
      "4": "Thu", "5": "Fri", "6": "Sat",
    };
    return `${days[dow] || dow} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  return cron;
}

// ─── Execute a task ─────────────────────────────────────────────────────
export async function executeTask(taskId: string): Promise<TaskExecution> {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found");

  const config = getFleetConfig();
  const instance = config.openclaw.find((c) => c.id === task.agentId);

  const exec: TaskExecution = {
    id: `exec-${Date.now()}`,
    taskId: task.id,
    taskName: task.name,
    agentId: task.agentId,
    startedAt: new Date().toISOString(),
    status: "running",
  };

  // Update task status
  updateTask(taskId, { lastRun: exec.startedAt, lastStatus: "running" });

  if (!instance) {
    exec.status = "failed";
    exec.error = "Agent not found in fleet config";
    exec.finishedAt = new Date().toISOString();
    appendExecution(exec);
    updateTask(taskId, { lastStatus: "failed", lastError: exec.error, runCount: task.runCount + 1 });
    return exec;
  }

  try {
    const tokenKey = `CLAW_${instance.id.split("-")[1]}_TOKEN`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = process.env[tokenKey];
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${instance.host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: task.message,
        systemPrompt: task.systemPromptOverride,
      }),
      timeoutMs: 60000,
    });

    if (res.ok) {
      const data = await res.json();
      exec.status = "success";
      exec.response = data.response || data.message || "OK";
      exec.tokensUsed = data.tokensUsed;
    } else {
      exec.status = "failed";
      exec.error = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    exec.status = "failed";
    exec.error = err.message;
  }

  exec.finishedAt = new Date().toISOString();
  appendExecution(exec);
  updateTask(taskId, {
    lastStatus: exec.status,
    lastError: exec.error,
    runCount: task.runCount + 1,
    nextRun: computeNextRun(task.cron),
  });

  // Notify on failure
  if (exec.status === "failed") {
    await dispatchNotification({
      level: "warning",
      event: "task_failed",
      title: `Scheduled task failed: ${task.name}`,
      message: `Task "${task.name}" on ${task.agentId} failed: ${exec.error}`,
      agent: task.agentId,
    });
  }

  return exec;
}

// ─── Ticker — check which tasks are due (call from setInterval) ─────────
export async function tickScheduler(): Promise<number> {
  const tasks = loadTasks();
  const now = Date.now();
  let executed = 0;

  for (const task of tasks) {
    if (!task.enabled) continue;
    if (!task.nextRun) continue;
    if (task.lastStatus === "running") continue;

    const nextRun = new Date(task.nextRun).getTime();
    if (nextRun <= now) {
      try {
        await executeTask(task.id);
        executed++;
      } catch {
        // logged inside executeTask
      }
    }
  }

  return executed;
}
