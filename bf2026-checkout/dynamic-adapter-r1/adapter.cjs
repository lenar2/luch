'use strict';
/**
 * BF2026 dynamic checkout order-intent ADAPTER (ISOLATED, NOT DEPLOYED).
 * This code does not create GetCourse orders, collect buyer data or publish URLs.
 * quoteFn must be the trusted R109 server-side compute(input), not client totals.
 */
const crypto=require('node:crypto');
const EXPECTED_VERSION='BF2026_LOT10_CUSTOM_SET_R107';
const REQUIRED_ROUTE_PROOFS=[
 'published_native_form_verified','provider_selection_binding_verified',
 'native_positive_paid_e2e_verified','native_negative_unpaid_verified',
 'native_duplicate_guard_verified','native_tax_receipt_verified',
 'native_consent_verified','owner_release_approved'
];
function canonical(x){
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
   return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
 if(x===null||['string','number','boolean'].includes(typeof x))return JSON.stringify(x);
 throw Error('NON_CANONICAL_VALUE');
}
function sha(x){return crypto.createHash('sha256').update(canonical(x)).digest('hex')}
function fail(code){const e=new Error(code);e.code=code;throw e}
function strictPositiveId(x){return Number.isSafeInteger(x)&&x>0}
function strictIds(x){return Array.isArray(x)&&x.length>0&&x.every(strictPositiveId)&&new Set(x).size===x.length}
function keyForLine(line){return line.key+(line.variant?':'+line.variant:'')}
function selectionFromQuote(q){
 if(q.kind==='single')return {kind:'single',lot:q.items[0].site_lot,...(q.items[0].variant?{variant:q.items[0].variant}:{})};
 const source=q.items.find(l=>l.key==='source');
 return {kind:'set',items:q.items.map(l=>l.key),...(source?{source_variant:source.variant}:{})};
}
function keyForQuote(q){return (q.kind==='single'?'single:':'set:')+q.items.map(keyForLine).join('|')}
function validNativeURL(url){
 try{
   const u=new URL(url);
   if(u.protocol!=='https:'||u.hostname!=='study.shkola-dnv.com'||u.port||u.hash||
      u.username||u.password||u.pathname==='/'||/\/pl\/sales\/(?:offer|product)\/(?:update|create)/i.test(u.pathname))return false;
   return true;
 }catch{return false}
}
function createAdapter({quoteFn,manifest,observedMapping}){
 if(typeof quoteFn!=='function'||!manifest||manifest.id!==EXPECTED_VERSION||
    manifest.default_access_days!==365||!observedMapping||typeof observedMapping!=='object')fail('INVALID_TRUSTED_CONFIG');
 const catalogSha=sha(manifest);
 function plan(input){
   // Server-authoritative quote recomputation; input MAY be untrusted; R109 rejects
   // overrides of totals/discounts/offer IDs and disallowed combinations.
   const q=quoteFn(input);
   if(q.pricing_version!==EXPECTED_VERSION||q.currency!=='RUB'||q.items.length!==q.count||
      !Number.isSafeInteger(q.total_rub)||q.total_rub<=0)fail('PRICE_VERSION_OR_SHAPE_MISMATCH');
   const selection=selectionFromQuote(q);
   const canonicalQuote=quoteFn(selection);
   if(sha(canonicalQuote)!==sha(q))fail('NONDETERMINISTIC_QUOTE');
   const blockers=[];
   const lines=q.items.map(line=>{
     const lookup=keyForLine(line);
     const m=observedMapping[lookup]||null;
     const offerIds=m?.offer_ids||[];
     const productIds=m?.product_ids||[];
     const trainingIds=m?.training_ids||[];
     const reason=[];
     if(!m)reason.push('NATIVE_MAPPING_MISSING');
     if(!strictIds(offerIds))reason.push('OFFER_UNVERIFIED');
     if(!strictIds(productIds))reason.push('PRODUCT_UNVERIFIED');
     if(!strictIds(trainingIds))reason.push('TRAINING_UNVERIFIED');
     if(m?.release_status!=='ACTIVE_VERIFIED')reason.push('NATIVE_NOT_ACTIVE_VERIFIED');
     if(m?.native_price_rub!==line.base_price_rub)reason.push('NATIVE_PRICE_NOT_VERIFIED');
     if(m?.access_days!==365)reason.push('365D_NOT_VERIFIED');
     if(!m?.native_readback_ref||!m?.grant_readback_ref)reason.push('NATIVE_EVIDENCE_INCOMPLETE');
     if(reason.length)blockers.push({line_key:lookup,codes:reason});
     return {
       line_key:lookup,site_lot:line.site_lot,variant:line.variant,
       base_price_rub:line.base_price_rub,offer_ids:offerIds,
       product_ids:productIds,training_ids:trainingIds,
       grant:{trigger:'CONFIRMED_PAID_EVENT_ONLY',start:'AFTER_PAY',duration_days:365,
         product_ids:productIds,training_ids:trainingIds},
       native_release_status:m?.release_status||'UNKNOWN',
       provenance:{catalog_version:q.pricing_version,
         native_readback_ref:m?.native_readback_ref||null,
         grant_readback_ref:m?.grant_readback_ref||null}
     };
   });
   const core={
     schema:'bf2026.order.intent.r1',
     selection_key:keyForQuote(q),selection,
     quote:{currency:'RUB',subtotal_rub:q.subtotal_rub,discount_percent:q.discount_percent,
       total_rub:q.total_rub,savings_rub:q.savings_rub,count:q.count,
       pricing_version:q.pricing_version,rounding:'nearest_10_rub_final_total'},
     lines,provenance:{input_origin:'SERVER_RECOMPUTED_R109',
       catalog_sha256:catalogSha,catalog_version:q.pricing_version}
   };
   core.provenance.line_binding_sha256=sha({
     key:core.selection_key,total:core.quote.total_rub,lines:core.lines.map(l=>({
       k:l.line_key,offers:l.offer_ids,products:l.product_ids,trainings:l.training_ids,days:l.grant.duration_days
     }))
   });
   return {...core,ready_for_native_binding:blockers.length===0,blockers};
 }
 function requireReady(p){if(!p.ready_for_native_binding||p.blockers.length)fail('NATIVE_MAPPING_HOLD')}
 function seal(input,{secret,now=Math.floor(Date.now()/1000),ttlSeconds=300,nonce}={}){
   if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_SECRET_REQUIRED');
   if(!Number.isSafeInteger(now)||!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>600)fail('BAD_TTL');
   const p=plan(input);requireReady(p);
   const n=nonce||crypto.randomBytes(16).toString('hex');
   if(!/^[a-f0-9]{32}$/.test(n))fail('BAD_NONCE');
   const payload={schema:'bf2026.sealed.intent.r1',scope:'INTERNAL_CANDIDATE_NOT_PROVIDER_ORDER',
     issued_at:now,expires_at:now+ttlSeconds,nonce:n,plan:p};
   const raw=Buffer.from(canonical(payload)).toString('base64url');
   const mac=crypto.createHmac('sha256',secret).update('v1.'+raw).digest('base64url');
   return 'v1.'+raw+'.'+mac;
 }
 function verify(token,{secret,now=Math.floor(Date.now()/1000)}={}){
   if(!Buffer.isBuffer(secret)||secret.length<32)fail('SERVER_SECRET_REQUIRED');
   if(typeof token!=='string'||token.length>18000||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))fail('BAD_TOKEN');
   const [v,raw,mac]=token.split('.');
   const expected=crypto.createHmac('sha256',secret).update(v+'.'+raw).digest();
   const supplied=Buffer.from(mac,'base64url');
   // Reject non-canonical base64url (unused pad bits could otherwise yield a
   // different token string with the same decoded bytes).
   if(supplied.toString('base64url')!==mac||
      Buffer.from(raw,'base64url').toString('base64url')!==raw||
      supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))fail('TAMPERED_INTENT');
   let p;try{p=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'))}catch{fail('BAD_TOKEN')}
   if(p.schema!=='bf2026.sealed.intent.r1'||p.scope!=='INTERNAL_CANDIDATE_NOT_PROVIDER_ORDER'||
     !Number.isSafeInteger(p.issued_at)||!Number.isSafeInteger(p.expires_at)||
     p.expires_at<=p.issued_at||p.expires_at-p.issued_at>600||p.issued_at>now+30||
     p.expires_at<=now||!(/^[a-f0-9]{32}$/.test(p.nonce||'')))fail('EXPIRED_OR_INVALID_INTENT');
   const rerun=plan(p.plan.selection);requireReady(rerun);
   if(sha(rerun)!==sha(p.plan))fail('STALE_CATALOG_OR_GRANTS');
   return p;
 }
 function resolve(token,{secret,nativeBindings,now=Math.floor(Date.now()/1000),idempotencyStore}={}){
   const intent=verify(token,{secret,now}),p=intent.plan;
   const b=nativeBindings?.[p.selection_key];
   if(!b||b.status!=='ACTIVE'||b.selection_key!==p.selection_key||
     b.expected_total_rub!==p.quote.total_rub||
     b.line_binding_sha256!==p.provenance.line_binding_sha256||
     !REQUIRED_ROUTE_PROOFS.every(k=>b[k]===true)||
     !b.evidence_refs||!REQUIRED_ROUTE_PROOFS.every(k=>typeof b.evidence_refs[k]==='string'&&b.evidence_refs[k].length>5)||
     !validNativeURL(b.native_public_form_url))fail('NATIVE_ROUTE_HOLD');
   // Verified browser/session transfer of EXACT selection is mandatory. This MUST
   // be proof of provider-side order lines, NOT merely a shared generic form URL.
   if(b.verified_provider_selection_key!==p.selection_key)fail('PROVIDER_SELECTION_UNPROVEN');
   if(!idempotencyStore||typeof idempotencyStore.consume!=='function')fail('DURABLE_IDEMPOTENCY_STORE_REQUIRED');
   const idempotencyKey=sha({scope:'bf2026',nonce:intent.nonce,selection_key:p.selection_key});
   if(idempotencyStore.consume(idempotencyKey)!==true)fail('INTENT_ALREADY_CONSUMED');
   return {native_public_form_url:b.native_public_form_url,idempotency_key:idempotencyKey,
     selection_key:p.selection_key,total_rub:p.quote.total_rub,
     provider_order_status:'NOT_CREATED_BY_THIS_ADAPTER',
     required_grants:p.lines.map(l=>l.grant)};
 }
 return {plan,seal,verify,resolve,version:EXPECTED_VERSION,catalogSha};
}
module.exports={createAdapter,canonical,sha,keyForQuote,selectionFromQuote,REQUIRED_ROUTE_PROOFS};

