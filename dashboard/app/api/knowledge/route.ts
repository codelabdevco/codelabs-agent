import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import {
  listKnowledge, getKnowledge, addKnowledge, updateKnowledge,
  deleteKnowledge, getCategories, getAllTags,
} from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { auth, error } = requireAuth("view:agents");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const entry = getKnowledge(id);
    return entry
      ? NextResponse.json({ entry })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = listKnowledge({
    category: searchParams.get("category") || undefined,
    tag: searchParams.get("tag") || undefined,
    search: searchParams.get("q") || undefined,
    agentId: searchParams.get("agentId") || undefined,
    limit: parseInt(searchParams.get("limit") || "100", 10),
  });
  const categories = getCategories();
  const tags = getAllTags();

  return NextResponse.json({ entries, categories, tags, timestamp: Date.now() });
}

export async function POST(req: Request) {
  const { auth, error } = requireAuth("action:chat");
  if (error) return error;

  const body = await req.json();
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  switch (body.action) {
    case "add": {
      const entry = addKnowledge({
        key: body.key,
        category: body.category || "general",
        title: body.title,
        content: body.content,
        tags: body.tags || [],
        sourceAgent: body.sourceAgent || "dashboard",
        sharedWith: body.sharedWith || [],
        updatedBy: username,
      });
      await addAuditLog({
        userId: auth!.userId, username,
        action: "settings_updated",
        target: `kb:${entry.id}`,
        detail: `Added KB entry "${entry.title}" [${entry.category}]`,
      });
      return NextResponse.json({ ok: true, entry });
    }
    case "update": {
      const updated = updateKnowledge(body.id, { ...body.updates, updatedBy: username });
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true, entry: updated });
    }
    case "delete": {
      const ok = deleteKnowledge(body.id);
      return NextResponse.json({ ok });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
