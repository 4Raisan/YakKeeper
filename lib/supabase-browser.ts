import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let browserClient:SupabaseClient|null=null;
export function browserAuth(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 return browserClient??=createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
export async function authHeaders():Promise<Record<string,string>>{
 const session=await browserAuth()?.auth.getSession();
 return session?.data.session?{Authorization:`Bearer ${session.data.session.access_token}`} : {};
}
