import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { getAuditLogs, getAuditDates } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { auth, error } = requireAuth("view:audit");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || undefined;
  const action = searchParams.get("action") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  const logs = getAuditLogs({ date, limit, action, userId });
  const dates = getAuditDates();

  return NextResponse.json({ logs, dates, timestamp: Date.now() });
}
