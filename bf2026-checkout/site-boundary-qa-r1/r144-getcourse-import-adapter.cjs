'use strict';
/* R144 fail-closed GetCourse Import API adapter.
 * Read-only auth/schema probe only. Official docs say /pl/api/deals is for
 * importing data, not operational real-time object management. No order-write,
 * live unpaid-order readback or payment-link implementation is exposed.
 */
const {readNativeOrderFields}=require('./r141-server-key.cjs');
const ACCOUNT=Object.freeze({id:67138,name:'singleladiesschool',apiKeyRowId:54763,
 customHost:'study.shkola-dnv.com',systemHost:'singleladiesschool.getcourse.ru'});
const DEFAULT_KEY_FILE='/app/private/getcourse-import.key';
function denied(code){
 return Object.freeze({ok:false,http_status:503,code,checkout_url:null,
  unpaid_order_native_verified:false,payment_verified:false,receipt_verified:false,
  access_grants_verified:false,provider_write_capability_verified:false,
  realtime_checkout_supported:false,public_release_allowed:false});
}
function createGetCourseImportAdapter({filePath=DEFAULT_KEY_FILE,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 async function probeReadOnly(){
  const r=await readNativeOrderFields({filePath,fetchImpl,timeoutMs});
  return Object.freeze({ok:r.authenticated_read_only===true,provider:'getcourse-import-api',
   account_id:ACCOUNT.id,account_name:ACCOUNT.name,api_key_row_id:ACCOUNT.apiKeyRowId,
   auth_state:r.auth_state||'UNKNOWN',code:r.code||'R144_READONLY_PROBE_UNKNOWN',
   provider_error_code:r.provider_error_code??null,
   native_order_fields_readback_verified:r.native_order_fields_readback_verified===true,
   fields:r.native_order_fields_readback_verified===true?r.fields:[],
   provider_write_capability_verified:false,realtime_checkout_supported:false,
   live_unpaid_order_readback_supported:false,payment_link_supported:false,
   public_release_allowed:false,secret_exposed:false});
 }
 async function createUnpaidOrder(){return denied('R144_GETCOURSE_IMPORT_API_NOT_REALTIME_CHECKOUT')}
 async function readUnpaidOrder(){return denied('R144_GETCOURSE_EXPORT_API_NOT_REALTIME_READBACK')}
 async function getPaymentLink(){return denied('R144_GETCOURSE_PAYMENT_LINK_NOT_AVAILABLE')}
 return Object.freeze({provider:'getcourse-import-api',account:ACCOUNT,
  capabilities:Object.freeze({readOnlyAuthenticationProbe:true,nativeFieldCatalogRead:true,
   createUnpaidOrder:false,liveUnpaidOrderReadback:false,paymentLink:false,realTimeCheckout:false}),
  probeReadOnly,createUnpaidOrder,readUnpaidOrder,getPaymentLink});
}
module.exports={ACCOUNT,DEFAULT_KEY_FILE,denied,createGetCourseImportAdapter};
