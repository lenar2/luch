#!/usr/bin/env python3
"""BF2026 R112 closed bundle QA route deployment. Does not enable customer checkout."""
from pathlib import Path
import fcntl,hashlib,os,json,subprocess,tempfile,time,urllib.request,urllib.error,sys
ROOT=Path('/srv/factory-scratch/bf2026-checkout-r2-20261119')
SOURCE=Path('/srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119/bf2026-checkout/site-boundary-qa-r1')
TARGET=ROOT/'site-boundary-qa-r1'
SERVER=ROOT/'server.js'
MARKER='BF2026_R112_NATIVE_BUNDLE_QA_ROUTE'
MODULES=['native-bundle-qa.cjs','native-bundle-site-qa-http.cjs']
def sha(data):return hashlib.sha256(data).hexdigest()
def run(*cmd,timeout=15):
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
 if p.returncode!=0:raise RuntimeError('%s failed: %s'%(cmd[0],p.stderr[-300:]))
 return p.stdout.strip()
def atomic(file,content):
 file.parent.mkdir(exist_ok=True,parents=True)
 fd,name=tempfile.mkstemp(prefix='.'+file.name+'.new-',dir=str(file.parent))
 try:
  os.fchmod(fd,0o600)
  with os.fdopen(fd,'wb') as f:
   f.write(content);f.flush();os.fsync(f.fileno())
  os.replace(name,file)
 finally:
  if os.path.exists(name):os.unlink(name)
def req(path,payload=None,qa=False):
 headers={'Accept':'application/json'}
 if qa:headers['x-bf2026-qa-key']=(ROOT/'private-widget-qa.secret').read_text().strip()
 if payload is not None:headers['Content-Type']='application/json'
 r=urllib.request.Request('https://wf.tati-lar.ru/api/checkout/'+path,
   data=json.dumps(payload).encode() if payload is not None else None,headers=headers,
   method='POST' if payload is not None else 'GET')
 try:
  with urllib.request.urlopen(r,timeout=7) as f:
   data=f.read();return f.status,json.loads(data) if 'json' in f.headers.get('Content-Type','') else data.decode()
 except urllib.error.HTTPError as e:
  try:v=json.loads(e.read())
  except:v={}
  return e.code,v
def smoke():
 checks=[]
 status,data=req('status')
 assert status==200 and data['sales_ready'] is False and data['verified_sale_routes']==0,('STATUS',status)
 checks.append('live_sale_routes_zero')
 selection={'kind':'set','items':['rejection_program','union']}
 status,q=req('quote',selection)
 assert status==200 and q['quote']['total_rub']==11690
 checks.append('server_quote_11690')
 status,x=req('_qa/native-bundle/prepare',{**selection,'checkout_idempotency_key':'a'*32},True)
 assert status==200 and x['offer_id']==8935004 and x['widget_id']==1686790 and x['total_rub']==11690 and x['checkout_url'] is None,('PREPARE',status,x.get('code'))
 checks.append('private_signed_bundle_prepare')
 token=x['signed_bundle_intent']
 status,v=req('_qa/native-bundle/verify',{'signed_bundle_intent':token},True)
 assert status==200 and [l['product_id'] for l in v['product_rights']]==[4557988,4550895] and [l['training_id'] for l in v['product_rights']]==[936022301,933861292],('VERIFY',status)
 checks.append('bundle_two_product_rights')
 status,y=req('_qa/native-bundle/start',{'signed_bundle_intent':token},True)
 assert status==503 and y['code']=='NATIVE_BUNDLE_QA_INACTIVE' and y['checkout_url'] is None,('START',status)
 checks.append('qa_bundle_start_hold')
 status,html=req('_qa/native-bundle/preview',qa=True)
 assert status==200 and '1686790' in html and '11 690' in html and 'неактивно' in html
 checks.append('private_native_widget_preview')
 status,none=req('_qa/native-bundle/preview')
 assert status==404 and none['code']=='NOT_FOUND'
 checks.append('anonymous_qa_denied')
 status,public=req('start',selection)
 assert status==503 and public['quote']['total_rub']==11690 and not public.get('checkout_url')
 checks.append('public_checkout_stays_hold')
 return checks
