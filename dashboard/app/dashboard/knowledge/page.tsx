"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CATEGORIES = ["client", "project", "policy", "product", "procedure", "general"];

const CATEGORY_ICONS: Record<string, string> = {
  client: "👤",
  project: "📁",
  policy: "📋",
  product: "📦",
  procedure: "📝",
  general: "📌",
};

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ key: "", title: "", content: "", category: "general", tags: "" });

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (catFilter) params.set("category", catFilter);

  const { data, mutate } = useSWR(`/api/knowledge?${params}`, fetcher, { refreshInterval: 15000 });
  const entries = data?.entries ?? [];
  const categories = data?.categories ?? [];
  const tags = data?.tags ?? [];

  async function handleSave() {
    const action = editingId ? "update" : "add";
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(editingId ? { id: editingId } : {}),
        key: form.key,
        title: form.title,
        content: form.content,
        category: form.category,
        tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
      }),
    });
    resetForm();
    mutate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    mutate();
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    setForm({
      key: entry.key || "",
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags?.join(", ") || "",
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ key: "", title: "", content: "", category: "general", tags: "" });
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 12,
    padding: "7px 10px",
    borderRadius: 8,
    background: "var(--surface-secondary)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
    width: "100%",
  };

  // Tag cloud from all entries
  const allTags: Record<string, number> = {};
  entries.forEach((e: any) => {
    (e.tags || []).forEach((t: string) => {
      allTags[t] = (allTags[t] || 0) + 1;
    });
  });

  // Stats
  const totalEntries = entries.length;
  const totalViews = entries.reduce((s: number, e: any) => s + (e.accessCount || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>Knowledge Base</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Shared memory across all agents — {totalEntries} entries · {totalViews} total views
          </p>
        </div>
        <button
          onClick={() => { showForm ? resetForm() : setShowForm(true); }}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: "#6366f1", color: "#fff" }}
        >
          {showForm ? "Cancel" : "+ Add entry"}
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge base..."
            style={{ ...inputStyle, paddingLeft: 32, flex: 1 }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-tertiary)" }}>◈</span>
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ ...inputStyle, width: 160 }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c} ({categories.find((x: any) => x.category === c)?.count || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((c: any) => (
          <button
            key={c.category}
            onClick={() => setCatFilter(catFilter === c.category ? "" : c.category)}
            className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{
              background: catFilter === c.category ? "rgba(99,102,241,0.15)" : "var(--surface-secondary)",
              color: catFilter === c.category ? "#818cf8" : "var(--text-secondary)",
              border: "0.5px solid var(--border-default)",
            }}
          >
            <span>{CATEGORY_ICONS[c.category] || "📌"}</span>
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      {/* Tag cloud */}
      {Object.keys(allTags).length > 0 && !showForm && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {Object.entries(allTags)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setSearch(tag)}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "var(--surface-secondary)",
                  color: "var(--text-tertiary)",
                  border: "0.5px solid var(--border-default)",
                  fontSize: Math.min(10 + count * 1, 14),
                }}
              >
                #{tag}
              </button>
            ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
            {editingId ? "Edit entry" : "Add new entry"}
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Key</label>
              <input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="e.g. client:สยามวอเตอร์"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="บริษัท สยามวอเตอร์ จำกัด — ข้อมูลลูกค้า"
                style={inputStyle}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={5}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="ข้อมูลที่ทุก agent ควรรู้..."
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-secondary)" }}>Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="กปน., ประปา, สัญญา"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!form.title || !form.content}
              className="text-sm px-5 py-2 rounded-lg font-medium"
              style={{ background: "#6366f1", color: "#fff", opacity: form.title && form.content ? 1 : 0.4 }}
            >
              {editingId ? "Update" : "Add to knowledge base"}
            </button>
            {editingId && (
              <button onClick={resetForm} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>
                Cancel edit
              </button>
            )}
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="space-y-3">
        {entries.length === 0 && (
          <p
            className="text-sm text-center py-8 rounded-xl"
            style={{ color: "var(--text-tertiary)", background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
          >
            {search ? "No results found" : "Knowledge base is empty — add your first entry"}
          </p>
        )}
        {entries.map((e: any) => {
          const isExpanded = expandedId === e.id;
          return (
            <div
              key={e.id}
              className="rounded-xl p-4"
              style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{CATEGORY_ICONS[e.category] || "📌"}</span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
                    >
                      {e.category}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {e.title}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 ml-3">
                  <button
                    onClick={() => startEdit(e)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: "var(--accent)", border: "0.5px solid var(--border-default)" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: "var(--text-tertiary)", border: "0.5px solid var(--border-default)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p
                className="text-sm mb-2"
                style={{ color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: isExpanded ? "pre-wrap" : "normal" }}
              >
                {isExpanded ? e.content : e.content.slice(0, 200) + (e.content.length > 200 ? "..." : "")}
              </p>
              {e.content.length > 200 && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : e.id)}
                  className="text-xs mb-2"
                  style={{ color: "var(--accent)" }}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
              <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--text-tertiary)" }}>
                {e.key && <span>Key: {e.key}</span>}
                <span>Source: {e.sourceAgent || "manual"}</span>
                <span>Views: {e.accessCount || 0}</span>
                <span>{new Date(e.updatedAt || e.createdAt).toLocaleDateString("th-TH")}</span>
                {e.tags?.length > 0 && (
                  <div className="flex gap-1">
                    {e.tags.map((t: string) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80"
                        style={{ background: "var(--surface-secondary)" }}
                        onClick={() => setSearch(t)}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
