#!/usr/bin/env python3
"""BF2026: upgrade only the already-authenticated QA native form handler, with rollback."""
import fcntl, hashlib, json, os, pathlib, subprocess, tempfile, time
import urllib.request,urllib.error

SITE=pathlib.Path('/srv/factory-scratch/bf2026-checkout-r2-20261119')
WORK=pathlib.Path('/srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119/bf2026-checkout/site-boundary-qa-r1')
FILES=['native-order-site-qa-http.cjs','native-getcourse-widget-driver.cjs']
def atomic(p,data):
 fd,tmp=tempfile.mkstemp(prefix='.'+p.name+'.gc-r112-',dir=str(p.parent))
 try:
  os.fchmod(fd,0o600)
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(tmp,p)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def cmd(*a):
 x=subprocess.run(a,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=17)
 if x.returncode:raise RuntimeError(a[0]+' RC='+str(x.returncode)+' '+x.stderr[-500:])
 return x.stdout.strip()
def post(endpoint,body,key=None):
 headers={'Accept':'application/json','Content-Type':'application/json'}
 if key is not None:headers['x-bf2026-qa-key']=key
 req=urllib.request.Request('https://wf.tati-lar.ru/api/checkout/'+endpoint,data=json.dumps(body).encode(),headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=9) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:
  try:result=json.load(e)
  except Exception:result={}
  return e.code,result
def smoke():
 key=(SITE/'private-widget-qa.secret').read_text().strip()
 selection={'kind':'set','items':['rejection_program','union']}
 code,a=post('quote',selection)
 assert code==200 and a['quote']['total_rub']==11690
 code,p=post('_qa/native-order/prepare',{**selection,'checkout_idempotency_key':'c'*32},key)
 assert code==200 and p['quote']['total_rub']==11690 and p['checkout_url'] is None,(code,p)
 code,r=post('_qa/native-order/verify',{'signed_order_payload':p['signed_order_payload']},key)
 assert code==200 and [x['offer_id'] for x in r['lines']]==[8933492,8919715],(code,r)
 code,h=post('_qa/native-order/start',{'signed_order_payload':p['signed_order_payload']},key)
 assert code==503 and h['code']=='NATIVE_PROVIDER_CAPABILITY_HOLD'
 code,n=post('_qa/native-order/provider-check',selection)
 assert code==404
 code,b=post('start',selection)
 assert code==503 and b['quote']['total_rub']==11690
 # External GetCourse widget may intermittently time out; this is an independent
 # provider-availability observation, never a reason to release a wrong price.
 provider_result=None
 for i in range(5):
  code,x=post('_qa/native-order/provider-check',selection,key)
  if code==200:
   assert x['native_widget_id']==1686745 and x['approved_total_rub']==11690
   assert x['native_base_total_rub']==12990
   assert x['checkout_ready'] is False and x['checkout_url'] is None
   assert [a['offer_id'] for a in x['native_offer_positions']]==[8919715,8933492],(code,x)
   provider_result={'http':code,'widget_id':x['native_widget_id'],'action_id':x['action_id'],
    'offer_ids':[y['offer_id'] for y in x['native_offer_positions']],
    'native_base_total_rub':12990,'approved_total_rub':11690,
    'will_create_paid_deal_field_value':x.get('will_create_paid_deal_field_value'),
    'checkout_ready':False,'no_provider_post':x['safety']['form_submitted'] is False}
   break
  if code not in (503,502):raise AssertionError(('provider',code,x))
  time.sleep(.5)
 if provider_result is None:provider_result={'http':503,'provider':'TEMPORARILY_UNAVAILABLE','checkout_ready':False}
 return {'private_qa_prepare_http':200,'verify_http':200,'start_http':503,
  'anonymous_provider_http':404,'public_checkout_http':503,
  'actual_getcourse_readback':provider_result}
def main():
 dst=SITE/'site-boundary-qa-r1';dst.mkdir(parents=True,exist_ok=True)
 with open(SITE/'site-register.lock','a+') as f:
  fcntl.flock(f.fileno(),fcntl.LOCK_EX)
  prior={}
  for name in FILES:
   path=dst/name
   prior[name]=path.read_bytes() if path.exists() else None
   atomic(path,(WORK/name).read_bytes())
  try:
   cmd('docker','exec','bf2026-checkout-r2','node','--check','/app/site-boundary-qa-r1/native-order-site-qa-http.cjs')
   cmd('docker','exec','bf2026-checkout-r2','node','-e',"const m=require('/app/server.js');if(!m.server)process.exit(1)")
   cmd('docker','restart','-t','2','bf2026-checkout-r2')
   outcome=None
   for i in range(5):
    try:outcome=smoke();break
    except Exception as e:
     if i==4:raise
     time.sleep(.7)
   evidence={'schema':'bf2026.r112.live-native-widget-driver.v1',
    'observed_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
    'files_updated':FILES,'qa_only':True,'getcourse_order_created':False,
    'payment_created':False,'public_site_price_unchanged':True,
    'live_http':outcome}
   atomic(WORK/'r112-live-getcourse-driver-evidence.json',(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n').encode())
   print('LIVE_GETCOURSE_NATIVE_FORM_DRIVER_QA_CONNECTED')
   print(json.dumps(evidence,ensure_ascii=False))
  except BaseException:
   for name,data in prior.items():
    path=dst/name
    if data is None:path.unlink(missing_ok=True)
    else:atomic(path,data)
   try:cmd('docker','restart','-t','2','bf2026-checkout-r2')
   except Exception as e:print('ROLLBACK_RESTART_FAILED '+str(e))
   print('QA_NATIVE_DRIVER_ROLLED_BACK')
   raise
if __name__=='__main__':main()
