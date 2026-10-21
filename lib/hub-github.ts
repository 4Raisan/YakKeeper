import { HttpError } from "./supabase-server.ts";
import type { Repo } from "./hub-types.ts";
const cache = new Map<string, { expires: number; value: unknown }>();
export async function github<T>(path: string, fresh = false): Promise<T> {
  if (
    !/^\/(user\/\d+|users\/[a-zA-Z0-9-]+\/repos\?[^#]+|repositories\/\d+)$/.test(
      path,
    )
  )
    throw new HttpError(400, "Invalid GitHub resource.");
  const hit = cache.get(path);

  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "YakKeeper",
    },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 404 ? 404 : 503,
      response.status === 403 || response.status === 429
        ? "GitHub is rate limited. Please try again later."
        : "GitHub could not load this public resource.",
    );
  const value = await response.json();
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(path, { expires: Date.now() + 300000, value });
  return value as T;
}
export async function githubProfile(id: string) {
  if (!/^\d+$/.test(id))
    throw new HttpError(401, "Reconnect your GitHub account.");
  return github<{
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  }>("/user/" + id);
}
export async function publicRepos(login: string, page: number) {
  return (
    await github<Repo[]>(
      `/users/${login}/repos?type=owner&sort=updated&per_page=30&page=${page}`,
    )
  ).filter((r) => !r.private);
}
export async function ownedRepo(repoId: number, githubId: string) {
  const repo = await github<Repo>("/repositories/" + repoId, true);
  if (repo.private || String(repo.owner.id) !== githubId)
    throw new HttpError(
      403,
      "Select a public repository owned by your connected GitHub account.",
    );
  return repo;
}
