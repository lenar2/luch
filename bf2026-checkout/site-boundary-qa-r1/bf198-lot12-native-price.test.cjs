'use strict';
const assert=require('node:assert/strict');
const tiers={2:10,3:15,4:25,5:35,6:40,7:45};
const price=(base,count)=>Math.round(base.reduce((sum,p)=>sum+Math.round(p*(100-tiers[count]))/100,0)*100)/100;
assert.equal(price([5990,7000],2),11691);
assert.equal(price([3333,5990,7000],3),13874.55);
for(const n of [2,3,4,5,6,7])assert.ok(price(Array(n).fill(3333),n)>0);
console.log('BF2026 Lot12 2–7 native price tests PASS');
