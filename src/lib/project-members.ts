import { z } from "zod";
import type { Store, Row } from "./hub-store.ts";
import type { Profile } from "./hub-types.ts";
import { HttpError } from "./supabase-server.ts";
import { github } from "./hub-github.ts";
import { demoAccounts } from "./hub-demo.ts";

export type ProjectMember = {id:string;project_id:string;github_id:string;login:string;user_id:string|null;status:"invited"|"active"|"removed"|"declined"};
export type ProjectInvitation = ProjectMember & {project_title:string;owner_login:string};

export async function ownedProject(db: Store, projectId: unknown, user: Profile | null) {
  if (!user) throw new HttpError(401,"Sign in first.");
  const project=(await db.find("yak_projects",{id:z.string().uuid().parse(projectId)},1))[0];
  if (!project || project.owner_id!==user.id) throw new HttpError(403,"Only this project's owner can manage its members.");
  return project;
}
export async function activeMember(db:Store, projectId: unknown, user:Profile) {
  const member=(await db.find("yak_members",{project_id:projectId,github_id:user.github_id,status:"active"},1))[0];
  if (!member) return false;
  const project=(await db.find("yak_projects",{id:projectId},1))[0];
  return Boolean(project && !(await db.find("yak_blocks",{owner_id:project.owner_id,blocked_id:user.id},1)).length);
}
export async function lookupMember(username:unknown,local:boolean) {
  const login=z.string().trim().regex(/^@?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/).parse(username).replace(/^@/,"");
  if (local) {
    const demo=demoAccounts.find(a=>a.github_login.toLowerCase()===login.toLowerCase());
    if (demo) return {github_id:demo.github_id,login:demo.github_login};
  }
  const found=await github<{id:number;login:string;type:string}>("/users/"+login,true);
  if (found.type!=="User" || !Number.isSafeInteger(found.id)) throw new HttpError(400,"Choose a personal GitHub account.");
  return {github_id:String(found.id),login:found.login};
}
export async function memberAction(db:Store,body:Row,user:Profile,local:boolean) {
  if (body.action==="respondInvite") {
    const member=(await db.find("yak_members",{id:z.string().uuid().parse(body.id)},1))[0];
    if (!member || member.github_id!==user.github_id || member.status!=="invited") throw new HttpError(403,"This invitation is not available to your GitHub account.");
    const project=(await db.find("yak_projects",{id:member.project_id},1))[0];
    if (!project || project.visibility!=="public" || project.moderated ||
      (await db.find("yak_blocks",{owner_id:project.owner_id,blocked_id:user.id},1)).length) throw new HttpError(403,"Invitation unavailable.");
    const accept=z.enum(["accept","decline"]).parse(body.decision)==="accept";
    await db.patch("yak_members",String(member.id),{status:accept?"active":"declined",user_id:user.id,login:user.github_login},{status:"invited",github_id:user.github_id});
    return;
  }
  const project=await ownedProject(db,body.project_id,user);
  if (project.visibility==="archived" || project.moderated) throw new HttpError(409,"Archived projects cannot change membership.");
  if (body.action==="inviteMember") {
    if (project.visibility!=="public") throw new HttpError(409,"Make the listing public before inviting members.");
    const found=await lookupMember(body.username,local);
    if (body.expected_github_id!==found.github_id) throw new HttpError(409,"The account changed. Look it up again before inviting.");
    if (found.github_id===user.github_id) throw new HttpError(400,"You already own this project.");
    const profile=(await db.find("yak_profiles",{github_id:found.github_id},1))[0];
    if (profile && (await db.find("yak_blocks",{owner_id:user.id,blocked_id:profile.id},1)).length) throw new HttpError(409,"Unblock this person before inviting them.");
    const existing=(await db.find("yak_members",{project_id:project.id,github_id:found.github_id},1))[0];
    if (existing && ["active","invited"].includes(String(existing.status))) throw new HttpError(409,"This person is already a member or has an invitation.");
    if (!(await db.limit("invite:"+user.id+":"+Math.floor(Date.now()/60000)))) throw new HttpError(429,"Too many invitations. Try again in a minute.");
    const values={project_id:project.id,...found,user_id:profile?.id || null,status:"invited",source_application_id:null};
    if (existing) await db.patch("yak_members",String(existing.id),values);
    else await db.save("yak_members",values);
  } else if (body.action==="removeMember") {
    const member=(await db.find("yak_members",{id:z.string().uuid().parse(body.id),project_id:project.id},1))[0];
    if (!member || member.github_id===user.github_id) throw new HttpError(404,"Member unavailable.");
    if (member.source_application_id) await db.patch("yak_interactions",String(member.source_application_id),{status:"Declined"});
    await db.patch("yak_members",String(member.id),{status:"removed"});
  }
}

// SQLite mirrors the Postgres trigger so both stores have the same contract.
export async function syncApplicationMember(db:Store,row:Row,previous?:Row) {
  if (row.kind!=="contribution") return;
  if (row.status==="Accepted") {
    const profile=(await db.find("yak_profiles",{id:row.applicant_id},1))[0];
    if (!profile?.github_id) return;
    const existing=(await db.find("yak_members",{project_id:row.project_id,github_id:profile.github_id},1))[0];
    const values={project_id:row.project_id,github_id:profile.github_id,login:profile.github_login,user_id:profile.id,status:"active",source_application_id:row.id};
    if (existing) await db.patch("yak_members",String(existing.id),values);
    else await db.save("yak_members",values);
  } else if (previous?.status==="Accepted") {
    for (const m of await db.find("yak_members",{source_application_id:row.id})) await db.patch("yak_members",String(m.id),{status:"removed"});
  }
}
