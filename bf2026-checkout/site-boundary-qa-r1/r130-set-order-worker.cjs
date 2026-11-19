'use strict';
/* R130: durable one GetCourse order / N existing Offers.
 * Send writes with PG advisory mutex and a committed SEND_UNCERTAIN
 * BEFORE each provider call. Never resubmit uncertain writes or
 * publish a link based on import acknowledgements.
 */
const crypto=require('node:crypto');
const {buildSetImportPlan}=require('./r130-set-lines.cjs');
const {createImportStep,generateDealNumber,validEmail,validNonce,validSha}=require('./r130-getcourse-import.cjs');
function fail(code){const e=Error(code);e.code=code;throw e}
function sha(s){return crypto.createHash('sha256').update(s).digest('hex')}
function validIntentKey(k){return typeof k==='string'&&/^[a-f0-9]{64}$/.test(k)}
function safe(row){return Object.freeze({
  state:row.state,deal_number:row.state==='ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK'?row.deal_number:null,
  imported_line_count:Number(row.current_step),expected_line_count:Number(row.count_items),
  desired_order_total_rub:Number(row.total_rub),
  native_line_items_verified:false,native_discount_total_verified:false,
  payment_verified:false,receipt_verified:false,actual_grants_verified:false,
  public_payment_link:null,public_release_allowed:false,
  reason:row.last_error_code||'HOLD_NATIVE_ORDER_LINES_AND_CONSENT_PROOF'
 })}
