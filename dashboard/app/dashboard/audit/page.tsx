"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login_success: { label: "Login", color: "#22c55e" },
  login_failed: { label: "Login failed", color: "#ef4444" },
  logout: { label: "Logout", color: "#6b7280" },
  agent_restart: { label: "Restart", color: "#f59e0b" },
  agent_stop: { label: "Stop", color: "#ef4444" },
  agent_start: { label: "Start", color: "#22c55e" },
  model_changed: { label: "Model changed", color: "#818cf8" },
  budget_changed: { label: "Budget changed", color: "#fbbf24" },
  settings_updated: { label: "Settings", color: "#6366f1" },
  secret_viewed: { label: "Secret viewed", color: "#f97316" },
  secret_updated: { label: "Secret updated", color: "#f97316" },
  user_created: { label: "User created", color: "#22c55e" },
  user_deleted: { label: "User deleted", color: "#ef4444" },
  chat_message: { label: "Chat", color: "#38bdf8" },
};

export default function AuditPage() {
  const [filterAction, setFilterAction] = useState("");
  const params = new URLSearchParams({ limit: "200" });
  if (filterAction) params.set("action", filterAction);

  const { data, isLoading } = useSWR(`/api/audit?${params}`, fetcher, {
    refreshInterval: 10000,
  });

  const logs = data?.logs ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Audit log
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Who did what, when — every action is recorded
          </p>
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-sm rounded-lg px-3 py-1.5"
          style={{
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--surface-primary)",
          border: "0.5px solid var(--border-default)",
        }}
      >
        {isLoading && logs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            Loading audit logs...
          </p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            No audit entries found
          </p>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                {["Time", "User", "Action", "Target", "Detail", "IP"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-xs font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((entry: any) => {
                const actionInfo = ACTION_LABELS[entry.action] || {
                  label: entry.action,
                  color: "#6b7280",
                };
                const time = new Date(entry.timestamp);
                return (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "0.5px solid var(--border-default)" }}
                  >
                    <td
                      className="px-4 py-2 font-mono text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {time.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })}{" "}
                      {time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                      {entry.username}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: `${actionInfo.color}15`,
                          color: actionInfo.color,
                        }}
                      >
                        {actionInfo.label}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2 font-mono text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {entry.target}
                    </td>
                    <td
                      className="px-4 py-2 text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {entry.detail || "—"}
                    </td>
                    <td
                      className="px-4 py-2 font-mono text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {entry.ip || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
