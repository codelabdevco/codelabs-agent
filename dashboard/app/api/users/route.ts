import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { listUsers, createUser, deleteUser, findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import type { Role } from "@/lib/auth-types";

export const dynamic = "force-dynamic";

// GET /api/users — list all users (admin only)
export async function GET() {
  const { auth, error } = requireAuth("users:manage");
  if (error) return error;

  const users = listUsers();
  return NextResponse.json({ users, timestamp: Date.now() });
}

// POST /api/users — create or delete user
export async function POST(req: Request) {
  const { auth, error } = requireAuth("users:manage");
  if (error) return error;

  const body = await req.json();
  const { action } = body;
  const admin = findUserById(auth!.userId);
  const adminName = admin?.username || "unknown";

  if (action === "create") {
    const { username, displayName, password, role } = body;
    if (!username || !password || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!["admin", "operator", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    try {
      const user = createUser(username, displayName || username, password, role as Role);
      await addAuditLog({
        userId: auth!.userId,
        username: adminName,
        action: "user_created",
        target: username,
        detail: `Role: ${role}`,
      });
      return NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  if (action === "delete") {
    const { userId } = body;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (userId === auth!.userId) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }
    const target = findUserById(userId);
    const deleted = deleteUser(userId);
    if (deleted) {
      await addAuditLog({
        userId: auth!.userId,
        username: adminName,
        action: "user_deleted",
        target: target?.username || userId,
      });
    }
    return NextResponse.json({ ok: deleted });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
