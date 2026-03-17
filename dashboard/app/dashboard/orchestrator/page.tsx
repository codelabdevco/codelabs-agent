"use client";

import { useState } from "react";
import useSWR from "swr";
import { useFleetHealth } from "@/lib/hooks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACTION_ICONS: Record<string, string> = {
  auto_restart: "↻",
  health_alert: "⚠",
  cpu_alert: "△",
  route_task: "→",
  schedule_run: "⏱",
  analytics_snapshot: "◉",
};

const ACTION_COLORS: Record<string, string> = {
  auto_restart: "#f59e0b",
  health_alert: "#ef4444",
  cpu_alert: "#f59e0b",
  route_task: "#818cf8",
  schedule_run: "#22c55e",
  analytics_snapshot: "#6b7280",
};

const CYCLE_STEPS = [
  { label: "Health Check", desc: "ตรวจสอบทุก agent — auto-restart ถ้าพัง", icon: "♥", color: "#22c55e" },
  { label: "CPU/RAM Monitor", desc: "แจ้งเตือนเมื่อ usage เกิน 90%", icon: "△", color: "#f59e0b" },
  { label: "Task Router", desc: "จัดสรรงานไปยัง agent ที่เหมาะสม", icon: "→", color: "#818cf8" },
  { label: "Analytics", desc: "บันทึก snapshot สำหรับ trend analysis", icon: "◉", color: "#0ea5e9" },
  { label: "Scheduler", desc: "Run scheduled tasks ที่ถึงเวลา", icon: "⏱", color: "#8b5cf6" },
];

const ROLE_EMOJI: Record<string, string> = {
  sales: "💼", support: "🎧", docs: "📄", devops: "⚙️", finance: "💰", hr: "👥",
};

export default function OrchestratorPage() {
  const { data, mutate } = useSWR("/api/orchestrator", fetcher, { refreshInterval: 5000 });
  const { data: healthData } = useFleetHealth(10000);
  const state = data || { running: false, lastTick: null, tickCount: 0, recentActions: [], config: {} };
  const agents = healthData?.agents ?? [];

  const [filterType, setFilterType] = useState<string>("");

  async function toggle() {
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: state.running ? "stop" : "start" }),
    });
    mutate();
  }

  const filteredActions = filterType
    ? (state.recentActions || []).filter((a: any) => a.type === filterType)
    : state.recentActions || [];

  const actionTypes = [...new Set((state.recentActions || []).map((a: any) => a.type))];

  // Count actions by type
  const actionCounts: Record<string, number> = {};
  (state.recentActions || []).forEach((a: any) => {
    actionCounts[a.type] = (actionCounts[a.type] || 0) + 1;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>AI Orchestrator</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Meta-agent ที่ดูแล fleet health, auto-restart, route tasks, และ analytics
          </p>
        </div>
        <button
          onClick={toggle}
          className="text-sm px-5 py-2 rounded-lg font-medium transition-all"
          style={{
            background: state.running ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            color: state.running ? "#ef4444" : "#22c55e",
            border: `1px solid ${state.running ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          }}
        >
          {state.running ? "Stop orchestrator" : "Start orchestrator"}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Status</p>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${state.running ? "pulse-online" : ""}`}
              style={{ background: state.running ? "#22c55e" : "#ef4444" }}
            />
            <span className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              {state.running ? "Running" : "Stopped"}
            </span>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Tick count</p>
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>{state.tickCount}</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>every 30 seconds</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Last tick</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {state.lastTick ? new Date(state.lastTick).toLocaleTimeString("th-TH") : "—"}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Total actions</p>
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            {state.recentActions?.length || 0}
          </p>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
          Orchestration pipeline — ทุก cycle (30s)
        </h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {CYCLE_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <div
                className="rounded-lg px-4 py-3 text-center min-w-[120px]"
                style={{ background: `${step.color}10`, border: `1px solid ${step.color}30` }}
              >
                <span className="text-lg block mb-1" style={{ color: step.color }}>{step.icon}</span>
                <p className="text-xs font-medium" style={{ color: step.color }}>{step.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{step.desc}</p>
              </div>
              {i < CYCLE_STEPS.length - 1 && (
                <span className="text-lg" style={{ color: "var(--border-hover)" }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Health Overview */}
      {agents.length > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Fleet health overview
          </h3>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {agents.map((agent: any) => (
              <div
                key={agent.id}
                className="rounded-lg p-3 text-center"
                style={{ background: "var(--surface-secondary)", border: "0.5px solid var(--border-default)" }}
              >
                <span className="text-xl block mb-1">
                  {ROLE_EMOJI[agent.role] || "🤖"}
                </span>
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {agent.name?.replace(/^Claw \d+ — /, "") || agent.id}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${agent.status === "online" ? "pulse-online" : ""}`}
                    style={{
                      background: agent.status === "online" ? "#22c55e" : agent.status === "degraded" ? "#f59e0b" : "#ef4444",
                    }}
                  />
                  <span className="text-xs capitalize" style={{ color: "var(--text-tertiary)" }}>
                    {agent.status || "unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action summary chips */}
      {Object.keys(actionCounts).length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterType("")}
            className="text-xs px-3 py-1 rounded-full"
            style={{
              background: !filterType ? "rgba(99,102,241,0.15)" : "var(--surface-secondary)",
              color: !filterType ? "#818cf8" : "var(--text-secondary)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            All ({state.recentActions?.length || 0})
          </button>
          {Object.entries(actionCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "" : type)}
              className="text-xs px-3 py-1 rounded-full"
              style={{
                background: filterType === type ? `${ACTION_COLORS[type] || "#666"}20` : "var(--surface-secondary)",
                color: filterType === type ? ACTION_COLORS[type] || "#666" : "var(--text-secondary)",
                border: "0.5px solid var(--border-default)",
              }}
            >
              {ACTION_ICONS[type] || "•"} {type.replace(/_/g, " ")} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Action log */}
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Recent actions ({filteredActions.length})
      </h3>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        {filteredActions.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            {state.running ? "Waiting for first cycle..." : "Start the orchestrator to see actions"}
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
            {filteredActions.slice(0, 50).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-opacity-50 transition-colors" style={{ background: i === 0 ? `${ACTION_COLORS[a.type] || "#666"}05` : "transparent" }}>
                <span className="text-base" style={{ color: ACTION_COLORS[a.type] || "#666" }}>
                  {ACTION_ICONS[a.type] || "•"}
                </span>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--text-tertiary)", width: 60 }}>
                  {new Date(a.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                  style={{ background: `${ACTION_COLORS[a.type] || "#666"}15`, color: ACTION_COLORS[a.type] || "#666" }}
                >
                  {a.type.replace(/_/g, " ")}
                </span>
                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{a.detail}</span>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{a.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
