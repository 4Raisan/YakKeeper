import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
export function configured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&process.env.OWNER_EMAIL);}
export function serverDb(){
 if(!configured())throw new HttpError(503,'Database is not connected.');
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
}
export class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export function digest(value:string){return createHash('sha256').update(value).digest('hex');}
export function check<T>(result:{data:T;error:unknown}):T {if(result.error)throw new HttpError(503,'Database request failed. Please try again.');return result.data;}
export async function identity(request:Request){
 const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');
 if(!token)return null;
 const db=serverDb();
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user?.email||!user.email_confirmed_at)throw new HttpError(401,'Please sign in again.');
 let profile=check(await db.from('yak_profiles').select('*').eq('id',user.id).maybeSingle());
 if(!profile&&user.email.toLowerCase()===process.env.OWNER_EMAIL!.toLowerCase()){
   const owner=check(await db.from('yak_profiles').select('id').eq('role','owner').maybeSingle());
   if(!owner)profile=check(await db.from('yak_profiles').upsert({id:user.id,email:user.email,name:'4Raisan',role:'owner'},{onConflict:'id'}).select().single());
 }
 return {id:user.id,email:user.email,name:profile?.name||user.user_metadata.full_name||user.email.split('@')[0],role:profile?.role||'visitor'};
}
