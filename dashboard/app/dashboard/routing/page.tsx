"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MATCH_TYPES = [
  { value: "keyword", label: "Keyword match" },
  { value: "intent", label: "Intent (category)" },
  { value: "prefix", label: "Prefix" },
  { value: "always", label: "Always route" },
];

const DELEGATION_MODES = [
  { value: "forward", label: "Forward (move to target)" },
  { value: "ask_then_forward", label: "Ask user first" },
  { value: "copy", label: "Copy (keep in both)" },
];

export default function RoutingPage() {
  const { data, mutate } = useSWR("/api/routing", fetcher, { refreshInterval: 15000 });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", sourceAgentIds: [] as string[], matchType: "keyword",
    matchValue: "", targetAgentId: "claw-5", mode: "forward",
    includeContext: true, priority: 10,
  });

  const rules = data?.rules ?? [];
  const recentLogs = data?.recentLogs ?? [];

  async function handleAdd() {
    await fetch("/api/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        name: form.name,
        sourceAgentIds: form.sourceAgentIds,
        match: { type: form.matchType, value: form.matchValue },
        targetAgentId: form.targetAgentId,
        delegation: { mode: form.mode, includeContext: form.includeContext },
        priority: form.priority,
      }),
    });
    setShowForm(false);
    setForm({ name: "", sourceAgentIds: [], matchType: "keyword", matchValue: "", targetAgentId: "claw-5", mode: "forward", includeContext: true, priority: 10 });
    mutate();
  }

  async function handleDelete(id: string) {
    await fetch("/api/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    mutate();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch("/api/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, updates: { enabled } }),
    });
    mutate();
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
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>Agent routing</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Auto-delegate tasks between agents based on rules
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: "var(--accent, #6366f1)", color: "#fff" }}
        >
          {showForm ? "Cancel" : "+ Add rule"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>New routing rule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Rule name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Invoice to Finance" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Target agent</label>
              <select value={form.targetAgentId} onChange={(e) => setForm({ ...form, targetAgentId: e.target.value })} style={inputStyle}>
                {["claw-1","claw-2","claw-3","claw-4","claw-5","claw-6"].map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Match type</label>
              <select value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })} style={inputStyle}>
                {MATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Match value</label>
              <input value={form.matchValue} onChange={(e) => setForm({ ...form, matchValue: e.target.value })} placeholder="e.g. invoice, ใบแจ้งหนี้" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Delegation mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} style={inputStyle}>
                {DELEGATION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Priority (lower = first)</label>
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} min={1} max={100} style={inputStyle} />
            </div>
          </div>
          <button onClick={handleAdd} disabled={!form.name || !form.matchValue} className="mt-4 text-sm px-5 py-2 rounded-lg font-medium" style={{ background: "var(--accent, #6366f1)", color: "#fff", opacity: form.name && form.matchValue ? 1 : 0.4 }}>
            Create rule
          </button>
        </div>
      )}

      {/* Rules list */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        {rules.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>No routing rules yet</p>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                {["", "Name", "Match", "Target", "Mode", "Priority", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <td className="px-4 py-2">
                    <button onClick={() => handleToggle(r.id, !r.enabled)} className="text-xs px-2 py-0.5 rounded" style={{ background: r.enabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: r.enabled ? "#22c55e" : "#ef4444" }}>
                      {r.enabled ? "ON" : "OFF"}
                    </button>
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>{r.name}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                      {r.match?.type}: {r.match?.value}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.targetAgentId}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>{r.delegation?.mode}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>{r.priority}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(r.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent routing logs */}
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>Recent routing activity</h3>
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--text-tertiary)" }}>No routing events yet</p>
        ) : (
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                {["Time", "Rule", "Source", "Target", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-tertiary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((l: any) => (
                <tr key={l.id} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <td className="px-4 py-2 font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(l.timestamp).toLocaleTimeString("th-TH")}
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>{l.ruleName}</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{l.sourceAgent}</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{l.targetAgent}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded" style={{ background: l.status === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: l.status === "success" ? "#22c55e" : "#ef4444" }}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
