"use client";

import { useState } from "react";
import { LogViewer } from "@/components/LogViewer";

const containers = [
  { value: "", label: "All containers" },
  { value: "claw-1-sales", label: "Claw 1 — Sales" },
  { value: "claw-2-support", label: "Claw 2 — Support" },
  { value: "claw-3-docs", label: "Claw 3 — Docs" },
  { value: "claw-4-devops", label: "Claw 4 — DevOps" },
  { value: "claw-5-finance", label: "Claw 5 — Finance" },
  { value: "claw-6-hr", label: "Claw 6 — HR" },
  { value: "n8n", label: "n8n" },
];

export default function LogsPage() {
  const [filter, setFilter] = useState("");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Live logs
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Real-time log stream from all containers
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm rounded-lg px-3 py-1.5"
          style={{
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
            border: "0.5px solid var(--border-default)",
          }}
        >
          {containers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <LogViewer container={filter || null} />
    </div>
  );
}
