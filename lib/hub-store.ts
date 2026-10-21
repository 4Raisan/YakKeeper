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
      async limit(_id:string) { return true; },
    };
  }
 throw new HttpError(503,"Local storage is unavailable.");
}
export async function demoIdentity(_request:Request):Promise<Row|null>{return null;}
export async function demoSession(_userId:string):Promise<string>{throw new HttpError(404,"Local sessions are unavailable.");}
