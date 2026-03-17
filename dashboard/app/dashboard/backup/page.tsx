"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BackupPage() {
  const { data, mutate } = useSWR("/api/backup", fetcher);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const backups = data?.backups ?? [];

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
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", backupId }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>Backup & restore</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Protect configs, sessions, and data</p>
        </div>
        <div className="flex gap-2">
          {(["full", "config", "data"] as const).map((type) => (
            <button key={type} onClick={() => handleCreate(type)} disabled={creating}
              className="text-sm px-4 py-2 rounded-lg" style={{ background: type === "full" ? "#6366f1" : "var(--surface-primary)", color: type === "full" ? "#fff" : "var(--text-secondary)", border: "0.5px solid var(--border-default)" }}>
              {creating ? "..." : `Backup ${type}`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {backups.length === 0 && (
          <p className="text-sm text-center py-8 rounded-xl" style={{ color: "var(--text-tertiary)", background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
            No backups yet — create your first one
          </p>
        )}
        {backups.map((b: any) => (
          <div key={b.id} className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{b.id}</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>{b.type}</span>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{b.sizeHuman}</span>
              </div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {new Date(b.timestamp).toLocaleString("th-TH")} — by {b.createdBy} — {b.files.length} files
              </div>
              {b.description && <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{b.description}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleRestore(b.id)} disabled={restoring === b.id}
                className="text-xs px-3 py-1 rounded-md" style={{ color: "#22c55e", border: "0.5px solid var(--border-default)" }}>
                {restoring === b.id ? "Restoring..." : "Restore"}
              </button>
              <button onClick={() => handleDelete(b.id)}
                className="text-xs px-3 py-1 rounded-md" style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
