import { z } from "zod";
import { configured, HttpError, digest } from "../../../lib/supabase-server.ts";
import {
  projectSchema,
  submissionSchema,
  statusSchema,
  profileSchema,
  type Project,
  type Profile,
} from "../../../lib/hub-types.ts";
import { sameOrigin } from "../../../lib/hub-security.ts";
import {
  localEnabled,
  store,
  demoSession,
  type Row,
} from "../../../lib/hub-store.ts";
import { identity, publicProfile } from "../../../lib/hub-auth.ts";
import { publicRepos, ownedRepo, github } from "../../../lib/hub-github.ts";
function sampleRepos(_user:Profile):Repo[]{return [];}
import type { Repo } from "../../../lib/hub-types.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function boundedJson(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 24000)
    throw new HttpError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 24000) { await reader.cancel(); throw new HttpError(413, "Request too large."); }
      text += decoder.decode(chunk.value, {stream: true});
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
const reply = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
function failure(e: unknown) {
  if (e instanceof z.ZodError)
    return reply({ error: e.issues[0]?.message || "Invalid input." }, 400);
  if (e instanceof HttpError) return reply({ error: e.message }, e.status);
  if (e instanceof SyntaxError)
    return reply({ error: "Invalid request." }, 400);
  console.error(
    "YakKeeper request failed:",
    e instanceof Error ? e.message : "unknown",
  );
  return reply(
    { error: "Could not complete the request. Please try again." },
    500,
  );
}
function application(row: Row) {
  const {
    id,
    project_id,
    project_title,
    owner_id,
    applicant_id,
    applicant_login,
    name,
    kind,
    message,
    status,
    notification,
    created_at,
  } = row;
  return {
    id,
    project_id,
    project_title,
    owner_id,
    applicant_id,
    applicant_login,
    name,
    kind,
    message,
    status,
    notification,
    created_at,
  };
}
export async function GET(request: Request) {
  try {
    const local = localEnabled(request);
    if (!local && !configured())
      return reply({
        configured: false,
        mode: "unconfigured",
        projects: [],
        user: null,
        inbox: [],
        sent: [],
        reports: [],
        blocks: [],
        hasMore: false,
      });
    const db = store(local),
      user = await identity(request, local),
      url = new URL(request.url);
    if (url.searchParams.get("resource") === "repos") {
      if (!user) throw new HttpError(401, "Sign in with GitHub first.");
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .parse(url.searchParams.get("page") || 1);
      let repos: Repo[] = [];
      let warning = "";
      try {
        repos = await publicRepos(user.github_login, page);
      } catch (e) {
        if (!local) throw e;
        warning =
          "GitHub is unavailable. The sandbox example is still available.";
      }
      const visible = repos.filter((r) => !r.archived);
      return reply({
        repos:
          local && page === 1 ? [...sampleRepos(user), ...visible] : visible,
        hasMore: repos.length === 30,
        warning,
      });
    }
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .parse(url.searchParams.get("page") || 1);
    const all = await db.find(
      "yak_projects",
      { visibility: "public" },
      page * 24 + 1,
    );
    const mine = user
      ? await db.find("yak_projects", { owner_id: user.id })
      : [];
    const projects = [
      ...new Map(
        [...all.slice(0, page * 24), ...mine].map((p) => [p.id, p]),
      ).values(),
    ] as Project[];
    const inbox = [] as Row[];
    const sent = [] as Row[];
    const blocks = [] as Row[];
    const reports = [] as Row[];
    return reply({
      configured: true,
      mode: local ? "local" : "live",
      projects,
      user: user ? publicProfile(user) : null,
      inbox: inbox.map(application),
      sent: sent.map(application),
      reports,
      blocks: blocks.map((b) => b.blocked_id),
      hasMore: all.length > page * 24,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      throw new HttpError(403, "Request origin not allowed.");
    const body = await boundedJson(request);
    const local = localEnabled(request);


    if (!local && !configured())
      throw new HttpError(503, "Server configuration is incomplete.");
    const db = store(local),
      user = await identity(request, local);
    if (!user) throw new HttpError(401, "Sign in with GitHub to continue.");
    if (body.action === "profile") {
      await db.patch(
        "yak_profiles",
        user.id,
        profileSchema.parse(body.profile),
      );
      return reply({ ok: true });
    }
    if (body.action === "saveProject") {
      const input = projectSchema.parse(body.project);
      let existing: Row | undefined;
      if (body.id) {
        existing = (
          await db.find("yak_projects", {
            id: z.string().uuid().parse(body.id),
          })
        )[0];
        if (!existing || existing.owner_id !== user.id)
          throw new HttpError(403, "You can only edit your own projects.");

        if (existing.repo_id !== input.repo_id)
          throw new HttpError(
            400,
            "The connected repository cannot be changed.",
          );
      }
      let repo: Repo;
      const sample = local
        ? sampleRepos(user).find((r) => r.id === input.repo_id)
        : undefined;
      if (sample) repo = sample;
      else if (local) {
        repo = await github<Repo>("/repositories/" + input.repo_id);
        if (
          repo.private ||
          repo.owner.login.toLowerCase() !== user.github_login.toLowerCase()
        )
          throw new HttpError(
            403,
            "Choose one of this demo account’s public repositories.",
          );
      } else repo = await ownedRepo(input.repo_id, user.github_id);
      if (repo.archived)
        throw new HttpError(400, "Archived repositories cannot be published.");
      const data = {
        ...input,
        repo: repo.html_url,
        owner_name: user.name,
        owner_login: user.github_login,
        updated_at: new Date().toISOString(),
        personal: false,
      };
      if (existing) await db.patch("yak_projects", String(existing.id), data);
      else await db.save("yak_projects", { ...data, owner_id: user.id });
      return reply({ ok: true });
    }
    if (body.action === "submit") {
      const input = submissionSchema.parse(body);
      const project = (
        await db.find("yak_projects", {
          id: input.project_id,
          visibility: "public",
        })
      )[0];
      if (!project) throw new HttpError(404, "Project unavailable.");



      const saved = await db.save("yak_interactions", {
        project_id: project.id,
        project_title: project.title,
        owner_id: project.owner_id,
        applicant_id: user.id,
        applicant_login: user.github_login,
        kind: input.kind,
        name: user.name,
        email: "",
        message: input.message,
        status: "Received",
        notification: "not configured",
      });

      return reply({ ok: true });
    }




    throw new HttpError(400, "Unknown action.");
  } catch (e) {
    return failure(e);
  }
}
