import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import { startOrchestrator, stopOrchestrator, getOrchestratorState } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  const { auth, error } = requireAuth("view:overview");
  if (error) return error;
  return NextResponse.json(getOrchestratorState());
}

export async function POST(req: Request) {
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;
  const body = await req.json();
  const user = findUserById(auth!.userId);

  if (body.action === "start") {
    startOrchestrator();
    await addAuditLog({ userId: auth!.userId, username: user?.username || "unknown", action: "settings_updated", target: "orchestrator", detail: "AI Orchestrator started" });
    return NextResponse.json({ ok: true, ...getOrchestratorState() });
  }
  if (body.action === "stop") {
    stopOrchestrator();
    await addAuditLog({ userId: auth!.userId, username: user?.username || "unknown", action: "settings_updated", target: "orchestrator", detail: "AI Orchestrator stopped" });
    return NextResponse.json({ ok: true, ...getOrchestratorState() });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
