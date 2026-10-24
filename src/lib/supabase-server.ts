import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function serverDb() {
  if (!configured())
    throw new HttpError(503, "Supabase server configuration is incomplete.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) {
    const code = (result.error as { code?: string }).code;
    if (code === "23505")
      throw new HttpError(
        409,
        "This repository or application is already listed.",
      );
    if (code === "23514") throw new HttpError(409,"Project limit reached. Archive a task before adding or restoring more.");
    throw new HttpError(
      503,
      "Database unavailable or schema upgrade required.",
    );
  }
  return result.data;
}
