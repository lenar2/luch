'use strict';
/* R129 boundary for GetCourse Order-field contract.
 * No native Order custom-field ID or Process ID is known by default.
 * The R127 endpoint remains unreachable without both the owner-signed
 * private config AND independently matching PG-stage metadata.
 */
const {ROUTE_KEYS}=require('./r128-native-cta-map.cjs');
const PREFIX='/api/checkout/_qa/order-fields/';
const CALLBACK='/api/checkout/_provider/getcourse/order-created';
const CONSENT='/api/checkout/consent/';
function send(res,status,value){
 if(res.headersSent)return;
 res.writeHead(status,{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, private','pragma':'no-cache',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow',
  'referrer-policy':'no-referrer'});
 res.end(JSON.stringify(value));
}
function createFieldGate({registry,consentBridge,providerHttp,qaAuthorized}={}){
 if(!registry||typeof registry.ready!=='function'||
  typeof registry.status!=='function'||
  typeof consentBridge!=='function'||typeof providerHttp!=='function'||
  typeof qaAuthorized!=='function')
  throw Error('R129_FIELD_GATE_DEPENDENCIES_REQUIRED');
 return async function fieldGate(req,res,path){
  if(path===CALLBACK){
   if(req.method!=='POST')return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED',
    public_release_allowed:false});
   const v=await registry.ready();
   if(!v.ready)return send(res,503,{ok:false,
    code:'R129_ORDER_LEVEL_NATIVE_FIELDS_NOT_ATTESTED',
    state:'HOLD_NATIVE_GETCOURSE_ORDER_FIELD_IDS_OR_CALLBACK_CONFIG',
    provider_signature_verified:false,provider_consent_verified:false,
    public_release_allowed:false});
   return providerHttp(req,res,path);
  }
  if(path.startsWith(PREFIX)){
   if(!qaAuthorized(req))return send(res,404,{ok:false,code:'NOT_FOUND'});
   if(path===PREFIX+'status'&&req.method==='GET'){
    const info=await registry.status();
    return send(res,info.postgres_ready?200:503,{ok:true,...info});
   }
   return send(res,404,{ok:false,code:'NOT_FOUND'});
  }
  if(!path.startsWith(CONSENT))
   return send(res,404,{ok:false,code:'NOT_FOUND'});
  if(path===CONSENT+'status'&&req.method==='GET'){
   const info=await registry.status();
   return send(res,200,{ok:true,route:'R129_ORDER_FIELD_BOUND_R128_CONSENT',
    native_widget_count:12,individual_route_count:ROUTE_KEYS.length,
    qa_only_native_widget_count:2,
    order_callback_contract_verified:info.order_field_ids_verified,
    callback_secret_configured:false, // no secret or provider proof exposed through this route
    challenge_issuance_enabled:false, // public release remains HOLD regardless of test metadata
    order_field_ids_verified:info.order_field_ids_verified,
    postgres_ready:info.postgres_ready,field_gate_code:info.gate_code,
    client_field_22204810_accepted_as_proof:false,
    client_checkbox_trusted:false,provider_signature_verified:false,
    provider_native_consent_negative_test_verified:false,
    public_release_allowed:false});
  }
  if(path===CONSENT+'challenge'&&req.method==='POST'){
   const v=await registry.ready();
   if(!v.ready)return send(res,503,{ok:false,
    code:'R129_ORDER_LEVEL_NATIVE_FIELDS_NOT_ATTESTED',
    provider_consent_verified:false,public_release_allowed:false});
  }
  // Session and validated challenge are supplied by the already-tested R128 bridge.
  return consentBridge(req,res,path);
 };
}
module.exports={PREFIX,CALLBACK,CONSENT,createFieldGate};
