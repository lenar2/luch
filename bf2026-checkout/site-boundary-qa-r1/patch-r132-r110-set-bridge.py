#!/usr/bin/env python3
"""BF2026 R132. Produce a fail-closed R110 checkout bridge asset offline.
Input: current R110 vf110-checkout-bridge.js. Output: an isolated NEW file.
No public deployment, no credential access, no GetCourse requests.
"""
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: patch-r132-r110-set-bridge.py <R110 JS source> <new JS path>")
source, dest = map(Path, sys.argv[1:])
if source.resolve() == dest.resolve():
    raise SystemExit("Refusing in-place rewrite")
s = source.read_text(encoding="utf-8")
if "BF2026 R132: set-specific native plan and release gate" in s:
    raise SystemExit("Already patched")

def replace_once(a, b):
    global s
    if s.count(a) != 1:
        raise SystemExit("Unexpected R110 source; fail closed at anchor: " + a[:55])
    s = s.replace(a, b, 1)

replace_once(
    " let serviceReady=false,activeRequest=null,requestSignature=null,sequence=0;",
    " let serviceReady=false,activeRequest=null,requestSignature=null,sequence=0;\n let setCheckoutReady=false;"
)
replace_once(
    " function preventPayment(){\n  activeRequest=null;requestSignature=null;",
    " function preventPayment(){\n  setCheckoutReady=false;\n  activeRequest=null;requestSignature=null;"
)

new_block = """ // BF2026 R132: set-specific native plan and release gate.
 // A globally ready SINGLE-offer site may never authorize a MULTI-offer set.
 async function verifySetPlan(request,q){
  try{
   const [r,statusResponse]=await Promise.all([
    post('set/plan',request),
    fetch('/api/checkout/set/status',{credentials:'same-origin',cache:'no-store'})
   ]);
   const s=statusResponse.ok?await statusResponse.json():null;
   const p=r.data,order=p?.order,lines=order?.expected_line_items;
   if(r.code!==200||p?.ok!==true||!s?.ok||p.quote?.pricing_version!==q.pricing_version||
      p.quote?.count!==q.count||p.quote?.total_rub!==q.total_rub||
      p.quote?.discount_percent!==q.discount_percent||
      !order||order.expected_single_order!==true||order.create_new_offer_count!==0||
      order.expected_payment_total_rub!==q.total_rub||
      !Array.isArray(lines)||lines.length!==q.count||
      new Set(lines.map(x=>x.offer_id)).size!==q.count||
      lines.some(x=>!Number.isSafeInteger(x.offer_id)||x.offer_id<=0||
         !Number.isSafeInteger(x.line_price_rub)||x.line_price_rub<=0||
         !Array.isArray(x.product_training_pairs)||!x.product_training_pairs.length||
         x.product_training_pairs.some(g=>!Number.isSafeInteger(g.product_id)||
            !Number.isSafeInteger(g.training_id)||g.after_pay_days!==365))||
      lines.reduce((sum,x)=>sum+x.line_price_rub,0)!==q.total_rub)return {valid:false};
   return {valid:true,released:s.sale_ready===true&&s.public_release_allowed===true&&
      s.live_provider_import_enabled===true&&s.native_payment_link_verified===true&&
      s.native_receipt_verified===true&&s.grants_verified===true&&
      p.public_release_allowed===true};
  }catch{return {valid:false}}
 }
"""
replace_once(" async function update(){", new_block+" async function update(){")
replace_once(
    "    displayQuote(q,basket.lines);\n    if(!serviceReady||r.data.availability.ready!==true)return;",
    """    displayQuote(q,basket.lines);
    if(q.kind==='set'){
      const verdict=await verifySetPlan(data.request,q);
      if(n!==sequence)return;
      if(!verdict.valid){
       preventPayment();
       $('#cart-message').textContent='Не удалось подтвердить состав и стоимость сета на сервере. Оформление недоступно.';
       return;
      }
      if(!verdict.released){
       $('#cart-message').textContent='Сет рассчитан сервером: '+currency(q.total_rub)+'. Оплата этого сета пока недоступна.';
       return;
      }
      setCheckoutReady=true;activeRequest=data.request;
      requestSignature=JSON.stringify(activeRequest);
      submit.disabled=false;submit.setAttribute('aria-disabled','false');
      submit.textContent='Перейти к оплате';
      $('#cart-message').textContent='Состав и стоимость сета подтверждены. Перейти к оплате.';
      return;
    }
    if(!serviceReady||r.data.availability.ready!==true)return;"""
)
replace_once(
    "  const req=activeRequest;preventPayment();submit.textContent='Проверяем заказ…';",
    """  const req=activeRequest,isSet=req.kind==='set';
  if(isSet&&!setCheckoutReady){preventPayment();return;}
  preventPayment();submit.textContent='Проверяем заказ…';"""
)
replace_once("   const r=await post('start',req);","   const r=await post(isSet?'set/start':'start',req);")
dest.parent.mkdir(parents=True, exist_ok=True)
if dest.exists():
    raise SystemExit("Refusing to replace an existing output")
dest.write_text(s,encoding="utf-8")
print("R132_PATCH_OK",source,dest,len(s))
