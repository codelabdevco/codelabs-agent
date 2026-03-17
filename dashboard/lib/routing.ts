import fs from "fs";
import path from "path";
import { addAuditLog } from "./audit";
import { fetchWithTimeout, getFleetConfig, type ClawInstance } from "./fleet";

// ─── Types ──────────────────────────────────────────────────────────────
export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  // Source agent(s) — who triggers this rule
  sourceAgentIds: string[]; // empty = any agent
  // Match condition
  match: {
    type: "keyword" | "intent" | "prefix" | "always";
    value: string; // keyword to match, intent name, prefix string
  };
  // Target agent
  targetAgentId: string;
  // How to delegate
  delegation: {
    mode: "forward" | "ask_then_forward" | "copy";
    // forward: send full context to target, remove from source
    // ask_then_forward: source asks user confirmation first
    // copy: send copy to target, keep original in source
    includeContext: boolean; // send conversation history
    customPrompt?: string; // prepend to delegated message
  };
  priority: number; // lower = higher priority
  createdAt: string;
}

export interface RoutingLog {
  id: string;
  timestamp: string;
  ruleId: string;
  ruleName: string;
  sourceAgent: string;
  targetAgent: string;
  matchedText: string;
  delegation: string;
  status: "success" | "failed" | "pending";
  error?: string;
}

// ─── Config store ───────────────────────────────────────────────────────
const ROUTING_FILE =
  process.env.ROUTING_CONFIG_PATH ||
  path.join(process.cwd(), "..", "data", "routing-rules.json");

const ROUTING_LOG_FILE =
  process.env.ROUTING_LOG_PATH ||
  path.join(process.cwd(), "..", "data", "routing-log.jsonl");

function ensureDir() {
  const dir = path.dirname(ROUTING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadRoutingRules(): RoutingRule[] {
  ensureDir();
  if (!fs.existsSync(ROUTING_FILE)) return [];
  return JSON.parse(fs.readFileSync(ROUTING_FILE, "utf-8"));
}

export function saveRoutingRules(rules: RoutingRule[]): void {
  ensureDir();
  fs.writeFileSync(ROUTING_FILE, JSON.stringify(rules, null, 2));
}

export function addRoutingRule(rule: Omit<RoutingRule, "id" | "createdAt">): RoutingRule {
  const rules = loadRoutingRules();
  const full: RoutingRule = {
    ...rule,
    id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  rules.push(full);
  rules.sort((a, b) => a.priority - b.priority);
  saveRoutingRules(rules);
  return full;
}

export function updateRoutingRule(id: string, updates: Partial<RoutingRule>): RoutingRule | null {
  const rules = loadRoutingRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...updates, id: rules[idx].id };
  rules.sort((a, b) => a.priority - b.priority);
  saveRoutingRules(rules);
  return rules[idx];
}

export function deleteRoutingRule(id: string): boolean {
  const rules = loadRoutingRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  rules.splice(idx, 1);
  saveRoutingRules(rules);
  return true;
}

// ─── Routing log ────────────────────────────────────────────────────────
function appendRoutingLog(entry: RoutingLog): void {
  ensureDir();
  fs.appendFileSync(ROUTING_LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
}

export function getRoutingLogs(limit = 100): RoutingLog[] {
  ensureDir();
  if (!fs.existsSync(ROUTING_LOG_FILE)) return [];
  const lines = fs.readFileSync(ROUTING_LOG_FILE, "utf-8").split("\n").filter(Boolean);
  const entries: RoutingLog[] = [];
  for (const line of lines) {
    try { entries.push(JSON.parse(line)); } catch {}
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

// ─── Match engine ───────────────────────────────────────────────────────
export function findMatchingRule(
  sourceAgentId: string,
  messageText: string
): RoutingRule | null {
  const rules = loadRoutingRules();
  const text = messageText.toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Check source filter
    if (rule.sourceAgentIds.length > 0 && !rule.sourceAgentIds.includes(sourceAgentId)) {
      continue;
    }

    // Check match condition
    let matched = false;
    switch (rule.match.type) {
      case "keyword":
        matched = text.includes(rule.match.value.toLowerCase());
        break;
      case "prefix":
        matched = text.startsWith(rule.match.value.toLowerCase());
        break;
      case "intent":
        // Simple intent matching — check for common patterns
        const intentPatterns: Record<string, string[]> = {
          invoice: ["ใบแจ้งหนี้", "invoice", "billing", "ออกบิล", "ใบเสร็จ"],
          support: ["ช่วยเหลือ", "ปัญหา", "support", "ticket", "แก้ไข", "ไม่ทำงาน"],
          hr: ["ลางาน", "สมัครงาน", "พนักงาน", "hr", "leave", "employee"],
          devops: ["deploy", "build", "ci/cd", "server", "เซิร์ฟเวอร์", "ดีพลอย"],
          docs: ["เอกสาร", "document", "report", "รายงาน", "สัญญา", "contract"],
          finance: ["บัญชี", "การเงิน", "ยอด", "finance", "payment", "จ่าย"],
        };
        const patterns = intentPatterns[rule.match.value.toLowerCase()] || [rule.match.value.toLowerCase()];
        matched = patterns.some((p) => text.includes(p));
        break;
      case "always":
        matched = true;
        break;
    }

    if (matched) return rule;
  }

  return null;
}

// ─── Delegate message to target agent ───────────────────────────────────
export async function delegateToAgent(
  rule: RoutingRule,
  sourceAgentId: string,
  message: string,
  context?: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const config = getFleetConfig();
  const targetInstance = config.openclaw.find((c) => c.id === rule.targetAgentId);

  if (!targetInstance) {
    const logEntry: RoutingLog = {
      id: `rlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ruleId: rule.id,
      ruleName: rule.name,
      sourceAgent: sourceAgentId,
      targetAgent: rule.targetAgentId,
      matchedText: message.slice(0, 100),
      delegation: rule.delegation.mode,
      status: "failed",
      error: "Target agent not found in config",
    };
    appendRoutingLog(logEntry);
    return { success: false, error: "Target agent not found" };
  }

  try {
    // Build the delegated message
    let delegatedMessage = message;
    if (rule.delegation.customPrompt) {
      delegatedMessage = `${rule.delegation.customPrompt}\n\n${message}`;
    }
    if (rule.delegation.includeContext && context) {
      delegatedMessage = `[Context from ${sourceAgentId}]\n${context}\n\n[Current request]\n${delegatedMessage}`;
    }

    // Send to target agent's API
    const tokenKey = `CLAW_${targetInstance.id.split("-")[1]}_TOKEN`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = process.env[tokenKey];
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${targetInstance.host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: delegatedMessage }),
      timeoutMs: 30000,
    });

    const logEntry: RoutingLog = {
      id: `rlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ruleId: rule.id,
      ruleName: rule.name,
      sourceAgent: sourceAgentId,
      targetAgent: rule.targetAgentId,
      matchedText: message.slice(0, 100),
      delegation: rule.delegation.mode,
      status: res.ok ? "success" : "failed",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
    appendRoutingLog(logEntry);

    if (res.ok) {
      const data = await res.json();
      return { success: true, response: data.response || data.message || "OK" };
    }

    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const logEntry: RoutingLog = {
      id: `rlog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ruleId: rule.id,
      ruleName: rule.name,
      sourceAgent: sourceAgentId,
      targetAgent: rule.targetAgentId,
      matchedText: message.slice(0, 100),
      delegation: rule.delegation.mode,
      status: "failed",
      error: err.message,
    };
    appendRoutingLog(logEntry);
    return { success: false, error: err.message };
  }
}
