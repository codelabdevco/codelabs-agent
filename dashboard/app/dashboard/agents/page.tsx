"use client";

import { useState } from "react";
import { useFleetHealth, useDockerStats } from "@/lib/hooks";
import { AgentCard } from "@/components/AgentCard";
import { LogViewer } from "@/components/LogViewer";

// Mapping from agent IDs to container names
const containerMap: Record<string, string> = {
  "claw-1": "claw-1-sales",
  "claw-2": "claw-2-support",
  "claw-3": "claw-3-docs",
  "claw-4": "claw-4-devops",
  "claw-5": "claw-5-finance",
  "claw-6": "claw-6-hr",
  n8n: "n8n",
};

const portMap: Record<string, number> = {
  "claw-1": 18789,
  "claw-2": 18790,
  "claw-3": 18791,
  "claw-4": 18792,
  "claw-5": 18793,
  "claw-6": 18794,
  n8n: 5678,
};

export default function AgentsPage() {
  const { data: health } = useFleetHealth(10000);
  const { data: docker } = useDockerStats(5000);
  const [logTarget, setLogTarget] = useState<string | null>(null);

  const agents = health?.agents ?? [];
  const stats = docker?.stats ?? [];

  function findStats(agentId: string) {
    const container = containerMap[agentId];
    return stats.find((s: any) => s.container === container);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Agents
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Manage and monitor all agents
          </p>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {agents.map((agent: any) => {
          const cStats = findStats(agent.id);
          return (
            <AgentCard
              key={agent.id}
              id={agent.id}
              name={agent.name}
              type={agent.type}
              status={agent.status}
              port={portMap[agent.id]}
              cpu={cStats?.cpuPercent}
              memoryMB={cStats?.memoryUsageMB}
              memoryLimitMB={cStats?.memoryLimitMB ?? 512}
              sessions={agent.activeSessions}
              container={containerMap[agent.id]}
              onViewLogs={(c) => setLogTarget(logTarget === c ? null : c)}
            />
          );
        })}
      </div>

      {/* Log panel (shows when a container is selected) */}
      {logTarget && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Logs: {logTarget}
            </h3>
            <button
              onClick={() => setLogTarget(null)}
              className="text-xs px-3 py-1 rounded-md"
              style={{
                color: "var(--text-secondary)",
                border: "0.5px solid var(--border-default)",
              }}
            >
              Close
            </button>
          </div>
          <LogViewer container={logTarget} />
        </div>
      )}
    </div>
  );
}
