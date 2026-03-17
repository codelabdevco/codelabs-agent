"use client";

export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{ background: "var(--surface-primary)", border: "0.5px solid var(--border-default)" }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="text-2xl font-medium tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
