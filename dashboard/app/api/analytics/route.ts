import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { getAggregates, getHourlyBreakdown } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { auth, error } = requireAuth("view:billing");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const view = searchParams.get("view"); // "hourly" for today breakdown

  if (view === "hourly") {
    return NextResponse.json({ hourly: getHourlyBreakdown(), timestamp: Date.now() });
  }

  const aggregates = getAggregates(days);
  return NextResponse.json({ aggregates, timestamp: Date.now() });
}
