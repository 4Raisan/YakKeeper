import type { Profile, Repo } from "./hub-types.ts";
export function sampleRepos(user: Profile): Repo[] {
  return [
    {
      id: user.github_login === "4Raisan" ? 900000001 : 900000002,
      name:
        user.github_login === "4Raisan"
          ? "yakkeeper-sandbox"
          : "study-buddy-sandbox",
      full_name: user.github_login + "/local-example",
      description: "A sample repository for trying the local publishing flow.",
      language: "TypeScript",
      html_url: "",
      homepage: "",
      owner: { id: 0, login: user.github_login },
      fork: false,
      archived: false,
      private: false,
    },
  ];
}
