"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

export default function ProvisionPage() {
  const { data, mutate } = useSWR("/api/provision", fetcher, { refreshInterval: 10000 });
  const [provisioning, setProvisioning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    role: "general",
    displayName: "",
    description: "",
    model: "claude-sonnet-4-20250514",
    systemPrompt: "",
    memoryLimitMB: 512,
  });

  const summary = data || { totalAgents: 0, nextNumber: 0, nextPort: 0, agents: [], roles: [] };
  const roles = summary.roles || [];

  async function handleProvision() {
    setProvisioning(true);
    setResult(null);
    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision",
          ...form,
          displayName: form.displayName || undefined,
          description: form.description || undefined,
          systemPrompt: form.systemPrompt || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        setShowForm(false);
        setForm({ role: "general", displayName: "", description: "", model: "claude-sonnet-4-20250514", systemPrompt: "", memoryLimitMB: 512 });
        mutate();
      }
    } catch (err: any) {
      setResult({ error: err.message });
    }
    setProvisioning(false);
  }

  async function handleRemove(agentId: string) {
    if (!confirm(`ลบ ${agentId} จริงหรือไม่? Container จะถูกหยุดและลบ`)) return;
    setRemoving(agentId);
    const deleteData = confirm("ลบข้อมูล (sessions, memory) ด้วยหรือไม่?\n\nOK = ลบทั้งหมด\nCancel = เก็บข้อมูลไว้");
    await fetch("/api/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decommission", agentId, deleteData }),
    });
    setRemoving(null);
    mutate();
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 8,
    background: "var(--surface-secondary)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
    width: "100%",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Provision agents
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Add or remove OpenClaw instances — auto-configured and ready to use
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-5 py-2.5 rounded-lg font-medium"
          style={{ background: "#6366f1", color: "#fff" }}
        >
          {showForm ? "Cancel" : "+ Add new Claw"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Active agents</p>
          <p className="text-2xl font-medium" style={{ color: "var(--text-primary)" }}>
            {summary.totalAgents}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Next ID</p>
          <p className="text-2xl font-medium font-mono" style={{ color: "var(--text-primary)" }}>
            claw-{summary.nextNumber}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Next port</p>
          <p className="text-2xl font-medium font-mono" style={{ color: "var(--text-primary)" }}>
            :{summary.nextPort}
          </p>
        </div>
      </div>

      {/* Provision form */}
      {showForm && (
        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            New agent → claw-{summary.nextNumber} (port :{summary.nextPort})
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                Role *
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={inputStyle}
              >
                {roles.map((r: any) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                Display name (optional)
              </label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder={`Claw ${summary.nextNumber} — ${form.role.charAt(0).toUpperCase() + form.role.slice(1)}`}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                Model
              </label>
              <select
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                style={inputStyle}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                Memory limit (MB)
              </label>
              <input
                type="number"
                value={form.memoryLimitMB}
                onChange={(e) => setForm({ ...form, memoryLimitMB: Number(e.target.value) })}
                min={256}
                max={4096}
                style={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description of what this agent does"
                style={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>
                System prompt (optional — auto-generated from role if empty)
              </label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                rows={3}
                placeholder="Leave empty to use default prompt for this role"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleProvision}
              disabled={provisioning || !form.role}
              className="text-sm px-6 py-2.5 rounded-lg font-medium"
              style={{
                background: provisioning ? "#444" : "#6366f1",
                color: "#fff",
                opacity: provisioning ? 0.6 : 1,
              }}
            >
              {provisioning ? "Provisioning..." : "Create & Start Agent"}
            </button>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              This will: generate token → create config → start container → register in fleet
            </p>
          </div>

          {/* Result feedback */}
          {result && (
            <div
              className="mt-4 rounded-lg p-3"
              style={{
                background: result.ok
                  ? "rgba(34,197,94,0.06)"
                  : "rgba(239,68,68,0.06)",
                border: `1px solid ${result.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              {result.ok ? (
                <div>
                  <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
                    Agent provisioned successfully!
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div>ID: <span className="font-mono">{result.agent?.id}</span></div>
                    <div>Port: <span className="font-mono">{result.agent?.port}</span></div>
                    <div>Container: <span className="font-mono">{result.agent?.container}</span></div>
                    <div>Token: <span className="font-mono">{result.agent?.token}</span></div>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "#22c55e" }}>
                    Access at http://localhost:{result.agent?.port}
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "#ef4444" }}>
                  Error: {result.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current agents list */}
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        Active instances ({summary.agents?.length || 0})
      </h3>
      <div className="space-y-2">
        {(summary.agents || []).map((agent: any) => (
          <div
            key={agent.id}
            className="rounded-xl p-4 flex items-center justify-between"
            style={{
              background: "var(--surface-primary)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#22c55e" }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {agent.name}
                </p>
                <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  <span className="font-mono">{agent.id}</span>
                  <span className="font-mono">:{agent.port}</span>
                  <span>{agent.role}</span>
                  <span className="font-mono">{agent.container}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`http://localhost:${agent.port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-md"
                style={{ color: "#818cf8", border: "0.5px solid var(--border-default)" }}
              >
                Open UI
              </a>
              <button
                onClick={() => handleRemove(agent.id)}
                disabled={removing === agent.id}
                className="text-xs px-3 py-1 rounded-md"
                style={{
                  color: removing === agent.id ? "#666" : "#ef4444",
                  border: "0.5px solid var(--border-default)",
                }}
              >
                {removing === agent.id ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
