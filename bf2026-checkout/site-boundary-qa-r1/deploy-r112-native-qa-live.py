#!/usr/bin/env python3
"""BF2026 R112: authorized QA-only deployment into checkout-r2, with fast rollback.
Changes no public sales route/price/registry/merchant credentials.
"""
import fcntl, hashlib, json, os, pathlib, shutil, subprocess, sys, tempfile, time
import urllib.request, urllib.error

TARGET=pathlib.Path('/srv/factory-scratch/bf2026-checkout-r2-20261119')
ORIGIN=pathlib.Path('/srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119/bf2026-checkout')
SERVER=TARGET/'server.js'
MARKER="BF2026_R112_NATIVE_HTTP_QA_BRIDGE"
FILES={
  'site-boundary-qa-r1/native-order-site-qa-http.cjs',
  'site-boundary-qa-r1/native-order-site-integration.cjs',
  'site-boundary-qa-r1/native-order-execution-contract.cjs',
  'site-boundary-qa-r1/native-order-execution-contract.json',
  'site-boundary-qa-r1/native-provider-evidence.cjs',
  'site-boundary-qa-r1/provider-supported-fallback.cjs',
  'site-boundary-qa-r1/native-mapping-live-overlay.json',
  'dynamic-adapter-r1/adapter.cjs',
  'dynamic-adapter-r1/native-mapping-observed.json'
}
def digest(b): return hashlib.sha256(b).hexdigest()
def run(*cmd,timeout=15):
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=timeout)
    if p.returncode: raise RuntimeError(f"{cmd[0]} rc={p.returncode} {p.stderr[-400:]}")
    return p.stdout.strip()
