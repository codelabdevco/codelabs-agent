"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { StatusDot } from "@/components/StatusDot";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4", color: "#818cf8" },
  { value: "claude-opus-4-20250514", label: "Opus 4", color: "#c084fc" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5", color: "#38bdf8" },
  { value: "gpt-4o", label: "GPT-4o", color: "#4ade80" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", color: "#86efac" },
];

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  time: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUSD?: number;
}

export default function ChatPage() {
  const { data: healthData } = useSWR("/api/health", fetcher, { refreshInterval: 15000 });
  const agents = healthData?.agents ?? [];

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-20250514");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedAgent]);

  const currentMessages = messages[selectedAgent] || [];
  const currentAgent = agents.find((a: any) => a.id === selectedAgent);

  // Total cost for current agent
  const agentCost = currentMessages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + (m.costUSD || 0), 0);

  async function handleSend() {
    if (!input.trim() || sending || !selectedAgent) return;
    const msg = input.trim();
    setInput("");

    const now = new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Add user message
    setMessages((prev) => ({
      ...prev,
      [selectedAgent]: [
        ...(prev[selectedAgent] || []),
        { role: "user", text: msg, time: now },
      ],
    }));

    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          message: msg,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      const replyTime = new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      if (res.ok) {
        setMessages((prev) => ({
          ...prev,
          [selectedAgent]: [
            ...(prev[selectedAgent] || []),
            {
              role: "assistant",
              text: data.response,
              time: replyTime,
              model: data.model,
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
              costUSD: data.costUSD,
            },
          ],
        }));
      } else {
        setMessages((prev) => ({
          ...prev,
          [selectedAgent]: [
            ...(prev[selectedAgent] || []),
            {
              role: "assistant",
              text: `Error: ${data.error || "Failed to reach agent"}`,
              time: replyTime,
            },
          ],
        }));
      }
    } catch (err: any) {
      setMessages((prev) => ({
        ...prev,
        [selectedAgent]: [
          ...(prev[selectedAgent] || []),
          {
            role: "assistant",
            text: `Network error: ${err.message}`,
            time: new Date().toLocaleTimeString("th-TH"),
          },
        ],
      }));
    }
    setSending(false);
  }

  const modelInfo = MODELS.find((m) => m.value === selectedModel);

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 130px)" }}>
      {/* Agent sidebar */}
      <div
        className="flex-shrink-0 overflow-y-auto pr-3"
        style={{
          width: 200,
          borderRight: "0.5px solid var(--border-default)",
        }}
      >
        <p
          className="text-xs px-2 mb-2"
          style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          Select agent
        </p>
        {agents.map((agent: any) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-left mb-0.5 transition-all"
            style={{
              background:
                selectedAgent === agent.id
                  ? "rgba(99,102,241,0.08)"
                  : "transparent",
            }}
          >
            <StatusDot status={agent.status} size="sm" />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs truncate"
                style={{
                  color:
                    selectedAgent === agent.id
                      ? "var(--accent, #818cf8)"
                      : "var(--text-secondary)",
                  fontWeight: selectedAgent === agent.id ? 500 : 400,
                }}
              >
                {agent.name}
              </p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {agent.type}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col pl-4">
        {/* Header */}
        <div
          className="flex items-center justify-between pb-3 mb-3 flex-shrink-0"
          style={{ borderBottom: "0.5px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            {currentAgent && (
              <StatusDot status={currentAgent.status} size="sm" />
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {currentAgent?.name || "Select an agent"}
              </p>
              {agentCost > 0 && (
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Session cost: ${agentCost.toFixed(4)} (฿{Math.round(agentCost * 34.5).toLocaleString()})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: `${modelInfo?.color || "#818cf8"}15`,
                color: modelInfo?.color || "#818cf8",
              }}
            >
              {modelInfo?.label || selectedModel}
            </span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs rounded-lg px-2 py-1"
              style={{
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                border: "0.5px solid var(--border-default)",
              }}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pr-2">
          {currentMessages.length === 0 && (
            <div className="text-center pt-20">
              <p className="text-2xl mb-2" style={{ opacity: 0.2 }}>
                ◆
              </p>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                ส่งข้อความถึง {currentAgent?.name || "agent"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                พิมพ์คำสั่งหรือคำถาม แล้วกด Enter
              </p>
            </div>
          )}
          {currentMessages.map((msg, i) => (
            <div
              key={i}
              className="flex mb-3"
              style={{
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                className="max-w-[75%] rounded-xl px-3.5 py-2.5"
                style={{
                  background:
                    msg.role === "user"
                      ? "rgba(99,102,241,0.1)"
                      : "var(--surface-secondary)",
                  border: `0.5px solid ${
                    msg.role === "user"
                      ? "rgba(99,102,241,0.2)"
                      : "var(--border-default)"
                  }`,
                  borderRadius:
                    msg.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                }}
              >
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--text-primary)" }}
                >
                  {msg.text}
                </p>
                <div
                  className="flex items-center gap-2 mt-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span className="text-xs">{msg.time}</span>
                  {msg.role === "assistant" && msg.model && (
                    <>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: `${
                            MODELS.find((m) => m.value === msg.model)?.color ||
                            "#818cf8"
                          }15`,
                          color:
                            MODELS.find((m) => m.value === msg.model)?.color ||
                            "#818cf8",
                          fontSize: 10,
                        }}
                      >
                        {MODELS.find((m) => m.value === msg.model)?.label ||
                          msg.model}
                      </span>
                      <span className="text-xs">
                        {msg.inputTokens}+{msg.outputTokens} tok
                      </span>
                      <span className="text-xs" style={{ color: "#f59e0b" }}>
                        ${msg.costUSD?.toFixed(4)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex mb-3">
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: "var(--surface-secondary)",
                  border: "0.5px solid var(--border-default)",
                  borderRadius: "14px 14px 14px 4px",
                }}
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "#818cf8",
                        animation: `pulse 1.2s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div
          className="flex gap-2 pt-3 flex-shrink-0"
          style={{ borderTop: "0.5px solid var(--border-default)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`ส่งข้อความถึง ${currentAgent?.name || "agent"}...`}
            disabled={!selectedAgent || sending}
            className="flex-1 text-sm rounded-xl px-4 py-2.5"
            style={{
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              border: "0.5px solid var(--border-default)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || !selectedAgent}
            className="text-sm px-5 py-2.5 rounded-xl font-medium transition-all"
            style={{
              background: input.trim() ? "#6366f1" : "var(--surface-secondary)",
              color: input.trim() ? "#fff" : "var(--text-tertiary)",
              opacity: input.trim() ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
