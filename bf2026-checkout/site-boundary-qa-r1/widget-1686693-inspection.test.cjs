'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('./inspect-widget-1686693.cjs');
test('LIVE GetCourse widget public embed/iframe transport is inspected read-only', {timeout:30000}, async()=>{
 const x=await inspect();
 assert.equal(x.embed_script.http_status,200);
 assert.equal(x.iframe.http_status,200);
 assert.equal(x.iframe.hidden_setted_offer_id_count,1);
 assert.equal(x.iframe.hidden_setted_offer_id_has_value_attribute,false);
 assert.equal(x.iframe.form_position_input_count,0);
 assert.equal(x.iframe.other_offer_selector_count,0);
 assert.equal(x.modal_injection.explicit_offer_position_supported,true);
 assert.equal(x.modal_injection.external_value_object_fill,true);
 assert.equal(x.safety.form_submitted,false);
 assert.equal(x.safety.order_created,false);
});

