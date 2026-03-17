import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import { getFleetConfig, fetchWithTimeout } from "@/lib/fleet";

export const dynamic = "force-dynamic";

// Model pricing per 1K tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5-20251001": { input: 0.0008, output: 0.004 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

// POST /api/chat — send message to an agent
export async function POST(req: Request) {
  const { auth, error } = requireAuth("action:chat");
  if (error) return error;

  const body = await req.json();
  const { agentId, message, model } = body;

  if (!agentId || !message) {
    return NextResponse.json({ error: "Missing agentId or message" }, { status: 400 });
  }

  const config = getFleetConfig();
  const instance = config.openclaw.find((c) => c.id === agentId);

  if (!instance) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  try {
    // Build headers
    const num = instance.id.split("-")[1];
    const tokenKey = `CLAW_${num}_TOKEN`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = process.env[tokenKey];
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Send to OpenClaw gateway
    const res = await fetchWithTimeout(`${instance.host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        model: model || undefined,
      }),
      timeoutMs: 60000, // 60s for LLM response
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Agent returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Estimate tokens (rough: 1 token ≈ 4 chars for English, 1.5 for Thai)
    const inputTokens = data.inputTokens || Math.ceil(message.length / 2.5);
    const outputTokens =
      data.outputTokens ||
      Math.ceil((data.response || data.message || "").length / 2.5);

    // Calculate cost
    const pricing = MODEL_PRICING[model || "claude-sonnet-4-20250514"] || {
      input: 0.003,
      output: 0.015,
    };
    const costUSD =
      (inputTokens / 1000) * pricing.input +
      (outputTokens / 1000) * pricing.output;

    // Audit
    await addAuditLog({
      userId: auth!.userId,
      username,
      action: "chat_message",
      target: agentId,
      detail: `"${message.slice(0, 60)}${message.length > 60 ? "..." : ""}" → ${inputTokens}+${outputTokens} tokens, $${costUSD.toFixed(4)}`,
    });

    return NextResponse.json({
      response: data.response || data.message || data.text || "OK",
      model: data.model || model || "claude-sonnet-4-20250514",
      inputTokens,
      outputTokens,
      costUSD,
      costTHB: costUSD * 34.5,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reach agent" },
      { status: 502 }
    );
  }
}

// GET /api/chat — get chat history for an agent (from session API)
export async function GET(req: Request) {
  const { auth, error } = requireAuth("action:chat");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
  }

  const config = getFleetConfig();
  const instance = config.openclaw.find((c) => c.id === agentId);

  if (!instance) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const num = instance.id.split("-")[1];
    const tokenKey = `CLAW_${num}_TOKEN`;
    const headers: Record<string, string> = {};
    const token = process.env[tokenKey];
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithTimeout(`${instance.host}/api/sessions`, {
      headers,
      timeoutMs: 5000,
    });

    if (!res.ok) {
      return NextResponse.json({ sessions: [] });
    }

    const sessions = await res.json();
    return NextResponse.json({ sessions, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