def main():
 with open(ROOT/'site-register.lock','a+') as mutex:
  fcntl.flock(mutex.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
  current=SERVER.read_bytes()
  if MARKER.encode() in current:
   print('ALREADY_PRESENT',json.dumps(smoke()))
   return
  needle="const server=http.createServer(async(req,res)=>{"
  route=" if(req.method==='GET'&&path==='/api/checkout/catalog'){"
  txt=current.decode('utf-8')
  if txt.count(needle)!=1 or txt.count(route)!=1:raise RuntimeError('SERVER_CODE_CHANGED')
  before={name:(TARGET/name).read_bytes() if (TARGET/name).exists() else None for name in MODULES}
  backups=ROOT/('server.js.before-r112-bundle-qa.'+time.strftime('%Y%m%d-%H%M%S',time.gmtime())+'.backup')
  init=("const "+MARKER+"=require('./site-boundary-qa-r1/native-bundle-site-qa-http.cjs').createNativeBundleQARouter({\n"
   " quoteFn:compute,manifest,qaAuthorized,\n"
   " secretHex:crypto.createHmac('sha256',Buffer.from(qaSecret))\n"
   " .update('bf2026:r112:native-bundle:qa-only:v1').digest('hex')\n"
   "});\n")
  txt=txt.replace(needle,init+needle).replace(route,
   " if(path.startsWith('/api/checkout/_qa/native-bundle/'))return "+MARKER+"(req,res,path);\n"+route)
  atomic(backups,current)
  for name in MODULES:atomic(TARGET/name,(SOURCE/name).read_bytes())
  atomic(SERVER,txt.encode())
  try:
   run('node','--check',str(SERVER),timeout=8)
   run('docker','exec','bf2026-checkout-r2','node','-e',
      "const m=require('/app/server.js');if(!m.server)process.exit(1)",timeout=12)
   run('docker','restart','-t','2','bf2026-checkout-r2',timeout=16)
   last=None
   for retry in range(5):
    try:checks=smoke();break
    except Exception as e:last=e;time.sleep(.6)
   else:raise RuntimeError('LIVE_SMOKE_FAILED '+repr(last))
   result={'schema':'bf2026.r112.live-native-bundle-private-qa.v1',
     'timestamp_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
     'original_server_sha256':sha(current),'current_server_sha256':sha(SERVER.read_bytes()),
     'backup_file':str(backups),'new_modules':MODULES,'observed_live_http_checks':checks,
     'native_bundle_offer_id':8935004,'native_widget_id':1686790,'native_unpaid_deal_id':'924624456',
     'approved_price_rub':11690,'public_sale_enabled':False,'public_sale_routes':0,
     'new_getcourse_order_created':False,'payment_attempted':False,
     'customer_data_used':False,'registry_changed':False,'cart_design_changed':False}
   out=SOURCE/'r112-live-native-bundle-qa-deploy-evidence.json'
   atomic(out,(json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode())
   print('LIVE_NATIVE_BUNDLE_QA_DEPLOYED')
   print(json.dumps(result,ensure_ascii=False))
  except BaseException as exc:
   atomic(SERVER,current)
   for name,data in before.items():
    try:
     if data is None:(TARGET/name).unlink(missing_ok=True)
     else:atomic(TARGET/name,data)
    except Exception as restore:print('MODULE_RESTORE_WARNING',name,str(restore),file=sys.stderr)
   try:run('docker','restart','-t','2','bf2026-checkout-r2',timeout=16)
   except Exception as recovery:print('RESTORE_RESTART_FAILED',str(recovery),file=sys.stderr)
   print('ROLLED_BACK',repr(exc),file=sys.stderr)
   raise
if __name__=='__main__':main()
