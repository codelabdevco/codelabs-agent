import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  findUser,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  updateUserLastLogin,
  findUserById,
} from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";

const COOKIE_NAME = "fleet_session";
const COOKIE_MAX_AGE = 86400; // 24h

// POST /api/auth — login
export async function POST(req: Request) {
  try {
    const { action, username, password } = await req.json();

    if (action === "login") {
      if (!username || !password) {
        return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
      }

      const user = findUser(username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        await addAuditLog({
          userId: "unknown",
          username: username || "unknown",
          action: "login_failed",
          target: username,
          detail: "Invalid credentials",
          ip: req.headers.get("x-forwarded-for") || "unknown",
        });
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const session = createSession(user.id, user.role);
      updateUserLastLogin(user.id);

      await addAuditLog({
        userId: user.id,
        username: user.username,
        action: "login_success",
        target: user.username,
        detail: `Role: ${user.role}`,
        ip: req.headers.get("x-forwarded-for") || "unknown",
      });

      const res = NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });

      res.cookies.set(COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });

      return res;
    }

    if (action === "logout") {
      const cookieStore = cookies();
      const token = cookieStore.get(COOKIE_NAME)?.value;
      if (token) {
        const session = validateSession(token);
        if (session) {
          const user = findUserById(session.userId);
          await addAuditLog({
            userId: session.userId,
            username: user?.username || "unknown",
            action: "logout",
            target: user?.username || session.userId,
          });
        }
        destroySession(token);
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/auth — get current user (me)
export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = validateSession(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = findUserById(session.userId);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
