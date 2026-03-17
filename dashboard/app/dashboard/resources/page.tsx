"use client";

import { useState, useEffect, useRef } from "react";
import { useDockerStats } from "@/lib/hooks";
import { UsageBar } from "@/components/UsageBar";

// ---------------------------------------------------------------------------
// Simple canvas sparkline for CPU history
// ---------------------------------------------------------------------------
function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);

    ctx.clearRect(0, 0, w, h);

    // Fill gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + "30");
    gradient.addColorStop(1, color + "00");

    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => {
      ctx.lineTo(i * step, h - (v / max) * h * 0.9);
    });
    ctx.lineTo((data.length - 1) * step, h);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / max) * h * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, color, height]);

  return <canvas ref={canvasRef} width={200} height={height} className="w-full" style={{ height }} />;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const MAX_HISTORY = 60;

export default function ResourcesPage() {
  const { data, isLoading } = useDockerStats(3000);
  const stats = data?.stats ?? [];
  const [view, setView] = useState<"grid" | "table">("grid");
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [memHistory, setMemHistory] = useState<Record<string, number[]>>({});

  // Track CPU/RAM history
  useEffect(() => {
    if (stats.length === 0) return;
    setHistory((prev) => {
      const next = { ...prev };
      stats.forEach((c: any) => {
        const arr = next[c.container] || [];
        arr.push(Math.round(c.cpuPercent || 0));
        if (arr.length > MAX_HISTORY) arr.shift();
        next[c.container] = arr;
      });
      return next;
    });
    setMemHistory((prev) => {
      const next = { ...prev };
      stats.forEach((c: any) => {
        const arr = next[c.container] || [];
        arr.push(Math.round(c.memoryUsageMB || 0));
        if (arr.length > MAX_HISTORY) arr.shift();
        next[c.container] = arr;
      });
      return next;
    });
  }, [stats]);

  const sorted = [...stats].sort((a: any, b: any) => (b.cpuPercent || 0) - (a.cpuPercent || 0));

  // Totals
  const totalCpu = sorted.length > 0
    ? Math.round(sorted.reduce((s: number, c: any) => s + (c.cpuPercent || 0), 0))
    : 0;
  const totalMem = sorted.reduce((s: number, c: any) => s + (c.memoryUsageMB || 0), 0);
  const totalMemLimit = sorted.reduce((s: number, c: any) => s + (c.memoryLimitMB || 0), 0);
  const totalNetRx = sorted.reduce((s: number, c: any) => s + (c.networkRxMB || 0), 0);
  const totalNetTx = sorted.reduce((s: number, c: any) => s + (c.networkTxMB || 0), 0);
  const containerCount = sorted.length;

  // Alert: any container > 80% CPU or > 80% memory
  const alerts = sorted.filter(
    (c: any) =>
      (c.cpuPercent || 0) > 80 ||
      (c.memoryLimitMB && c.memoryUsageMB / c.memoryLimitMB > 0.8)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Resources
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Container resource usage — {containerCount} containers · updates every 3s
          </p>
        </div>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-secondary)" }}>
          {(["grid", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{
                background: view === v ? "var(--surface-primary)" : "transparent",
                color: view === v ? "var(--text-primary)" : "var(--text-tertiary)",
                border: view === v ? "0.5px solid var(--border-default)" : "none",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{ background: "rgba(245,158,11,0.08)", border: "0.5px solid rgba(245,158,11,0.3)" }}
        >
          <span style={{ color: "#f59e0b" }}>⚠</span>
          <span className="text-sm" style={{ color: "#f59e0b" }}>
            {alerts.length} container{alerts.length > 1 ? "s" : ""} using high resources:{" "}
            {alerts.map((a: any) => a.container).join(", ")}
          </span>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Containers</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{containerCount}</p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total CPU</p>
          <p className="text-2xl font-medium mt-1" style={{ color: totalCpu > 80 ? "#ef4444" : "var(--text-primary)" }}>
            {totalCpu}%
          </p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>RAM Used</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>
            {totalMem} <span className="text-sm font-normal" style={{ color: "var(--text-tertiary)" }}>/ {totalMemLimit || "∞"} MB</span>
          </p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Network RX</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{totalNetRx.toFixed(1)} MB</p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Network TX</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{totalNetTx.toFixed(1)} MB</p>
        </div>
      </div>

      {isLoading && sorted.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading container stats...</p>
      ) : view === "grid" ? (
        /* Grid view */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((c: any) => (
            <div
              key={c.container}
              className="rounded-xl p-4"
              style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: (c.cpuPercent || 0) > 80 ? "#ef4444" : "#22c55e" }}
                  />
                  <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.container}
                  </h4>
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                  ↓{c.networkRxMB?.toFixed(1)} ↑{c.networkTxMB?.toFixed(1)} MB
                </span>
              </div>
              <div className="space-y-3">
                <UsageBar label="CPU" value={Math.round(c.cpuPercent)} />
                <UsageBar label="Memory" value={c.memoryUsageMB} max={c.memoryLimitMB} unit="MB" />
              </div>
              {/* CPU sparkline */}
              {(history[c.container]?.length || 0) > 2 && (
                <div className="mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border-default)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>CPU trend (last {history[c.container].length} samples)</p>
                  <Sparkline data={history[c.container]} color="#6366f1" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Table view */
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                {["Container", "CPU %", "RAM (MB)", "Limit (MB)", "Net RX", "Net TX"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium px-4 py-2.5" style={{ color: "var(--text-tertiary)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c: any) => (
                <tr key={c.container} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: (c.cpuPercent || 0) > 80 ? "#ef4444" : "#22c55e" }} />
                      {c.container}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: (c.cpuPercent || 0) > 80 ? "#ef4444" : "var(--text-secondary)" }}>
                    {Math.round(c.cpuPercent)}%
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-secondary)" }}>{c.memoryUsageMB}</td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-tertiary)" }}>{c.memoryLimitMB || "∞"}</td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-tertiary)" }}>{c.networkRxMB?.toFixed(1)}</td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-tertiary)" }}>{c.networkTxMB?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
