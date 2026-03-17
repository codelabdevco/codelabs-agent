"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import { StatusDot } from "@/components/StatusDot";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Send,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  MessageSquare,
  Zap,
  Clock,
  DollarSign,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ── Model definitions ───────────────────────────────── */
const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4", color: "#818cf8", icon: "✦" },
  { value: "claude-opus-4-20250514", label: "Opus 4", color: "#c084fc", icon: "✦" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5", color: "#38bdf8", icon: "✦" },
  { value: "gpt-4o", label: "GPT-4o", color: "#4ade80", icon: "◈" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", color: "#86efac", icon: "◈" },
];

/* ── Agent role icons & colors ───────────────────────── */
const AGENT_THEMES: Record<string, { icon: string; gradient: string }> = {
  sales: { icon: "💼", gradient: "from-amber-500/20 to-orange-500/20" },
  support: { icon: "🎧", gradient: "from-blue-500/20 to-cyan-500/20" },
  docs: { icon: "📄", gradient: "from-emerald-500/20 to-green-500/20" },
  devops: { icon: "⚙️", gradient: "from-purple-500/20 to-violet-500/20" },
  finance: { icon: "📊", gradient: "from-yellow-500/20 to-amber-500/20" },
  hr: { icon: "👥", gradient: "from-pink-500/20 to-rose-500/20" },
  default: { icon: "🤖", gradient: "from-indigo-500/20 to-blue-500/20" },
};

function getAgentTheme(type?: string) {
  if (!type) return AGENT_THEMES.default;
  const key = type.toLowerCase();
  return AGENT_THEMES[key] || AGENT_THEMES.default;
}

/* ── Simple Markdown Renderer ────────────────────────── */
function MarkdownContent({ text }: { text: string }) {
  const parts = useMemo(() => parseMarkdown(text), [text]);
  return <div className="markdown-content">{parts}</div>;
}

function parseMarkdown(text: string) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (```)
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <CodeBlock key={key++} code={codeLines.join("\n")} language={lang} />
      );
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={key++} className="text-sm font-semibold mt-3 mb-1" style={{ color: "var(--text-primary)" }}>
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="text-sm font-semibold mt-3 mb-1" style={{ color: "var(--text-primary)" }}>
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key++} className="text-base font-semibold mt-3 mb-1" style={{ color: "var(--text-primary)" }}>
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        listItems.push(
          <li key={key++} className="ml-4 text-sm leading-relaxed list-disc" style={{ color: "var(--text-primary)" }}>
            {renderInline(lines[i].replace(/^[\s]*[-*]\s/, ""))}
          </li>
        );
        i++;
      }
      blocks.push(<ul key={key++} className="my-1.5 space-y-0.5">{listItems}</ul>);
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        listItems.push(
          <li key={key++} className="ml-4 text-sm leading-relaxed list-decimal" style={{ color: "var(--text-primary)" }}>
            {renderInline(lines[i].replace(/^[\s]*\d+\.\s/, ""))}
          </li>
        );
        i++;
      }
      blocks.push(<ol key={key++} className="my-1.5 space-y-0.5">{listItems}</ol>);
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 pl-3 my-2 text-sm italic"
          style={{ borderColor: "var(--accent)", color: "var(--text-secondary)" }}
        >
          {renderInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-3 border-t" style={{ borderColor: "var(--border-default)" }} />);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Normal paragraph
    blocks.push(
      <p key={key++} className="text-sm leading-relaxed my-1" style={{ color: "var(--text-primary)" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode {
  // Process inline code, bold, italic, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    // Inline code
    let match = remaining.match(/^(.*?)`([^`]+)`([\s\S]*)$/);
    if (match) {
      if (match[1]) parts.push(renderPlainInline(match[1], k++));
      parts.push(
        <code
          key={k++}
          className="text-xs px-1.5 py-0.5 rounded-md font-mono"
          style={{
            background: "var(--surface-tertiary)",
            color: "var(--accent)",
          }}
        >
          {match[2]}
        </code>
      );
      remaining = match[3];
      continue;
    }

    // Bold
    match = remaining.match(/^(.*?)\*\*(.+?)\*\*([\s\S]*)$/);
    if (match) {
      if (match[1]) parts.push(renderPlainInline(match[1], k++));
      parts.push(<strong key={k++}>{match[2]}</strong>);
      remaining = match[3];
      continue;
    }

    // Italic
    match = remaining.match(/^(.*?)\*(.+?)\*([\s\S]*)$/);
    if (match) {
      if (match[1]) parts.push(renderPlainInline(match[1], k++));
      parts.push(<em key={k++}>{match[2]}</em>);
      remaining = match[3];
      continue;
    }

    // Link
    match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)$/);
    if (match) {
      if (match[1]) parts.push(renderPlainInline(match[1], k++));
      parts.push(
        <a key={k++} href={match[3]} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
          {match[2]}
        </a>
      );
      remaining = match[4];
      continue;
    }

    // No more patterns
    parts.push(renderPlainInline(remaining, k++));
    break;
  }

  return <>{parts}</>;
}

