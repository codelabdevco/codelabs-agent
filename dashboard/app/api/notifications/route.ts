import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import {
  loadNotifyConfigs,
  addNotifyConfig,
  removeNotifyConfig,
  dispatchNotification,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET — list notification configs
export async function GET() {
  const { error } = requireAuth("view:settings");
  if (error) return error;
  const configs = loadNotifyConfigs();
  return NextResponse.json({ configs, timestamp: Date.now() });
}

// POST — add/remove/test notification config
export async function POST(req: Request) {
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;

  const body = await req.json();

  if (body.action === "add") {
    const config = addNotifyConfig({
      channel: body.channel,
      enabled: body.enabled ?? true,
      name: body.name,
      secretKey: body.secretKey,
      events: body.events || [],
      throttleSeconds: body.throttleSeconds ?? 300,
    });
    return NextResponse.json({ ok: true, config });
  }

  if (body.action === "remove") {
    const ok = removeNotifyConfig(body.id);
    return NextResponse.json({ ok });
  }

  if (body.action === "test") {
    const result = await dispatchNotification({
      level: "info",
      event: "test",
      title: "Test notification",
      message: "If you see this, the notification channel is working!",
    });
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
