import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {configured,serverDb,identity,check,digest,HttpError} from '../../../lib/supabase-server.ts';
import {projectSchema,submissionSchema,statusSchema} from '../../../lib/hub-types.ts';
import {sameOrigin,requestOrigin} from '../../../lib/hub-security.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function failure(error:unknown){if(error instanceof z.ZodError)return reply({error:error.issues[0]?.message||'Invalid input.'},400);if(error instanceof HttpError)return reply({error:error.message},error.status);if(error instanceof SyntaxError)return reply({error:'Invalid request.'},400);return reply({error:'Could not save. Please retry.'},500);}
export async function GET(request:Request){
 if(!configured())return reply({configured:false,projects:[],user:null,inbox:[],invites:[],whatsapp:false});
 try{
  const db=serverDb(),user=await identity(request);
  // Fetch public and owned records independently; never interpolate a user identifier into a filter.
  const publicProjects=check(await db.from('yak_projects').select('*').eq('visibility','public').order('updated_at',{ascending:false}))||[];
  let projects=publicProjects;
  if(user?.role==='owner')projects=check(await db.from('yak_projects').select('*').order('updated_at',{ascending:false}))||[];
  else if(user?.role==='collaborator'){
   const owned=check(await db.from('yak_projects').select('*').eq('owner_id',user.id))||[];
   projects=[...new Map([...publicProjects,...owned].map(p=>[p.id,p])).values()].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
  }
  let inbox:unknown[]=[],invites:unknown[]=[];
  if(user&&user.role!=='visitor'){
   let query=db.from('yak_interactions').select('*').order('created_at',{ascending:false});
   if(user.role!=='owner')query=query.eq('owner_id',user.id);
   inbox=check(await query)||[];
  }
  if(user?.role==='owner')invites=check(await db.from('yak_invitations').select('id,email,expires_at,used_by').order('created_at',{ascending:false}))||[];
  return reply({configured:true,projects,user:user?{id:user.id,name:user.name,role:user.role}:null,inbox,invites,whatsapp:user?.role==='owner'&&whatsappConfigured()});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))throw new HttpError(403,'Request origin not allowed.');
  if(!configured())throw new HttpError(503,'Database is not connected yet.');
  if(Number(request.headers.get('content-length')||0)>20000)throw new HttpError(413,'Submission is too large.');
  const raw=await request.text();if(raw.length>20000)throw new HttpError(413,'Submission is too large.');
  const body=JSON.parse(raw),db=serverDb(),user=await identity(request);
  if(body.action==='submit'){
   const input=submissionSchema.parse(body);
   const project=check(await db.from('yak_projects').select('id,owner_id,title').eq('id',input.project_id).eq('visibility','public').maybeSingle());
   if(!project)throw new HttpError(404,'Project unavailable.');
   const address=request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||request.headers.get('x-forwarded-for')?.split(',')[0].trim()||(process.env.NODE_ENV==='development'?'127.0.0.1':null);
   if(!address&&!user)throw new HttpError(429,'Connection could not be verified. Please sign in.');
   const allowed=check(await db.rpc('yak_limit_submission',{p_id:digest(`${address||user!.id}:${Math.floor(Date.now()/3600000)}`)}));
   if(!allowed)throw new HttpError(429,'Hourly submission limit reached. Try again later.');
   const record=check(await db.from('yak_interactions').insert({project_id:project.id,owner_id:project.owner_id,kind:input.kind,name:input.name,email:input.email,message:input.message}).select('id').single());
   const {data:owner}=await db.from('yak_profiles').select('role').eq('id',project.owner_id).single();
   if(owner?.role==='owner'&&whatsappConfigured()){
    let state='failed';
    try{
     const response=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${process.env.META_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.META_WHATSAPP_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({messaging_product:'whatsapp',to:process.env.WHATSAPP_TO,type:'template',template:{name:process.env.WHATSAPP_TEMPLATE,language:{code:process.env.WHATSAPP_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:input.kind==='idea'?'idea':'contribution request'},{type:'text',text:project.title},{type:'text',text:new URL('/?view=inbox',requestOrigin(request)!).href}]}]}})});
     state=response.ok?'accepted by Meta':'failed';
    }catch{/* The request remains in the inbox even if Meta is unavailable. */}
    await db.from('yak_interactions').update({notification:state}).eq('id',record!.id);
   }
   return reply({ok:true});
  }
  if(!user)throw new HttpError(401,'Sign in to continue.');
  if(body.action==='activate'){
   if(user.role!=='visitor')throw new HttpError(409,'Publishing access is already active.');
   const token=z.string().trim().min(20).max(100).parse(body.token);
   const used=check(await db.rpc('yak_use_invitation',{p_hash:digest(token),p_user_id:user.id,p_email:user.email,p_name:user.name}));
   if(!used)throw new HttpError(403,'Invalid, expired, or wrong-email invitation.');
   return reply({ok:true});
  }
  if(user.role==='visitor')throw new HttpError(403,'Publishing requires an invitation.');
  if(body.action==='saveProject'){
   const input=projectSchema.parse(body.project);
   if(body.id){
    const id=z.string().uuid().parse(body.id);
    const existing=check(await db.from('yak_projects').select('owner_id').eq('id',id).maybeSingle());
    if(!existing)throw new HttpError(404,'Project not found.');
    if(existing.owner_id!==user.id&&user.role!=='owner')throw new HttpError(403,'You can only edit your own projects.');
    check(await db.from('yak_projects').update({...input,updated_at:new Date().toISOString()}).eq('id',id));
   }else check(await db.from('yak_projects').insert({...input,owner_id:user.id,owner_name:user.name,personal:user.role==='owner'}));
   return reply({ok:true});
  }
  if(body.action==='status'){
   const id=z.string().uuid().parse(body.id),status=statusSchema.parse(body.status);
   const record=check(await db.from('yak_interactions').select('owner_id').eq('id',id).maybeSingle());
   if(!record||(record.owner_id!==user.id&&user.role!=='owner'))throw new HttpError(404,'Request not found.');
   check(await db.from('yak_interactions').update({status}).eq('id',id));return reply({ok:true});
  }
  if(user.role!=='owner')throw new HttpError(403,'Owner access required.');
  if(body.action==='invite'){
   const email=z.string().trim().email().max(254).parse(body.email).toLowerCase();
   const token=randomBytes(24).toString('hex');
   check(await db.from('yak_invitations').insert({email,hash:digest(token),expires_at:new Date(Date.now()+7*86400000).toISOString()}));
   return reply({ok:true,token});
  }
  if(body.action==='revoke'){
   check(await db.from('yak_invitations').delete().eq('id',z.string().uuid().parse(body.id)).is('used_by',null));return reply({ok:true});
  }
  throw new HttpError(400,'Unknown action.');
 }catch(error){return failure(error);}
}
function whatsappConfigured(){return Boolean(process.env.META_WHATSAPP_TOKEN&&process.env.META_PHONE_NUMBER_ID&&process.env.WHATSAPP_TO&&process.env.WHATSAPP_TEMPLATE&&/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||''));}
