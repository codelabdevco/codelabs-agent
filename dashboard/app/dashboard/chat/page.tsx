"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  timestamp: number;
  model?: string;
  tokens?: { input: number; output: number };
  latencyMs?: number;
  offline?: boolean;
}

interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLE_EMOJI: Record<string, string> = {
  sales: "💼",
  support: "🎧",
  docs: "📄",
  devops: "⚙️",
  finance: "💰",
  hr: "👥",
};

const ROLE_COLORS: Record<string, string> = {
  sales: "#6366f1",
  support: "#0ea5e9",
  docs: "#8b5cf6",
  devops: "#f59e0b",
  finance: "#10b981",
  hr: "#ec4899",
};

const STORAGE_KEY = "fleet-chat-conversations";
const THB_PER_USD = 35;

// Pricing per 1M tokens (Claude 3.5 Sonnet approximate)
const PRICE_INPUT = 3.0;
const PRICE_OUTPUT = 15.0;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

function calcCost(tokens: { input: number; output: number }) {
  const usd = (tokens.input / 1_000_000) * PRICE_INPUT + (tokens.output / 1_000_000) * PRICE_OUTPUT;
  return { usd, thb: usd * THB_PER_USD };
}

// ---------------------------------------------------------------------------
// Simple Markdown Renderer (no external deps needed at runtime)
// ---------------------------------------------------------------------------
function renderMarkdown(text: string) {
  // Split into code blocks and regular text
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, i) => {
    // Code block
    const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
    if (codeMatch) {
      const lang = codeMatch[1] || "text";
      const code = codeMatch[2].trimEnd();
      return (
        <div key={i} className="my-3 rounded-lg overflow-hidden" style={{ border: "0.5px solid var(--border-default)" }}>
          <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "var(--surface-tertiary)" }}>
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{lang}</span>
            <button
              onClick={() => navigator.clipboard.writeText(code)}
              className="text-xs px-2 py-0.5 rounded hover:opacity-80"
              style={{ color: "var(--text-tertiary)" }}
            >
              Copy
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-xs leading-relaxed" style={{ background: "var(--surface-secondary)", margin: 0 }}>
            <code className="font-mono" style={{ color: "var(--text-primary)" }}>{code}</code>
          </pre>
        </div>
      );
    }

    // Inline code
    const inlined = part.split(/(`[^`]+`)/g).map((seg, j) => {
      if (seg.startsWith("`") && seg.endsWith("`")) {
        return (
          <code
            key={j}
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: "var(--surface-tertiary)", color: "#e879f9" }}
          >
            {seg.slice(1, -1)}
          </code>
        );
      }

      // Bold
      let processed: (string | JSX.Element)[] = [seg];
      processed = processed.flatMap((s) => {
        if (typeof s !== "string") return [s];
        return s.split(/(\*\*[^*]+\*\*)/g).map((p, k) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={`b${k}`}>{p.slice(2, -2)}</strong>;
          }
          return p;
        });
      });

      // Italic
      processed = processed.flatMap((s) => {
        if (typeof s !== "string") return [s];
        return s.split(/(_[^_]+_)/g).map((p, k) => {
          if (p.startsWith("_") && p.endsWith("_") && p.length > 2) {
            return <em key={`i${k}`}>{p.slice(1, -1)}</em>;
          }
          return p;
        });
      });

      return <span key={j}>{processed}</span>;
    });

    // Split into paragraphs
    const lines = part.split("\n");
    return (
      <div key={i}>
        {lines.map((line, li) => {
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={li} className="flex gap-2 ml-2">
                <span style={{ color: "var(--text-tertiary)" }}>•</span>
                <span>{line.slice(2)}</span>
              </div>
            );
          }
          if (line.match(/^\d+\.\s/)) {
            const num = line.match(/^(\d+)\.\s(.*)/);
            return (
              <div key={li} className="flex gap-2 ml-2">
                <span style={{ color: "var(--text-tertiary)" }}>{num?.[1]}.</span>
                <span>{num?.[2]}</span>
              </div>
            );
          }
          if (line.trim() === "") return <div key={li} className="h-2" />;
          return <div key={li}>{line}</div>;
        })}
      </div>
    );
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ChatPage() {
  const { data: agentData } = useSWR("/api/chat", fetcher);
  const agents: Agent[] = agentData?.agents ?? [];

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("claw-1");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    if (loaded.length > 0) {
      setActiveConvoId(loaded[0].id);
      setSelectedAgent(loaded[0].agentId);
    }
  }, []);

  // Save conversations when they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeConvoId]);

  const activeConvo = conversations.find((c) => c.id === activeConvoId) || null;
  const currentAgent = agents.find((a) => a.id === selectedAgent);

  // Total tokens for active conversation
  const totalTokens = activeConvo?.messages.reduce(
    (acc, m) => ({
      input: acc.input + (m.tokens?.input || 0),
      output: acc.output + (m.tokens?.output || 0),
    }),
    { input: 0, output: 0 }
  ) || { input: 0, output: 0 };

  const cost = calcCost(totalTokens);

  function startNewConversation(agentId?: string) {
    const aid = agentId || selectedAgent;
    const agent = agents.find((a) => a.id === aid);
    const convo: Conversation = {
      id: generateId(),
      agentId: aid,
      title: `Chat with ${agent?.name || aid}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [convo, ...prev]);
    setActiveConvoId(convo.id);
    setSelectedAgent(aid);
    setShowHistory(false);
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      agentId: selectedAgent,
      timestamp: Date.now(),
    };

    // Create new conversation if none active
    let convoId = activeConvoId;
    if (!convoId) {
      const agent = agents.find((a) => a.id === selectedAgent);
      const newConvo: Conversation = {
        id: generateId(),
        agentId: selectedAgent,
        title: input.trim().slice(0, 50),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      convoId = newConvo.id;
      setConversations((prev) => [newConvo, ...prev]);
      setActiveConvoId(convoId);
    }

    // Add user message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convoId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              title: c.messages.length === 0 ? input.trim().slice(0, 50) : c.title,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    setInput("");
    setSending(true);

    // Auto-resize textarea back
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }

    try {
      const start = Date.now();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          message: input.trim(),
        }),
      });
      const data = await res.json();
      const latency = Date.now() - start;

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.response || data.error || "No response",
        agentId: selectedAgent,
        timestamp: Date.now(),
        model: data.model,
        tokens: data.tokens,
        latencyMs: data.latencyMs || latency,
        offline: data.offline,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId
            ? { ...c, messages: [...c.messages, assistantMessage], updatedAt: Date.now() }
            : c
        )
      );
    } catch (err: any) {
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `❌ **Error:** ${err.message}`,
        agentId: selectedAgent,
        timestamp: Date.now(),
        offline: true,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convoId
            ? { ...c, messages: [...c.messages, errorMessage], updatedAt: Date.now() }
            : c
        )
      );
    }

    setSending(false);
  }, [input, sending, selectedAgent, activeConvoId, agents]);

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConversations(updated);
      return updated;
    });
    if (activeConvoId === id) {
      setActiveConvoId(null);
    }
  }

  function clearAllConversations() {
    setConversations([]);
    setActiveConvoId(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // Auto-resize textarea
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "44px";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Agent conversations grouped
  const agentConvos = conversations.filter((c) => c.agentId === selectedAgent);

  return (
    <div className="flex h-[calc(100vh-48px)] -mx-6 -my-6">
      {/* Agent Sidebar */}
      <div
        className="w-64 flex-shrink-0 border-r flex flex-col"
        style={{ background: "var(--surface-primary)", borderColor: "var(--border-default)" }}
      >
        {/* Agent List */}
        <div className="p-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
            AGENTS
          </p>
          <div className="space-y-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent.id);
                  const latest = conversations.find((c) => c.agentId === agent.id);
                  setActiveConvoId(latest?.id || null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                style={{
                  background: selectedAgent === agent.id ? "rgba(99,102,241,0.08)" : "transparent",
                  color: selectedAgent === agent.id ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <span className="text-lg">{ROLE_EMOJI[agent.role] || "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{agent.name.replace(/^Claw \d+ — /, "")}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {agent.description.slice(0, 30)}
                  </p>
                </div>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ROLE_COLORS[agent.role] || "#666" }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
              HISTORY
            </p>
            <button
              onClick={() => startNewConversation()}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: "var(--accent)" }}
            >
              + New
            </button>
          </div>
          <div className="space-y-1">
            {agentConvos.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-tertiary)" }}>
                No conversations yet
              </p>
            )}
            {agentConvos.map((convo) => (
              <div
                key={convo.id}
                className="group flex items-center rounded-lg cursor-pointer"
                style={{
                  background: activeConvoId === convo.id ? "var(--surface-tertiary)" : "transparent",
                }}
              >
                <button
                  onClick={() => setActiveConvoId(convo.id)}
                  className="flex-1 text-left px-3 py-2 min-w-0"
                >
                  <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                    {convo.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {convo.messages.length} messages
                  </p>
                </button>
                <button
                  onClick={() => deleteConversation(convo.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 mr-1 rounded"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Clear All */}
        {conversations.length > 0 && (
          <div className="p-3 border-t" style={{ borderColor: "var(--border-default)" }}>
            <button
              onClick={clearAllConversations}
              className="w-full text-xs py-1.5 rounded-lg"
              style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}
            >
              Clear all history
            </button>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{ background: "var(--surface-primary)", borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{ROLE_EMOJI[currentAgent?.role || ""] || "🤖"}</span>
            <div>
              <h2 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {currentAgent?.name || "Select an agent"}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {currentAgent?.description || ""}
              </p>
            </div>
          </div>
          {activeConvo && (
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>
                {totalTokens.input + totalTokens.output > 0
                  ? `${(totalTokens.input + totalTokens.output).toLocaleString()} tokens`
                  : ""}
              </span>
              {cost.usd > 0 && (
                <span>
                  ${cost.usd.toFixed(4)} / ฿{cost.thb.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!activeConvo || activeConvo.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: "var(--text-tertiary)" }}>
              <span className="text-4xl mb-4">{ROLE_EMOJI[currentAgent?.role || ""] || "🤖"}</span>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Chat with {currentAgent?.name || "an agent"}
              </p>
              <p className="text-xs text-center max-w-xs">
                {currentAgent?.description || "Select an agent from the sidebar to start chatting"}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {activeConvo.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[80%] rounded-xl px-4 py-3"
                    style={{
                      background:
                        msg.role === "user"
                          ? "var(--accent)"
                          : "var(--surface-primary)",
                      color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                      border:
                        msg.role === "assistant"
                          ? "0.5px solid var(--border-default)"
                          : "none",
                    }}
                  >
                    <div className="text-sm leading-relaxed">
                      {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                    </div>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-3 mt-2 pt-2 text-xs" style={{ color: "var(--text-tertiary)", borderTop: "0.5px solid var(--border-default)" }}>
                        {msg.model && <span>{msg.model}</span>}
                        {msg.latencyMs ? <span>{msg.latencyMs}ms</span> : null}
                        {msg.tokens && msg.tokens.input + msg.tokens.output > 0 && (
                          <span>{(msg.tokens.input + msg.tokens.output).toLocaleString()} tok</span>
                        )}
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="hover:opacity-80"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)", color: "var(--text-tertiary)" }}
                  >
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className="px-5 py-3 border-t flex-shrink-0"
          style={{ background: "var(--surface-primary)", borderColor: "var(--border-default)" }}
        >
          <div
            className="flex items-end gap-3 max-w-3xl mx-auto rounded-xl px-4 py-2"
            style={{ background: "var(--surface-secondary)", border: "0.5px solid var(--border-default)" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentAgent?.name || "agent"}...`}
              rows={1}
              className="flex-1 text-sm resize-none bg-transparent outline-none"
              style={{ color: "var(--text-primary)", minHeight: "44px", maxHeight: "160px", lineHeight: "22px", paddingTop: "11px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mb-1"
              style={{
                background: input.trim() ? "var(--accent)" : "var(--surface-tertiary)",
                color: input.trim() ? "#fff" : "var(--text-tertiary)",
                transition: "all 0.15s",
              }}
            >
              ↑
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: "var(--text-tertiary)" }}>
            Shift+Enter for new line · Messages saved locally
          </p>
        </div>
      </div>
    </div>
  );
}
