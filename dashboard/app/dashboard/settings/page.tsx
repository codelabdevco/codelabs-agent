"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          Settings
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Fleet configuration and connection settings
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Global model config */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            Global model configuration
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Default model
              </label>
              <select
                className="flex-1 text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
                defaultValue="claude-sonnet-4-20250514"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="gpt-4o">GPT-4o</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Fallback model
              </label>
              <select
                className="flex-1 text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
                defaultValue="claude-haiku-4-5-20251001"
              >
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
              </select>
            </div>
          </div>
        </section>

        {/* n8n connection */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            n8n connection
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Endpoint
              </label>
              <input
                type="text"
                defaultValue="http://n8n:5678"
                className="flex-1 text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                API key
              </label>
              <input
                type="password"
                defaultValue="n8n_api_xxxxx"
                className="flex-1 text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
              />
            </div>
          </div>
        </section>

        {/* Polling intervals */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            Polling intervals
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Health check
              </label>
              <input
                type="number"
                defaultValue={10}
                min={3}
                max={60}
                className="w-20 text-sm rounded-lg px-3 py-2 text-right"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>seconds</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Stats
              </label>
              <input
                type="number"
                defaultValue={5}
                min={2}
                max={30}
                className="w-20 text-sm rounded-lg px-3 py-2 text-right"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>seconds</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm w-32 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                Logs
              </label>
              <input
                type="number"
                defaultValue={3}
                min={1}
                max={15}
                className="w-20 text-sm rounded-lg px-3 py-2 text-right"
                style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-default)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>seconds</span>
            </div>
          </div>
        </section>

        {/* OpenClaw instances */}
        <section
          className="rounded-xl p-5"
          style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
        >
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            OpenClaw instances
          </h3>
          <div className="space-y-2">
            {[
              { id: "claw-1", name: "Sales", port: 18789 },
              { id: "claw-2", name: "Support", port: 18790 },
              { id: "claw-3", name: "Docs", port: 18791 },
              { id: "claw-4", name: "DevOps", port: 18792 },
              { id: "claw-5", name: "Finance", port: 18793 },
              { id: "claw-6", name: "HR", port: 18794 },
            ].map((inst) => (
              <div
                key={inst.id}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: "0.5px solid var(--border-default)" }}
              >
                <span className="text-sm w-24" style={{ color: "var(--text-primary)" }}>
                  {inst.name}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                  :{inst.port}
                </span>
                <span className="text-xs font-mono flex-1" style={{ color: "var(--text-secondary)" }}>
                  http://openclaw-{inst.id.split("-")[1]}:3001
                </span>
                <a
                  href={`http://localhost:${inst.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{ color: "var(--accent)", border: "0.5px solid var(--border-default)" }}
                >
                  Open UI
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            className="text-sm px-5 py-2 rounded-lg font-medium transition-all"
            style={{
              background: saved ? "var(--status-online)" : "var(--accent)",
              color: "#fff",
            }}
          >
            {saved ? "Saved!" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