function renderPlainInline(text: string, key: number) {
  return <span key={key}>{text}</span>;
}

/* ── Code Block with Copy ────────────────────────────── */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: "var(--surface-tertiary)" }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all hover:opacity-80"
          style={{ color: "var(--text-tertiary)" }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Code */}
      <pre
        className="px-4 py-3 overflow-x-auto text-xs leading-relaxed font-mono"
        style={{ background: "var(--surface-secondary)", color: "var(--text-primary)" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ── Message Action Buttons ──────────────────────────── */
function MessageActions({
  text,
  onRegenerate,
  showRegenerate,
}: {
  text: string;
  onRegenerate?: () => void;
  showRegenerate: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg transition-all hover:scale-105"
        style={{ color: copied ? "var(--status-online)" : "var(--text-tertiary)" }}
        title="Copy message"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      {showRegenerate && onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1.5 rounded-lg transition-all hover:scale-105"
          style={{ color: "var(--text-tertiary)" }}
          title="Regenerate"
        >
          <RefreshCw size={14} />
        </button>
      )}
      <button
        onClick={() => setLiked(liked === "up" ? null : "up")}
        className="p-1.5 rounded-lg transition-all hover:scale-105"
        style={{ color: liked === "up" ? "var(--status-online)" : "var(--text-tertiary)" }}
        title="Good response"
      >
        <ThumbsUp size={14} fill={liked === "up" ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => setLiked(liked === "down" ? null : "down")}
        className="p-1.5 rounded-lg transition-all hover:scale-105"
        style={{ color: liked === "down" ? "var(--status-offline)" : "var(--text-tertiary)" }}
        title="Bad response"
      >
        <ThumbsDown size={14} fill={liked === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/* ── Chat Message Interface ──────────────────────────── */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUSD?: number;
}

/* ── Auto-resize Textarea ────────────────────────────── */
function AutoResizeTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="flex-1 text-sm rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
      style={{
        background: "var(--surface-primary)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-default)",
        maxHeight: 160,
        lineHeight: "1.5",
      }}
    />
  );
}

/* ── Model Selector Dropdown ─────────────────────────── */
function ModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
        style={{
          background: `${current?.color || "#818cf8"}12`,
          color: current?.color || "#818cf8",
          border: `1px solid ${current?.color || "#818cf8"}25`,
        }}
      >
        <Sparkles size={12} />
        {current?.label || value}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl min-w-[200px]"
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          {MODELS.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-all hover:opacity-80"
              style={{
                background: m.value === value ? `${m.color}10` : "transparent",
                color: "var(--text-primary)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: m.color }}
              />
              <span className="flex-1">{m.label}</span>
              {m.value === value && (
                <Check size={14} style={{ color: m.color }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Chat Page ──────────────────────────────────── */
export default function ChatPage() {
  const { data: healthData } = useSWR("/api/health", fetcher, {
    refreshInterval: 15000,
  });
  const agents = healthData?.agents ?? [];

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-20250514");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-select first agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgent]);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, selectedAgent, sending]);

  const currentMessages = messages[selectedAgent] || [];
  const currentAgent = agents.find((a: any) => a.id === selectedAgent);
  const agentTheme = getAgentTheme(currentAgent?.type);

  // Total cost for current agent
  const agentCost = currentMessages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + (m.costUSD || 0), 0);

  const totalTokens = currentMessages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + (m.inputTokens || 0) + (m.outputTokens || 0), 0);

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !selectedAgent) return;
    const msg = input.trim();
    setInput("");

    const now = new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: msg,
      time: now,
    };

    setMessages((prev) => ({
      ...prev,
      [selectedAgent]: [...(prev[selectedAgent] || []), userMsg],
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
      });

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        text: res.ok
          ? data.response
          : `Error: ${data.error || "Failed to reach agent"}`,
        time: replyTime,
        model: res.ok ? data.model : undefined,
        inputTokens: res.ok ? data.inputTokens : undefined,
        outputTokens: res.ok ? data.outputTokens : undefined,
        costUSD: res.ok ? data.costUSD : undefined,
      };

      setMessages((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), assistantMsg],
      }));
    } catch (err: any) {
      setMessages((prev) => ({
        ...prev,
        [selectedAgent]: [
          ...(prev[selectedAgent] || []),
          {
            id: generateId(),
            role: "assistant",
            text: `Network error: ${err.message}`,
            time: new Date().toLocaleTimeString("th-TH"),
          },
        ],
      }));
    }
    setSending(false);
  }, [input, sending, selectedAgent, selectedModel]);

  const handleRegenerate = useCallback(
    async (msgIndex: number) => {
      if (sending || !selectedAgent) return;
      // Find the last user message before this assistant message
      const agentMsgs = messages[selectedAgent] || [];
      let userMsg = "";
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (agentMsgs[i].role === "user") {
          userMsg = agentMsgs[i].text;
          break;
        }
      }
      if (!userMsg) return;

      // Remove the old assistant message
      setMessages((prev) => ({
        ...prev,
        [selectedAgent]: prev[selectedAgent].filter((_, i) => i !== msgIndex),
      }));

      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: selectedAgent,
            message: userMsg,
            model: selectedModel,
          }),
        });

        const data = await res.json();
        const replyTime = new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        setMessages((prev) => ({
          ...prev,
          [selectedAgent]: [
            ...(prev[selectedAgent] || []),
            {
              id: generateId(),
              role: "assistant",
              text: res.ok ? data.response : `Error: ${data.error}`,
              time: replyTime,
              model: data.model,
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
              costUSD: data.costUSD,
            },
          ],
        }));
      } catch (err: any) {
        setMessages((prev) => ({
          ...prev,
          [selectedAgent]: [
            ...(prev[selectedAgent] || []),
            {
              id: generateId(),
              role: "assistant",
              text: `Network error: ${err.message}`,
              time: new Date().toLocaleTimeString("th-TH"),
            },
          ],
        }));
      }
      setSending(false);
    },
    [sending, selectedAgent, selectedModel, messages]
  );

  return (
    <div className="flex gap-0" style={{ height: "calc(100vh - 130px)" }}>
      {/* ── Agent Sidebar ──────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{
          width: 240,
          borderRight: "1px solid var(--border-default)",
        }}
      >
        {/* Sidebar header */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.1)" }}
            >
              <MessageSquare size={14} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Chat
              </p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {agents.filter((a: any) => a.status === "online").length} agents online
              </p>
            </div>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {agents.map((agent: any) => {
            const theme = getAgentTheme(agent.type);
            const isActive = selectedAgent === agent.id;
            const agentMsgCount = (messages[agent.id] || []).length;

            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all group"
                style={{
                  background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                }}
              >
                {/* Agent avatar */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    background: isActive
                      ? "rgba(99,102,241,0.15)"
                      : "var(--surface-tertiary)",
                  }}
                >
                  {theme.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-sm truncate"
                      style={{
                        color: isActive ? "var(--accent)" : "var(--text-primary)",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {agent.name}
                    </p>
                    <StatusDot status={agent.status} size="sm" />
                  </div>
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {agent.type}
                    {agentMsgCount > 0 && (
                      <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                        {" "}· {agentMsgCount} msgs
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}

          {agents.length === 0 && (
            <div className="text-center py-8">
              <Bot size={24} className="mx-auto mb-2" style={{ color: "var(--text-tertiary)", opacity: 0.5 }} />
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                No agents available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat Area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-default)", background: "var(--surface-primary)" }}
        >
          <div className="flex items-center gap-3">
            {currentAgent && (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "rgba(99,102,241,0.1)" }}
              >
                {agentTheme.icon}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {currentAgent?.name || "Select an agent"}
                </p>
                {currentAgent && <StatusDot status={currentAgent.status} size="sm" />}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {currentAgent && (
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {currentAgent.type}
                  </span>
                )}
                {totalTokens > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <Zap size={10} />
                    {totalTokens.toLocaleString()} tokens
                  </span>
                )}
                {agentCost > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "#f59e0b" }}>
                    <DollarSign size={10} />
                    ${agentCost.toFixed(4)} (฿{Math.round(agentCost * 34.5).toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          </div>

          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
        </div>

        {/* Messages area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ background: "var(--surface-secondary)" }}
        >
          {/* Empty state */}
          {currentMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(99,102,241,0.08)" }}
              >
                <span className="text-3xl">{agentTheme.icon}</span>
              </div>
              <p className="text-base font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                {currentAgent?.name || "Agent Chat"}
              </p>
              <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
                ส่งข้อความเพื่อเริ่มสนทนา
              </p>
              <div className="flex flex-wrap gap-2 max-w-md justify-center">
                {[
                  "สถานะระบบเป็นอย่างไร?",
                  "สรุปงานวันนี้",
                  "ช่วยตรวจสอบ logs",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    className="text-xs px-3 py-2 rounded-xl transition-all hover:scale-[1.02]"
                    style={{
                      background: "var(--surface-primary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="max-w-3xl mx-auto space-y-1">
            {currentMessages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isLastAssistant =
                msg.role === "assistant" &&
                i === currentMessages.length - 1;
              const modelInfo = MODELS.find((m) => m.value === msg.model);

              return (
                <div
                  key={msg.id}
                  className={`group flex gap-3 py-3 rounded-2xl transition-colors ${
                    isUser ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 pt-0.5">
                    {isUser ? (
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.15)" }}
                      >
                        <User size={16} style={{ color: "var(--accent)" }} />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: "var(--surface-tertiary)" }}
                      >
                        <span className="text-sm">{agentTheme.icon}</span>
                      </div>
                    )}
                  </div>

                  {/* Message content */}
                  <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
                    {/* Name + time header */}
                    <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        {isUser ? "You" : currentAgent?.name || "Agent"}
                      </span>
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
                        <Clock size={10} />
                        {msg.time}
                      </span>
                      {!isUser && modelInfo && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{
                            background: `${modelInfo.color}15`,
                            color: modelInfo.color,
                            fontSize: 10,
                          }}
                        >
                          {modelInfo.label}
                        </span>
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`inline-block rounded-2xl px-4 py-3 ${
                        isUser ? "max-w-[85%]" : "max-w-full"
                      }`}
                      style={{
                        background: isUser
                          ? "rgba(99,102,241,0.1)"
                          : "var(--surface-primary)",
                        border: `1px solid ${
                          isUser
                            ? "rgba(99,102,241,0.2)"
                            : "var(--border-default)"
                        }`,
                        borderRadius: isUser
                          ? "20px 20px 6px 20px"
                          : "20px 20px 20px 6px",
                      }}
                    >
                      {isUser ? (
                        <p
                          className="text-sm leading-relaxed whitespace-pre-wrap"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {msg.text}
                        </p>
                      ) : (
                        <MarkdownContent text={msg.text} />
                      )}

                      {/* Token info for assistant */}
                      {!isUser && msg.inputTokens != null && (
                        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                          <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
                            <Zap size={10} />
                            {msg.inputTokens}+{msg.outputTokens} tokens
                          </span>
                          {msg.costUSD != null && (
                            <span className="text-xs" style={{ color: "#f59e0b" }}>
                              ${msg.costUSD.toFixed(4)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons (only for assistant) */}
                    {!isUser && (
                      <MessageActions
                        text={msg.text}
                        onRegenerate={() => handleRegenerate(i)}
                        showRegenerate={isLastAssistant}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-3 py-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--surface-tertiary)" }}
                >
                  <span className="text-sm">{agentTheme.icon}</span>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                    {currentAgent?.name || "Agent"}
                  </span>
                  <div
                    className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-3"
                    style={{
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "20px 20px 20px 6px",
                    }}
                  >
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                    <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                    <span className="text-xs ml-2" style={{ color: "var(--text-tertiary)" }}>
                      กำลังคิด...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 px-5 py-3"
          style={{
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-primary)",
          }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <AutoResizeTextarea
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                placeholder={`ส่งข้อความถึง ${currentAgent?.name || "agent"}... (Shift+Enter ขึ้นบรรทัดใหม่)`}
                disabled={!selectedAgent || sending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !selectedAgent}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-105 flex-shrink-0"
                style={{
                  background: input.trim() ? "#6366f1" : "var(--surface-tertiary)",
                  color: input.trim() ? "#fff" : "var(--text-tertiary)",
                  opacity: input.trim() ? 1 : 0.5,
                  cursor: input.trim() ? "pointer" : "default",
                }}
              >
                <Send size={18} className={input.trim() ? "" : ""} />
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
              Agent Fleet Chat · Powered by OpenClaw
            </p>
          </div>
        </div>
      </div>

      {/* ── Styles ─────────────────────────────────── */}
      <style>{`
        .typing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-muted, #818cf8);
          animation: typing-bounce 1.2s ease-in-out infinite;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        .markdown-content p + p { margin-top: 0.5rem; }
        .markdown-content pre { margin: 0; }
        .markdown-content code { font-family: 'JetBrains Mono', monospace; }

        /* Smooth scroll for chat */
        .overflow-y-auto { scroll-behavior: smooth; }

        /* Hover effect on messages */
        .group:hover { background: rgba(99,102,241,0.02); }
      `}</style>
    </div>
  );
}
