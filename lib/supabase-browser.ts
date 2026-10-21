import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let browserClient:SupabaseClient|null=null;
// Keep the YakKeeper session and PKCE verifier, but do not persist GitHub provider tokens.
export function sanitizeAuthStorage(value:string){return value;}
export function browserAuth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(typeof window==='undefined'||!url||!key)return null;
 return browserClient??=createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:{getItem(name){const value=localStorage.getItem(name);if(!value)return value;const sanitized=sanitizeAuthStorage(value);if(sanitized!==value)localStorage.setItem(name,sanitized);return sanitized;},setItem(name,value){localStorage.setItem(name,sanitizeAuthStorage(value));},removeItem(name){localStorage.removeItem(name);}}}});
}
export async function authHeaders():Promise<Record<string,string>>{const session=await browserAuth()?.auth.getSession();return session?.data.session?{Authorization:`Bearer ${session.data.session.access_token}`}:{ };}
