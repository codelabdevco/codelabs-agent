"use client";

import { useEffect, useRef } from "react";
import { useFleetLogs } from "@/lib/hooks";

export function LogViewer({ container }: { container?: string | null }) {
  const { data, isLoading } = useFleetLogs(container, 3000);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [data]);

  const logs: { container: string; line: string }[] = data?.logs ?? [];

  function containerColor(name: string) {
    if (name.includes("claw-1")) return "#6366f1";
    if (name.includes("claw-2")) return "#0ea5e9";
    if (name.includes("claw-3")) return "#8b5cf6";
    if (name.includes("claw-4")) return "#f59e0b";
    if (name.includes("claw-5")) return "#10b981";
    if (name.includes("claw-6")) return "#ec4899";
    if (name.includes("n8n")) return "#f97316";
    return "var(--text-secondary)";
  }

  function formatLine(line: string) {
    // Extract timestamp if present
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*(.*)/);
    if (tsMatch) {
      const ts = new Date(tsMatch[1]);
      const timeStr = ts.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return { time: timeStr, message: tsMatch[2] };
    }
    return { time: "", message: line };
  }

  return (
    <div
      ref={scrollRef}
      className="rounded-xl overflow-y-auto font-mono text-xs leading-relaxed"
      style={{
        background: "var(--surface-primary)",
        border: "0.5px solid var(--border-default)",
        maxHeight: "520px",
        padding: "12px 16px",
      }}
    >
      {isLoading && logs.length === 0 && (
        <p style={{ color: "var(--text-tertiary)" }}>Loading logs...</p>
      )}
      {logs.map((log, i) => {
        const { time, message } = formatLine(log.line);
        return (
          <div
            key={i}
            className="py-0.5 flex gap-2 log-line-new"
            style={{ color: "var(--text-secondary)" }}
          >
            {time && (
              <span className="flex-shrink-0 w-16" style={{ color: "var(--text-tertiary)" }}>
                {time}
              </span>
            )}
            <span
              className="flex-shrink-0 w-24 font-medium truncate"
              style={{ color: containerColor(log.container) }}
            >
              [{log.container.replace("claw-", "C").replace("-", "")}]
            </span>
            <span className="break-all">{message}</span>
          </div>
        );
      })}
      {!isLoading && logs.length === 0 && (
        <p style={{ color: "var(--text-tertiary)" }}>No logs available</p>
      )}
    </div>
  );
}
