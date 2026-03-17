import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  target: string;
  detail?: string;
  ip?: string;
}

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "agent_restart"
  | "agent_stop"
  | "agent_start"
  | "model_changed"
  | "budget_changed"
  | "settings_updated"
  | "secret_viewed"
  | "secret_updated"
  | "user_created"
  | "user_deleted"
  | "chat_message"
  | "n8n_workflow_toggled";

// ─── File-based audit store ─────────────────────────────────────────────
const AUDIT_DIR =
  process.env.AUDIT_DIR_PATH ||
  path.join(process.cwd(), "..", "data", "audit");

function ensureDir() {
  if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

function todayFile(): string {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(AUDIT_DIR, `audit-${d}.jsonl`);
}

// ─── Write audit entry (append to JSONL file) ───────────────────────────
export async function addAuditLog(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<void> {
  ensureDir();
  const full: AuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const line = JSON.stringify(full) + "\n";
  fs.appendFileSync(todayFile(), line, "utf-8");
}

// ─── Read audit logs ────────────────────────────────────────────────────
export function getAuditLogs(opts: {
  date?: string; // YYYY-MM-DD
  limit?: number;
  action?: string;
  userId?: string;
}): AuditEntry[] {
  ensureDir();
  const { date, limit = 200, action, userId } = opts;

  // If date specified, read that file; otherwise read today + yesterday
  const files: string[] = [];
  if (date) {
    files.push(path.join(AUDIT_DIR, `audit-${date}.jsonl`));
  } else {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    files.push(
      path.join(AUDIT_DIR, `audit-${today.toISOString().slice(0, 10)}.jsonl`),
      path.join(AUDIT_DIR, `audit-${yesterday.toISOString().slice(0, 10)}.jsonl`)
    );
  }

  let entries: AuditEntry[] = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }
  }

  // Filter
  if (action) entries = entries.filter((e) => e.action === action);
  if (userId) entries = entries.filter((e) => e.userId === userId);

  // Sort newest first, limit
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries.slice(0, limit);
}

// ─── Get available audit dates ──────────────────────────────────────────
export function getAuditDates(): string[] {
  ensureDir();
  return fs
    .readdirSync(AUDIT_DIR)
    .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
    .map((f) => f.replace("audit-", "").replace(".jsonl", ""))
    .sort()
    .reverse();
}
