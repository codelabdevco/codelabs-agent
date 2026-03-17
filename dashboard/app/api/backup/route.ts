import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import { listBackups, createBackup, restoreBackup, deleteBackup, formatSize } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const { auth, error } = requireAuth("view:settings");
  if (error) return error;

  const backups = listBackups().map((b) => ({
    ...b,
    sizeHuman: formatSize(b.sizeBytes),
  }));
  return NextResponse.json({ backups, timestamp: Date.now() });
}

export async function POST(req: Request) {
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;

  const body = await req.json();
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  switch (body.action) {
    case "create": {
      try {
        const manifest = createBackup(body.type || "full", username, body.description);
        await addAuditLog({
          userId: auth!.userId, username,
          action: "settings_updated",
          target: `backup:${manifest.id}`,
          detail: `Created ${manifest.type} backup: ${manifest.files.length} files, ${formatSize(manifest.sizeBytes)}`,
        });
        return NextResponse.json({ ok: true, backup: { ...manifest, sizeHuman: formatSize(manifest.sizeBytes) } });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    case "restore": {
      try {
        const result = restoreBackup(body.backupId);
        await addAuditLog({
          userId: auth!.userId, username,
          action: "settings_updated",
          target: `backup:${body.backupId}`,
          detail: `Restored backup: ${result.restored} files`,
        });
        return NextResponse.json({ ok: true, ...result });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    case "delete": {
      const ok = deleteBackup(body.backupId);
      if (ok) {
        await addAuditLog({
          userId: auth!.userId, username,
          action: "settings_updated",
          target: `backup:${body.backupId}`,
          detail: "Deleted backup",
        });
      }
      return NextResponse.json({ ok });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
