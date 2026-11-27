'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const puppeteer=require(process.env.LUCH_TEST_PUPPETEER_CORE||'puppeteer-core');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.LUCH_TEST_BROWSER_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-first-run'],timeout:30000});
 const report={version:'0.8.5',scope:'LOCAL_SYNTHETIC_BROWSER_ONLY',checks:[],timestamp:new Date().toISOString()};
 try{
  const page=await browser.newPage();
  const executor=fs.readFileSync(path.join(root,'extension/extended-dom-ops.js'),'utf8');
  await page.setContent('<!doctype html><html lang="en"><body><form id="qa_form"><input type="hidden" name="csrf" value="EXAMPLE_LOCAL_CSRF"><input type="text" name="otp" value="EXAMPLE_LOCAL_OTP"><input type="password" name="password" value="EXAMPLE_LOCAL_PASSWORD"><input type="text" name="user_note" value="Allowed normal content"></form></body></html>');
  await page.evaluate(executor);
  let values=await page.evaluate(()=>window.luchExtendedDomExecutor({op:'get_form_values',args:{selector:'#qa_form'}}));
  assert.equal(values.ok,true,JSON.stringify(values));
  const names=values.data.map(x=>x.name);
  for(const name of ['csrf','otp','password'])assert.ok(!names.includes(name),'Sensitive form field must not be exported: '+name);
  assert.ok(names.includes('user_note'),'Ordinary user-authorized text field must remain readable');
  report.checks.push({name:'form_values_sensitive_excluded',pass:true});
  const selected=await page.evaluate(()=>{
   const form=document.querySelector('#qa_form'),sel=getSelection(),range=document.createRange();
   range.selectNode(form);sel.removeAllRanges();sel.addRange(range);
   return window.luchExtendedDomExecutor({op:'get_selected_html',args:{}});
  });
  assert.equal(selected.ok,true);
  for(const secret of ['EXAMPLE_LOCAL_PASSWORD','EXAMPLE_LOCAL_CSRF','EXAMPLE_LOCAL_OTP'])assert.ok(!JSON.stringify(selected).includes(secret),'Selected DOM must redact fixture: '+secret);
  assert.equal(selected.data.html.includes('value='),false,'No source HTML value attributes may survive');
  report.checks.push({name:'selected_html_sensitive_excluded',pass:true});
  const input=await page.evaluate(()=>window.luchExtendedDomExecutor({op:'get_inputs',args:{}}));
  assert.equal(input.ok,true);
  assert.ok(!input.data.some(x=>x.name==='otp'||x.name==='csrf'||x.name==='password'),'Sensitive inputs must not appear in discovered inputs');
  assert.ok(input.data.some(x=>x.name==='user_note'));
  report.checks.push({name:'input_inventory_filters_sensitive',pass:true});
  const attributes=await page.evaluate(()=>window.luchExtendedDomExecutor({op:'get_attributes',args:{selector:'input[name=password]'}}));
  assert.equal(attributes.ok,false,'Password field attributes must be denied');
  report.checks.push({name:'password_attributes_denied',pass:true});
  report.summary={pass:report.checks.length,fail:0};
  console.log('R14_SENSITIVE_DATA_CHROME_PASS',JSON.stringify(report.summary));
 }finally{
  await browser.close();
  fs.writeFileSync(path.join(root,'audits','R14_SENSITIVE_DATA_CHROME_20261127.json'),JSON.stringify(report,null,2)+'\n');
 }
})().catch(err=>{console.error(err.stack);process.exitCode=1});