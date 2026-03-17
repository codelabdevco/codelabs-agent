"use client";

import { clsx } from "clsx";

export function StatusDot({
  status,
  size = "sm",
}: {
  status: "online" | "degraded" | "offline";
  size?: "sm" | "md";
}) {
  const px = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  return (
    <span
      className={clsx(
        "inline-block rounded-full flex-shrink-0",
        px,
        status === "online" && "pulse-online",
        status === "degraded" && "pulse-degraded"
      )}
      style={{
        background:
          status === "online"
            ? "var(--status-online)"
            : status === "degraded"
            ? "var(--status-degraded)"
            : "var(--status-offline)",
      }}
    />
  );
}
