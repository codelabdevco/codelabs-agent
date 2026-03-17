"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ── Types ─────────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
}

interface ChatMessage {
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
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/* ── Constants ─────────────────────────────────────────── */
const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4", color: "#818cf8" },
  { value: "claude-opus-4-20250514", label: "Opus 4", color: "#c084fc" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5", color: "#38bdf8" },
  { value: "gpt-4o", label: "GPT-4o", color: "#4ade80" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", color: "#86efac" },
];

const AGENT_THEMES: Record<string, { icon: string; color: string }> = {
  sales: { icon: "💼", color: "#f59e0b" },
  support: { icon: "🎧", color: "#0ea5e9" },
  docs: { icon: "📄", color: "#8b5cf6" },
  devops: { icon: "⚙️", color: "#6366f1" },
  finance: { icon: "📊", color: "#10b981" },
  hr: { icon: "👥", color: "#ec4899" },
};

const STORAGE_KEY = "fleet-chat-v2";
const THB_RATE = 35;

const SUGGESTIONS = [
  "สถานะระบบตอนนี้เป็นอย่างไร?",
  "สรุปงานวันนี้ให้หน่อย",
  "ช่วยตรวจสอบ error logs",
  "วิเคราะห์ performance ล่าสุด",
];

/* ── Helpers ───────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getTheme(role?: string) {
  return AGENT_THEMES[role || ""] || { icon: "🤖", color: "#6366f1" };
}
function shortName(name: string) {
  return name.replace(/^Claw \d+ — /, "");
}
function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function calcCost(inp: number, out: number) {
  const usd = (inp / 1e6) * 3 + (out / 1e6) * 15;
  return { usd, thb: usd * THB_RATE };
}

/* ── localStorage persistence ──────────────────────────── */
function loadConvos(): Conversation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveConvos(c: Conversation[]) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

/* ── Markdown Renderer ─────────────────────────────────── */
function MarkdownBlock({ text }: { text: string }) {
  const nodes = useMemo(() => parseMarkdown(text), [text]);
  return <div className="md-content">{nodes}</div>;
}

function parseMarkdown(text: string) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0, k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { code.push(lines[i]); i++; }
      i++;
      blocks.push(<CodeBlock key={k++} code={code.join("\n")} lang={lang} />);
      continue;
    }
    // Headings
    if (line.startsWith("### ")) { blocks.push(<h4 key={k++} className="text-sm font-semibold mt-3 mb-1">{inlineRender(line.slice(4))}</h4>); i++; continue; }
    if (line.startsWith("## ")) { blocks.push(<h3 key={k++} className="text-sm font-semibold mt-3 mb-1">{inlineRender(line.slice(3))}</h3>); i++; continue; }
    if (line.startsWith("# ")) { blocks.push(<h2 key={k++} className="text-base font-semibold mt-3 mb-1">{inlineRender(line.slice(2))}</h2>); i++; continue; }
    // Blockquote
    if (line.startsWith("> ")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { q.push(lines[i].slice(2)); i++; }
      blocks.push(<blockquote key={k++} className="border-l-2 pl-3 my-2 text-sm italic" style={{ borderColor: "var(--accent)", color: "var(--text-secondary)" }}>{inlineRender(q.join(" "))}</blockquote>);
      continue;
    }
    // Unordered list
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(<li key={k++} className="ml-4 list-disc">{inlineRender(lines[i].replace(/^[\s]*[-*]\s/, ""))}</li>);
        i++;
      }
      blocks.push(<ul key={k++} className="my-1.5 space-y-0.5 text-sm leading-relaxed">{items}</ul>);
      continue;
    }
    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        items.push(<li key={k++} className="ml-4 list-decimal">{inlineRender(lines[i].replace(/^[\s]*\d+\.\s/, ""))}</li>);
        i++;
      }
      blocks.push(<ol key={k++} className="my-1.5 space-y-0.5 text-sm leading-relaxed">{items}</ol>);
      continue;
    }
    // HR
    if (/^[-*_]{3,}$/.test(line.trim())) { blocks.push(<hr key={k++} className="my-3" style={{ borderColor: "var(--border-default)" }} />); i++; continue; }
    // Empty line
    if (line.trim() === "") { i++; continue; }
    // Paragraph
    blocks.push(<p key={k++} className="text-sm leading-relaxed my-1">{inlineRender(line)}</p>);
    i++;
  }
  return <>{blocks}</>;
}

function inlineRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = text, n = 0;
  while (rest.length > 0) {
    let m: RegExpMatchArray | null;
    // Inline code
    if ((m = rest.match(/^(.*?)`([^`]+)`([\s\S]*)$/))) {
      if (m[1]) parts.push(<span key={n++}>{m[1]}</span>);
      parts.push(<code key={n++} className="text-xs px-1.5 py-0.5 rounded-md font-mono" style={{ background: "var(--surface-tertiary)", color: "var(--accent)" }}>{m[2]}</code>);
      rest = m[3]; continue;
    }
    // Bold
    if ((m = rest.match(/^(.*?)\*\*(.+?)\*\*([\s\S]*)$/))) {
      if (m[1]) parts.push(<span key={n++}>{m[1]}</span>);
      parts.push(<strong key={n++}>{m[2]}</strong>);
      rest = m[3]; continue;
    }
    // Italic
    if ((m = rest.match(/^(.*?)(?<!\*)\*([^*]+)\*(?!\*)([\s\S]*)$/))) {
      if (m[1]) parts.push(<span key={n++}>{m[1]}</span>);
      parts.push(<em key={n++}>{m[2]}</em>);
      rest = m[3]; continue;
    }
    // Link
    if ((m = rest.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)$/))) {
      if (m[1]) parts.push(<span key={n++}>{m[1]}</span>);
      parts.push(<a key={n++} href={m[3]} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>{m[2]}</a>);
      rest = m[4]; continue;
    }
    parts.push(<span key={n++}>{rest}</span>);
    break;
  }
  return <>{parts}</>;
}

/* ── Code Block ────────────────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="my-2.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-default)" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "var(--surface-tertiary)" }}>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>{lang || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-all" style={{ color: copied ? "var(--status-online)" : "var(--text-tertiary)" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-xs leading-relaxed font-mono" style={{ background: "var(--surface-secondary)", color: "var(--text-primary)", margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ── Message Actions ───────────────────────────────────── */
function MsgActions({ text, onRegenerate, isLast }: { text: string; onRegenerate?: () => void; isLast: boolean }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button onClick={copy} className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: copied ? "var(--status-online)" : "var(--text-tertiary)" }} title="Copy">
        {copied ? "✓" : "⎘"}
      </button>
      {isLast && onRegenerate && (
        <button onClick={onRegenerate} className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: "var(--text-tertiary)" }} title="Regenerate">↻</button>
      )}
      <button onClick={() => setLiked(liked === "up" ? null : "up")} className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: liked === "up" ? "var(--status-online)" : "var(--text-tertiary)" }} title="Good">
        {liked === "up" ? "▲" : "△"}
      </button>
      <button onClick={() => setLiked(liked === "down" ? null : "down")} className="p-1.5 rounded-lg transition-all hover:scale-110" style={{ color: liked === "down" ? "var(--status-offline)" : "var(--text-tertiary)" }} title="Bad">
        {liked === "down" ? "▼" : "▽"}
      </button>
    </div>
  );
}

/* ── Model Selector ────────────────────────────────────── */
function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = MODELS.find((m) => m.value === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
        style={{ background: `${cur?.color || "#818cf8"}12`, color: cur?.color || "#818cf8", border: `1px solid ${cur?.color || "#818cf8"}25` }}>
        <span className="font-medium">✦ {cur?.label || value}</span>
        <span className={`transition-transform text-[10px] ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl min-w-[200px]"
          style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)" }}>
          {MODELS.map((m) => (
            <button key={m.value} onClick={() => { onChange(m.value); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-all hover:opacity-80"
              style={{ background: m.value === value ? `${m.color}10` : "transparent", color: "var(--text-primary)" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className="flex-1">{m.label}</span>
              {m.value === value && <span style={{ color: m.color }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ██  MAIN CHAT PAGE
   ════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const { data: agentData } = useSWR("/api/chat", fetcher);
  const agents: Agent[] = agentData?.agents ?? [];

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("claw-1");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-20250514");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"agents" | "history">("agents");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage
  useEffect(() => {
    const loaded = loadConvos();
    setConvos(loaded);
    if (loaded.length > 0) { setActiveId(loaded[0].id); setSelectedAgent(loaded[0].agentId); }
  }, []);

  // Save on change
  useEffect(() => { if (convos.length > 0) saveConvos(convos); }, [convos]);

  // Auto-scroll
  useEffect(() => { chatBoxRef.current && (chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight); }, [convos, activeId, sending]);

  const activeConvo = convos.find((c) => c.id === activeId) || null;
  const currentAgent = agents.find((a) => a.id === selectedAgent);
  const theme = getTheme(currentAgent?.role);
  const agentConvos = convos.filter((c) => c.agentId === selectedAgent);

  // Token totals
  const totals = (activeConvo?.messages || []).reduce(
    (a, m) => ({ inp: a.inp + (m.tokens?.input || 0), out: a.out + (m.tokens?.output || 0) }),
    { inp: 0, out: 0 }
  );
  const cost = calcCost(totals.inp, totals.out);

  /* ── Actions ───────────────────────────────────────── */
  function newConvo(agentId?: string) {
    const aid = agentId || selectedAgent;
    const a = agents.find((x) => x.id === aid);
    const c: Conversation = { id: uid(), agentId: aid, title: `แชทกับ ${a ? shortName(a.name) : aid}`, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    setConvos((p) => [c, ...p]);
    setActiveId(c.id);
    setSelectedAgent(aid);
    setSidebarTab("history");
  }

  function selectAgent(id: string) {
    setSelectedAgent(id);
    const latest = convos.find((c) => c.agentId === id);
    setActiveId(latest?.id || null);
    setSidebarTab("agents");
  }

  function deleteConvo(id: string) {
    setConvos((p) => { const u = p.filter((c) => c.id !== id); saveConvos(u); return u; });
    if (activeId === id) setActiveId(null);
  }

  function clearAll() { setConvos([]); setActiveId(null); localStorage.removeItem(STORAGE_KEY); }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    if (taRef.current) { taRef.current.style.height = "48px"; }

    // Ensure conversation exists
    let cid = activeId;
    if (!cid) {
      const a = agents.find((x) => x.id === selectedAgent);
      const nc: Conversation = { id: uid(), agentId: selectedAgent, title: text.slice(0, 50), messages: [], createdAt: Date.now(), updatedAt: Date.now() };
      cid = nc.id;
      setConvos((p) => [nc, ...p]);
      setActiveId(cid);
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, agentId: selectedAgent, timestamp: Date.now() };
    setConvos((p) => p.map((c) => c.id === cid ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? text.slice(0, 50) : c.title, updatedAt: Date.now() } : c));
    setSending(true);

    try {
      const t0 = Date.now();
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: selectedAgent, message: text, model: selectedModel }) });
      const data = await res.json();
      const latency = Date.now() - t0;
      const reply: ChatMessage = {
        id: uid(), role: "assistant", content: data.response || data.error || "No response",
        agentId: selectedAgent, timestamp: Date.now(), model: data.model, tokens: data.tokens, latencyMs: data.latencyMs || latency, offline: data.offline,
      };
      setConvos((p) => p.map((c) => c.id === cid ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() } : c));
    } catch (err: any) {
      const errMsg: ChatMessage = { id: uid(), role: "assistant", content: `❌ **Error:** ${err.message}`, agentId: selectedAgent, timestamp: Date.now(), offline: true };
      setConvos((p) => p.map((c) => c.id === cid ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() } : c));
    }
    setSending(false);
  }, [input, sending, selectedAgent, selectedModel, activeId, agents]);

  const regenerate = useCallback(async (msgIdx: number) => {
    if (sending || !activeConvo) return;
    const msgs = activeConvo.messages;
    let userText = "";
    for (let j = msgIdx - 1; j >= 0; j--) { if (msgs[j].role === "user") { userText = msgs[j].content; break; } }
    if (!userText) return;

    setConvos((p) => p.map((c) => c.id === activeId ? { ...c, messages: c.messages.filter((_, i) => i !== msgIdx) } : c));
    setSending(true);
    try {
      const t0 = Date.now();
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: selectedAgent, message: userText, model: selectedModel }) });
      const data = await res.json();
      const reply: ChatMessage = { id: uid(), role: "assistant", content: data.response || "Error", agentId: selectedAgent, timestamp: Date.now(), model: data.model, tokens: data.tokens, latencyMs: Date.now() - t0 };
      setConvos((p) => p.map((c) => c.id === activeId ? { ...c, messages: [...c.messages, reply], updatedAt: Date.now() } : c));
    } catch (err: any) {
      const errMsg: ChatMessage = { id: uid(), role: "assistant", content: `❌ ${err.message}`, agentId: selectedAgent, timestamp: Date.now(), offline: true };
      setConvos((p) => p.map((c) => c.id === activeId ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() } : c));
    }
    setSending(false);
  }, [sending, activeConvo, activeId, selectedAgent, selectedModel]);

  /* ── Textarea auto-resize ──────────────────────────── */
  function onTaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "48px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }
  function onKey(e: React.KeyboardEvent) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="flex" style={{ height: "calc(100vh - 48px)", margin: "-24px", overflow: "hidden" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div className="w-[260px] flex-shrink-0 flex flex-col" style={{ background: "var(--surface-primary)", borderRight: "1px solid var(--border-default)" }}>

        {/* Sidebar header + tabs */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agent Chat</h3>
            <button onClick={() => newConvo()} className="text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
              style={{ background: "var(--accent)", color: "#fff" }}>+ New</button>
          </div>
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-secondary)" }}>
            {(["agents", "history"] as const).map((t) => (
              <button key={t} onClick={() => setSidebarTab(t)}
                className="flex-1 text-xs py-1.5 rounded-md capitalize transition-all"
                style={{
                  background: sidebarTab === t ? "var(--surface-primary)" : "transparent",
                  color: sidebarTab === t ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: sidebarTab === t ? 600 : 400,
                  boxShadow: sidebarTab === t ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}>{t === "agents" ? "Agents" : `History (${agentConvos.length})`}</button>
            ))}
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sidebarTab === "agents" ? (
            <div className="space-y-0.5">
              {agents.map((agent) => {
                const t = getTheme(agent.role);
                const active = selectedAgent === agent.id;
                const msgCount = convos.filter((c) => c.agentId === agent.id).reduce((s, c) => s + c.messages.length, 0);
                return (
                  <button key={agent.id} onClick={() => selectAgent(agent.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all group"
                    style={{ background: active ? `${t.color}10` : "transparent" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: active ? `${t.color}20` : "var(--surface-tertiary)" }}>
                      {t.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: active ? t.color : "var(--text-primary)", fontWeight: active ? 600 : 400 }}>
                        {shortName(agent.name)}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                        {agent.description.slice(0, 28)}
                        {msgCount > 0 && <span style={{ color: t.color, fontWeight: 500 }}> · {msgCount}</span>}
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color, opacity: active ? 1 : 0.4 }} />
                  </button>
                );
              })}
              {agents.length === 0 && <p className="text-xs text-center py-8" style={{ color: "var(--text-tertiary)" }}>No agents found</p>}
            </div>
          ) : (
            <div className="space-y-0.5">
              {agentConvos.length === 0 && <p className="text-xs text-center py-8" style={{ color: "var(--text-tertiary)" }}>ยังไม่มีประวัติแชท</p>}
              {agentConvos.map((c) => (
                <div key={c.id} className="group flex items-center rounded-xl transition-all"
                  style={{ background: activeId === c.id ? "var(--surface-tertiary)" : "transparent" }}>
                  <button onClick={() => setActiveId(c.id)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{c.messages.length} msgs · {timeStr(c.updatedAt)}</p>
                  </button>
                  <button onClick={() => deleteConvo(c.id)} className="opacity-0 group-hover:opacity-100 text-sm px-2 py-1 mr-1 rounded-lg transition-all hover:scale-110"
                    style={{ color: "var(--text-tertiary)" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        {convos.length > 0 && (
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border-default)" }}>
            <button onClick={clearAll} className="w-full text-xs py-2 rounded-lg transition-all hover:opacity-80"
              style={{ color: "var(--status-offline)", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              ลบประวัติทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* ═══ CHAT AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--surface-secondary)" }}>

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: "var(--surface-primary)", borderBottom: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${theme.color}15` }}>
              {theme.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{currentAgent ? shortName(currentAgent.name) : "Select an agent"}</p>
                <span className="w-2 h-2 rounded-full pulse-online" style={{ background: "var(--status-online)" }} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{currentAgent?.role}</span>
                {totals.inp + totals.out > 0 && (
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>⚡ {(totals.inp + totals.out).toLocaleString()} tokens</span>
                )}
                {cost.usd > 0 && (
                  <span className="text-xs" style={{ color: "#f59e0b" }}>${cost.usd.toFixed(4)} (฿{cost.thb.toFixed(1)})</span>
                )}
              </div>
            </div>
          </div>
          <ModelPicker value={selectedModel} onChange={setSelectedModel} />
        </div>

        {/* Messages area */}
        <div ref={chatBoxRef} className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollBehavior: "smooth" }}>

          {/* Empty state */}
          {(!activeConvo || activeConvo.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: `${theme.color}10` }}>
                <span className="text-4xl">{theme.icon}</span>
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {currentAgent ? shortName(currentAgent.name) : "Agent Chat"}
              </p>
              <p className="text-sm mb-6 max-w-sm text-center" style={{ color: "var(--text-tertiary)" }}>
                {currentAgent?.description || "เลือก agent จากด้านซ้ายเพื่อเริ่มสนทนา"}
              </p>
              <div className="flex flex-wrap gap-2 max-w-lg justify-center">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-xs px-3.5 py-2 rounded-xl transition-all hover:scale-[1.02] hover:shadow-sm"
                    style={{ background: "var(--surface-primary)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {activeConvo && activeConvo.messages.length > 0 && (
            <div className="max-w-3xl mx-auto space-y-1">
              {activeConvo.messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isLastAssistant = !isUser && idx === activeConvo.messages.length - 1;
                const modelInfo = MODELS.find((m) => m.value === msg.model);

                return (
                  <div key={msg.id} className={`group flex gap-3 py-3 ${isUser ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                        style={{ background: isUser ? "rgba(99,102,241,0.15)" : "var(--surface-tertiary)" }}>
                        {isUser ? "👤" : theme.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${isUser ? "flex flex-col items-end" : ""}`}>
                      {/* Name + time */}
                      <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          {isUser ? "You" : currentAgent ? shortName(currentAgent.name) : "Agent"}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{timeStr(msg.timestamp)}</span>
                        {!isUser && modelInfo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${modelInfo.color}15`, color: modelInfo.color }}>
                            {modelInfo.label}
                          </span>
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`inline-block rounded-2xl px-4 py-3 ${isUser ? "max-w-[85%]" : "max-w-full"}`}
                        style={{
                          background: isUser ? `${theme.color}12` : "var(--surface-primary)",
                          border: `1px solid ${isUser ? `${theme.color}25` : "var(--border-default)"}`,
                          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                        }}>
                        {isUser
                          ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{msg.content}</p>
                          : <MarkdownBlock text={msg.content} />
                        }
                        {/* Token info */}
                        {!isUser && msg.tokens && (msg.tokens.input + msg.tokens.output > 0) && (
                          <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>⚡ {msg.tokens.input}+{msg.tokens.output} tok</span>
                            {msg.latencyMs && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{msg.latencyMs}ms</span>}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!isUser && <MsgActions text={msg.content} onRegenerate={() => regenerate(idx)} isLast={isLastAssistant} />}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {sending && (
                <div className="flex gap-3 py-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{ background: "var(--surface-tertiary)" }}>
                    {theme.icon}
                  </div>
                  <div>
                    <span className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                      {currentAgent ? shortName(currentAgent.name) : "Agent"}
                    </span>
                    <div className="inline-flex items-center gap-2 rounded-2xl px-4 py-3"
                      style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: "20px 20px 20px 6px" }}>
                      <span className="typing-dot" /><span className="typing-dot" style={{ animationDelay: "0.15s" }} /><span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                      <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>กำลังคิด...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-5 py-3" style={{ background: "var(--surface-primary)", borderTop: "1px solid var(--border-default)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-2xl px-4 py-2" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border-default)" }}>
              <textarea ref={taRef} value={input} onChange={onTaChange} onKeyDown={onKey}
                placeholder={`ส่งข้อความถึง ${currentAgent ? shortName(currentAgent.name) : "agent"}...`}
                rows={1} disabled={sending}
                className="flex-1 text-sm resize-none bg-transparent outline-none"
                style={{ color: "var(--text-primary)", minHeight: "48px", maxHeight: "160px", lineHeight: "24px", paddingTop: "12px" }} />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mb-0.5 transition-all hover:scale-105"
                style={{ background: input.trim() ? "var(--accent)" : "var(--surface-tertiary)", color: input.trim() ? "#fff" : "var(--text-tertiary)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "var(--text-tertiary)", opacity: 0.6 }}>
              Shift+Enter ขึ้นบรรทัดใหม่ · ประวัติบันทึกอัตโนมัติ · Codelabs Tech
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Scoped Styles ═══ */}
      <style>{`
        .typing-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent-muted, #818cf8);
          animation: typing-bounce 1.2s ease-in-out infinite;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        .md-content p + p { margin-top: 0.5rem; }
        .md-content pre { margin: 0; }
        .md-content code { font-family: 'JetBrains Mono', monospace; }
        .group:hover { background: rgba(99,102,241,0.015); }
        .overflow-y-auto { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
