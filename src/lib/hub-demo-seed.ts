import {demoAccounts,sampleRepos} from "./hub-demo.ts";
import {blankProject,type Profile} from "./hub-types.ts";
import {repositoryDisplay} from "./hub-github.ts";
import type {Store} from "./hub-store.ts";

// Explicit local-only fixture loader. Never resets or overwrites existing records.
export async function seedDemoWorkspace(db:Store) {
  for(const account of demoAccounts) {
    if(!(await db.find("yak_profiles",{id:account.id})).length) await db.save("yak_profiles",{...account,email:"",avatar_url:"",bio:"Local sandbox account.",skills:"",availability:"",timezone:"",demo:true});
  }
  for(const owner of [demoAccounts[0],demoAccounts[2]]) {
    const profile=(await db.find("yak_profiles",{id:owner.id}))[0] as Profile;
    for(const repo of sampleRepos(profile)) {
      let project=(await db.find("yak_projects",{repo_id:repo.id}))[0];
      if(!project) {
        const {banner_data,banner_url,...defaults}=blankProject;
        project=await db.save("yak_projects",{...defaults,...repositoryDisplay(repo),repo_id:repo.id,owner_id:owner.id,owner_name:owner.name,owner_login:owner.github_login,needs:"Frontend, testing, documentation",repo:"",personal:false,updated_at:new Date().toISOString()});
      }
      for(const applicant of [demoAccounts[1],demoAccounts[3]]) {
        if((await db.find("yak_interactions",{project_id:project.id,applicant_id:applicant.id,kind:"contribution"})).length) continue;
        await db.save("yak_interactions",{project_id:project.id,project_title:project.title,owner_id:owner.id,applicant_id:applicant.id,applicant_login:applicant.github_login,name:applicant.name,kind:"contribution",message:applicant===demoAccounts[1]?"I can improve the documentation and help test the interface.":"I can build frontend components and test the mobile layouts.",email:"",status:"Received",notification:"sandbox (not sent)"});
      }
    }
  }
}
