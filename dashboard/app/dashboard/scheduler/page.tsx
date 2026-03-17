"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CRON_PRESETS = [
  { label: "Every 30 min", cron: "*/30 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily 7:00", cron: "0 7 * * *" },
  { label: "Daily 18:00", cron: "0 18 * * *" },
  { label: "Mon-Fri 8:00", cron: "0 8 * * 1-5" },
  { label: "Weekly Mon 9:00", cron: "0 9 * * 1" },
];

const AGENTS = ["claw-1","claw-2","claw-3","claw-4","claw-5","claw-6","n8n-1","n8n-2","n8n-3","n8n-4"];

export default function SchedulerPage() {
  const { data, mutate } = useSWR("/api/scheduler", fetcher, { refreshInterval: 10000 });
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", agentId: "claw-3", cron: "0 7 * * *", message: "",
  });

  const tasks = data?.tasks ?? [];

  async function handleAdd() {
    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...form }),
    });
    setShowForm(false);
    setForm({ name: "", agentId: "claw-3", cron: "0 7 * * *", message: "" });
    mutate();
  }

  async function handleDelete(id: string) {
    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    mutate();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, updates: { enabled } }),
    });
    mutate();
  }

  async function handleRun(taskId: string) {
    setRunning(taskId);
    await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", taskId }),
    });
    setTimeout(() => { setRunning(null); mutate(); }, 2000);
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 12, padding: "7px 10px", borderRadius: 8,
    background: "var(--surface-secondary)", border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)", width: "100%",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>Task scheduler</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Schedule recurring tasks for any agent</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: "#6366f1", color: "#fff" }}>
          {showForm ? "Cancel" : "+ New task"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Task name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Morning report" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Agent</label>
              <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} style={inputStyle}>
                {AGENTS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Schedule</label>
              <select value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} style={inputStyle}>
                {CRON_PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label} ({p.cron})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Custom cron (optional)</label>
              <input value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} placeholder="*/30 * * * *" style={{ ...inputStyle, fontFamily: "monospace" }} />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Message to send</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder="สร้างสรุปรายวันจาก Jira tickets ที่ปิดไปเมื่อวาน แล้วส่งไป Discord #standup" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <button onClick={handleAdd} disabled={!form.name || !form.message} className="text-sm px-5 py-2 rounded-lg font-medium" style={{ background: "#6366f1", color: "#fff", opacity: form.name && form.message ? 1 : 0.4 }}>
            Create task
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-sm text-center py-8 rounded-xl" style={{ color: "var(--text-tertiary)", background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
            No scheduled tasks yet
          </p>
        )}
        {tasks.map((t: any) => (
          <div key={t.id} className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: `0.5px solid ${t.lastStatus === "failed" ? "rgba(239,68,68,0.3)" : "var(--border-default)"}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(t.id, !t.enabled)} className="text-xs px-2 py-0.5 rounded" style={{ background: t.enabled ? "rgba(34,197,94,0.1)" : "rgba(160,160,160,0.1)", color: t.enabled ? "#22c55e" : "#888" }}>
                  {t.enabled ? "ON" : "OFF"}
                </button>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleRun(t.id)} disabled={running === t.id} className="text-xs px-3 py-1 rounded-md" style={{ color: "#818cf8", border: "0.5px solid var(--border-default)" }}>
                  {running === t.id ? "Running..." : "Run now"}
                </button>
                <button onClick={() => handleDelete(t.id)} className="text-xs px-2 py-1 rounded-md" style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}>
                  Delete
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
              <div><span style={{ color: "var(--text-tertiary)" }}>Agent:</span> {t.agentId}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>Schedule:</span> {t.cronHuman || t.cron}</div>
              <div><span style={{ color: "var(--text-tertiary)" }}>Runs:</span> {t.runCount}</div>
              <div>
                <span style={{ color: "var(--text-tertiary)" }}>Last: </span>
                {t.lastStatus && (
                  <span style={{ color: t.lastStatus === "success" ? "#22c55e" : t.lastStatus === "failed" ? "#ef4444" : "#f59e0b" }}>
                    {t.lastStatus}
                  </span>
                )}
                {!t.lastStatus && "—"}
              </div>
            </div>
            <p className="text-xs mt-2 truncate" style={{ color: "var(--text-tertiary)" }}>"{t.message}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
