import type { Profile, Repo } from "./hub-types.ts";
export const demoAccounts = [
  {id:"11111111-1111-4111-8111-111111111111",name:"4Raisan",github_login:"4Raisan",github_id:"demo-raisan",role:"owner"},
  {id:"22222222-2222-4222-8222-222222222222",name:"Asha · demo",github_login:"asha-demo",github_id:"demo-asha",role:"collaborator"},
  {id:"33333333-3333-4333-8333-333333333333",name:"Maya · demo",github_login:"maya-demo",github_id:"demo-maya",role:"collaborator"},
  {id:"44444444-4444-4444-8444-444444444444",name:"Dev · demo",github_login:"dev-demo",github_id:"demo-dev",role:"collaborator"},
] as const;
export function sampleRepos(user: Profile): Repo[] {
  const index=Math.max(0,demoAccounts.findIndex(account=>account.github_login===user.github_login));
  return [0,1].map(offset=>({
      id: 900000001 + index + offset*100,
      name: offset ? "side-project-sandbox" : index===0 ? "yakkeeper-sandbox" : "study-buddy-sandbox",
      full_name: user.github_login + (offset ? "/side-project-sandbox" : "/local-example"),
      description: "A sample repository for trying the local publishing flow.",
      language: "TypeScript",
      html_url: "",
      homepage: "",
      owner: { id: 0, login: user.github_login },
      fork: false,
      archived: false,
      private: false,
    }));
}
