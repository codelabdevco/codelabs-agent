"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function BillingPage() {
  const { data, mutate } = useSWR("/api/billing", fetcher, { refreshInterval: 10000 });
  const [editBudget, setEditBudget] = useState(false);
  const [newBudget, setNewBudget] = useState(5000);

  const budget = data?.budget || { budgetTHB: 5000, alertsSent: [] };
  const costs = data?.costs || { agents: [], totalUSD: 0, totalTHB: 0, budgetPercent: 0 };

  async function handleSetBudget() {
    await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-budget", budgetTHB: newBudget }),
    });
    setEditBudget(false);
    mutate();
  }

  async function handleReset() {
    if (!confirm("รีเซ็ตค่าใช้จ่ายทั้งหมดเป็น 0 ?")) return;
    await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-usage" }),
    });
    mutate();
  }

  const barColor =
    costs.budgetPercent >= 100
      ? "#ef4444"
      : costs.budgetPercent >= 75
      ? "#f59e0b"
      : "#22c55e";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
            Billing
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Real-time cost tracking + budget alerts
          </p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs px-3 py-1.5 rounded-md"
          style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}
        >
          Reset usage
        </button>
      </div>

      {/* Budget bar */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
              ฿{Math.round(costs.totalTHB).toLocaleString()}
            </span>
            <span className="text-sm ml-2" style={{ color: "var(--text-tertiary)" }}>
              / ฿{budget.budgetTHB.toLocaleString()}
            </span>
          </div>
          {editBudget ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(Number(e.target.value))}
                className="text-sm rounded-lg px-3 py-1.5 w-28 text-right"
                style={{
                  background: "var(--surface-secondary)",
                  border: "0.5px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleSetBudget}
                className="text-xs px-3 py-1.5 rounded-md"
                style={{ background: "#6366f1", color: "#fff" }}
              >
                Save
              </button>
              <button
                onClick={() => setEditBudget(false)}
                className="text-xs px-2 py-1.5 rounded-md"
                style={{ color: "var(--text-tertiary)" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNewBudget(budget.budgetTHB);
                setEditBudget(true);
              }}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{ color: "var(--text-secondary)", border: "0.5px solid var(--border-default)" }}
            >
              Set budget
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div
          className="h-2 rounded-full overflow-hidden relative"
          style={{ background: "var(--surface-tertiary)" }}
        >
          {/* Threshold markers */}
          {[50, 75, 100].map((th) => (
            <div
              key={th}
              className="absolute top-0 h-full"
              style={{
                left: `${th}%`,
                width: 1,
                background: "var(--border-default)",
              }}
            />
          ))}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(costs.budgetPercent, 100)}%`,
              background: barColor,
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
          <span>0%</span>
          <span style={{ color: costs.budgetPercent >= 90 ? "#ef4444" : "var(--text-tertiary)" }}>
            {costs.budgetPercent}% used
          </span>
          <span>100%</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { l: "Total (USD)", v: `$${costs.totalUSD.toFixed(2)}`, c: "#818cf8" },
          { l: "Total (THB)", v: `฿${Math.round(costs.totalTHB).toLocaleString()}`, c: "#f59e0b" },
          {
            l: "Remaining",
            v: `฿${Math.max(0, Math.round(budget.budgetTHB - costs.totalTHB)).toLocaleString()}`,
            c: costs.budgetPercent >= 90 ? "#ef4444" : "#22c55e",
          },
          { l: "Agents tracked", v: String(costs.agents.length), c: "#38bdf8" },
        ].map((card) => (
          <div
            key={card.l}
            className="rounded-xl px-4 py-3"
            style={{
              background: "var(--surface-primary)",
              border: "0.5px solid var(--border-default)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 3,
                height: "100%",
                background: card.c,
              }}
            />
            <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              {card.l}
            </p>
            <p className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
              {card.v}
            </p>
          </div>
        ))}
      </div>

      {/* Per-agent breakdown */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{
          background: "var(--surface-primary)",
          border: "0.5px solid var(--border-default)",
        }}
      >
        {costs.agents.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
            No usage data yet — chat with agents to start tracking
          </p>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                {["Agent", "Model", "Input tokens", "Output tokens", "Cost (USD)", "Cost (THB)", "%"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-xs font-medium"
                      style={{
                        color: "var(--text-tertiary)",
                        textAlign: ["Agent", "Model"].includes(h) ? "left" : "right",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {costs.agents.map((agent: any) => {
                const pct =
                  costs.totalUSD > 0
                    ? Math.round((agent.costUSD / costs.totalUSD) * 100)
                    : 0;
                return (
                  <tr
                    key={agent.agentId}
                    style={{ borderBottom: "0.5px solid var(--border-default)" }}
                  >
                    <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                      {agent.agentName || agent.agentId}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{
                          background: "rgba(99,102,241,0.08)",
                          color: "#818cf8",
                        }}
                      >
                        {agent.modelLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {agent.tokensIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {agent.tokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right" style={{ color: "var(--text-primary)" }}>
                      ${agent.costUSD.toFixed(4)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium" style={{ color: "#f59e0b" }}>
                      ฿{Math.round(agent.costTHB).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Budget alerts history */}
      {budget.alertsSent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Budget alerts triggered
          </h3>
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
          >
            <div className="flex flex-wrap gap-2">
              {budget.alertsSent.sort((a: number, b: number) => a - b).map((th: number) => (
                <span
                  key={th}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{
                    background:
                      th >= 100
                        ? "rgba(239,68,68,0.1)"
                        : th >= 90
                        ? "rgba(245,158,11,0.1)"
                        : "rgba(56,189,248,0.1)",
                    color: th >= 100 ? "#ef4444" : th >= 90 ? "#f59e0b" : "#38bdf8",
                  }}
                >
                  {th}% reached
                </span>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
              Alerts sent via configured notification channels (Discord/LINE/webhook)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
