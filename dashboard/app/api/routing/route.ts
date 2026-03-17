import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import {
  loadRoutingRules,
  addRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  getRoutingLogs,
} from "@/lib/routing";

export const dynamic = "force-dynamic";

// GET — list routing rules + recent logs
export async function GET(req: Request) {
  const { auth, error } = requireAuth("view:agents");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const logsOnly = searchParams.get("logs") === "true";

  if (logsOnly) {
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    return NextResponse.json({ logs: getRoutingLogs(limit), timestamp: Date.now() });
  }

  const rules = loadRoutingRules();
  const logs = getRoutingLogs(20);
  return NextResponse.json({ rules, recentLogs: logs, timestamp: Date.now() });
}

// POST — add/update/delete routing rules
export async function POST(req: Request) {
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;

  const body = await req.json();
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  switch (body.action) {
    case "add": {
      const rule = addRoutingRule({
        name: body.name,
        enabled: body.enabled ?? true,
        sourceAgentIds: body.sourceAgentIds || [],
        match: body.match,
        targetAgentId: body.targetAgentId,
        delegation: body.delegation || { mode: "forward", includeContext: true },
        priority: body.priority ?? 10,
      });
      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "settings_updated",
        target: `routing-rule:${rule.id}`,
        detail: `Added routing rule "${rule.name}": ${rule.match.type}="${rule.match.value}" → ${rule.targetAgentId}`,
      });
      return NextResponse.json({ ok: true, rule });
    }

    case "update": {
      const updated = updateRoutingRule(body.id, body.updates);
      if (!updated) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "settings_updated",
        target: `routing-rule:${body.id}`,
        detail: `Updated routing rule "${updated.name}"`,
      });
      return NextResponse.json({ ok: true, rule: updated });
    }

    case "delete": {
      const deleted = deleteRoutingRule(body.id);
      if (deleted) {
        await addAuditLog({
          userId: auth!.userId,
          username,
          action: "settings_updated",
          target: `routing-rule:${body.id}`,
          detail: `Deleted routing rule`,
        });
      }
      return NextResponse.json({ ok: deleted });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
