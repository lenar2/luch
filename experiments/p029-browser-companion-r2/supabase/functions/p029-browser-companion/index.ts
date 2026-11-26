import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { z } from "npm:zod@^4.3.6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTH_ISSUER = Deno.env.get("MCP_AUTH_ISSUER") || `${SUPABASE_URL}/auth/v1`;
const MCP_RESOURCE = Deno.env.get("MCP_RESOURCE_URL") || "https://api.lenarsalimov.ru/luch/browser/mcp";
const FUNCTION_NAME = "p029-browser-companion";
const MAX_RESULT_BYTES = 900_000;
const ONLINE_MS = 90_000;
const JOB_WAIT_MS = 55_000;
const JOB_POLL_MS = 250;
const DEVICE_TOKEN_BYTES = 32;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { "X-LUCH-Service": FUNCTION_NAME } },
});

const READ_OPS = new Set([
  "read_text","inspect_page","get_links","get_headings","get_forms","get_tables",
  "get_selection","query_elements","find_text","accessibility_snapshot","hit_test",
  "get_element","scroll_position","screenshot","tab_info","window_info","list_open_tabs",,
 "get_document_info","get_viewport","get_images","get_media","get_buttons","get_inputs","get_labels","get_attributes","get_computed_style","get_rect","get_visibility","get_form_values","get_element_state","get_ancestors","get_descendants","get_shadow_elements","get_iframes","get_dom_statistics","get_selected_html","get_performance","get_resources","get_active_element","list_windows","get_zoom","get_tab_language","get_tab_details","get_browser_capabilities","downloads_list","wait_for_url","wait_for_load"
]);
const INTERACT_OPS = new Set([
  "focus","hover","scroll_into_view","scroll","scroll_to","fill","insert_text",
  "type_text","select_option","check_element","click","click_at","double_click",
  "click_accessible","navigate","reload","back","forward","activate_tab","close_tab",
  "new_tab","new_window","window_set",,
 "blur","clear_field","append_text","insert_at_cursor","select_text","set_selection_range","toggle_details","open_details","close_details","submit_form","reset_form","scroll_element","scroll_element_to","set_range_value","duplicate_tab","pin_tab","unpin_tab","mute_tab","unmute_tab","move_tab","discard_tab","set_zoom","press_key","key_chord","download_url"
]);
const POINTER_OPS = new Set(["pointer_move","pointer_click","pointer_double_click","pointer_drag","pointer_wheel"]);
const ALL_OPS = new Set([...READ_OPS, ...INTERACT_OPS, ...POINTER_OPS]);
const POINTER_SCOPE = new Set(POINTER_OPS);

const title = (op:string) => ({
  read_text:"Read page text", inspect_page:"Inspect page", get_links:"Get links",
  get_headings:"Get headings", get_forms:"Get forms", get_tables:"Get tables",
  get_selection:"Get selected text", query_elements:"Query elements", find_text:"Find text",
  accessibility_snapshot:"Accessibility snapshot", hit_test:"Hit test", get_element:"Get element",
  scroll_position:"Read scroll position", screenshot:"Take screenshot", tab_info:"Read tab info",
  window_info:"Read window info", list_open_tabs:"List open tabs",
  focus:"Focus element", hover:"Hover element", scroll_into_view:"Scroll element into view",
  scroll:"Scroll page", scroll_to:"Scroll to position", fill:"Fill field", insert_text:"Insert text",
  type_text:"Type text", select_option:"Select option", check_element:"Check element",
  click:"Click element", click_at:"Click coordinates", double_click:"Double click",
  click_accessible:"Click accessible element", navigate:"Navigate tab", reload:"Reload tab",
  back:"Go back", forward:"Go forward", activate_tab:"Activate tab", close_tab:"Close tab",
  new_tab:"Open new tab", new_window:"Open new window", window_set:"Set window",
  pointer_move:"Move precise pointer", pointer_click:"Precise pointer click",
  pointer_double_click:"Precise double click", pointer_drag:"Precise pointer drag",
  pointer_wheel:"Precise pointer wheel",
}[op] || op);

