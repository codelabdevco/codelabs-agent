import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth";
import { hasPermission } from "@/lib/auth-types";
import type { Role } from "@/lib/auth-types";

export interface AuthContext {
  userId: string;
  role: Role;
  username?: string;
}

/**
 * Check auth from the cookie in API routes.
 * Returns AuthContext or null if not authenticated.
 */
export function getAuthFromRequest(): AuthContext | null {
  const cookieStore = cookies();
  const token = cookieStore.get("fleet_session")?.value;
  if (!token) return null;

  const session = validateSession(token);
  if (!session) return null;

  return {
    userId: session.userId,
    role: session.role,
  };
}

/**
 * Require authentication + optional permission check.
 * Returns { auth } or { error: NextResponse }.
 */
export function requireAuth(permission?: string): {
  auth?: AuthContext;
  error?: Response;
} {
  const auth = getAuthFromRequest();

  if (!auth) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  if (permission && !hasPermission(auth.role, permission)) {
    return {
      error: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { auth };
}
