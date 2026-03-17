import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { listSecrets, getSecret, setSecret, deleteSecret, maskSecret } from "@/lib/vault";
import { addAuditLog } from "@/lib/audit";
import { findUserById } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/vault — list secrets (keys + descriptions only)
export async function GET() {
  const { auth, error } = requireAuth("secrets:view");
  if (error) return error;

  const user = findUserById(auth!.userId);
  await addAuditLog({
    userId: auth!.userId,
    username: user?.username || "unknown",
    action: "secret_viewed",
    target: "vault",
    detail: "Listed all secrets",
  });

  const secrets = listSecrets();
  return NextResponse.json({ secrets, timestamp: Date.now() });
}

// POST /api/vault — create/update/delete/reveal secrets
export async function POST(req: Request) {
  const { auth, error } = requireAuth("secrets:edit");
  if (error) return error;

  const body = await req.json();
  const { action } = body;
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  switch (action) {
    case "set": {
      const { key, value, description } = body;
      if (!key || !value) {
        return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
      }
      setSecret(key, value, description || key, username);
      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "secret_updated",
        target: key,
        detail: `Secret "${key}" updated`,
      });
      return NextResponse.json({ ok: true });
    }

    case "delete": {
      const { key } = body;
      if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
      const deleted = deleteSecret(key);
      if (deleted) {
        await addAuditLog({
          userId: auth!.userId,
          username,
          action: "secret_updated",
          target: key,
          detail: `Secret "${key}" deleted`,
        });
      }
      return NextResponse.json({ ok: deleted });
    }

    case "reveal": {
      const { key } = body;
      if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
      const value = getSecret(key);
      if (!value) return NextResponse.json({ error: "Secret not found" }, { status: 404 });

      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "secret_viewed",
        target: key,
        detail: `Secret "${key}" revealed`,
      });

      return NextResponse.json({ key, masked: maskSecret(value), value });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
