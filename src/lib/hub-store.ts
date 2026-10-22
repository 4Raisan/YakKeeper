import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { serverDb, check, digest, HttpError } from "./supabase-server.ts";
import {demoAccounts} from "./hub-demo.ts";
export type Row = Record<string, unknown>;
export type Store = {
  find: (table: string, filters?: Row, limit?: number) => Promise<Row[]>;
  save: (table: string, row: Row) => Promise<Row>;
  patch: (table: string, id: string, row: Row) => Promise<void>;
  remove: (table: string, id: string) => Promise<void>;
  limit: (id: string) => Promise<boolean>;
};
export function localEnabled(request: Request) {
  const url = new URL(request.url);
  return (
    process.env.YAKKEEPER_LOCAL_DEMO === "true" &&
    !process.env.VERCEL &&
    !process.env.RENDER &&
    !process.env.RAILWAY_ENVIRONMENT &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    ["127.0.0.1", "localhost"].includes(
      (request.headers.get("host") || url.host).split(":")[0],
    )
  );
}
const connections = new Map<string, DatabaseSync>();
export function localDatabase() {
  const filename = path.resolve(
    /* turbopackIgnore: true */ process.env.YAKKEEPER_LOCAL_DB ||
      ".local/yakkeeper.sqlite",
  );
  let db = connections.get(filename);
  if (!db) {
    mkdirSync(path.dirname(filename), { recursive: true });
    db = new DatabaseSync(filename);
    db.exec(
      `PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS records(collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(collection,id));CREATE UNIQUE INDEX IF NOT EXISTS unique_repo ON records(json_extract(data,'$.repo_id')) WHERE collection='yak_projects';CREATE UNIQUE INDEX IF NOT EXISTS unique_application ON records(json_extract(data,'$.project_id'),json_extract(data,'$.applicant_id')) WHERE collection='yak_interactions' AND json_extract(data,'$.kind')='contribution';CREATE UNIQUE INDEX IF NOT EXISTS unique_block ON records(json_extract(data,'$.owner_id'),json_extract(data,'$.blocked_id')) WHERE collection='yak_blocks';`,
    );
    connections.set(filename, db);
  }
  return db;
}
export function store(local: boolean): Store {
  if (!local) {
    const db = serverDb();
    return {
      async find(table, filters = {}, limit = 100) {
        let q = db.from(table).select("*");
        for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
        return (
          check(
            await q.order("created_at", { ascending: false }).limit(limit),
          ) || []
        );
      },
      async save(table, row) {
        return check(await db.from(table).insert(row).select().single()) as Row;
      },
      async patch(table, id, row) {
        check(await db.from(table).update(row).eq("id", id));
      },
      async remove(table, id) {
        check(await db.from(table).delete().eq("id", id));
      },
      async limit(id) {
        return Boolean(
          check(await db.rpc("yak_limit_submission", { p_id: digest(id) })),
        );
      },
    };
  }
  const db = localDatabase();
  return {
    async find(table, filters = {}, limit = 100) {
      return (
        db
          .prepare("SELECT data FROM records WHERE collection=?")
          .all(table) as { data: string }[]
      )
        .map((r) => JSON.parse(r.data) as Row)
        .filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v))
        .sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || "")),
        )
        .slice(0, limit);
    },
    async save(table, row) {
      const saved = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      };
      try {
        db.prepare("INSERT INTO records VALUES (?,?,?)").run(
          table,
          String(saved.id),
          JSON.stringify(saved),
        );
      } catch {
        throw new HttpError(
          409,
          "This repository or application is already listed.",
        );
      }
      return saved;
    },
    async patch(table, id, row) {
      const existing = db
        .prepare("SELECT data FROM records WHERE collection=? AND id=?")
        .get(table, id) as { data: string } | undefined;
      if (!existing) throw new HttpError(404, "Record not found.");
      db.prepare("UPDATE records SET data=? WHERE collection=? AND id=?").run(
        JSON.stringify({ ...JSON.parse(existing.data), ...row }),
        table,
        id,
      );
    },
    async remove(table, id) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (table === "yak_projects") {
          const record = db.prepare("SELECT data FROM records WHERE collection=? AND id=?").get(table,id) as {data:string}|undefined;
          const project = record ? JSON.parse(record.data) : null;
          if (project?.moderated && project.repo_id) db.prepare("INSERT OR IGNORE INTO records VALUES ('yak_repo_restrictions',?,?)").run(String(project.repo_id),JSON.stringify({id:String(project.repo_id),repo_id:project.repo_id,created_at:new Date().toISOString()}));
          db.prepare("DELETE FROM records WHERE collection IN ('yak_interactions','yak_reports') AND json_extract(data,'$.project_id')=?").run(id);
        }
        db.prepare("DELETE FROM records WHERE collection=? AND id=?").run(table,id);
        db.exec("COMMIT");
      } catch(error) { db.exec("ROLLBACK"); throw error; }
    },
    async limit(id) {
      const key = digest(id + ":" + Math.floor(Date.now() / 3600000));
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          "DELETE FROM records WHERE collection='limits' AND json_extract(data,'$.expires') < ?",
        ).run(Date.now());
        const hit = db
          .prepare(
            "SELECT data FROM records WHERE collection='limits' AND id=?",
          )
          .get(key) as { data: string } | undefined;
        const value = hit
          ? JSON.parse(hit.data)
          : { count: 0, expires: Date.now() + 3600000 };
        value.count++;
        db.prepare("INSERT OR REPLACE INTO records VALUES ('limits',?,?)").run(
          key,
          JSON.stringify(value),
        );
        db.exec("COMMIT");
        return value.count <= 5;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
export const demoUsers = demoAccounts;
export async function demoSession(userId: string) {
  const account = demoUsers.find((u) => u.id === userId);
  if (!account) throw new HttpError(400, "Choose a demo account.");
  const db = store(true);
  if (!(await db.find("yak_profiles", { id: userId })).length)
    await db.save("yak_profiles", {
      ...account,
      email: "",
      avatar_url: "",
      bio: "Local sandbox account. Not GitHub verified.",
      skills: "React, TypeScript",
      availability: "2–4 hours / week",
      timezone: "Asia/Kolkata",
      demo: true,
    });
  const token = randomBytes(32).toString("hex");
  await db.save("sessions", {
    id: digest(token),
    user_id: userId,
    expires: Date.now() + 86400000,
  });
  return token;
}
export async function demoIdentity(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("yk_demo="))
    ?.slice(8);
  if (!token) return null;
  const db = store(true);
  const session = (await db.find("sessions", { id: digest(token) }))[0];
  if (!session || Number(session.expires) < Date.now()) return null;
  return (await db.find("yak_profiles", { id: session.user_id }))[0] || null;
}
