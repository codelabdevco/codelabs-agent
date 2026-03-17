"use client";

import { useState } from "react";
import { StatusDot } from "./StatusDot";
import { UsageBar } from "./UsageBar";
import { performContainerAction } from "@/lib/hooks";

interface AgentCardProps {
  id: string;
  name: string;
  type: "openclaw" | "n8n";
  role?: string;
  status: "online" | "degraded" | "offline";
  port?: number;
  cpu?: number;
  memoryMB?: number;
  memoryLimitMB?: number;
  sessions?: number;
  container?: string;
  onViewLogs?: (container: string) => void;
}

export function AgentCard({
  id,
  name,
  type,
  role,
  status,
  port,
  cpu,
  memoryMB,
  memoryLimitMB,
  sessions,
  container,
  onViewLogs,
}: AgentCardProps) {
  const [acting, setActing] = useState(false);

  async function handleAction(action: "restart" | "stop" | "start") {
    if (!container || acting) return;
    setActing(true);
    try {
      await performContainerAction(container, action);
    } catch {
      // handle error silently, will refresh on next poll
    }
    setTimeout(() => setActing(false), 3000);
  }

  return (
    <div
      className="rounded-xl p-4 transition-all hover:shadow-sm"
      style={{
        background: "var(--surface-primary)",
        border: `0.5px solid ${status === "degraded" ? "var(--status-degraded)" : "var(--border-default)"}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={status} size="md" />
          <div>
            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {name}
            </h3>
            {port && (
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                :{port}
              </p>
            )}
          </div>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-md"
          style={{
            background: type === "openclaw" ? "rgba(13,148,86,0.08)" : "rgba(216,90,48,0.08)",
            color: type === "openclaw" ? "#0f6e56" : "#993c1d",
          }}
        >
          {type === "openclaw" ? "OpenClaw" : "n8n"}
        </span>
      </div>

      {/* Stats */}
      <div className="space-y-2.5 mb-3">
        {cpu !== undefined && (
          <UsageBar label="CPU" value={Math.round(cpu)} />
        )}
        {memoryMB !== undefined && memoryLimitMB !== undefined && (
          <UsageBar label="RAM" value={memoryMB} max={memoryLimitMB} unit="MB" />
        )}
        {sessions !== undefined && (
          <div className="flex justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Sessions</span>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {sessions}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
        {container && onViewLogs && (
          <button
            onClick={() => onViewLogs(container)}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{
              color: "var(--text-secondary)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            Logs
          </button>
        )}
        <button
          onClick={() => handleAction("restart")}
          disabled={acting || !container}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
          style={{
            color: "var(--status-degraded)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          {acting ? "..." : "Restart"}
        </button>
        {status === "online" ? (
          <button
            onClick={() => handleAction("stop")}
            disabled={acting || !container}
            className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
            style={{
              color: "var(--status-offline)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            Stop
          </button>
        ) : status === "offline" ? (
          <button
            onClick={() => handleAction("start")}
            disabled={acting || !container}
            className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-40"
            style={{
              color: "var(--status-online)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            Start
          </button>
        ) : null}
      </div>
    </div>
  );
}
