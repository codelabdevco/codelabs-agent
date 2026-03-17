import { NextResponse } from "next/server";
import {
  getAllFleetStats,
  restartContainer,
  stopContainer,
  startContainer,
  getContainerLogs,
} from "@/lib/docker";
import { requireAuth } from "@/lib/auth-middleware";
import { addAuditLog } from "@/lib/audit";
import { findUserById } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/docker — return stats (viewer+)
export async function GET() {
  const { auth, error } = requireAuth("view:resources");
  if (error) return error;

  const stats = await getAllFleetStats();
  return NextResponse.json({ stats, timestamp: Date.now() });
}

// POST /api/docker — container actions with RBAC + audit
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, container } = body;

    if (!container || !action) {
      return NextResponse.json({ error: "Missing container or action" }, { status: 400 });
    }

    const permMap: Record<string, string> = {
      restart: "action:restart",
      stop: "action:stop",
      start: "action:start",
      logs: "view:logs",
    };

    const perm = permMap[action];
    if (!perm) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { auth, error } = requireAuth(perm);
    if (error) return error;

    const user = findUserById(auth!.userId);
    const username = user?.username || "unknown";

    switch (action) {
      case "restart":
        await restartContainer(container);
        await addAuditLog({ userId: auth!.userId, username, action: "agent_restart", target: container, detail: `Container "${container}" restarted` });
        return NextResponse.json({ ok: true, action, container });

      case "stop":
        await stopContainer(container);
        await addAuditLog({ userId: auth!.userId, username, action: "agent_stop", target: container, detail: `Container "${container}" stopped` });
        return NextResponse.json({ ok: true, action, container });

      case "start":
        await startContainer(container);
        await addAuditLog({ userId: auth!.userId, username, action: "agent_start", target: container, detail: `Container "${container}" started` });
        return NextResponse.json({ ok: true, action, container });

      case "logs":
        const tail = body.tail ?? 100;
        const logs = await getContainerLogs(container, tail);
        return NextResponse.json({ logs, container });

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Action failed" }, { status: 500 });
  }
}
