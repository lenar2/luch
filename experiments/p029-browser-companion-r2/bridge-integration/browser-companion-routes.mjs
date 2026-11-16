// LUCH Companion R4 — private Browser Bridge routing for a user-consented tab.
// Caller must first pass the existing authenticated Browser Bridge bearer check.
// Never reinterpret an ext: target as CDP, personal Opera, or native Chrome.
const EXACT=/^ext:(0|[1-9][0-9]*):[a-f0-9]{24}$/;
const MAPPING={
 '/v1/click':b=>['click',{selector:b.selector}],
 '/v1/click-at':b=>['click_at',{x:b.x,y:b.y}],
 '/v1/hit-test':b=>['hit_test',{x:b.x,y:b.y}],
 '/v1/type':b=>['fill',{selector:b.selector,text:b.text}],
 '/v1/scroll':b=>['scroll',{dx:b.deltaX,dy:b.deltaY}],
 '/v1/select':b=>['select_option',{selector:b.selector,value:b.value}],
 '/v1/navigate':b=>['navigate',{url:b.url}],
 '/v1/reload':b=>['reload',{}],
 '/v1/history/back':b=>['back',{}],
 '/v1/history/forward':b=>['forward',{}],
 '/v1/tab/activate':b=>['activate_tab',{}],
 '/v1/tab/close':b=>['close_tab',{}],
 '/v1/accessibility/snapshot':b=>['accessibility_snapshot',{}],
 '/v1/screenshot':b=>['screenshot',{}],
 '/v1/window/info':b=>['window_info',{}],
 '/v1/window/set':b=>['window_set',{left:b.left,top:b.top,width:b.width,height:b.height}],
 '/v1/insert-text':b=>['insert_text',{selector:b.selector,text:b.text}],
};
const SAFE=new Set(Object.keys(MAPPING));
export function companionRouteEligible(path,body){
 return body?.browser==='chrome'&&typeof body?.targetId==='string'&&body.targetId.startsWith('ext:');
}
export async function routeCompanionRequest(path,body,adapter){
 if(!companionRouteEligible(path,body))return {status:409,body:{ok:false,error:'COMPANION_ROUTE_SCOPE_INVALID'}};
 if(!EXACT.test(body.targetId))return {status:409,body:{ok:false,error:'INVALID_COMPANION_TARGET'}};
 if(!SAFE.has(path))return {status:409,body:{ok:false,error:'OPERATION_UNAVAILABLE_ON_CONSENTED_TAB'}};
 const [op,args]=MAPPING[path](body);
 // Explicit opt-in for any interaction; the adapter rechecks grant scope on the broker.
 try{
  const result=await adapter.runAuthorizedAction({targetId:body.targetId,op,args});
  const data=result.data;
  if(path==='/v1/screenshot'){
   if(typeof data?.dataUrl!=='string'||!data.dataUrl.startsWith('data:image/jpeg;base64,'))
    return {status:502,body:{ok:false,error:'SCREENSHOT_RESULT_INVALID'}};
   return {status:200,body:{ok:true,data:data.dataUrl.split(',')[1],format:'jpeg',captureMode:'user-consented-extension'}};
  }
  if(path==='/v1/window/info')return {status:200,body:{ok:true,browser:'chrome',targetId:body.targetId,bounds:data,windowId:null,viewport:null}};
  if(path==='/v1/window/set')return {status:200,body:{ok:true,browser:'chrome',targetId:body.targetId,bounds:data}};
  if(path==='/v1/tab/activate')return {status:200,body:{ok:true,browser:'chrome',targetId:body.targetId,activated:true}};
  if(path==='/v1/tab/close')return {status:200,body:{ok:true,browser:'chrome',targetId:body.targetId,closed:true}};
  if(path==='/v1/hit-test')return {status:200,body:{ok:true,x:body.x,y:body.y,elements:data?[data]:[]}};
  if(path==='/v1/accessibility/snapshot')return {status:200,body:{ok:true,result:{nodes:data||[],source:'USER_CONSENTED_TAB'}}};
  return {status:200,body:{ok:true,result:data,source:'USER_CONSENTED_TAB',targetId:body.targetId}};
 }catch(e){
  const code=String(e?.code||e?.message||'COMPANION_ACTION_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,80)||'COMPANION_ACTION_FAILED';
  return {status:409,body:{ok:false,error:code}};
 }
}
