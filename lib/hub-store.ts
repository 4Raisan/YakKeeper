import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { serverDb, check, digest, HttpError } from "./supabase-server.ts";
export type Row = Record<string, unknown>;
export type Store = {
  find: (table: string, filters?: Row, limit?: number) => Promise<Row[]>;
  save: (table: string, row: Row) => Promise<Row>;
  patch: (table: string, id: string, row: Row) => Promise<void>;
  remove: (table: string, id: string) => Promise<void>;
  limit: (id: string) => Promise<boolean>;
};
export function localEnabled(_request:Request){return false;}
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
      db.prepare("DELETE FROM records WHERE collection=? AND id=?").run(
        table,
        id,
      );
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
export async function demoIdentity(_request:Request):Promise<Row|null>{return null;}
export async function demoSession(_userId:string):Promise<string>{throw new HttpError(404,"Local sessions are unavailable.");}
