import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface UsageSnapshot {
  timestamp: string;
  agents: {
    id: string;
    name: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUSD: number;
    cpu: number;
    ram: number;
    sessions: number;
  }[];
}

export interface DailyAggregate {
  date: string; // YYYY-MM-DD
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUSD: number;
  peakCPU: number;
  avgCPU: number;
  peakRAM: number;
  snapshotCount: number;
  perAgent: Record<string, {
    tokensIn: number;
    tokensOut: number;
    costUSD: number;
    avgCPU: number;
  }>;
}

// ─── Store ──────────────────────────────────────────────────────────────
const ANALYTICS_DIR =
  process.env.ANALYTICS_DIR_PATH ||
  path.join(process.cwd(), "..", "data", "analytics");

function ensureDir() {
  if (!fs.existsSync(ANALYTICS_DIR)) fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
}

function snapshotFile(date: string): string {
  return path.join(ANALYTICS_DIR, `snapshots-${date}.jsonl`);
}

function aggregateFile(date: string): string {
  return path.join(ANALYTICS_DIR, `aggregate-${date}.json`);
}

// ─── Record a snapshot (call every polling interval) ────────────────────
export function recordSnapshot(snapshot: UsageSnapshot): void {
  ensureDir();
  const date = snapshot.timestamp.slice(0, 10);
  fs.appendFileSync(snapshotFile(date), JSON.stringify(snapshot) + "\n", "utf-8");
}

// ─── Aggregate a day's snapshots ────────────────────────────────────────
export function aggregateDay(date: string): DailyAggregate | null {
  ensureDir();
  const file = snapshotFile(date);
  if (!fs.existsSync(file)) return null;

  const lines = fs.readFileSync(file, "utf-8").split("\n").filter(Boolean);
  const snapshots: UsageSnapshot[] = [];
  for (const line of lines) {
    try { snapshots.push(JSON.parse(line)); } catch {}
  }
  if (snapshots.length === 0) return null;

  const agg: DailyAggregate = {
    date,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostUSD: 0,
    peakCPU: 0,
    avgCPU: 0,
    peakRAM: 0,
    snapshotCount: snapshots.length,
    perAgent: {},
  };

  let cpuSum = 0;
  let cpuCount = 0;

  // Use last snapshot for token totals (they're cumulative)
  const last = snapshots[snapshots.length - 1];
  for (const agent of last.agents) {
    agg.totalTokensIn += agent.tokensIn;
    agg.totalTokensOut += agent.tokensOut;
    agg.totalCostUSD += agent.costUSD;
  }

  // Scan all snapshots for peak/avg
  for (const snap of snapshots) {
    for (const agent of snap.agents) {
      agg.peakCPU = Math.max(agg.peakCPU, agent.cpu);
      agg.peakRAM = Math.max(agg.peakRAM, agent.ram);
      cpuSum += agent.cpu;
      cpuCount++;

      if (!agg.perAgent[agent.id]) {
        agg.perAgent[agent.id] = { tokensIn: 0, tokensOut: 0, costUSD: 0, avgCPU: 0 };
      }
    }
  }

  agg.avgCPU = cpuCount > 0 ? Math.round(cpuSum / cpuCount) : 0;

  // Per-agent from last snapshot
  for (const agent of last.agents) {
    agg.perAgent[agent.id] = {
      tokensIn: agent.tokensIn,
      tokensOut: agent.tokensOut,
      costUSD: agent.costUSD,
      avgCPU: 0,
    };
  }

  // Compute per-agent avg CPU across all snapshots
  const agentCpuSums = new Map<string, { sum: number; count: number }>();
  for (const snap of snapshots) {
    for (const agent of snap.agents) {
      const prev = agentCpuSums.get(agent.id) || { sum: 0, count: 0 };
      prev.sum += agent.cpu;
      prev.count++;
      agentCpuSums.set(agent.id, prev);
    }
  }
  for (const [id, { sum, count }] of agentCpuSums) {
    if (agg.perAgent[id]) {
      agg.perAgent[id].avgCPU = Math.round(sum / count);
    }
  }

  // Cache aggregate
  fs.writeFileSync(aggregateFile(date), JSON.stringify(agg, null, 2));
  return agg;
}

// ─── Get aggregates for date range ──────────────────────────────────────
export function getAggregates(days = 7): DailyAggregate[] {
  ensureDir();
  const results: DailyAggregate[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);

    // Check cached aggregate
    const aggFile = aggregateFile(date);
    if (fs.existsSync(aggFile)) {
      try {
        results.push(JSON.parse(fs.readFileSync(aggFile, "utf-8")));
        continue;
      } catch {}
    }

    // Try to aggregate from snapshots
    const agg = aggregateDay(date);
    if (agg) results.push(agg);
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Hourly breakdown for today ─────────────────────────────────────────
export function getHourlyBreakdown(): { hour: number; costUSD: number; tokens: number }[] {
  ensureDir();
  const today = new Date().toISOString().slice(0, 10);
  const file = snapshotFile(today);
  if (!fs.existsSync(file)) return [];

  const lines = fs.readFileSync(file, "utf-8").split("\n").filter(Boolean);
  const hourly = new Map<number, { costUSD: number; tokens: number }>();

  for (const line of lines) {
    try {
      const snap: UsageSnapshot = JSON.parse(line);
      const hour = new Date(snap.timestamp).getHours();
      const prev = hourly.get(hour) || { costUSD: 0, tokens: 0 };
      for (const a of snap.agents) {
        prev.costUSD = Math.max(prev.costUSD, a.costUSD);
        prev.tokens = Math.max(prev.tokens, a.tokensIn + a.tokensOut);
      }
      hourly.set(hour, prev);
    } catch {}
  }

  return Array.from(hourly.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour - b.hour);
}
