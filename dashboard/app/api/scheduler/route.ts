import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { findUserById } from "@/lib/auth";
import { addAuditLog } from "@/lib/audit";
import {
  loadTasks,
  addTask,
  updateTask,
  deleteTask,
  getTaskExecutions,
  executeTask,
  describeCron,
} from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// GET — list tasks + optional execution history
export async function GET(req: Request) {
  const { auth, error } = requireAuth("view:agents");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (taskId) {
    const executions = getTaskExecutions(taskId, 30);
    return NextResponse.json({ executions, timestamp: Date.now() });
  }

  const tasks = loadTasks().map((t) => ({
    ...t,
    cronHuman: describeCron(t.cron),
  }));
  return NextResponse.json({ tasks, timestamp: Date.now() });
}

// POST — add/update/delete/run tasks
export async function POST(req: Request) {
  const body = await req.json();

  // Manual run only needs operator permission
  if (body.action === "run") {
    const { auth, error } = requireAuth("action:restart");
    if (error) return error;
    const user = findUserById(auth!.userId);

    try {
      const exec = await executeTask(body.taskId);
      await addAuditLog({
        userId: auth!.userId,
        username: user?.username || "unknown",
        action: "settings_updated",
        target: `task:${body.taskId}`,
        detail: `Manually executed task — status: ${exec.status}`,
      });
      return NextResponse.json({ ok: true, execution: exec });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // All other actions need admin
  const { auth, error } = requireAuth("settings:edit");
  if (error) return error;
  const user = findUserById(auth!.userId);
  const username = user?.username || "unknown";

  switch (body.action) {
    case "add": {
      const task = addTask({
        name: body.name,
        enabled: body.enabled ?? true,
        agentId: body.agentId,
        cron: body.cron,
        cronDescription: describeCron(body.cron),
        message: body.message,
        systemPromptOverride: body.systemPromptOverride,
        createdBy: username,
      });
      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "settings_updated",
        target: `task:${task.id}`,
        detail: `Created scheduled task "${task.name}" [${task.cron}] → ${task.agentId}`,
      });
      return NextResponse.json({ ok: true, task });
    }

    case "update": {
      const updated = updateTask(body.id, body.updates);
      if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      await addAuditLog({
        userId: auth!.userId,
        username,
        action: "settings_updated",
        target: `task:${body.id}`,
        detail: `Updated task "${updated.name}"`,
      });
      return NextResponse.json({ ok: true, task: updated });
    }

    case "delete": {
      const deleted = deleteTask(body.id);
      if (deleted) {
        await addAuditLog({
          userId: auth!.userId,
          username,
          action: "settings_updated",
          target: `task:${body.id}`,
          detail: "Deleted scheduled task",
        });
      }
      return NextResponse.json({ ok: deleted });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
