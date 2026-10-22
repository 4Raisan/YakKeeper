import { z } from "zod";
export type Profile = {
  id: string;
  name: string;
  role: "owner" | "collaborator" | "visitor";
  github_id: string;
  github_login: string;
  avatar_url: string;
  bio: string;
  skills: string;
  availability: string;
  timezone: string;
  demo?: boolean;
};
export type Project = {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_login: string;
  repo_id: number;
  title: string;
  summary: string;
  description: string;
  category: string;
  status: string;
  tags: string;
  needs: string;
  roadmap: string;
  repo: string;
  demo: string;
  visibility: string;
  contributions_open: boolean;
  beginner_friendly: boolean;
  time_commitment: string;
  banner_path?: string;
  banner_url?: string;
  updated_at: string;
  created_at: string;
};
export type HubRequest = {
  id: string;
  project_id: string;
  project_title: string;
  owner_id: string;
  applicant_id: string;
  applicant_login: string;
  name: string;
  kind: "idea" | "contribution";
  message: string;
  status: string;
  notification: string;
  created_at: string;
};
export type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string;
  language: string;
  html_url: string;
  homepage: string;
  owner: { id: number; login: string };
  fork: boolean;
  archived: boolean;
  private: boolean;
};
export type Report = {
  id: string;
  project_id: string;
  reason: string;
  status: string;
  created_at: string;
};
export type HubState = {
  configured: boolean;
  mode: "local" | "live" | "unconfigured";
  projects: Project[];
  user: Profile | null;
  inbox: HubRequest[];
  sent: HubRequest[];
  reports: Report[];
  blocks: string[];
  hasMore: boolean;
};
export const blankProject = {
  repo_id: 0,
  title: "",
  summary: "",
  description: "",
  category: "Web apps",
  status: "In progress",
  tags: "",
  needs: "",
  roadmap: "",
  demo: "",
  visibility: "public",
  contributions_open: true,
  beginner_friendly: true,
  banner_url: "",
  banner_data: undefined as string | null | undefined,
};
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (!v) return true;
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Use an HTTP(S) URL.");
export const projectCategories = [
  "Software", "Websites", "Web apps", "Mobile apps", "APIs & backend",
  "Tools", "Developer tools", "Automation", "AI & research", "Machine learning",
  "Data & analytics", "Cloud & DevOps", "Games", "Documentation", "Design", "Other",
] as const;
export const projectSchema = z.object({
  repo_id: z.number().int().positive(),
  category: z.enum(projectCategories),
  status: z.enum(["In progress", "Completed", "Paused"]),
  needs: z.string().trim().max(1000).default(""),
  roadmap: z.string().trim().max(3000),
  demo: url,
  visibility: z.enum(["public", "private", "archived"]),
  contributions_open: z.boolean(),
  beginner_friendly: z.boolean(),
  banner_data: z.string().max(180000).nullable().optional(),
});
export const submissionSchema = z.object({
  project_id: z.string().uuid(),
  kind: z.enum(["idea", "contribution"]),
  message: z.string().trim().min(20).max(4000),
  website: z.string().max(0),
});
export const statusSchema = z.enum([
  "Received",
  "Reviewing",
  "Accepted",
  "Declined",
]);
export const profileSchema = z.object({
  bio: z.string().trim().max(500),
  skills: z.string().trim().max(200),
  availability: z.string().trim().max(100),
  timezone: z.string().trim().max(80),
});
