import { NextResponse } from "next/server";
import {
  getFleetConfig,
  getClawHealth,
  getN8nHealth,
  type AgentHealth,
} from "@/lib/fleet";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getFleetConfig();

  // Fetch health from all OpenClaw instances in parallel
  const clawHealthPromises = config.openclaw.map((instance) => {
    const tokenKey = `CLAW_${instance.id.split("-")[1]}_TOKEN`;
    const token = process.env[tokenKey];
    return getClawHealth(instance, token);
  });

  // Fetch n8n health
  const n8nHealthPromise = getN8nHealth(config.n8n.host);

  const results = await Promise.allSettled([
    ...clawHealthPromises,
    n8nHealthPromise,
  ]);

  const agents: AgentHealth[] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { id: "unknown", name: "Unknown", type: "openclaw" as const, status: "offline" as const }
  );

  const summary = {
    total: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    degraded: agents.filter((a) => a.status === "degraded").length,
    offline: agents.filter((a) => a.status === "offline").length,
  };

  return NextResponse.json({ agents, summary, timestamp: Date.now() });
}