def request(url,body=None,key=None):
    headers={'Accept':'application/json'}
    if body is not None: headers['Content-Type']='application/json'
    if key is not None: headers['x-bf2026-qa-key']=key
    req=urllib.request.Request(url,data=(json.dumps(body).encode() if body is not None else None),headers=headers,method=('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(req,timeout=6) as r:
            return r.status,json.load(r)
    except urllib.error.HTTPError as ex:
        try: val=json.load(ex)
        except Exception: val={}
        return ex.code,val
def smoke():
    base="https://wf.tati-lar.ru/api/checkout/"
    key=(TARGET/'private-widget-qa.secret').read_text().strip()
    st,info=request(base+'status')
    assert st==200 and info['service']=='BF2026_CHECKOUT_R2' and info['sales_ready'] is False and info['verified_sale_routes']==0, (st,info)
    sel={"kind":"set","items":["rejection_program","union"]}
    st,q=request(base+'quote',sel)
    assert st==200 and q['quote']['total_rub']==11690 and q['availability']['ready'] is False
    st,x=request(base+'_qa/native-order/prepare',{**sel,"checkout_idempotency_key":"b"*32},key)
    assert st==200 and x['quote']['total_rub']==11690 and x['route_enabled'] is False, (st,x)
    signed=x["signed_order_payload"]
    st,verify=request(base+'_qa/native-order/verify',{"signed_order_payload":signed},key)
    assert st==200 and [l['offer_id'] for l in verify['lines']]==[8933492,8919715],(st,verify)
    st,hold=request(base+'_qa/native-order/start',{"signed_order_payload":signed},key)
    assert st==503 and hold['code']=='NATIVE_PROVIDER_CAPABILITY_HOLD' and hold['checkout_url'] is None,(st,hold)
    st,_=request(base+'_qa/native-order/prepare',{**sel,"checkout_idempotency_key":"c"*32})
    assert st==404,st
    st,blocked=request(base+'start',sel)
    assert st==503 and blocked['quote']['total_rub']==11690 and not blocked.get('checkout_url'),(st,blocked)
    return {"status":st,"actual_http_checks":7,"signed_exact_two_offer_ids":[8933492,8919715],
       "due_rub":11690,"public_sales_ready":False,"verified_sale_routes":0,
       "public_checkout_http":503,"private_qa_unauthed_http":404,
       "qa_start_http":503,"payment_created":False}
def atomic_write(p,data):
    fd,tmp=tempfile.mkstemp(prefix='.'+p.name+'.r112-',dir=str(p.parent))
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'wb') as f: f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(tmp,p)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def main():
    lock=TARGET/'site-register.lock'
    stamp=time.strftime('%Y%m%d-%H%M%S',time.gmtime())
    with open(lock,'a+') as lf:
        fcntl.flock(lf.fileno(),fcntl.LOCK_EX)
        original=SERVER.read_bytes()
        if MARKER.encode() in original:
            print('ALREADY_DEPLOYED',digest(original))
            print(json.dumps(smoke(),ensure_ascii=False))
            return
        # Never replace registry/catalog/site/cart or Caddy.
        for rel in FILES:
            src=ORIGIN/rel
            dest=TARGET/rel
            dest.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
            atomic_write(dest,src.read_bytes())
        insert=(f"const {MARKER}=require('./site-boundary-qa-r1/native-order-site-qa-http.cjs').createSiteQARouter({{\n"
            " quoteFn:compute,manifest,qaAuthorize:qaAuthorized,\n"
            " hmacKeyHex:crypto.createHmac('sha256',Buffer.from(qaSecret))\n"
            "  .update('bf2026:r112:native-order-qa:hmac-v1').digest('hex')\n"
            "});\n")
        entry="const server=http.createServer(async(req,res)=>{"
        probe=" if(req.method==='GET'&&path==='/api/checkout/catalog'){"
        text=original.decode('utf-8')
        if text.count(entry)!=1 or text.count(probe)!=1:raise RuntimeError('UNEXPECTED_PRODUCTION_SOURCE_SHAPE')
        text=text.replace(entry,insert+entry)
        text=text.replace(probe,
           f" if(path.startsWith('/api/checkout/_qa/native-order/'))return {MARKER}(req,res,path);\n"+probe)
        proposed=text.encode()
        backup=TARGET/f'server.js.before-r112-native-qa.{stamp}.backup'
        atomic_write(backup,original)
        atomic_write(SERVER,proposed)
        try:
            run('node','--check',str(SERVER),timeout=7)
            run('docker','exec','bf2026-checkout-r2','node','--check','/app/server.js',timeout=8)
            run('docker','exec','bf2026-checkout-r2','node','-e',"const m=require('/app/server.js');if(!m.server)process.exit(1)",timeout=8)
            # Only checkout container is recycled: live Caddy and public site remain intact.
            run('docker','restart','-t','2','bf2026-checkout-r2',timeout=16)
            last=None
            for i in range(6):
                try:
                    result=smoke(); break
                except Exception as exc:
                    last=exc
                    time.sleep(0.8)
            else:raise RuntimeError('POST_DEPLOY_SMOKE_FAILED '+repr(last))
            evidence={'schema':'bf2026.r112.private-native-qa-live-deploy.v1',
             'observed_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
             'original_server_sha256':digest(original),'current_server_sha256':digest(SERVER.read_bytes()),
             'backup_file':str(backup),'package_files':sorted(FILES),
             'checkout_container_restarted':True,'production_qa_route_enabled':True,
             'production_public_cart_changed':False,'production_registry_changed':False,
             'getcourse_order_driver_connected':False,
             'smoke':result}
            out=ORIGIN/'site-boundary-qa-r1'/'r112-live-qa-deployment-evidence.json'
            atomic_write(out,(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n').encode())
            print('LIVE_PRIVATE_QA_NATIVE_ORDER_DEPLOYED')
            print(json.dumps(evidence,ensure_ascii=False))
        except BaseException as exc:
            atomic_write(SERVER,original)
            try:run('docker','restart','-t','2','bf2026-checkout-r2',timeout=16)
            except Exception as restart:print('CRITICAL_ROLLBACK_RESTART_FAILED '+str(restart),file=sys.stderr)
            print('ROLLED_BACK_TO_PRIOR_SERVER '+repr(exc),file=sys.stderr)
            raise
if __name__=='__main__': main()
