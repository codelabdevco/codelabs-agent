import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  description: string;
  // Which agents belong to this workspace
  agentIds: string[];
  // Which users can access this workspace
  memberUserIds: string[];
  // Workspace-level budget (THB)
  budgetTHB: number;
  // Workspace-level settings
  defaultModel?: string;
  createdAt: string;
  createdBy: string;
}

// ─── Store ──────────────────────────────────────────────────────────────
const WS_FILE =
  process.env.WORKSPACE_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "workspaces.json");

function ensureDir() {
  const dir = path.dirname(WS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load(): Workspace[] {
  ensureDir();
  if (!fs.existsSync(WS_FILE)) return [];
  return JSON.parse(fs.readFileSync(WS_FILE, "utf-8"));
}

function save(ws: Workspace[]): void {
  ensureDir();
  fs.writeFileSync(WS_FILE, JSON.stringify(ws, null, 2));
}

// ─── CRUD ───────────────────────────────────────────────────────────────
export function listWorkspaces(userId?: string): Workspace[] {
  const ws = load();
  if (userId) return ws.filter((w) => w.memberUserIds.includes(userId));
  return ws;
}

export function getWorkspace(id: string): Workspace | null {
  return load().find((w) => w.id === id) || null;
}

export function createWorkspace(ws: Omit<Workspace, "id" | "createdAt">): Workspace {
  const all = load();
  const full: Workspace = {
    ...ws,
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  all.push(full);
  save(all);
  return full;
}

export function updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | null {
  const all = load();
  const idx = all.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, id: all[idx].id };
  save(all);
  return all[idx];
}

export function deleteWorkspace(id: string): boolean {
  const all = load();
  const idx = all.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  save(all);
  return true;
}

export function getWorkspaceForAgent(agentId: string): Workspace | null {
  return load().find((w) => w.agentIds.includes(agentId)) || null;
}
