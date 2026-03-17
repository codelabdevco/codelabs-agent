import { NextResponse } from "next/server";
import { getContainerLogs, listFleetContainers } from "@/lib/docker";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tail = parseInt(searchParams.get("tail") ?? "50", 10);
  const filterContainer = searchParams.get("container");

  const containers = await listFleetContainers();
  const targetContainers = filterContainer
    ? containers.filter((c) =>
        c.Names?.some((n) => n.includes(filterContainer))
      )
    : containers;

  const results = await Promise.allSettled(
    targetContainers.map(async (c) => {
      const name = c.Names?.[0]?.replace(/^\//, "") || c.Id.slice(0, 12);
      const lines = await getContainerLogs(name, tail);
      return lines.map((line) => ({ container: name, line }));
    })
  );

  // Flatten and sort by timestamp (embedded in docker log lines)
  const allLogs = results
    .filter(
      (r): r is PromiseFulfilledResult<{ container: string; line: string }[]> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value)
    .sort((a, b) => {
      // Try to extract ISO timestamp from the beginning of each line
      const tsA = a.line.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?/)?.[0] || "";
      const tsB = b.line.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?/)?.[0] || "";
      return tsB.localeCompare(tsA); // newest first
    })
    .slice(0, 200);

  return NextResponse.json({ logs: allLogs, timestamp: Date.now() });
}
