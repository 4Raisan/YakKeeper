import { serverDb, check, HttpError } from "./supabase-server.ts";
import { githubProfile } from "./hub-github.ts";
import { demoIdentity, store, type Row } from "./hub-store.ts";
import type { Profile } from "./hub-types.ts";
export async function identity(
  request: Request,
  local: boolean,
): Promise<(Profile & { email?: string }) | null> {
  if (local)
    return (await demoIdentity(request)) as
      (Profile & { email?: string }) | null;
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  const db = serverDb();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "Please sign in again.");
  const connected = user.identities?.find((i) => i.provider === "github");
  // Provider identity is returned by the verified Auth server, never from editable user_metadata.
  const githubId = String(
    connected?.identity_data?.sub ||
      connected?.identity_data?.provider_id ||
      "",
  );
  if (!/^\d+$/.test(githubId))
    throw new HttpError(
      403,
      "Connect your GitHub account to publish or apply.",
    );
  const remote = await githubProfile(githubId);
  if (String(remote.id) !== githubId)
    throw new HttpError(401, "GitHub identity mismatch.");
  let profile = check(
    await db.from("yak_profiles").select("*").eq("id", user.id).maybeSingle(),
  ) as Row | null;
  const identityFields = {
    github_id: githubId,
    github_login: remote.login,
    avatar_url: remote.avatar_url,
    name: remote.name || remote.login,
  };
  if (!profile) {
    const admin = Boolean(
      process.env.OWNER_EMAIL &&
      user.email_confirmed_at &&
      user.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase(),
    );
    const newProfile = {
      id: user.id,
      email: user.email || "",
      role: admin ? "owner" : "collaborator",
      ...identityFields,
      bio: "",
      skills: "",
      availability: "",
      timezone: "Asia/Kolkata",
    };
    check(await db.from("yak_profiles").upsert(newProfile, {onConflict: "id", ignoreDuplicates: true}));
    profile = check(await db.from("yak_profiles").select("*").eq("id",user.id).single()) as Row;
  } else if (
    profile.github_id !== githubId ||
    profile.github_login !== remote.login ||
    profile.avatar_url !== remote.avatar_url
  ) {
    await store(false).patch("yak_profiles", user.id, identityFields);
    profile = { ...profile, ...identityFields };
  }
  return profile as Profile & { email?: string };
}
export function publicProfile(p: Profile) {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    github_id: p.github_id,
    github_login: p.github_login,
    avatar_url: p.avatar_url,
    bio: p.bio || "",
    skills: p.skills || "",
    availability: p.availability || "",
    timezone: p.timezone || "",
    demo: Boolean(p.demo),
  };
}
