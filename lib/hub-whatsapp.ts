import type {Row,Store} from "./hub-store.ts";

type Environment = Record<string,string|undefined>;
export function whatsappConfiguration(env: Environment = process.env) {
  const required=["META_WHATSAPP_TOKEN","META_PHONE_NUMBER_ID","META_GRAPH_VERSION","WHATSAPP_TO","WHATSAPP_TEMPLATE","APP_URL"];
  const missing=required.filter(key=>!env[key]?.trim());
  const invalid:string[]=[];
  if (env.META_PHONE_NUMBER_ID && !/^\d{5,30}$/.test(env.META_PHONE_NUMBER_ID)) invalid.push("META_PHONE_NUMBER_ID");
  if (env.WHATSAPP_TO && !/^\+?[1-9]\d{7,14}$/.test(env.WHATSAPP_TO)) invalid.push("WHATSAPP_TO");
  if (env.META_GRAPH_VERSION && !/^v\d{1,3}\.\d+$/.test(env.META_GRAPH_VERSION)) invalid.push("META_GRAPH_VERSION");
  if (env.WHATSAPP_TEMPLATE && !/^[a-z0-9_]{1,512}$/.test(env.WHATSAPP_TEMPLATE)) invalid.push("WHATSAPP_TEMPLATE");
  if (env.WHATSAPP_LANGUAGE && !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(env.WHATSAPP_LANGUAGE)) invalid.push("WHATSAPP_LANGUAGE");
  if (env.APP_URL) {
    try { const url=new URL(env.APP_URL); if(url.protocol!=="https:" || url.username || url.password) invalid.push("APP_URL"); }
    catch { invalid.push("APP_URL"); }
  }
  const enabled=env.WHATSAPP_ENABLED==="true";
  return {enabled,ready:enabled && !missing.length && !invalid.length,missing,invalid};
}

// Route calls this only for submissions to the administrator's projects.
// Meta acceptance is not a delivery receipt. No automatic retries: avoid duplicates.
export async function notifyAdmin(record: Row,project: Row,db: Pick<Store,"patch">,env:Environment=process.env) {
  const config=whatsappConfiguration(env);
  let notification=!config.enabled ? "disabled" : config.missing.length ? "not configured" : config.invalid.length ? "invalid configuration" : "failed";
  if (config.ready) {
    try {
      const response=await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`,{
        method:"POST",
        headers:{Authorization:"Bearer "+env.META_WHATSAPP_TOKEN,"Content-Type":"application/json"},
        signal:AbortSignal.timeout(8000),
        body:JSON.stringify({messaging_product:"whatsapp",to:env.WHATSAPP_TO!.replace(/^\+/,""),type:"template",template:{
          name:env.WHATSAPP_TEMPLATE,language:{code:env.WHATSAPP_LANGUAGE || "en_US"},
          components:[{type:"body",parameters:[
            {type:"text",text:String(record.kind)},
            {type:"text",text:String(project.title)},
            {type:"text",text:new URL("/?view=applications",env.APP_URL).href},
          ]}],
        }}),
      });
      const result=await response.json().catch(()=>null);
      if(response.ok && typeof result?.messages?.[0]?.id==="string") notification="accepted by Meta (delivery unconfirmed)";
      else if(Number.isInteger(result?.error?.code)) notification="failed (Meta code "+result.error.code+")";
      else notification="failed (invalid Meta response)";
    } catch { notification="failed (network or timeout)"; }
  }
  // A notification problem must never turn an already-saved application into an error.
  try { await db.patch("yak_interactions",String(record.id),{notification}); }
  catch { console.warn("WhatsApp alert status could not be saved."); }
  return notification;
}
