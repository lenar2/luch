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
const GENERIC_ACTION='/v1/companion/action';
const EXT_READ=new Set([
 'read_text','inspect_page','get_links','get_headings','get_forms','get_tables',
 'get_selection','query_elements','find_text','accessibility_snapshot','hit_test',
 'get_element','scroll_position','screenshot','tab_info','window_info','list_open_tabs',
 'get_document_info','get_viewport','get_images','get_media','get_buttons','get_inputs','get_labels','get_attributes','get_computed_style','get_rect','get_visibility','get_form_values','get_element_state','get_ancestors','get_descendants','get_shadow_elements','get_iframes','get_dom_statistics','get_selected_html','get_performance','get_resources','get_active_element','list_windows','get_zoom','get_tab_language','get_tab_details','get_browser_capabilities','downloads_list','wait_for_url','wait_for_load'
]);
const EXT_INTERACT=new Set([
 'focus','hover','scroll_into_view','scroll','scroll_to','fill','insert_text',
 'type_text','select_option','check_element','click','click_at','double_click',
 'click_accessible','navigate','reload','back','forward','activate_tab',
 'close_tab','new_tab','new_window','window_set',
 'pointer_move','pointer_click','pointer_double_click','pointer_drag','pointer_wheel',
 'blur','clear_field','append_text','insert_at_cursor','select_text','set_selection_range','toggle_details','open_details','close_details','submit_form','reset_form','scroll_element','scroll_element_to','set_range_value','duplicate_tab','pin_tab','unpin_tab','mute_tab','unmute_tab','move_tab','discard_tab','set_zoom','press_key','key_chord','download_url'
]);
export const EXTENSION_ACTIONS=Object.freeze({read:[...EXT_READ],interact:[...EXT_INTERACT]});
const SAFE=new Set([...Object.keys(MAPPING),GENERIC_ACTION]);
export function companionRouteEligible(path,body){
 return body?.browser==='chrome'&&typeof body?.targetId==='string'&&body.targetId.startsWith('ext:');
}
export async function routeCompanionRequest(path,body,adapter){
 if(!companionRouteEligible(path,body))return {status:409,body:{ok:false,error:'COMPANION_ROUTE_SCOPE_INVALID'}};
 if(!EXACT.test(body.targetId))return {status:409,body:{ok:false,error:'INVALID_COMPANION_TARGET'}};
 if(!SAFE.has(path))return {status:409,body:{ok:false,error:'OPERATION_UNAVAILABLE_ON_CONSENTED_TAB'}};
 let op,args;
 if(path===GENERIC_ACTION){
  op=body.op;args=body.args===undefined?{}:body.args;
  if(typeof op!=='string'||(!EXT_READ.has(op)&&!EXT_INTERACT.has(op)))
   return {status:409,body:{ok:false,error:'OPERATION_UNAVAILABLE_ON_CONSENTED_TAB'}};
  if(!args||typeof args!=='object'||Array.isArray(args))
   return {status:400,body:{ok:false,error:'INVALID_ACTION_ARGS'}};
 }else [op,args]=MAPPING[path](body);
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