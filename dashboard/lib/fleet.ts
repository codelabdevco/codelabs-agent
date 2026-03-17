import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClawInstance {
  id: string;
  name: string;
  container: string;
  host: string;
  externalPort: number;
  role: string;
  description: string;
}

export interface FleetConfig {
  fleet: { name: string; version: string };
  openclaw: ClawInstance[];
  n8n: { host: string; externalPort: number; container: string };
  cadvisor: { host: string };
  polling: {
    healthIntervalMs: number;
    statsIntervalMs: number;
    logsIntervalMs: number;
  };
}

export interface AgentHealth {
  id: string;
  name: string;
  type: "openclaw" | "n8n";
  status: "online" | "degraded" | "offline";
  uptime?: number;
  version?: string;
  activeSessions?: number;
  error?: string;
}

export interface ContainerStats {
  id: string;
  container: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  networkRxMB: number;
  networkTxMB: number;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  lastExecution?: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
  };
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

// Exported so provisioner can invalidate cache when new agents are added
export let _config: FleetConfig | null = null;

export function getFleetConfig(): FleetConfig {
  if (_config) return _config;

  const configPath =
    process.env.FLEET_CONFIG_PATH ||
    path.join(process.cwd(), "..", "fleet-config.json");

  const raw = fs.readFileSync(configPath, "utf-8");
  _config = JSON.parse(raw) as FleetConfig;
  return _config;
}

export function invalidateConfigCache(): void {
  _config = null;
}

// ---------------------------------------------------------------------------
// HTTP helper with timeout
// ---------------------------------------------------------------------------

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 5000, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// OpenClaw Gateway API helpers
// ---------------------------------------------------------------------------

export async function getClawHealth(
  instance: ClawInstance,
  token?: string
): Promise<AgentHealth> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${instance.host}/health`, {
      headers,
      timeoutMs: 4000,
    });

    if (!res.ok) {
      return {
        id: instance.id,
        name: instance.name,
        type: "openclaw",
        status: "degraded",
        error: `HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      id: instance.id,
      name: instance.name,
      type: "openclaw",
      status: "online",
      uptime: data.uptime,
      version: data.version,
      activeSessions: data.activeSessions ?? data.sessions?.length ?? 0,
    };
  } catch (err: any) {
    return {
      id: instance.id,
      name: instance.name,
      type: "openclaw",
      status: "offline",
      error: err.message,
    };
  }
}

export async function getClawSessions(
  instance: ClawInstance,
  token?: string
): Promise<any[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${instance.host}/api/sessions`, {
      headers,
      timeoutMs: 5000,
    });

    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// n8n REST API helpers
// ---------------------------------------------------------------------------

export async function getN8nWorkflows(
  host: string,
  apiKey?: string
): Promise<N8nWorkflow[]> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) headers["X-N8N-API-KEY"] = apiKey;

    const res = await fetchWithTimeout(`${host}/api/v1/workflows`, {
      headers,
      timeoutMs: 5000,
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));
  } catch {
    return [];
  }
}

export async function getN8nExecutions(
  host: string,
  apiKey?: string,
  limit = 20
): Promise<any[]> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) headers["X-N8N-API-KEY"] = apiKey;

    const res = await fetchWithTimeout(
      `${host}/api/v1/executions?limit=${limit}`,
      { headers, timeoutMs: 5000 }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function getN8nHealth(host: string): Promise<AgentHealth> {
  try {
    const res = await fetchWithTimeout(`${host}/healthz`, { timeoutMs: 3000 });
    return {
      id: "n8n",
      name: "n8n",
      type: "n8n",
      status: res.ok ? "online" : "degraded",
    };
  } catch {
    return { id: "n8n", name: "n8n", type: "n8n", status: "offline" };
  }
}
