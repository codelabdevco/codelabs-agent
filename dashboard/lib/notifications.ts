import fs from "fs";
import path from "path";
import { getSecret } from "./vault";
import { addAuditLog } from "./audit";

// ─── Types ──────────────────────────────────────────────────────────────
export type NotifyChannel = "discord" | "line" | "webhook";
export type NotifyLevel = "info" | "warning" | "critical";

export interface NotifyConfig {
  id: string;
  channel: NotifyChannel;
  enabled: boolean;
  name: string;
  // Discord: webhook URL stored in vault as secret key
  // LINE: channel access token stored in vault
  // Webhook: URL stored in vault
  secretKey: string;
  // Which events trigger this notification
  events: string[];
  // Throttle: min seconds between same-type notifications
  throttleSeconds: number;
}

export interface NotifyEvent {
  level: NotifyLevel;
  event: string;
  title: string;
  message: string;
  agent?: string;
  timestamp?: string;
}

// ─── Config store ───────────────────────────────────────────────────────
const NOTIFY_CONFIG_FILE =
  process.env.NOTIFY_CONFIG_PATH ||
  path.join(process.cwd(), "..", "data", "notifications.json");

function ensureDir() {
  const dir = path.dirname(NOTIFY_CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadNotifyConfigs(): NotifyConfig[] {
  ensureDir();
  if (!fs.existsSync(NOTIFY_CONFIG_FILE)) return [];
  return JSON.parse(fs.readFileSync(NOTIFY_CONFIG_FILE, "utf-8"));
}

export function saveNotifyConfigs(configs: NotifyConfig[]): void {
  ensureDir();
  fs.writeFileSync(NOTIFY_CONFIG_FILE, JSON.stringify(configs, null, 2));
}

export function addNotifyConfig(config: Omit<NotifyConfig, "id">): NotifyConfig {
  const configs = loadNotifyConfigs();
  const full: NotifyConfig = {
    ...config,
    id: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  configs.push(full);
  saveNotifyConfigs(configs);
  return full;
}

export function removeNotifyConfig(id: string): boolean {
  const configs = loadNotifyConfigs();
  const idx = configs.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  configs.splice(idx, 1);
  saveNotifyConfigs(configs);
  return true;
}

// ─── Throttle tracker ───────────────────────────────────────────────────
const lastSent = new Map<string, number>();

function shouldThrottle(configId: string, event: string, throttleSec: number): boolean {
  const key = `${configId}:${event}`;
  const last = lastSent.get(key);
  if (last && Date.now() - last < throttleSec * 1000) return true;
  lastSent.set(key, Date.now());
  return false;
}

// ─── Senders ────────────────────────────────────────────────────────────

async function sendDiscord(webhookUrl: string, event: NotifyEvent): Promise<boolean> {
  try {
    const colorMap: Record<NotifyLevel, number> = {
      info: 0x3b82f6,
      warning: 0xf59e0b,
      critical: 0xef4444,
    };
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `${event.level === "critical" ? "🔴" : event.level === "warning" ? "🟡" : "🔵"} ${event.title}`,
          description: event.message,
          color: colorMap[event.level],
          fields: event.agent ? [{ name: "Agent", value: event.agent, inline: true }] : [],
          timestamp: event.timestamp || new Date().toISOString(),
          footer: { text: "Fleet Dashboard" },
        }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendLINE(token: string, event: NotifyEvent): Promise<boolean> {
  try {
    const emoji = event.level === "critical" ? "🔴" : event.level === "warning" ? "🟡" : "🔵";
    const message = `${emoji} ${event.title}\n${event.message}${event.agent ? `\nAgent: ${event.agent}` : ""}`;
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: `message=${encodeURIComponent(message)}`,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWebhook(url: string, event: NotifyEvent): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...event,
        source: "fleet-dashboard",
        timestamp: event.timestamp || new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Main dispatch ──────────────────────────────────────────────────────

export async function dispatchNotification(event: NotifyEvent): Promise<{
  sent: number;
  failed: number;
}> {
  const configs = loadNotifyConfigs();
  let sent = 0;
  let failed = 0;

  for (const config of configs) {
    if (!config.enabled) continue;
    if (config.events.length > 0 && !config.events.includes(event.event)) continue;
    if (shouldThrottle(config.id, event.event, config.throttleSeconds)) continue;

    const secret = getSecret(config.secretKey);
    if (!secret) {
      failed++;
      continue;
    }

    let ok = false;
    switch (config.channel) {
      case "discord":
        ok = await sendDiscord(secret, event);
        break;
      case "line":
        ok = await sendLINE(secret, event);
        break;
      case "webhook":
        ok = await sendWebhook(secret, event);
        break;
    }

    if (ok) sent++;
    else failed++;
  }

  return { sent, failed };
}

// ─── Pre-built event helpers ────────────────────────────────────────────

export async function notifyAgentDown(agentName: string) {
  return dispatchNotification({
    level: "critical",
    event: "agent_down",
    title: "Agent offline!",
    message: `${agentName} ไม่ตอบสนอง — ตรวจสอบด่วน`,
    agent: agentName,
  });
}

export async function notifyAgentDegraded(agentName: string, reason: string) {
  return dispatchNotification({
    level: "warning",
    event: "agent_degraded",
    title: "Agent degraded",
    message: `${agentName}: ${reason}`,
    agent: agentName,
  });
}

export async function notifyBudgetThreshold(percent: number, currentTHB: number, budgetTHB: number) {
  return dispatchNotification({
    level: percent >= 100 ? "critical" : "warning",
    event: "budget_threshold",
    title: percent >= 100 ? "เกินงบ!" : `งบถึง ${percent}%`,
    message: `ค่าใช้จ่าย ฿${Math.round(currentTHB).toLocaleString()} จากงบ ฿${budgetTHB.toLocaleString()} (${percent}%)`,
  });
}

export async function notifyHighCPU(agentName: string, cpuPercent: number) {
  return dispatchNotification({
    level: "warning",
    event: "high_cpu",
    title: "CPU สูง",
    message: `${agentName} ใช้ CPU ${Math.round(cpuPercent)}%`,
    agent: agentName,
  });
}
