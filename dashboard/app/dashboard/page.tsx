"use client";

import { useFleetHealth, useDockerStats, useN8nData } from "@/lib/hooks";
import { MetricCard } from "@/components/MetricCard";
import { StatusDot } from "@/components/StatusDot";
import { UsageBar } from "@/components/UsageBar";

export default function DashboardOverview() {
  const { data: health } = useFleetHealth(10000);
  const { data: docker } = useDockerStats(5000);
  const { data: n8n } = useN8nData(15000);

  const agents = health?.agents ?? [];
  const summary = health?.summary ?? { total: 0, online: 0, degraded: 0, offline: 0 };
  const stats = docker?.stats ?? [];
  const workflows = n8n?.workflows ?? [];

  // Calculate aggregate metrics
  const totalCpu = stats.length > 0
    ? Math.round(stats.reduce((s: number, c: any) => s + (c.cpuPercent || 0), 0) / stats.length)
    : 0;
  const totalMemMB = stats.reduce((s: number, c: any) => s + (c.memoryUsageMB || 0), 0);
  const activeWorkflows = workflows.filter((w: any) => w.active).length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Fleet overview
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Real-time status of all agents and resources
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-1.5">
            <StatusDot status="online" /> {summary.online} online
          </span>
          <span className="flex items-center gap-1.5">
            <StatusDot status="degraded" /> {summary.degraded} degraded
          </span>
          <span className="flex items-center gap-1.5">
            <StatusDot status="offline" /> {summary.offline} offline
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Total agents"
          value={`${summary.total}`}
          sub={`${agents.filter((a: any) => a.type === "openclaw").length} OpenClaw · ${agents.filter((a: any) => a.type === "n8n").length} n8n`}
        />
        <MetricCard
          label="Active sessions"
          value={agents.reduce((s: number, a: any) => s + (a.activeSessions || 0), 0)}
          sub="across all gateways"
        />
        <MetricCard
          label="Avg CPU"
          value={`${totalCpu}%`}
          sub="fleet average"
        />
        <MetricCard
          label="Total RAM"
          value={`${totalMemMB} MB`}
          sub={`${stats.length} containers`}
        />
      </div>

      {/* Agent status grid */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          Agent status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent: any) => {
            const containerStats = stats.find(
              (s: any) =>
                s.container?.includes(agent.id) ||
                s.container?.includes(agent.name?.toLowerCase().replace(/\s/g, "-"))
            );

            return (
              <div
                key={agent.id}
                className="rounded-xl p-3.5"
                style={{
                  background: "var(--surface-primary)",
                  border: `0.5px solid ${
                    agent.status === "degraded" ? "var(--status-degraded)" : "var(--border-default)"
                  }`,
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <StatusDot status={agent.status} size="md" />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {agent.name}
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-md"
                    style={{
                      background:
                        agent.type === "openclaw"
                          ? "rgba(13,148,86,0.08)"
                          : "rgba(216,90,48,0.08)",
                      color: agent.type === "openclaw" ? "#0f6e56" : "#993c1d",
                    }}
                  >
                    {agent.type}
                  </span>
                </div>
                <div className="space-y-2">
                  <UsageBar
                    label="CPU"
                    value={Math.round(containerStats?.cpuPercent ?? 0)}
                  />
                  <UsageBar
                    label="RAM"
                    value={containerStats?.memoryUsageMB ?? 0}
                    max={containerStats?.memoryLimitMB ?? 512}
                    unit="MB"
                  />
                </div>
                {agent.activeSessions !== undefined && (
                  <div className="flex justify-between text-xs mt-2">
                    <span style={{ color: "var(--text-secondary)" }}>Sessions</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {agent.activeSessions}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* n8n workflows summary */}
      {workflows.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            n8n workflows ({activeWorkflows} active)
          </h3>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface-primary)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Workflow
                  </th>
                  <th
                    className="text-left px-4 py-2.5 text-xs font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Status
                  </th>
                  <th
                    className="text-right px-4 py-2.5 text-xs font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w: any) => (
                  <tr
                    key={w.id}
                    style={{ borderBottom: "0.5px solid var(--border-default)" }}
                  >
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>
                      {w.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: w.active
                            ? "rgba(34,197,94,0.08)"
                            : "rgba(160,160,160,0.08)",
                          color: w.active ? "var(--status-online)" : "var(--text-tertiary)",
                        }}
                      >
                        {w.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2.5 text-right font-mono text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      #{w.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
