import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Fleet health (all agents)
// ---------------------------------------------------------------------------
export function useFleetHealth(intervalMs = 10000) {
  return useSWR("/api/health", fetcher, {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Docker stats (CPU, RAM, network)
// ---------------------------------------------------------------------------
export function useDockerStats(intervalMs = 5000) {
  return useSWR("/api/docker", fetcher, {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Aggregated logs
// ---------------------------------------------------------------------------
export function useFleetLogs(
  container?: string | null,
  intervalMs = 3000
) {
  const params = new URLSearchParams({ tail: "80" });
  if (container) params.set("container", container);

  return useSWR(`/api/logs?${params.toString()}`, fetcher, {
    refreshInterval: intervalMs,
  });
}

// ---------------------------------------------------------------------------
// n8n workflows + executions
// ---------------------------------------------------------------------------
export function useN8nData(intervalMs = 15000) {
  return useSWR("/api/n8n", fetcher, {
    refreshInterval: intervalMs,
  });
}

// ---------------------------------------------------------------------------
// Single agent details
// ---------------------------------------------------------------------------
export function useAgentDetail(id: string | null) {
  return useSWR(id ? `/api/agents/${id}` : null, fetcher, {
    refreshInterval: 10000,
  });
}

// ---------------------------------------------------------------------------
// Container actions (restart, stop, start)
// ---------------------------------------------------------------------------
export async function performContainerAction(
  container: string,
  action: "restart" | "stop" | "start"
) {
  const res = await fetch("/api/docker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ container, action }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------
export function useProvisionInfo() {
  return useSWR("/api/provision", fetcher, {
    refreshInterval: 30000,
  });
}

export async function provisionAgent(params: {
  role: string;
  displayName?: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  memoryLimitMB?: number;
  cpuLimit?: string;
}) {
  const res = await fetch("/api/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "provision", ...params }),
  });
  return res.json();
}

export async function decommissionAgent(agentId: string, deleteData = false) {
  const res = await fetch("/api/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "decommission", agentId, deleteData }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
export function useBilling(intervalMs = 10000) {
  return useSWR("/api/billing", fetcher, {
    refreshInterval: intervalMs,
  });
}
