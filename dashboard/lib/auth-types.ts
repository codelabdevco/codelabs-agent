// ─── Roles & Permissions ────────────────────────────────────────────────
// admin    — full access: read, write, restart, settings, secrets, audit
// operator — can chat, restart, view logs/resources, but no secrets/settings
// viewer   — read-only: overview, logs, resources (no actions)

export type Role = "admin" | "operator" | "viewer";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Session {
  token: string;
  userId: string;
  role: Role;
  expiresAt: number;
  createdAt: number;
}

// Permission matrix
export const PERMISSIONS: Record<string, Role[]> = {
  // Dashboard views
  "view:overview": ["admin", "operator", "viewer"],
  "view:agents": ["admin", "operator", "viewer"],
  "view:logs": ["admin", "operator", "viewer"],
  "view:resources": ["admin", "operator", "viewer"],
  "view:chat": ["admin", "operator"],
  "view:billing": ["admin", "operator", "viewer"],
  "view:n8n": ["admin", "operator", "viewer"],
  "view:settings": ["admin"],
  "view:audit": ["admin"],

  // Actions
  "action:restart": ["admin", "operator"],
  "action:stop": ["admin"],
  "action:start": ["admin", "operator"],
  "action:chat": ["admin", "operator"],
  "action:change-model": ["admin"],
  "action:set-budget": ["admin"],

  // Secrets & config
  "secrets:view": ["admin"],
  "secrets:edit": ["admin"],
  "settings:edit": ["admin"],
  "users:manage": ["admin"],
};

export function hasPermission(role: Role, permission: string): boolean {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function getVisibleTabs(role: Role): string[] {
  const allTabs = [
    { id: "overview", permission: "view:overview" },
    { id: "agents", permission: "view:agents" },
    { id: "chat", permission: "view:chat" },
    { id: "billing", permission: "view:billing" },
    { id: "n8n", permission: "view:n8n" },
    { id: "logs", permission: "view:logs" },
    { id: "resources", permission: "view:resources" },
    { id: "settings", permission: "view:settings" },
    { id: "audit", permission: "view:audit" },
  ];
  return allTabs.filter((t) => hasPermission(role, t.permission)).map((t) => t.id);
}
