import { NextResponse } from "next/server";
import { getFleetConfig, getN8nWorkflows, getN8nExecutions } from "@/lib/fleet";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getFleetConfig();
  const apiKey = process.env.N8N_API_KEY;

  const [workflows, executions] = await Promise.all([
    getN8nWorkflows(config.n8n.host, apiKey),
    getN8nExecutions(config.n8n.host, apiKey, 20),
  ]);

  return NextResponse.json({
    workflows,
    executions,
    timestamp: Date.now(),
  });
}
