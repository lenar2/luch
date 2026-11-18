'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const expected=require('./native-order-lot5-union.expected.json');
const {canonical}=require('../adapter.cjs');
test('exact Lot5+Union expected quote matches current R109 source bytes and compute()',()=>{
 const serverPath=process.env.BF_R109_SERVER;
 const pricingPath=process.env.BF_R109_PRICING;
 assert.ok(serverPath,'BF_R109_SERVER must point to the existing R109 server.js');
 assert.ok(pricingPath,'BF_R109_PRICING must point to existing pricing-r107.json');
 const raw=fs.readFileSync(path.resolve(pricingPath));
 const catalogSha=crypto.createHash('sha256').update(raw).digest('hex');
 assert.equal(catalogSha,expected.catalog_sha256,'pricing source changed; refresh owner-approved provenance');
 const {compute}=require(path.resolve(serverPath));
 const quote=compute({kind:'set',items:['rejection_program','union']});
 assert.deepEqual(quote,{
  kind:'set',
  items:[
   {key:'rejection_program',site_lot:5,variant:null,base_price_rub:6990},
   {key:'union',site_lot:7,variant:null,base_price_rub:6000}
  ],
  currency:'RUB',count:2,subtotal_rub:12990,discount_percent:10,
  total_rub:11690,savings_rub:1300,pricing_version:expected.pricing_version
 });
 const quoteSha=crypto.createHash('sha256').update(canonical(quote)).digest('hex');
 assert.equal(quoteSha,expected.quote_sha256,'R109 quote changed; stop provider reconciliation');
});

