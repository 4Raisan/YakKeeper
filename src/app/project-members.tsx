"use client";
import { useCallback, useEffect, useState } from "react";
import LoadingIndicator from "./loading-indicator";
import { authHeaders } from "@/lib/supabase-browser";
import type { ProjectMember } from "@/lib/project-members";
import type { Project } from "@/lib/hub-types";

export default function ProjectMembers({project,onChange}:{project:Project;onChange:()=>Promise<void>}) {
  const [loading,setLoading]=useState(true);
  const [members,setMembers]=useState<ProjectMember[]>([]);
  const [username,setUsername]=useState("");
  const [found,setFound]=useState<{login:string;github_id:string}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const refresh=useCallback(async()=>{
    const r=await fetch("/api/hub?resource=members&project_id="+project.id,{headers:await authHeaders(),cache:"no-store"});
    const data=await r.json(); if(!r.ok) throw Error(data.error);
    setMembers(data.members);
  },[project.id]);
  useEffect(()=>{let active=true;setLoading(true);void refresh().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[refresh]);
  async function lookup(){
    setBusy(true);setError("");setFound(null);
    try{
      const r=await fetch("/api/hub?resource=githubUser&project_id="+project.id+"&username="+encodeURIComponent(username),{headers:await authHeaders()});
      const data=await r.json(); if(!r.ok) throw Error(data.error); setFound(data);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function change(body:Record<string,unknown>){
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/hub",{method:"POST",headers:{"Content-Type":"application/json",...(await authHeaders())},body:JSON.stringify({...body,project_id:project.id})});
      const data=await r.json();if(!r.ok)throw Error(data.error);
      setFound(null);setUsername("");await refresh();await onChange();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const readonly=project.visibility==="archived";
  return <div className="members-panel">
    <p className="member-note">You own this project. Invite people by GitHub username; they accept in My projects. This does not change GitHub repository access.</p>
    {project.visibility!=="public" && <p className="member-note">Only public listings can invite new members. Choose Invite only to stay visible in Explore while controlling who joins.</p>}
    {!readonly && project.visibility === "public" && <form onSubmit={e=>{e.preventDefault();void lookup();}} className="member-invite-form">
      <label>GitHub username<input value={username} onChange={e=>{setUsername(e.target.value);setFound(null);}} required maxLength={40} disabled={busy || loading} placeholder="username"/></label>
      <button className="small-button" disabled={busy || loading}>Look up account</button>
    </form>}
    {found && <div className="member-preview"><a href={"https://github.com/"+found.login} target="_blank" rel="noreferrer">@{found.login}</a><span>Confirm this is the right person.</span><button className="small-button contribute" disabled={busy} onClick={()=>void change({action:"inviteMember",username:found.login,expected_github_id:found.github_id})}>Send invitation</button></div>}
    {loading && <LoadingIndicator label="Loading members…"/>}
    {busy && <LoadingIndicator label={found ? "Updating members…" : "Checking account or saving changes…"}/>}
    {error && <p className="feedback" role="alert">{error}</p>}
    <div className="member-entry"><strong>@{project.owner_login}</strong><span>Owner</span></div>
    {members.filter(m=>m.status==="active"||m.status==="invited").map(m=><div key={m.id} className="member-entry"><strong>@{m.login}</strong><span>{m.status==="invited"?"Invitation pending":"Member"}</span>{!readonly && <button disabled={busy} className="text-button" onClick={()=>void change({action:"removeMember",id:m.id})}>{m.status==="invited"?"Cancel invitation":"Remove member"}</button>}</div>)}
    {!loading && !error && !members.some(m=>m.status==="active"||m.status==="invited") && <p className="member-note">No members or pending invitations yet.</p>}
  </div>;
}
