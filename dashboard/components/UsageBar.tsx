"use client";

export function UsageBar({
  label,
  value,
  max,
  unit = "%",
  showLabel = true,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  showLabel?: boolean;
}) {
  const percent = max ? Math.min(Math.round((value / max) * 100), 100) : Math.min(value, 100);
  const color =
    percent > 85
      ? "var(--status-offline)"
      : percent > 65
      ? "var(--status-degraded)"
      : "var(--status-online)";

  const displayValue = max ? `${value}/${max} ${unit}` : `${value}${unit}`;

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {displayValue}
          </span>
        </div>
      )}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-tertiary)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
