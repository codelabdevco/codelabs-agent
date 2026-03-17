import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Chat API — proxy messages to OpenClaw agents
// ---------------------------------------------------------------------------

const fleetPath = process.env.FLEET_CONFIG_PATH || path.join(process.cwd(), "../fleet-config.json");

function loadFleet() {
  try {
    return JSON.parse(fs.readFileSync(fleetPath, "utf-8"));
  } catch {
    return { openclaw: [], n8n: {} };
  }
}

// POST — send message to agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, message, model } = body;

    const fleet = loadFleet();
    const agent = fleet.openclaw?.find((a: any) => a.id === agentId);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Try to proxy to OpenClaw agent
    try {
      const res = await fetch(`${agent.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, model }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          response: data.response || data.message || data.text || JSON.stringify(data),
          model: data.model || model || "unknown",
          tokens: data.tokens || { input: 0, output: 0 },
          latencyMs: data.latencyMs || 0,
        });
      }
    } catch {
      // Agent offline — return simulated response
    }

    // Fallback: agent offline simulation
    return NextResponse.json({
      response: `⚠️ **${agent.name}** is currently offline.\n\nThe agent container \`${agent.container}\` is not responding. Please check:\n- Container status in the **Agents** page\n- Use **Orchestrator** to auto-restart\n\n_Your message: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"_`,
      model: "offline",
      tokens: { input: 0, output: 0 },
      latencyMs: 0,
      offline: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — list available agents for chat
export async function GET() {
  const fleet = loadFleet();
  const agents = (fleet.openclaw || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    description: a.description,
  }));
  return NextResponse.json({ agents });
}
