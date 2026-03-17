import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface KnowledgeEntry {
  id: string;
  key: string; // searchable key, e.g. "client:สยามวอเตอร์"
  category: string; // client, project, policy, product, procedure
  title: string;
  content: string;
  tags: string[];
  sourceAgent: string; // which agent created this
  sharedWith: string[]; // empty = all agents
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  accessCount: number;
}

// ─── Store ──────────────────────────────────────────────────────────────
const KB_FILE =
  process.env.KB_FILE_PATH ||
  path.join(process.cwd(), "..", "data", "knowledge-base.json");

function ensureDir() {
  const dir = path.dirname(KB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load(): KnowledgeEntry[] {
  ensureDir();
  if (!fs.existsSync(KB_FILE)) return [];
  return JSON.parse(fs.readFileSync(KB_FILE, "utf-8"));
}

function save(entries: KnowledgeEntry[]): void {
  ensureDir();
  fs.writeFileSync(KB_FILE, JSON.stringify(entries, null, 2));
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export function listKnowledge(opts?: {
  category?: string;
  tag?: string;
  agentId?: string;
  search?: string;
  limit?: number;
}): KnowledgeEntry[] {
  let entries = load();

  if (opts?.category) entries = entries.filter((e) => e.category === opts.category);
  if (opts?.tag) entries = entries.filter((e) => e.tags.includes(opts.tag!));
  if (opts?.agentId) {
    entries = entries.filter(
      (e) => e.sharedWith.length === 0 || e.sharedWith.includes(opts.agentId!)
    );
  }
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.key.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return entries.slice(0, opts?.limit || 200);
}

export function getKnowledge(id: string): KnowledgeEntry | null {
  const entry = load().find((e) => e.id === id);
  if (entry) {
    // Increment access count
    const entries = load();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      entries[idx].accessCount++;
      save(entries);
    }
  }
  return entry || null;
}

export function addKnowledge(
  entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt" | "accessCount">
): KnowledgeEntry {
  const entries = load();
  const full: KnowledgeEntry = {
    ...entry,
    id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessCount: 0,
  };
  entries.push(full);
  save(entries);
  return full;
}

export function updateKnowledge(
  id: string,
  updates: Partial<KnowledgeEntry>
): KnowledgeEntry | null {
  const entries = load();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = {
    ...entries[idx],
    ...updates,
    id: entries[idx].id,
    updatedAt: new Date().toISOString(),
  };
  save(entries);
  return entries[idx];
}

export function deleteKnowledge(id: string): boolean {
  const entries = load();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  save(entries);
  return true;
}

// ─── Agent-facing search (used by OpenClaw skills) ──────────────────────
export function searchForAgent(agentId: string, query: string): KnowledgeEntry[] {
  return listKnowledge({ agentId, search: query, limit: 10 });
}

export function getCategories(): { category: string; count: number }[] {
  const entries = load();
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.category, (map.get(e.category) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAllTags(): string[] {
  const entries = load();
  const set = new Set<string>();
  for (const e of entries) e.tags.forEach((t) => set.add(t));
  return Array.from(set).sort();
}
