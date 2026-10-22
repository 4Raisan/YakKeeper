import {test} from "node:test";
import assert from "node:assert/strict";
import {notifyAdmin,whatsappConfiguration} from "../lib/hub-whatsapp.ts";

const configured={WHATSAPP_ENABLED:"true",META_WHATSAPP_TOKEN:"fake-test-token",META_PHONE_NUMBER_ID:"123456789",META_GRAPH_VERSION:"v24.0",WHATSAPP_TO:"+94770000000",WHATSAPP_TEMPLATE:"yakkeeper_update",WHATSAPP_LANGUAGE:"en_US",APP_URL:"https://yakkeeper.example"};
test("WhatsApp requires explicit enablement, complete configuration and safe paths",()=>{
  assert.equal(whatsappConfiguration({}).ready,false);
  assert.equal(whatsappConfiguration({...configured,WHATSAPP_ENABLED:"false"}).ready,false);
  assert.equal(whatsappConfiguration(configured).ready,true);
  for(const change of [{META_PHONE_NUMBER_ID:"../other"},{META_GRAPH_VERSION:"v24.0/messages"},{WHATSAPP_TO:"bad"},{WHATSAPP_TEMPLATE:"Bad name"},{APP_URL:"http://public.example"},{WHATSAPP_LANGUAGE:"../../"}]) assert.equal(whatsappConfiguration({...configured,...change}).ready,false);
});
test("WhatsApp sends the approved admin template and distinguishes acceptance from delivery",async t=>{
  let hits=0;let saved="";
  t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL,init?:RequestInit)=>{
    hits++;const request=new Request(input,init);
    assert.equal(request.url,"https://graph.facebook.com/v24.0/123456789/messages");
    assert.equal(request.headers.get("authorization"),"Bearer fake-test-token");
    const body=await request.json();assert.equal(body.to,"94770000000");assert.equal(body.template.name,"yakkeeper_update");
    assert.deepEqual(body.template.components[0].parameters.map((p:{text:string})=>p.text),["contribution","Project one","https://yakkeeper.example/?view=applications"]);
    return Response.json({messages:[{id:"wamid.test"}]});
  });
  const db={patch:async(_table:string,_id:string,row:Record<string,unknown>)=>{saved=String(row.notification);}};
  const result=await notifyAdmin({id:"request",kind:"contribution"},{title:"Project one"},db,configured);
  assert.equal(result,"accepted by Meta (delivery unconfirmed)");assert.equal(saved,result);assert.equal(hits,1);
  await notifyAdmin({id:"request"},{},db,{});assert.equal(hits,1);assert.equal(saved,"disabled");
  await notifyAdmin({id:"request"},{},db,{WHATSAPP_ENABLED:"true"});assert.equal(hits,1);assert.equal(saved,"not configured");
});
test("WhatsApp failures do not undo saved applications or expose provider errors",async t=>{
  let response:Response|Error=Response.json({error:{code:190,message:"secret must not be stored"}},{status:401});
  t.mock.method(globalThis,"fetch",async()=>{if(response instanceof Error) throw response;return response;});
  const db={patch:async()=>{}};
  assert.equal(await notifyAdmin({id:"r",kind:"idea"},{title:"P"},db,configured),"failed (Meta code 190)");
  response=Response.json({});assert.equal(await notifyAdmin({id:"r"},{},db,configured),"failed (invalid Meta response)");
  response=Error("network");assert.equal(await notifyAdmin({id:"r"},{},db,configured),"failed (network or timeout)");
  await assert.doesNotReject(()=>notifyAdmin({id:"r"},{},{patch:async()=>{throw Error("database");}},configured));
});