function createSetOrderWorker({pool,quoteFn,transport,
 allowExternalWrites=false,testOnly=false,requiredNativePreflight=null}={}){
 if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function'||
  typeof quoteFn!=='function'||typeof transport?.send!=='function')
  fail('R130_WORKER_DEPENDENCIES_MISSING');
 if(allowExternalWrites===true&&!testOnly&&typeof requiredNativePreflight!=='function')
  fail('R130_REAL_WRITES_REQUIRE_INDEPENDENT_PREFLIGHT');
 async function prepare({selection,email,nonce,offerRevisionSha256,idempotencyKey}={}){
  if(!validIntentKey(idempotencyKey)||!validEmail(email)||!validNonce(nonce)||
    !validSha(offerRevisionSha256))
   fail('R130_PREPARE_REQUIRED_SERVER_IDENTITY_OR_CONSENT_MISSING');
  const plan=buildSetImportPlan({selection,quoteFn});
  const emailHash=sha(email.trim().toLowerCase()),nonceHash=sha(nonce);
  const inputHash=sha(JSON.stringify({email_sha256:emailHash,nonce_sha256:nonceHash,
   revision:offerRevisionSha256,plan_sha256:plan.plan_sha256}));
  const dealNumber=generateDealNumber();
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const existing=await client.query(
    'SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1 FOR UPDATE',
    [idempotencyKey]);
   if(existing.rows.length){
    if(existing.rows[0].request_sha256!==inputHash)fail('R130_IDEMPOTENCY_KEY_BODY_CHANGED');
    await client.query('COMMIT');
    return {plan,status:safe(existing.rows[0]),intent_key:idempotencyKey,duplicate:true};
   }
   const inserted=await client.query(
    "INSERT INTO bf2026_r130_set_order_intents ("+
    "intent_key,request_sha256,buyer_sha256,nonce_sha256,offer_revision_sha256,"+
    "plan_sha256,pricing_version,deal_number,count_items,total_rub,state) VALUES("+
    "$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PREPARED') ON CONFLICT DO NOTHING RETURNING *",
    [idempotencyKey,inputHash,emailHash,nonceHash,offerRevisionSha256,
     plan.plan_sha256,plan.pricing_version,dealNumber,
     plan.items_count,plan.desired_order_total_rub]);
   if(!inserted.rows.length){
    // A concurrent request can win the same idempotency key (or a different
    // key with the SAME one-use consent nonce) between SELECT and INSERT.
    // ON CONFLICT waits for the winning transaction, then this locked read
    // returns the durable winner without creating another provider order.
    const winner=await client.query(
     'SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1 FOR UPDATE',
     [idempotencyKey]);
    if(winner.rows.length){
     if(winner.rows[0].request_sha256!==inputHash)
      fail('R130_IDEMPOTENCY_KEY_BODY_CHANGED');
     await client.query('COMMIT');
     return {plan,status:safe(winner.rows[0]),intent_key:idempotencyKey,duplicate:true};
    }
    const nonceOwner=await client.query(
     'SELECT intent_key FROM bf2026_r130_set_order_intents WHERE nonce_sha256=$1',
     [nonceHash]);
    if(nonceOwner.rows.length)fail('R131_ONE_TIME_CONSENT_NONCE_REUSED');
    fail('R131_ORDER_NUMBER_COLLISION_OR_UNKNOWN_UNIQUE_CONFLICT');
   }
   for(let i=0;i<plan.lines.length;i++){
    await client.query('INSERT INTO bf2026_r130_set_order_steps '+
     '(intent_key,step_index,offer_id,line_amount_rub) VALUES($1,$2,$3,$4)',
     [idempotencyKey,i,plan.lines[i].offer_id,
      plan.lines[i].discounted_line_price_rub]);
   }
   await client.query('COMMIT');
   return {plan,status:safe(inserted.rows[0]),intent_key:idempotencyKey,duplicate:false};
  }catch(e){try{await client.query('ROLLBACK')}catch{};throw e}
  finally{client.release()}
 }
 async function inspect({idempotencyKey}={}){
  if(!validIntentKey(idempotencyKey))fail('R130_IDEMPOTENCY_KEY_INVALID');
  const r=await pool.query(
   'SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[idempotencyKey]);
  if(!r.rows.length)fail('R130_INTENT_NOT_FOUND');
  return safe(r.rows[0]);
 }
 async function assembleOnce({idempotencyKey,selection,email,nonce,offerRevisionSha256}={}){
  if(!allowExternalWrites)
   return Object.freeze({state:'HOLD_GETCOURSE_IMPORT_DISABLED',
    public_release_allowed:false,public_payment_link:null,
    provider_requests_sent:0});
  if(!testOnly){
   const allowed=await requiredNativePreflight?.();
   if(allowed?.owner_enabled!==true||allowed?.native_order_fields_verified!==true||
    allowed?.provider_side_consent_enforced!==true||
    allowed?.buyer_order_specific_consent_verified!==true||
    allowed?.write_api_key_owner_approved!==true||
    allowed?.source_provider_identity_verified!==true||
    // GetCourse may send an automatic email when the Order is created:
    // never test this connector using an uncontrolled real customer.
    allowed?.owner_controlled_qa_buyer_verified!==true||
    allowed?.provider_order_notification_behavior_owner_approved!==true)
    fail('R130_LIVE_ORDER_PREFLIGHT_UNVERIFIED');
  }
  if(!validIntentKey(idempotencyKey)||!validEmail(email)||
   !validNonce(nonce)||!validSha(offerRevisionSha256))
   fail('R130_ASSEMBLY_REQUIRED_IDENTITY_MISSING');
  const plan=buildSetImportPlan({selection,quoteFn});
  const inputHash=sha(JSON.stringify({email_sha256:sha(email.trim().toLowerCase()),
   nonce_sha256:sha(nonce),revision:offerRevisionSha256,
   plan_sha256:plan.plan_sha256}));
  const client=await pool.connect();
  let locked=false;
  try{
   const l=await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[idempotencyKey]);
   if(l.rows?.[0]?.locked!==true)
    return {state:'HOLD_ASSEMBLER_ALREADY_RUNNING',public_release_allowed:false,
     public_payment_link:null,provider_requests_sent:0};
   locked=true;
   let row=(await client.query(
    'SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1',[idempotencyKey])).rows[0];
   if(!row||row.request_sha256!==inputHash)fail('R130_INTENT_IDENTITY_OR_QUOTE_MISMATCH');
   if(['SEND_UNCERTAIN','PROVIDER_UNKNOWN_MANUAL_RECONCILIATION'].includes(row.state))
    return safe(row);
   if(row.state==='ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK')return safe(row);
   if(!['PREPARED','PARTIAL_ACKED_HOLD'].includes(row.state))
    return safe(row);
   for(let i=Number(row.current_step);i<plan.lines.length;i++){
    const step=(await client.query(
     'SELECT * FROM bf2026_r130_set_order_steps WHERE intent_key=$1 AND step_index=$2',
     [idempotencyKey,i])).rows[0];
    if(!step||step.state!=='PREPARED'||Number(step.offer_id)!==plan.lines[i].offer_id||
     Number(step.line_amount_rub)!==plan.lines[i].discounted_line_price_rub)
     fail('R130_STEP_NOT_UNSENT_EXACT_QUOTE');
    const marked=await client.query(
     "UPDATE bf2026_r130_set_order_intents SET state='SEND_UNCERTAIN',updated_at=now() "+
     "WHERE intent_key=$1 AND current_step=$2 AND state IN ('PREPARED','PARTIAL_ACKED_HOLD') RETURNING intent_key",
     [idempotencyKey,i]);
    if(marked.rowCount!==1)fail('R130_ASSEMBLER_CONCURRENT_STATE_CHANGE');
    await client.query("UPDATE bf2026_r130_set_order_steps SET state='SEND_UNCERTAIN',sent_at=now() "+
     'WHERE intent_key=$1 AND step_index=$2',[idempotencyKey,i]);
    const payload=createImportStep({line:plan.lines[i],index:i,total:plan.items_count,
     dealNumber:row.deal_number,email:email.trim().toLowerCase(),nonce,offerRevisionSha256});
    let ack;
    try{
     ack=await transport.send({payload,dealNumber:row.deal_number,
      previousDealId:row.deal_id});
    }catch(e){
     const code=String(e?.code||'R130_IMPORT_RESPONSE_UNKNOWN').slice(0,100);
     await client.query(
      "UPDATE bf2026_r130_set_order_steps SET state='UNKNOWN_HOLD' "+
      "WHERE intent_key=$1 AND step_index=$2",[idempotencyKey,i]);
     await client.query(
      "UPDATE bf2026_r130_set_order_intents SET state='PROVIDER_UNKNOWN_MANUAL_RECONCILIATION',last_error_code=$2,updated_at=now() WHERE intent_key=$1",
      [idempotencyKey,code]);
     row=(await client.query(
      'SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1',
      [idempotencyKey])).rows[0];
     return safe(row);
    }
    if(!ack||ack.import_acknowledged!==true||ack.deal_number!==row.deal_number||
      !/^[1-9][0-9]{0,17}$/.test(String(ack.deal_id))||
      (row.deal_id!==null&&row.deal_id!==String(ack.deal_id))){
      await client.query(
       "UPDATE bf2026_r130_set_order_intents SET state='PROVIDER_UNKNOWN_MANUAL_RECONCILIATION',last_error_code='R130_ACK_IDENTITY_MISMATCH',updated_at=now() WHERE intent_key=$1",
       [idempotencyKey]);
      row=(await client.query('SELECT * FROM bf2026_r130_set_order_intents WHERE intent_key=$1',
       [idempotencyKey])).rows[0];
      return safe(row);
    }
    await client.query(
     "UPDATE bf2026_r130_set_order_steps SET state='ACKED',deal_id=$3,acked_at=now() "+
     'WHERE intent_key=$1 AND step_index=$2',[idempotencyKey,i,String(ack.deal_id)]);
    const state=i===plan.lines.length-1?
     'ALL_IMPORT_ACKED_HOLD_NATIVE_READBACK':'PARTIAL_ACKED_HOLD';
    const done=await client.query(
     'UPDATE bf2026_r130_set_order_intents SET state=$2,deal_id=$3,current_step=$4,'+
     'updated_at=now() WHERE intent_key=$1 RETURNING *',
     [idempotencyKey,state,String(ack.deal_id),i+1]);
    row=done.rows[0];
   }
   return safe(row);
  }finally{
   if(locked)try{await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',
    [idempotencyKey])}catch{}
   client.release();
  }
 }
 return Object.freeze({prepare,inspect,assembleOnce});
}
module.exports={createSetOrderWorker};
