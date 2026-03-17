import { NextResponse } from "next/server";
import { getFleetConfig, getClawSessions } from "@/lib/fleet";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const config = getFleetConfig();
  const instance = config.openclaw.find((c) => c.id === params.id);

  if (!instance) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const tokenKey = `CLAW_${instance.id.split("-")[1]}_TOKEN`;
  const token = process.env[tokenKey];

  const sessions = await getClawSessions(instance, token);

  return NextResponse.json({
    agent: instance,
    sessions,
    timestamp: Date.now(),
  });
}
