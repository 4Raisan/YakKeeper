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
import { publicRepos, ownedRepo, github, repositoryDisplay } from "../../../lib/hub-github.ts";
import { sampleRepos } from "../../../lib/hub-demo.ts";
import type { Repo } from "../../../lib/hub-types.ts";
import { withBanners, saveBanner, removeBanner } from "../../../lib/hub-banners.ts";
import {notifyAdmin} from "../../../lib/hub-whatsapp.ts";
import {seedDemoWorkspace} from "../../../lib/hub-demo-seed.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function boundedJson(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 210000)
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
      if (size > 210000) { await reader.cancel(); throw new HttpError(413, "Request too large."); }
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
    const inbox = user
      ? await db.find("yak_interactions", { owner_id: user.id })
      : [];
    const sent = user
      ? await db.find("yak_interactions", { applicant_id: user.id })
      : [];
    const blocks = user
      ? await db.find("yak_blocks", { owner_id: user.id })
      : [];
    const reports = user?.role === "owner" ? await db.find("yak_reports") : [];
    return reply({
      configured: true,
      mode: local ? "local" : "live",
      projects: await withBanners(projects,local),
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
    if (body.action === "demoLogin") {
      if (!local) throw new HttpError(404, "Local sandbox is disabled.");
      const token = await demoSession(z.string().uuid().parse(body.user_id));
      return reply({ ok: true }, 200, {
        "Set-Cookie": `yk_demo=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
      });
    }
    if (body.action === "demoLogout") {
      if (!local) throw new HttpError(404, "Local sandbox is disabled.");
      const token = request.headers
        .get("cookie")
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("yk_demo="))
        ?.slice(8);
      if (token) await store(true).remove("sessions", digest(token));
      return reply({ ok: true }, 200, {
        "Set-Cookie": "yk_demo=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    if (body.action === "demoSeed") {
      if (!local) throw new HttpError(404,"Local sandbox is disabled.");
      await seedDemoWorkspace(store(true));
      return reply({ok:true});
    }
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
    if (body.action === "deleteProject") {
      const id = z.string().uuid().parse(body.id);
      const project = (await db.find("yak_projects",{id},1))[0];
      if (!project || project.owner_id !== user.id)
        throw new HttpError(403,"You can only delete your own YakKeeper projects.");
      if (body.confirm !== true) throw new HttpError(400,"Confirm deletion before continuing.");
      await db.remove("yak_projects",id);
      if (project.banner_path) await removeBanner(String(project.banner_path),local);
      return reply({ok:true});
    }
    if (body.action === "saveProject") {
      const {banner_data,...input} = projectSchema.parse(body.project);
      let existing: Row | undefined;
      if (body.id) {
        existing = (
          await db.find("yak_projects", {
            id: z.string().uuid().parse(body.id),
          })
        )[0];
        if (!existing || existing.owner_id !== user.id)
          throw new HttpError(403, "You can only edit your own projects.");
        if (existing.moderated && input.visibility === "public")
          throw new HttpError(403, "This listing was archived by a moderator.");
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
      let newBanner: string | undefined;
      if (typeof banner_data === "string") {
        if (!(await db.limit("banner:" + user.id))) throw new HttpError(429,"Hourly banner upload limit reached.");
        newBanner = await saveBanner(banner_data,user.id,local);
      }
      const data = {
        ...input,
        ...repositoryDisplay(repo),
        repo: repo.html_url,
        owner_name: user.name,
        owner_login: user.github_login,
        updated_at: new Date().toISOString(),
        personal: false,
        ...(banner_data !== undefined ? {banner_path:newBanner || ""} : {}),
      };
      try {
        if (existing) await db.patch("yak_projects", String(existing.id), data);
        else await db.save("yak_projects", { ...data, owner_id: user.id });
      } catch (error) {
        if (newBanner) await removeBanner(newBanner,local);
        throw error;
      }
      if (banner_data !== undefined && existing?.banner_path) await removeBanner(String(existing.banner_path),local);
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
      if (project.owner_id === user.id)
        throw new HttpError(400, "You cannot apply to your own project.");
      if (!project.contributions_open || project.status !== "In progress")
        throw new HttpError(409, "This project is not accepting requests.");
      if (
        (
          await db.find("yak_blocks", {
            owner_id: project.owner_id,
            blocked_id: user.id,
          })
        ).length
      )
        throw new HttpError(
          403,
          "This project is not accepting your requests.",
        );
      if (!(await db.limit("submit:" + user.id)))
        throw new HttpError(429, "Hourly request limit reached.");
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
        notification: local ? "sandbox (not sent)" : "in-app only",
      });
      if (
        !local &&
        project.owner_id ===
          (await db.find("yak_profiles", { role: "owner" }))[0]?.id
      )
        await notifyAdmin(saved, project, db);
      return reply({ ok: true });
    }
    if (body.action === "status") {
      const record = (
        await db.find("yak_interactions", {
          id: z.string().uuid().parse(body.id),
        })
      )[0];
      if (!record || record.owner_id !== user.id)
        throw new HttpError(
          403,
          "Only this project’s owner can review the application.",
        );
      await db.patch("yak_interactions", String(record.id), {
        status: statusSchema.parse(body.status),
      });
      return reply({ ok: true });
    }
    if (body.action === "block") {
      const blocked = z.string().uuid().parse(body.user_id);
      if (blocked === user.id) throw new HttpError(400, "Invalid account.");
      const existing = (
        await db.find("yak_blocks", { owner_id: user.id, blocked_id: blocked })
      )[0];
      if (existing) await db.remove("yak_blocks", String(existing.id));
      else
        await db.save("yak_blocks", { owner_id: user.id, blocked_id: blocked });
      return reply({ ok: true });
    }
    if (body.action === "report") {
      const project_id = z.string().uuid().parse(body.project_id),
        reason = z.string().trim().min(10).max(1000).parse(body.reason);
      if (
        !(
          await db.find("yak_projects", {
            id: project_id,
            visibility: "public",
          })
        ).length
      )
        throw new HttpError(404, "Project unavailable.");
      if (!(await db.limit("report:" + user.id)))
        throw new HttpError(429, "Report limit reached.");
      await db.save("yak_reports", {
        project_id,
        reporter_id: user.id,
        reason,
        status: "Open",
      });
      return reply({ ok: true });
    }
    if (body.action === "moderate") {
      if (user.role !== "owner")
        throw new HttpError(403, "Administrator access required.");
      const report = (
        await db.find("yak_reports", { id: z.string().uuid().parse(body.id) })
      )[0];
      if (!report) throw new HttpError(404, "Report not found.");
      const decision = z.enum(["Dismissed", "Archived"]).parse(body.decision);
      if (decision === "Archived")
        await db.patch("yak_projects", String(report.project_id), {
          visibility: "archived",
          moderated: true,
        });
      await db.patch("yak_reports", String(report.id), { status: decision });
      return reply({ ok: true });
    }
    throw new HttpError(400, "Unknown action.");
  } catch (e) {
    return failure(e);
  }
}
