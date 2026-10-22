import { randomUUID } from "node:crypto";
import { serverDb, HttpError } from "./supabase-server.ts";
import { store } from "./hub-store.ts";
import type { Project } from "./hub-types.ts";

const bucket = "project-banners";
export const MAX_BANNER_BYTES = 128 * 1024;

export function decodeBanner(value: string) {
  if (!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new HttpError(400, "Choose a PNG, JPEG or WebP image.");
  const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  if (bytes.length > MAX_BANNER_BYTES)
    throw new HttpError(413, "Banner is too large. Choose a smaller image.");
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WEBP" ||
      !["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16)) ||
      bytes.readUInt32LE(4) !== bytes.length - 8)
    throw new HttpError(400, "The banner is not a valid WebP image.");
  return bytes;
}

export async function saveBanner(value: string, userId: string, local: boolean) {
  const bytes = decodeBanner(value);
  const path = `${userId}/${randomUUID()}.webp`;
  if (local) await store(true).save("yak_banners", {id:path, data:value});
  else {
    const {error} = await serverDb().storage.from(bucket).upload(path, bytes, {contentType:"image/webp", upsert:false});
    if (error) throw new HttpError(503, "Could not upload the banner. Please try again.");
  }
  return path;
}

export async function removeBanner(path: string, local: boolean) {
  try {
    if (local) await store(true).remove("yak_banners", path);
    else {
      const {error} = await serverDb().storage.from(bucket).remove([path]);
      if (error) throw error;
    }
  } catch { console.warn("Unused project banner cleanup failed."); }
}

// Called only after public/owner listing access has been checked by the route.
export async function withBanners(projects: Project[], local: boolean): Promise<Project[]> {
  const paths = projects.map(p => p.banner_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string,string>();
  if (paths.length && local) {
    for (const path of paths) {
      const row = (await store(true).find("yak_banners", {id:path},1))[0];
      if (row) urls.set(path,String(row.data));
    }
  } else if (paths.length) {
    const {data,error} = await serverDb().storage.from(bucket).createSignedUrls(paths,3600);
    if (!error) {
      for (const item of data || []) if (item.path && item.signedUrl) urls.set(item.path,item.signedUrl);
    } else console.warn("Project banners are temporarily unavailable.");
  }
  return projects.map(({banner_path,...p}) => ({...p,banner_url:urls.get(banner_path || "") || ""}));
}
