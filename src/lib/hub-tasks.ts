import { z } from "zod";
import type { Profile } from "./hub-types.ts";
import type { Store, Row } from "./hub-store.ts";
import { HttpError } from "./supabase-server.ts";
import { taskInput, taskStatuses } from "./task-types.ts";

export async function boardAccess(db: Store, projectId: string, user: Profile | null) {
  if (!user) throw new HttpError(401, "Sign in to view the project board.");
  const project = (await db.find("yak_projects", {id: z.string().uuid().parse(projectId)}, 1))[0];
  if (!project) throw new HttpError(404, "Project unavailable.");
  if (project.owner_id === user.id) return project;
  const member = project.visibility === "public" && !project.moderated &&
    (await db.find("yak_interactions", {project_id: project.id, applicant_id: user.id,
      kind: "contribution", status: "Accepted"}, 1)).length > 0;
  const blocked = (await db.find("yak_blocks", {owner_id: project.owner_id, blocked_id: user.id}, 1)).length > 0;
  if (!member || blocked) throw new HttpError(403, "Only the owner and accepted project members can use this board.");
  return project;
}

export async function readBoard(db: Store, projectId: string, user: Profile | null) {
  await boardAccess(db, projectId, user);
  const tasks = await db.find("yak_tasks", {project_id: projectId}, 201);
  if (tasks.length > 200) throw new HttpError(409, "This board exceeds the 200-task limit. Contact the project owner.");
  const workers = tasks.length ? await db.find("yak_task_workers", {task_id: tasks.map(t => t.id)}, 2001) : [];
  if (workers.length > 2000) throw new HttpError(409, "This board has too many task participants.");
  return {tasks, workers};
}

export async function changeTask(db: Store, body: Row, user: Profile) {
  const projectId = z.string().uuid().parse(body.project_id);
  const project = await boardAccess(db, projectId, user);
  if (project.visibility === "archived" || project.moderated)
    throw new HttpError(409, "Archived project boards are read-only.");
  if (body.action === "createTask") {
    const input = taskInput.parse(body.task);
    if ((await db.find("yak_tasks", {project_id: projectId}, 200)).length >= 200)
      throw new HttpError(409, "A project board can contain up to 200 tasks.");
    if (!(await db.limit("task-create:" + user.id + ":" + Math.floor(Date.now() / 60000)))) throw new HttpError(429, "Task creation limit reached. Try again in a minute.");
    await db.save("yak_tasks", {...input, project_id: projectId, author_id: user.id, updated_at: new Date().toISOString()});
    return;
  }
  const id = z.string().uuid().parse(body.id);
  const task = (await db.find("yak_tasks", {id, project_id: projectId}, 1))[0];
  if (!task) throw new HttpError(404, "Task unavailable.");
  if (body.action === "taskStatus") {
    await db.patch("yak_tasks", id, {status: z.enum(taskStatuses).parse(body.status), updated_at: new Date().toISOString()});
  } else if (body.action === "workOnTask") {
    const working = z.boolean().parse(body.working);
    if (task.status === "Finished" && working) throw new HttpError(409, "Reopen the task before joining it.");
    const current = (await db.find("yak_task_workers", {task_id: id, user_id: user.id}, 1))[0];
    if (working && !current) {
      try { await db.save("yak_task_workers", {task_id: id, user_id: user.id, login: user.github_login}); }
      catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
    }
    if (!working && current) await db.remove("yak_task_workers", String(current.id));
  } else throw new HttpError(400, "Unknown task action.");
}
