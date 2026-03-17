"use client";

import { useN8nData } from "@/lib/hooks";

export default function N8nPage() {
  const { data, isLoading } = useN8nData(10000);
  const workflows = data?.workflows ?? [];
  const executions = data?.executions ?? [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          n8n Workflows
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Monitor workflows and recent executions
        </p>
      </div>

      {/* Workflows table */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          Workflows ({workflows.length})
        </h3>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--surface-primary)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          {isLoading && workflows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
              Loading workflows...
            </p>
          ) : workflows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
              No workflows found. Check n8n API connection.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Name
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Status
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((w: any) => (
                  <tr key={w.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>
                      {w.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: w.active ? "rgba(34,197,94,0.08)" : "rgba(160,160,160,0.08)",
                          color: w.active ? "var(--status-online)" : "var(--text-tertiary)",
                        }}
                      >
                        {w.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`http://localhost:5678/workflow/${w.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 rounded-md"
                        style={{
                          color: "var(--accent)",
                          border: "0.5px solid var(--border-default)",
                        }}
                      >
                        Open in n8n
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent executions */}
      <div>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
          Recent executions
        </h3>
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--surface-primary)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          {executions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
              No recent executions
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    ID
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Workflow
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Status
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.slice(0, 15).map((ex: any) => (
                  <tr key={ex.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-tertiary)" }}>
                      #{ex.id}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--text-primary)" }}>
                      {ex.workflowData?.name ?? ex.workflowId ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background:
                            ex.status === "success"
                              ? "rgba(34,197,94,0.08)"
                              : ex.status === "error"
                              ? "rgba(239,68,68,0.08)"
                              : "rgba(160,160,160,0.08)",
                          color:
                            ex.status === "success"
                              ? "var(--status-online)"
                              : ex.status === "error"
                              ? "var(--status-offline)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {ex.status ?? "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                      {ex.startedAt
                        ? new Date(ex.startedAt).toLocaleString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