const field = {
  targetId: z.string().min(1).max(200),
  deviceId: z.string().uuid().optional(),
  selector: z.string().min(1).max(500),
  text: z.string().max(10_000),
  url: z.string().url().max(2048),
  value: z.string().max(500),
  checked: z.boolean(),
  x: z.number().finite(),
  y: z.number().finite(),
  dx: z.number().finite(),
  dy: z.number().finite(),
  toX: z.number().finite(),
  toY: z.number().finite(),
  deltaX: z.number().finite(),
  deltaY: z.number().finite(),
  left: z.number().int().min(-100000).max(100000),
  top: z.number().int().min(-100000).max(100000),
  width: z.number().int().min(100).max(100000),
  height: z.number().int().min(100).max(100000),
  key: z.string().min(1).max(30),
  modifiers: z.number().int().min(0).max(15),
  filename: z.string().min(1).max(160),
  index: z.number().int().min(0).max(10000),
  windowId: z.number().int().min(0),
  factor: z.number().min(0.25).max(5),
  timeoutMs: z.number().int().min(50).max(40000),
  start: z.number().int().min(0).max(1000000),
  end: z.number().int().min(0).max(1000000),
  query: z.string().min(1).max(200),
  properties: z.array(z.string().max(80)).max(40),

};

function schemaFor(op:string) {
  const shape:Record<string,unknown> = { deviceId: field.deviceId };
  if (op !== "list_open_tabs") shape.targetId = field.targetId;
  const add=(name:keyof typeof field, required=false)=>{ shape[name]=required?field[name]:field[name].optional(); };
  switch(op) {
    case "read_text": case "get_element": case "focus": case "hover": case "scroll_into_view":
    case "query_elements": case "click": case "double_click": case "click_accessible":
      add("selector", true); break;
    case "fill": case "insert_text": case "type_text":
      add("selector", true); add("text", true); break;
    case "find_text": add("text", true); break;
    case "hit_test": case "click_at": add("x", true); add("y", true); break;
    case "scroll": add("dx"); add("dy"); break;
    case "scroll_to": add("x"); add("y"); break;
    case "select_option": add("selector",true);add("value",true);break;
    case "check_element": add("selector",true);add("checked",true);break;
    case "navigate": add("url", true); break;
    case "new_tab": case "new_window": add("url", true); break;
    case "window_set": add("left"); add("top"); add("width"); add("height"); break;
    case "get_attributes": case "get_rect": case "get_visibility":
    case "get_form_values": case "get_element_state": case "get_ancestors": case "get_descendants":
    case "blur": case "clear_field": case "select_text": case "toggle_details":
    case "open_details": case "close_details": case "submit_form": case "reset_form":
      add("selector", true); break;
    case "append_text": case "insert_at_cursor":
      add("selector",true);add("text",true);break;
    case "set_selection_range":
      add("selector",true);add("start",true);add("end",true);break;
    case "scroll_element": case "scroll_element_to":
      add("selector",true);add("dx");add("dy");add("x");add("y");break;
    case "get_computed_style":add("selector",true);add("properties");break;
    case "get_shadow_elements": add("query");break;
    case "wait_for_url": case "download_url": add("url",true);add("timeoutMs");add("filename");break;
    case "wait_for_load":add("timeoutMs");break;
    case "press_key": case "key_chord":add("key",true);add("modifiers");break;
    case "move_tab":add("index",true);add("windowId");break;
    case "set_zoom":add("factor",true);break;
    case "set_range_value":add("selector",true);add("value",true);break;
    case "pointer_move": case "pointer_click": case "pointer_double_click": add("x", true); add("y", true); break;
    case "pointer_drag": add("x", true); add("y", true); add("toX", true); add("toY", true); break;
    case "pointer_wheel": add("x", true); add("y", true); add("deltaX"); add("deltaY"); break;
  }
  return shape as any;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,content-type,accept",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data:unknown,status=200,extra:Record<string,string>={}) {
  const h = new Headers(corsHeaders);
  h.set("Content-Type","application/json");
  for (const [k,v] of Object.entries(extra)) h.set(k,v);
  return new Response(JSON.stringify(data),{status,headers:h});
}
function nowIso(){ return new Date().toISOString(); }
function bytes(s:string){ return new TextEncoder().encode(s).byteLength; }
async function sha256Hex(value:string) {
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function randomToken() {
  const b=new Uint8Array(DEVICE_TOKEN_BYTES); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function pairingCode() {
  const b=new Uint8Array(4); crypto.getRandomValues(b);
  const n=new DataView(b.buffer).getUint32(0) % 100_000_000;
  return String(n).padStart(8,"0");
}
function redactedUrl(value:string|null|undefined) {
  try { const u=new URL(String(value||"")); if(!["http:","https:"].includes(u.protocol)) return null; u.search="";u.hash=""; return u.href.slice(0,2048); } catch { return null; }
}
function origin(value:string|null|undefined) {
  try { const u=new URL(String(value||"")); return ["http:","https:"].includes(u.protocol)?u.origin:null; } catch { return null; }
}
function safeJson(value:unknown) {
  try { const s=JSON.stringify(value); if(bytes(s)>MAX_RESULT_BYTES) throw new Error("RESULT_TOO_LARGE"); return value; }
  catch { throw new Error("RESULT_TOO_LARGE"); }
}
function deviceToken(req:Request) {
  const h=req.headers.get("authorization")||"";
  return h.startsWith("Bearer ")?h.slice(7).trim():null;
}
async function getUserId(supabase:any) {
  const {data,error}=await supabase.auth.getUser();
  if(error || !data?.user) throw new Error("AUTHENTICATED_USER_REQUIRED");
  return data.user.id as string;
}
async function deviceByToken(token:string|null) {
  if(!token) return null;
  const hash=await sha256Hex(token);
  const {data,error}=await admin.from("p029_browser_devices")
    .select("id,user_id,device_name,browser,extension_version,status,last_seen_at,created_at")
    .eq("token_hash",hash).maybeSingle();
  if(error || !data || data.status!=="active") return null;
  return data;
}
function online(device:any) {
  return !!device?.last_seen_at && Date.now()-new Date(device.last_seen_at).getTime() <= ONLINE_MS;
}
async function touchDevice(deviceId:string) {
  await admin.from("p029_browser_devices").update({last_seen_at:nowIso()}).eq("id",deviceId).eq("status","active");
}
async function chooseDevice(userId:string,deviceId?:string,requireOnline=true) {
  let q=admin.from("p029_browser_devices").select("id,user_id,device_name,browser,extension_version,status,last_seen_at,created_at")
    .eq("user_id",userId).eq("status","active").order("created_at",{ascending:false});
  if(deviceId) q=q.eq("id",deviceId);
  const {data,error}=await q;
  if(error) throw new Error("DEVICE_LOOKUP_FAILED");
  if(deviceId) {
    const d=data?.[0]; if(!d) throw new Error("DEVICE_NOT_FOUND");
    if(requireOnline&&!online(d)) throw new Error("BROWSER_COMPANION_OFFLINE");
    return d;
  }
  const active=(data||[]).filter((d:any)=>!requireOnline||online(d));
  if(active.length===1) return active[0];
  if(active.length===0) throw new Error("BROWSER_COMPANION_OFFLINE");
  throw new Error("MULTIPLE_COMPANIONS_SELECT_DEVICE");
}
async function audit(userId:string,deviceId:string|null,tool:string,op:string|null,targetOrigin:string|null,outcome:string) {
  await admin.from("p029_browser_audit_events").insert({user_id:userId,device_id:deviceId,tool_name:tool,op,target_origin:targetOrigin,outcome}).then(()=>{});
}
async function currentGrant(userId:string,deviceId:string,targetId:string) {
  const m=/^ext:(\d+):([A-Za-z0-9_-]+)$/.exec(targetId||"");
  if(!m) throw new Error("INVALID_TARGET_ID");
  const tabId=Number(m[1]),grantId=m[2];
  const {data,error}=await admin.from("p029_browser_grants")
    .select("id,device_id,tab_id,grant_id,origin,url_redacted,title,scope,precise_cursor,updated_at")
    .eq("user_id",userId).eq("device_id",deviceId).eq("tab_id",tabId).eq("grant_id",grantId).maybeSingle();
  if(error||!data) throw new Error("TAB_GRANT_NOT_FOUND");
  return data;
}
async function validateTarget(userId:string,device:any,op:string,args:any) {
  if(op==="list_open_tabs") {
    const {data,error}=await admin.from("p029_browser_tab_overviews").select("enabled,tabs,updated_at").eq("user_id",userId).eq("device_id",device.id).maybeSingle();
    if(error||!data?.enabled) throw new Error("ALL_TABS_USER_APPROVAL_REQUIRED");
    return null;
  }
  if(typeof args.targetId!=="string") throw new Error("TARGET_ID_REQUIRED");
  const g=await currentGrant(userId,device.id,args.targetId);
  if(READ_OPS.has(op) && g.scope!=="read" && g.scope!=="interact") throw new Error("READ_APPROVAL_REQUIRED");
  if(INTERACT_OPS.has(op) && g.scope!=="interact") throw new Error("INTERACTION_APPROVAL_REQUIRED");
  if(POINTER_SCOPE.has(op) && (!g.precise_cursor || g.scope!=="interact")) throw new Error("PRECISE_CURSOR_APPROVAL_REQUIRED");
  return g;
}
async function enqueueAndWait(userId:string,device:any,toolName:string,op:string,args:any,grant:any) {
  const {data,error}=await admin.from("p029_browser_jobs").insert({
    user_id:userId,device_id:device.id,tool_name:toolName,op,target_id:args.targetId||null,args,
    expires_at:new Date(Date.now()+120_000).toISOString()
  }).select("id").single();
  if(error||!data) throw new Error("BROWSER_JOB_CREATE_FAILED");
  const jobId=data.id as string;
  try {
    const deadline=Date.now()+JOB_WAIT_MS;
    while(Date.now()<deadline) {
      const {data:job,error:e}=await admin.from("p029_browser_jobs")
        .select("status,result,error,completed_at").eq("id",jobId).eq("user_id",userId).maybeSingle();
      if(e) throw new Error("BROWSER_JOB_READ_FAILED");
      if(job?.status==="completed") return safeJson(job.result||{ok:true});
      if(job?.status==="failed"||job?.status==="expired"||job?.status==="cancelled") throw new Error(job.error||"BROWSER_JOB_FAILED");
      await new Promise(r=>setTimeout(r,JOB_POLL_MS));
    }
    await admin.from("p029_browser_jobs").update({status:"expired",error:"BROWSER_JOB_TIMEOUT",completed_at:nowIso()})
      .eq("id",jobId).eq("user_id",userId).in("status",["pending","claimed"]);
    throw new Error("BROWSER_JOB_TIMEOUT");
  } finally {
    // Keep only a tiny audit trail; result payloads are cleared after the MCP call.
    await admin.from("p029_browser_jobs").update({result:null}).eq("id",jobId).eq("user_id",userId);
  }
}
function toolResult(result:any) {
  if(!result?.ok) return {content:[{type:"text",text:String(result?.error||"BROWSER_ACTION_FAILED")}],isError:true};
  const data=result.data ?? result;
  if(data?.dataUrl && typeof data.dataUrl==="string" && data.dataUrl.startsWith("data:image/")) {
    const m=/^data:(image\/[^;]+);base64,(.+)$/.exec(data.dataUrl);
    if(m) {
      return {
        content:[
          {type:"image",data:m[2],mimeType:m[1]},
          {type:"text",text:JSON.stringify({...data,dataUrl:"[image returned as MCP image content]"}).slice(0,12000)}
        ]
      };
    }
  }
  return {content:[{type:"text",text:typeof data==="string"?data:JSON.stringify(data).slice(0,100000)}]};
}

function userMcpServer(userId:string) {
  const server=new McpServer({name:"LUCH Browser Companion",version:"0.7.0"});
  server.registerTool("browser_companion_status",{
    title:"Browser Companion status",
    description:"Show the signed-in user's paired LUCH Browser Companion devices and online state. Does not expose page contents.",
    inputSchema:z.object({}),
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async()=> {
    const {data,error}=await admin.from("p029_browser_devices").select("id,device_name,browser,extension_version,status,last_seen_at,created_at").eq("user_id",userId).order("created_at",{ascending:false});
    if(error) throw new Error("DEVICE_LOOKUP_FAILED");
    return {content:[{type:"text",text:JSON.stringify((data||[]).map((d:any)=>({...d,online:d.status==="active"&&online(d)})))}]};
  });
  server.registerTool("browser_companion_pairing_create",{
    title:"Create Browser Companion pairing code",
    description:"Create a one-time 8-digit code to pair this signed-in LUCH account with the Chrome/Opera Browser Companion extension. The code expires in 10 minutes and can be used once.",
    inputSchema:z.object({deviceName:z.string().min(1).max(80).default("LUCH Browser Companion")}),
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
  },async({deviceName})=>{
    const since=new Date(Date.now()-60_000).toISOString();
    const {count}=await admin.from("p029_browser_pairings").select("id",{count:"exact",head:true}).eq("user_id",userId).gte("created_at",since).is("used_at",null);
    if((count||0)>=3) throw new Error("PAIRING_RATE_LIMIT");
    const code=pairingCode(),hash=await sha256Hex(code);
    const {error}=await admin.from("p029_browser_pairings").insert({user_id:userId,code_hash:hash,device_name:deviceName,expires_at:new Date(Date.now()+600_000).toISOString()});
    if(error) throw new Error("PAIRING_CREATE_FAILED");
    return {content:[{type:"text",text:JSON.stringify({code,expiresInSeconds:600,instructions:"Open LUCH Browser Companion in Chrome/Opera and enter this code. The code is one-time and never returned again."})}]};
  });
  server.registerTool("browser_companion_devices",{
    title:"List Browser Companion devices",
    description:"List only the signed-in user's paired browser devices.",
    inputSchema:z.object({}),
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async()=>{
    const {data,error}=await admin.from("p029_browser_devices").select("id,device_name,browser,extension_version,status,last_seen_at,created_at").eq("user_id",userId).order("created_at",{ascending:false});
    if(error) throw new Error("DEVICE_LOOKUP_FAILED");
    return {content:[{type:"text",text:JSON.stringify((data||[]).map((d:any)=>({...d,online:d.status==="active"&&online(d)})))}]};
  });
  server.registerTool("browser_companion_revoke_device",{
    title:"Revoke Browser Companion device",
    description:"Immediately revoke one of this user's paired Browser Companion devices and cancel its queued jobs. The extension token becomes unusable.",
    inputSchema:z.object({deviceId:z.string().uuid()}),
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},
  },async({deviceId})=>{
    const {data,error}=await admin.from("p029_browser_devices").update({status:"revoked",revoked_at:nowIso()}).eq("id",deviceId).eq("user_id",userId).select("id").maybeSingle();
    if(error||!data) throw new Error("DEVICE_NOT_FOUND");
    await admin.from("p029_browser_grants").delete().eq("device_id",deviceId).eq("user_id",userId);
    await admin.from("p029_browser_tab_overviews").delete().eq("device_id",deviceId).eq("user_id",userId);
    await admin.from("p029_browser_jobs").update({status:"cancelled",error:"DEVICE_REVOKED",completed_at:nowIso()}).eq("device_id",deviceId).eq("user_id",userId).in("status",["pending","claimed"]);
    return {content:[{type:"text",text:JSON.stringify({ok:true,deviceId})}]};
  });
  server.registerTool("browser_list_approved_tabs",{
    title:"List my approved browser tabs",
    description:"List only tabs already explicitly approved in the LUCH Browser Companion extension, including targetId for subsequent reads. No all-tabs permission is requested or needed. Other open tabs remain private.",
    inputSchema:z.object({deviceId:z.string().uuid().optional()}),
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async({deviceId})=>{
    const device=await chooseDevice(userId,deviceId,true);
    const {data,error}=await admin.from("p029_browser_grants")
      .select("tab_id,grant_id,origin,url_redacted,title,scope,precise_cursor,updated_at")
      .eq("user_id",userId).eq("device_id",device.id).order("updated_at",{ascending:false}).limit(500);
    if(error) throw new Error("APPROVED_TABS_LOOKUP_FAILED");
    const tabs=(data||[]).filter((g:any)=>g.origin&&["read","interact"].includes(g.scope))
      .map((g:any)=>({
        targetId:`ext:${g.tab_id}:${g.grant_id}`,
        title:String(g.title||"").slice(0,180),
        url:redactedUrl(g.url_redacted),
        scope:g.scope,
        preciseCursor:g.precise_cursor===true,
      }));
    return {content:[{type:"text",text:JSON.stringify({deviceId:device.id,tabs,onlyApprovedTabs:true})}]};
  });
  server.registerTool("browser_list_open_tabs",{
    title:"List open browser tabs",
    description:"List open HTTP(S) tabs from the user's explicitly enabled tab overview. This returns metadata only, not page contents. The extension must have the separate 'share all tabs' permission enabled.",
    inputSchema:z.object({deviceId:z.string().uuid().optional()}),
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async({deviceId})=>{
    const device=await chooseDevice(userId,deviceId,true);
    const {data,error}=await admin.from("p029_browser_tab_overviews").select("enabled,tabs,updated_at").eq("user_id",userId).eq("device_id",device.id).maybeSingle();
    if(error||!data?.enabled) throw new Error("ALL_TABS_USER_APPROVAL_REQUIRED");
    const grants=await admin.from("p029_browser_grants").select("tab_id,grant_id,origin,title,scope,precise_cursor").eq("user_id",userId).eq("device_id",device.id);
    const grantMap=new Map((grants.data||[]).map((g:any)=>[String(g.tab_id),g]));
    const tabs=(Array.isArray(data.tabs)?data.tabs:[]).map((t:any)=>({...t,grant:grantMap.get(String(t.id))?{targetId:`ext:${t.id}:${grantMap.get(String(t.id)).grant_id}`,scope:grantMap.get(String(t.id)).scope,preciseCursor:grantMap.get(String(t.id)).precise_cursor}:null}));
    return {content:[{type:"text",text:JSON.stringify({device:{id:device.id,name:device.device_name,browser:device.browser},updatedAt:data.updated_at,tabs})}]};
  });

  const browserToolOps=[...ALL_OPS].filter((x)=>x!=="list_open_tabs");
  for(const op of browserToolOps) {
    const toolName=`browser_${op}`;
    const description=`${title(op)} in a tab the user explicitly approved in the LUCH Browser Companion extension. Find target IDs with browser_list_approved_tabs (no all-tabs access needed). Read requires the tab's Read grant; interaction requires a separate Interaction grant; precise pointer actions require additional per-tab cursor permission. Never assume a target or ask for all-tabs metadata as a workaround.`;
    const readOnly=READ_OPS.has(op);
    server.registerTool(toolName,{
      title:title(op),
      description,
      inputSchema:schemaFor(op),
      annotations:{readOnlyHint:readOnly,destructiveHint:["close_tab","navigate","new_window","window_set"].includes(op),idempotentHint:["read_text","inspect_page","get_links","get_headings","get_forms","get_tables","get_selection","query_elements","find_text","accessibility_snapshot","hit_test","get_element","scroll_position","tab_info","window_info","list_open_tabs","reload","back","forward"].includes(op),openWorldHint:["navigate","new_tab","new_window","click","click_at","click_accessible","pointer_click","pointer_double_click","pointer_drag"].includes(op)}
    },async(args:any)=>{
      const device=await chooseDevice(userId,args.deviceId,true);
      const grant=await validateTarget(userId,device,op,args);
      const result=await enqueueAndWait(userId,device,toolName,op,args,grant);
      await audit(userId,device.id,toolName,op,grant?.origin||null,"completed").catch(()=>{});
      return toolResult(result) as any;
    });
  }
  return server;
}

const mcpFetch = pipeline(
  [
    withOAuthProtectedResource({resourceServer:MCP_RESOURCE,authorizationServer:AUTH_ISSUER}),
    withSupabase({auth:"user"}),
  ],
  async (_req,{supabase}) => {
    const userId=await getUserId(supabase);
    const handler=createMcpHandler(()=>userMcpServer(userId));
    return handler.fetch(_req);
  },
);

async function extensionHandler(req:Request) {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  const token=deviceToken(req);
  const device=await deviceByToken(token);
  const url=new URL(req.url);
  const path=url.pathname;
  if(path.endsWith("/health")) {
    if(!device) return json({ok:true,paired:false});
    await touchDevice(device.id);
    return json({ok:true,paired:true,device:{id:device.id,name:device.device_name,browser:device.browser,extensionVersion:device.extension_version}});
  }
  if(!device) return json({ok:false,error:"DEVICE_UNAUTHORIZED"},401,{"WWW-Authenticate":"Bearer"});
  await touchDevice(device.id);

  if(path.endsWith("/extension/disconnect")) {
    await admin.from("p029_browser_devices").update({status:"revoked",revoked_at:nowIso()}).eq("id",device.id);
    await admin.from("p029_browser_grants").delete().eq("device_id",device.id);
    await admin.from("p029_browser_tab_overviews").delete().eq("device_id",device.id);
    await admin.from("p029_browser_jobs").update({status:"cancelled",error:"DEVICE_DISCONNECTED",completed_at:nowIso()}).eq("device_id",device.id).in("status",["pending","claimed"]);
    return json({ok:true});
  }
  if(path.endsWith("/extension/grants")) {
    const body=await req.json().catch(()=>null);
    const grants=Array.isArray(body?.grants)?body.grants:[];
    if(grants.length>500) return json({ok:false,error:"TOO_MANY_GRANTS"},400);
    const rows=grants.map((g:any)=>({
      user_id:device.user_id,device_id:device.id,tab_id:Number(g.tabId),grant_id:String(g.grantId||"").slice(0,120),
      origin:origin(g.url)||String(g.origin||"").slice(0,255),url_redacted:redactedUrl(g.url),title:String(g.title||"").slice(0,180),
      scope:g.scope==="interact"?"interact":"read",precise_cursor:g.preciseCursor===true,updated_at:nowIso()
    })).filter((g:any)=>Number.isSafeInteger(g.tab_id)&&g.tab_id>=0&&g.grant_id&&g.origin);
    if(rows.length) {
      // Keep unchanged grants continuously readable during the 30s heartbeat.
      // Delete-and-reinsert previously caused transient TAB_GRANT_NOT_FOUND.
      const {error}=await admin.from("p029_browser_grants")
        .upsert(rows,{onConflict:"device_id,tab_id"});
      if(error) return json({ok:false,error:"GRANTS_UPDATE_FAILED"},500);
      const allowedIds=[...new Set(rows.map((g:any)=>g.tab_id))].join(",");
      const {error:pruneError}=await admin.from("p029_browser_grants").delete()
        .eq("device_id",device.id).not("tab_id","in",`(${allowedIds})`);
      if(pruneError) return json({ok:false,error:"GRANTS_PRUNE_FAILED"},500);
    } else {
      const {error}=await admin.from("p029_browser_grants").delete().eq("device_id",device.id);
      if(error) return json({ok:false,error:"GRANTS_REVOKE_FAILED"},500);
    }
    return json({ok:true,count:rows.length});
  }
  if(path.endsWith("/extension/tab-overview")) {
    const body=await req.json().catch(()=>null);
    if(Array.isArray(body?.tabs)&&body.tabs.length>500)return json({ok:false,error:"TOO_MANY_TABS"},400);
    const tabs=Array.isArray(body?.tabs)?body.tabs.map((t:any)=>({
      id:Number(t.id),title:String(t.title||"").slice(0,180),url:redactedUrl(t.url),windowId:Number(t.windowId)||0,active:!!t.active
    })).filter((t:any)=>Number.isSafeInteger(t.id)&&t.id>=0&&t.url):[];
    const {error}=await admin.from("p029_browser_tab_overviews").upsert({
      device_id:device.id,user_id:device.user_id,enabled:body?.enabled===true,tabs,updated_at:nowIso()
    },{onConflict:"device_id"});
    if(error) return json({ok:false,error:"TAB_OVERVIEW_UPDATE_FAILED"},500);
    return json({ok:true,enabled:body?.enabled===true,count:tabs.length});
  }
  if(path.endsWith("/extension/jobs")) {
    // Never auto-requeue claimed browser actions. An acknowledgement can be lost
    // after the browser has already clicked/typed; replay would double-execute.
    // Let the original job time out instead and require an explicit new request.
    const out:any[]=[];
    for(let i=0;i<3;i++){
      const {data:pending,error}=await admin.from("p029_browser_jobs").select("id,op,target_id,args,tool_name")
        .eq("device_id",device.id).eq("user_id",device.user_id).eq("status","pending")
        .gt("expires_at",nowIso()).order("created_at",{ascending:true}).limit(1);
      if(error||!pending?.[0]) break;
      const job=pending[0];
      const {data:claimed,error:claimError}=await admin.from("p029_browser_jobs").update({
        status:"claimed",claimed_at:nowIso(),lease_until:new Date(Date.now()+60_000).toISOString()
      }).eq("id",job.id).eq("device_id",device.id).eq("user_id",device.user_id).eq("status","pending")
        .select("id,op,target_id,args,tool_name").maybeSingle();
      if(claimError||!claimed) continue;
      // Database columns are snake_case, but the MV3 worker intentionally
      // accepts camelCase targetId. Without this mapping every grant fails.
      out.push({
        id:claimed.id, op:claimed.op, targetId:claimed.target_id,
        args:claimed.args, toolName:claimed.tool_name,
      });
    }
    return json({ok:true,jobs:out});
  }
  if(path.endsWith("/extension/result")) {
    const body=await req.json().catch(()=>null);
    const jobId=String(body?.jobId||"");
    const result=body?.result;
    if(!jobId||result===undefined) return json({ok:false,error:"INVALID_RESULT"},400);
    if(bytes(JSON.stringify(result))>MAX_RESULT_BYTES) return json({ok:false,error:"RESULT_TOO_LARGE"},413);
    const {data,error}=await admin.from("p029_browser_jobs").update({
      status:result?.ok===false?"failed":"completed",result:result?.ok===false?null:result,
      error:result?.ok===false?String(result?.error||"BROWSER_ACTION_FAILED").slice(0,200):null,
      completed_at:nowIso()
    }).eq("id",jobId).eq("device_id",device.id).eq("user_id",device.user_id)
      .eq("status","claimed").gt("expires_at",nowIso())
      .gt("lease_until",nowIso()).select("id").maybeSingle();
    if(error||!data) return json({ok:false,error:"JOB_NOT_FOUND_OR_NOT_CLAIMED"},404);
    return json({ok:true});
  }
  return json({ok:false,error:"NOT_FOUND"},404);
}

async function permitPairAttempt(req:Request) {
  // The reverse proxy is Cloudflare-fronted; do not trust arbitrary X-Forwarded-For.
  // An unknown IP is deliberately mapped to one shared bucket (fail closed).
  const clientIp=String(req.headers.get("cf-connecting-ip")||"shared").slice(0,80);
  const ipKey="ip:"+await sha256Hex(SERVICE_KEY+":p029-pair:"+clientIp);
  const limits:[string,number,number][]=[
    ["global:pair",240,600],
    [ipKey,18,600],
  ];
  for(const [p_key,p_limit,p_window_seconds] of limits) {
    const {data,error}=await admin.rpc("p029_pair_attempt_allowed",{p_key,p_limit,p_window_seconds});
    if(error||data!==true) return false;
  }
  return true;
}
async function pairHandler(req:Request) {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  if(req.method!=="POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  if(!await permitPairAttempt(req))
    return json({ok:false,error:"PAIRING_RATE_LIMIT"},429,{"Retry-After":"600"});
  const body=await req.json().catch(()=>null);
  const code=String(body?.code||"");
  if(!/^\d{8}$/.test(code)) return json({ok:false,error:"INVALID_PAIRING_CODE"},400);
  // Claim code and create device in a single database transaction. This
  // prevents the old eq(NULL) bug and guarantees one device per one-time code.
  // The code itself is never stored or logged; only its SHA-256 hash is sent
  // to this service-role-only RPC.
  const hash=await sha256Hex(code);
  const token=randomToken(),tokenHash=await sha256Hex(token);
  const deviceName=String(body?.deviceName||"").slice(0,80);
  const browser=String(body?.browser||"unknown").slice(0,40);
  const extensionVersion=String(body?.extensionVersion||"unknown").slice(0,40);
  const {data:claimed,error:claimError}=await admin.rpc("p029_claim_pairing",{
    p_code_hash:hash,
    p_token_hash:tokenHash,
    p_device_name:deviceName,
    p_browser:browser,
    p_extension_version:extensionVersion,
  });
  if(claimError) return json({ok:false,error:"PAIRING_REDEEM_FAILED"},500);
  if(!claimed?.deviceId) return json({ok:false,error:"PAIRING_CODE_INVALID_OR_EXPIRED"},403);
  return json({ok:true,token,deviceId:claimed.deviceId,deviceName:claimed.deviceName});
}

Deno.serve(async (req)=>{
  const path=new URL(req.url).pathname;
  if(path.endsWith("/pair")) return pairHandler(req);
  if(path.endsWith("/health")||path.includes("/extension/")) return extensionHandler(req);
  return mcpFetch(req);
});