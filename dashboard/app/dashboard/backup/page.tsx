"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_COLORS: Record<string, string> = {
  full: "#6366f1",
  config: "#0ea5e9",
  data: "#22c55e",
};

const TYPE_ICONS: Record<string, string> = {
  full: "▥",
  config: "⚙",
  data: "◧",
};

export default function BackupPage() {
  const { data, mutate } = useSWR("/api/backup", fetcher);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(true);
  const [schedule, setSchedule] = useState("daily");
  const [showSchedule, setShowSchedule] = useState(false);

  const backups = data?.backups ?? [];

  // Group by type
  const groupedCounts: Record<string, number> = {};
  const totalSize = backups.reduce((s: number, b: any) => {
    groupedCounts[b.type] = (groupedCounts[b.type] || 0) + 1;
    return s + (b.sizeBytes || 0);
  }, 0);

  async function handleCreate(type: "full" | "config" | "data") {
    setCreating(true);
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", type }),
    });
    setCreating(false);
    mutate();
  }

  async function handleRestore(backupId: string) {
    if (!confirm("This will overwrite current files. Continue?")) return;
    setRestoring(backupId);
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", backupId }),
    });
    setRestoring(null);
    mutate();
  }

  async function handleDelete(backupId: string) {
    if (!confirm("Delete this backup?")) return;
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", backupId }),
    });
    mutate();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>Backup & Restore</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Protect configs, sessions, and data — {backups.length} backups
          </p>
        </div>
        <div className="flex gap-2">
          {(["full", "config", "data"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleCreate(type)}
              disabled={creating}
              className="text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all"
              style={{
                background: type === "full" ? "#6366f1" : "var(--surface-primary)",
                color: type === "full" ? "#fff" : "var(--text-secondary)",
                border: "0.5px solid var(--border-default)",
                opacity: creating ? 0.6 : 1,
              }}
            >
              <span>{TYPE_ICONS[type]}</span>
              {creating ? "..." : `Backup ${type}`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total backups</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{backups.length}</p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Total size</p>
          <p className="text-2xl font-medium mt-1" style={{ color: "var(--text-primary)" }}>{formatSize(totalSize)}</p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Latest backup</p>
          <p className="text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>
            {backups.length > 0 ? new Date(backups[0].timestamp).toLocaleString("th-TH") : "—"}
          </p>
        </div>
        <div className="rounded-xl px-4 py-3.5" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Auto-backup</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoBackup(!autoBackup)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: autoBackup ? "#22c55e" : "var(--surface-tertiary)" }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: autoBackup ? 22 : 2 }}
              />
            </button>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {autoBackup ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Schedule config */}
      {autoBackup && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center justify-between"
          style={{ background: "rgba(34,197,94,0.05)", border: "0.5px solid rgba(34,197,94,0.2)" }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: "#22c55e" }}>⏱</span>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Auto-backup schedule</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Full backup runs {schedule === "daily" ? "every day at 02:00" : schedule === "weekly" ? "every Sunday at 02:00" : "every 1st of month at 02:00"}
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-secondary)" }}>
            {["daily", "weekly", "monthly"].map((s) => (
              <button
                key={s}
                onClick={() => setSchedule(s)}
                className="text-xs px-3 py-1.5 rounded-md capitalize"
                style={{
                  background: schedule === s ? "var(--surface-primary)" : "transparent",
                  color: schedule === s ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: schedule === s ? "0.5px solid var(--border-default)" : "none",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backup type breakdown */}
      {Object.keys(groupedCounts).length > 0 && (
        <div className="flex gap-2 mb-4">
          {Object.entries(groupedCounts).map(([type, count]) => (
            <span
              key={type}
              className="text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: `${TYPE_COLORS[type] || "#666"}15`, color: TYPE_COLORS[type] || "#666" }}
            >
              {TYPE_ICONS[type]} {type}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Backup list */}
      <div className="space-y-3">
        {backups.length === 0 && (
          <p
            className="text-sm text-center py-8 rounded-xl"
            style={{ color: "var(--text-tertiary)", background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
          >
            No backups yet — create your first one
          </p>
        )}
        {backups.map((b: any, i: number) => (
          <div
            key={b.id}
            className="rounded-xl p-4"
            style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-lg" style={{ color: TYPE_COLORS[b.type] || "#666" }}>
                    {TYPE_ICONS[b.type] || "▥"}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{b.id}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${TYPE_COLORS[b.type] || "#666"}15`, color: TYPE_COLORS[b.type] || "#666" }}
                  >
                    {b.type}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {b.sizeHuman || formatSize(b.sizeBytes || 0)}
                  </span>
                  {i === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                      Latest
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{new Date(b.timestamp).toLocaleString("th-TH")}</span>
                  <span>by {b.createdBy || "system"}</span>
                  <span>{b.files?.length || 0} files</span>
                </div>
                {b.description && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>{b.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => handleRestore(b.id)}
                  disabled={restoring === b.id}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: "#22c55e", border: "0.5px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}
                >
                  {restoring === b.id ? "Restoring..." : "Restore"}
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
