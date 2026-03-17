"use client";

import useSWR from "swr";

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

export default function OrchestratorPage() {
  const { data, mutate } = useSWR("/api/orchestrator", fetcher, { refreshInterval: 5000 });
  const state = data || { running: false, lastTick: null, tickCount: 0, recentActions: [] };

  async function toggle() {
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: state.running ? "stop" : "start" }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>AI Orchestrator</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Meta-agent that monitors fleet health, auto-restarts, routes tasks, and records analytics
          </p>
        </div>
        <button onClick={toggle} className="text-sm px-5 py-2 rounded-lg font-medium"
          style={{ background: state.running ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: state.running ? "#ef4444" : "#22c55e", border: `1px solid ${state.running ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}` }}>
          {state.running ? "Stop orchestrator" : "Start orchestrator"}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Status</p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: state.running ? "#22c55e" : "#ef4444" }} />
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
      </div>

      {/* What it does */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>What the orchestrator does every cycle</h3>
        <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div className="flex items-start gap-2">
            <span style={{ color: "#22c55e" }}>1.</span>
            <span>Health check ทุก agent — ถ้าพังจะ auto-restart + แจ้งเตือน</span>
          </div>
          <div className="flex items-start gap-2">
            <span style={{ color: "#f59e0b" }}>2.</span>
            <span>Monitor CPU/RAM — แจ้งเตือนเมื่อเกิน 90%</span>
          </div>
          <div className="flex items-start gap-2">
            <span style={{ color: "#818cf8" }}>3.</span>
            <span>Record analytics snapshot สำหรับ trend analysis</span>
          </div>
          <div className="flex items-start gap-2">
            <span style={{ color: "#38bdf8" }}>4.</span>
            <span>Run scheduled tasks ที่ถึงเวลา</span>
          </div>
        </div>
      </div>

      {/* Action log */}
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Recent orchestrator actions ({state.recentActions?.length || 0})
      </h3>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        {(!state.recentActions || state.recentActions.length === 0) ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            {state.running ? "Waiting for first cycle..." : "Start the orchestrator to see actions"}
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
            {state.recentActions.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base" style={{ color: ACTION_COLORS[a.type] || "#666" }}>
                  {ACTION_ICONS[a.type] || "•"}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)", width: 60 }}>
                  {new Date(a.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${ACTION_COLORS[a.type] || "#666"}15`, color: ACTION_COLORS[a.type] || "#666" }}>
                  {a.type.replace(/_/g, " ")}
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)", flex: 1 }}>{a.detail}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{a.target}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
