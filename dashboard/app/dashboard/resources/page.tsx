"use client";

import { useDockerStats } from "@/lib/hooks";
import { UsageBar } from "@/components/UsageBar";

export default function ResourcesPage() {
  const { data, isLoading } = useDockerStats(3000);
  const stats = data?.stats ?? [];

  // Sort: highest CPU first
  const sorted = [...stats].sort((a: any, b: any) => (b.cpuPercent || 0) - (a.cpuPercent || 0));

  // Totals
  const totalCpu = sorted.length > 0
    ? Math.round(sorted.reduce((s: number, c: any) => s + (c.cpuPercent || 0), 0))
    : 0;
  const totalMem = sorted.reduce((s: number, c: any) => s + (c.memoryUsageMB || 0), 0);
  const totalNetRx = sorted.reduce((s: number, c: any) => s + (c.networkRxMB || 0), 0);
  const totalNetTx = sorted.reduce((s: number, c: any) => s + (c.networkTxMB || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          Resources
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Container resource usage — updates every 3 seconds
        </p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total CPU usage</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{totalCpu}%</p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total RAM</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{totalMem} MB</p>
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

      {/* Per-container detail */}
      {isLoading && sorted.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading container stats...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((c: any) => (
            <div
              key={c.container}
              className="rounded-xl p-4"
              style={{
                background: "var(--surface-primary)",
                border: "0.5px solid var(--border-default)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.container}
                </h4>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                  {c.networkRxMB?.toFixed(1)} / {c.networkTxMB?.toFixed(1)} MB
                </span>
              </div>
              <div className="space-y-3">
                <UsageBar label="CPU" value={Math.round(c.cpuPercent)} />
                <UsageBar
                  label="Memory"
                  value={c.memoryUsageMB}
                  max={c.memoryLimitMB}
                  unit="MB"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
