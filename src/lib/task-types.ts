import { z } from "zod";

export const taskStatuses = ["Future", "Ongoing", "Finished"] as const;
export const taskInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(""),
  status: z.enum(taskStatuses).default("Future"),
});
export type Task = {
  id: string;
  project_id: string;
  author_id: string;
  archived: boolean;
  title: string;
  description: string;
  status: typeof taskStatuses[number];
  created_at: string;
  updated_at: string;
};
export type TaskWorker = { id: string; task_id: string; user_id: string; login: string };
export type TaskBoardState = { tasks: Task[]; workers: TaskWorker[]; hasMore?: boolean };
