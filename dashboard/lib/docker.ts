import Docker from "dockerode";
import type { ContainerStats } from "./fleet";

// ---------------------------------------------------------------------------
// Docker client (connects via unix socket mounted into the dashboard container)
// ---------------------------------------------------------------------------

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// ---------------------------------------------------------------------------
// List fleet containers
// ---------------------------------------------------------------------------

export async function listFleetContainers() {
  const containers = await docker.listContainers({ all: true });
  return containers.filter(
    (c) =>
      c.Labels?.["fleet.agent"] === "openclaw" ||
      c.Labels?.["fleet.agent"] === "n8n" ||
      c.Names?.some((n) => n.includes("claw-") || n.includes("n8n"))
  );
}

// ---------------------------------------------------------------------------
// Get container stats (one-shot, not streaming)
// ---------------------------------------------------------------------------

export async function getContainerStats(
  containerName: string
): Promise<ContainerStats | null> {
  try {
    const container = docker.getContainer(containerName);
    const stats: any = await container.stats({ stream: false });

    // CPU calculation
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage -
      stats.precpu_stats.system_cpu_usage;
    const numCpus = stats.cpu_stats.online_cpus || 1;
    const cpuPercent =
      systemDelta > 0
        ? Math.round((cpuDelta / systemDelta) * numCpus * 10000) / 100
        : 0;

    // Memory
    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memoryUsageMB = Math.round(memUsage / 1024 / 1024);
    const memoryLimitMB = Math.round(memLimit / 1024 / 1024);
    const memoryPercent = Math.round((memUsage / memLimit) * 10000) / 100;

    // Network
    const networks = stats.networks || {};
    let rxBytes = 0;
    let txBytes = 0;
    for (const iface of Object.values(networks) as any[]) {
      rxBytes += iface.rx_bytes || 0;
      txBytes += iface.tx_bytes || 0;
    }

    return {
      id: containerName,
      container: containerName,
      cpuPercent,
      memoryUsageMB,
      memoryLimitMB,
      memoryPercent,
      networkRxMB: Math.round((rxBytes / 1024 / 1024) * 100) / 100,
      networkTxMB: Math.round((txBytes / 1024 / 1024) * 100) / 100,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Get stats for all fleet containers
// ---------------------------------------------------------------------------

export async function getAllFleetStats(): Promise<ContainerStats[]> {
  const containers = await listFleetContainers();
  const results = await Promise.allSettled(
    containers.map((c) => {
      const name = c.Names?.[0]?.replace(/^\//, "") || c.Id.slice(0, 12);
      return getContainerStats(name);
    })
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ContainerStats> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

// ---------------------------------------------------------------------------
// Container actions
// ---------------------------------------------------------------------------

export async function restartContainer(containerName: string): Promise<void> {
  const container = docker.getContainer(containerName);
  await container.restart({ t: 10 });
}

export async function stopContainer(containerName: string): Promise<void> {
  const container = docker.getContainer(containerName);
  await container.stop({ t: 10 });
}

export async function startContainer(containerName: string): Promise<void> {
  const container = docker.getContainer(containerName);
  await container.start();
}

// ---------------------------------------------------------------------------
// Container logs (last N lines)
// ---------------------------------------------------------------------------

export async function getContainerLogs(
  containerName: string,
  tail = 100
): Promise<string[]> {
  try {
    const container = docker.getContainer(containerName);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    // Docker logs come as a Buffer with header bytes per line
    const text = typeof logs === "string" ? logs : logs.toString("utf-8");
    return text
      .split("\n")
      .map((line: string) => {
        // Strip docker log header (8 bytes)
        if (line.length > 8) {
          const cleaned = line.slice(8).trim();
          return cleaned || null;
        }
        return line.trim() || null;
      })
      .filter(Boolean) as string[];
  } catch {
    return [];
  }
}
