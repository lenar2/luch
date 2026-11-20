'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const e=require('./r110-site-native-evidence.json');
test('actual PUBLIC site is already R110 using the 265-selection checkout bridge',()=>{
 assert.equal(e.site.main_page_uses_r110_bridge,true);
 assert.equal(e.site.main_page_uses_r110_cart,true);
 assert.equal(e.site.bridge_supports_multiple_cart,true);
 assert.equal(e.site.bridge_requires_sales_ready,true);
 assert.equal(e.site.status.service,'BF2026_CHECKOUT_R2');
 assert.equal(e.site.status.set_configurations_server_calculated,265);
});
test('real server quote gives exact approved 11690 for two programs',()=>{
 const q=e.site.example;
 assert.deepEqual(q.selection,{kind:'set',items:['rejection_program','union']});
 assert.equal(q.quote_http_status,200);
 assert.equal(q.subtotal_rub,12990);
 assert.equal(q.discount_percent,10);
 assert.equal(q.savings_rub,1300);
 assert.equal(q.total_rub,11690);
});
test('public sales remain fail-closed with zero provider-confirmed sale routes',()=>{
 assert.equal(e.site.status.sales_ready,false);
 assert.equal(e.site.status.provider_offer_ready,false);
 assert.equal(e.site.status.verified_sale_routes,0);
 assert.equal(e.site.example.provider_availability_ready,false);
 assert.equal(e.safety.no_form_post,true);
 assert.equal(e.safety.no_order_created,true);
 assert.equal(e.safety.no_payment,true);
});
test('test GetCourse widget has one form with two separate unchecked offer checkboxes but 12990 base',()=>{
 const w=e.getcourse.observed_forms.find(x=>x.widget_id===1686745);
 assert.equal(w.http_status,200);assert.equal(w.form_count,1);
 assert.equal(w.forms[0].action_id,'2263283894');
 assert.deepEqual(w.forms[0].offers.map(o=>[o.offer_id,o.price_rub,o.type,o.checked]),[
 [8919715,6000,'checkbox',false],[8933492,6990,'checkbox',false]]);
 assert.equal(w.forms[0].offers.reduce((s,x)=>s+x.price_rub,0),12990);
 assert.equal(w.native_order_created,false);
 assert.equal(w.native_paid_order_verified,false);
});
test('fixed audio native form has been corrected to exactly one 3333 offer',()=>{
 const w=e.getcourse.observed_forms.find(x=>x.widget_id===1686753);
 assert.equal(w.http_status,200);assert.equal(w.form_count,1);
 assert.equal(w.forms[0].action_id,'2263284969');
 assert.equal(w.forms[0].explicit_oferta,true);
 assert.deepEqual(w.forms[0].offers.map(x=>[x.offer_id,x.price_rub]),[[8934925,3333]]);
 assert.equal(w.marketing_checked_by_default,'false');
});
test('public HTML is provider read-only evidence, not payment or access proof',()=>{
 assert.equal(e.getcourse.native_one_order_two_items_verified,false);
 assert.equal(e.getcourse.provider_11690_order_verified,false);
 assert.equal(e.safety.no_getcourse_ui_or_lock_access,true);
 assert.equal(e.safety.no_site_change,true);
});
