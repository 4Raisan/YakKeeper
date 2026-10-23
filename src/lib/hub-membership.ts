import type { HubRequest, Project } from "./hub-types.ts";

export function joinedProjectIds(sent: HubRequest[], userId?: string) {
  return new Set(sent.filter(r =>
    Boolean(userId) && r.applicant_id === userId &&
    r.kind === "contribution" && r.status === "Accepted",
  ).map(r => r.project_id));
}

export function isMyProject(project: Project, userId: string | undefined, joined: Set<string>) {
  return Boolean(userId) && (project.owner_id === userId ||
    (project.visibility === "public" && joined.has(project.id)));
}
