'use strict';
/* R154 opt-in wiring over R130 PostgreSQL idempotency and R136/R135 native
 * unpaid order + payment-link validation. No provider traffic by default.
 * A GC Import API ACK alone MUST NOT enable operational checkout.
 */
const {createSetOrderWorker}=require('./r130-set-order-worker.cjs');
const {createLot10Coordinator}=require('./r136-lot10-order-coordinator.cjs');
const {quoteSetR154,buildLot12SetPlan}=require('./r154-lot12-set.cjs');
function patchR154Sql(sql){
 if(typeof sql!=='string')throw Error('R154_SQL_TEXT_REQUIRED');
 return sql.replaceAll('bf2026_r130_set_order_intents','bf2026_r154_lot12_order_intents')
  .replaceAll('bf2026_r130_set_order_steps','bf2026_r154_lot12_order_steps');
}
function createR154PgAdapter(pool){
 if(typeof pool?.connect!=='function'||typeof pool?.query!=='function')
  throw Error('R154_POSTGRES_POOL_REQUIRED');
 return Object.freeze({
  query:(sql,params)=>pool.query(patchR154Sql(sql),params),
  connect:async()=>{
   const client=await pool.connect();
   return Object.freeze({
    query:(sql,params)=>client.query(patchR154Sql(sql),params),
    release:()=>client.release()
   });
  }
 });
}
function createLot12Coordinator({
 pool,transport,preflight,nativeOrderReadback,nativeConsentReadback,
 allowProviderWrites=false
}={}){
 if(typeof preflight!=='function')throw Error('R154_PROVIDER_PREFLIGHT_REQUIRED');
 // Both caller-visible readiness and the durable import worker run this
 // independent provider-capability gate. A 901 or import-only API is HOLD.
 const gated=async()=>{
  const p=await preflight();
  if(p?.r154_owner_approved_realtime_multioffer===true&&
   p?.r154_native_one_deal_multioffer_verified===true&&
   p?.r154_provider_payment_link_readback_verified===true&&
   p?.r154_365d_after_pay_grants_verified===true)
   return p;
  return Object.freeze({});
 };
 return createLot10Coordinator({
  quoteFn:quoteSetR154,planBuilder:buildLot12SetPlan,
  transport,preflight:gated,nativeOrderReadback,nativeConsentReadback,
  allowProviderWrites,
  makeWorker:guardedTransport=>createSetOrderWorker({
   pool:createR154PgAdapter(pool),quoteFn:quoteSetR154,planBuilder:buildLot12SetPlan,
   transport:guardedTransport,allowExternalWrites:allowProviderWrites,
   requiredNativePreflight:gated
  })
 });
}
module.exports={createLot12Coordinator,createR154PgAdapter,patchR154Sql};
