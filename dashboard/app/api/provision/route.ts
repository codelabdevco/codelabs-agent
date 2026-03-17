import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import {
  provisionNewClaw,
  decommissionClaw,
  getAvailableRoles,
  getFleetSummary,
} from "@/lib/provisioner";

export const dynamic = "force-dynamic";

// GET — fleet summary + available roles (for the provisioning form)
export async function GET() {
  const { auth, error } = requireAuth("view:settings");
  if (error) return error;

  const summary = getFleetSummary();
  const roles = getAvailableRoles();

  return NextResponse.json({ ...summary, roles, timestamp: Date.now() });
}

// POST — provision or decommission
export async function POST(req: Request) {
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;

  const body = await req.json();
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  if (body.action === "provision") {
    const result = await provisionNewClaw(
      {
        role: body.role,
        displayName: body.displayName,
        description: body.description,
        model: body.model,
        systemPrompt: body.systemPrompt,
        memoryLimitMB: body.memoryLimitMB,
        cpuLimit: body.cpuLimit,
        channels: body.channels,
      },
      username
    );

    if (result.success) {
      return NextResponse.json({ ok: true, agent: result.agent });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (body.action === "decommission") {
    const result = await decommissionClaw(
      body.agentId,
      username,
      body.deleteData ?? false
    );

    if (result.success) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
