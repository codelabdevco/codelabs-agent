"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const navSections = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: "◈" },
      { href: "/dashboard/agents", label: "Agents", icon: "◉" },
      { href: "/dashboard/chat", label: "Chat", icon: "◆" },
      { href: "/dashboard/n8n", label: "n8n Workflows", icon: "⟁" },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "/dashboard/routing", label: "Agent Routing", icon: "→" },
      { href: "/dashboard/scheduler", label: "Scheduler", icon: "⏱" },
      { href: "/dashboard/orchestrator", label: "Orchestrator", icon: "◆" },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/dashboard/logs", label: "Live Logs", icon: "▤" },
      { href: "/dashboard/resources", label: "Resources", icon: "◧" },
      { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "◇" },
      { href: "/dashboard/billing", label: "Billing", icon: "฿" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/provision", label: "Provision", icon: "+" },
      { href: "/dashboard/audit", label: "Audit Log", icon: "◎" },
      { href: "/dashboard/backup", label: "Backup", icon: "▥" },
      { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

// Flatten for backwards compat
const navItems = navSections.flatMap((s) => s.items);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 border-r flex flex-col"
        style={{
          background: "var(--surface-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border-default)" }}>
          <h1 className="text-base font-medium tracking-tight" style={{ color: "var(--text-primary)" }}>
            Codelabs Tech
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            6 OpenClaw · 1 n8n
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p
                  className="text-xs px-3 pt-3 pb-1"
                  style={{ color: "var(--text-tertiary)", letterSpacing: "0.04em" }}
                >
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                      isActive ? "font-medium" : "hover:opacity-80"
                    )}
                    style={{
                      color: isActive ? "var(--accent)" : "var(--text-secondary)",
                      background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                    }}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t text-xs"
          style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
        >
          Codelabs Tech v1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-6 h-full">{children}</div>
      </main>
    </div>
  );
}
