#!/usr/bin/env python3
"""BF2026 R180: authorized native GetCourse repricer, using LOCAL logged-in Chrome.
No password/cookies/API keys copied to server. Acquires exclusive Mac owner lock.
Reads expected discounted lines via SSH from owner-controlled checkout ledger.
Only rewrites existing UNPAID GetCourse Deal price fields, then independently reloads.
"""
import asyncio,base64,datetime,fcntl,hashlib,json,os,re,subprocess,sys,urllib.request,shutil
from pathlib import Path
import websockets

HOST="study.shkola-dnv.com"
CDP="http://127.0.0.1:9235"
REMOTE="zagon-prod-1"
QUEUE="/srv/factory-scratch/bf2026-checkout-r2-20261119/site-boundary-qa-r1/r180-lot12-reprice-ledger.cjs"
UI_LOCK=Path("/private/tmp/luch_bf2026_getcourse_tab.lock")
SINGLETON=Path("/private/tmp/bf2026-lot12-repricer.singleton")
LOG=Path.home()/".luch"/"bf2026-lot12-repricer.log"

JS_SNAPSHOT=r"""(()=>{
 const text=document.body?.innerText||'';
 const order=text.match(/Заказ #(\d+)/)?.[1]||null;
 const totalText=text.match(/Сумма заказа\s*([\d\s]+)\s*руб\./)?.[1]||'';
 const customer=text.split(/\nКлиент\n/).slice(1).join('').slice(0,500);
 const email=customer.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase()||null;
 const lines=Array.from(document.querySelectorAll('tr.deal-position-tr')).map(tr=>{
  const link=tr.querySelector('a[href*="/offer/update?id="]');
  const href=link?.getAttribute('href')||'';
  const position=tr.querySelector('input[name$="[price]"]');
  const posid=position?.name.match(/^Position\[(\d+)\]\[price\]$/)?.[1];
  return {offer_id:Number(href.match(/[?&]id=(\d+)/)?.[1]||0),
   position_id:Number(posid||0),price_rub:Number(position?.value||0),
   quantity:Number(tr.querySelector('input[name$="[quantity]"]')?.value||0),
   currency:tr.querySelector('select[name$="[currency]"]')?.value||null};
 });
 return {host:location.hostname,url:location.pathname,ready:document.readyState,
  form_action:document.querySelector('form#dealForm')?.getAttribute('action')||null,
  order_number:order,
  native_status:text.match(/Статус:\s*(\S+)/)?.[1]||null,
  total_rub:Number(totalText.replace(/\s/g,''))||null,lines,
  buyer_email:email,
  nonce:document.querySelector('#field-input-23331550')?.value||null,
  plan_sha256:document.querySelector('#field-input-23331559')?.value||null
 };
})()"""
JS_SAVE_TEMPLATE=r"""(()=>{
 const arr=__POSITIONS__;
 if(location.hostname!=='study.shkola-dnv.com'||!document.querySelector('form#dealForm'))
  throw Error('NATIVE_ADMIN_FORM_MISSING');
 const rows=Array.from(document.querySelectorAll('tr.deal-position-tr'));
 const old=rows.map(tr=>{
  const input=tr.querySelector('input[name$="[price]"]');
  const link=tr.querySelector('a[href*="/offer/update?id="]');
  const offerId=Number(link?.getAttribute('href')?.match(/[?&]id=(\d+)/)?.[1]||0);
  return {offer_id:offerId,input};
 });
 if(old.length!==arr.length)throw Error('NATIVE_COUNT_CHANGED');
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 for(const p of arr){
  const found=old.filter(x=>x.offer_id===p.offer_id);
  if(found.length!==1||!found[0].input||!/^\d+$/.test(String(p.price_rub)))
   throw Error('NATIVE_POSITION_TARGET_MISMATCH');
  setter.call(found[0].input,String(p.price_rub));
  found[0].input.dispatchEvent(new Event('input',{bubbles:true}));
  found[0].input.dispatchEvent(new Event('change',{bubbles:true}));
 }
 const button=document.querySelector('button.btn.btn-primary.action-link');
 if(!button||button.disabled)throw Error('NATIVE_SAVE_BUTTON_MISSING');
 button.click();
 return {clicked:true,count:arr.length};
})()"""

def log(code,**kw):
    try:
        LOG.parent.mkdir(parents=True,exist_ok=True)
        payload={"time":datetime.datetime.now(datetime.timezone.utc).isoformat(),"event":code,**kw}
        with LOG.open("a") as f:f.write(json.dumps(payload,ensure_ascii=False)+"\n")
    except Exception:pass

def ssh(*args,timeout=25):
    cm=Path.home()/".luch"/"ssh-bf180"
    cm.mkdir(parents=True,exist_ok=True,mode=0o700)
    p=subprocess.run(["ssh","-o","BatchMode=yes",
        "-o","ConnectTimeout=12",
        "-o","ConnectionAttempts=1",
        "-o","ControlMaster=auto",
        "-o","ControlPersist=600",
        "-o",f"ControlPath={cm}/%C",
        REMOTE,"node",QUEUE,*args],capture_output=True,text=True,timeout=timeout)
    if p.returncode!=0:raise RuntimeError("REMOTE_QUEUE_ERROR "+p.stderr[:180])
    return json.loads(p.stdout.strip())

def targets():
    with urllib.request.urlopen(CDP+"/json/list",timeout=3) as r:return json.load(r)
def debugger():
    with urllib.request.urlopen(CDP+"/json/version",timeout=3) as r:
        return json.load(r)["webSocketDebuggerUrl"]

class Client:
    def __init__(self,url):self.url=url;self.ws=None;self.seq=0
    async def __aenter__(self):
        self.ws=await websockets.connect(self.url,open_timeout=5,max_size=4_000_000)
        return self
    async def __aexit__(self,*args):
        await self.ws.close()
    async def call(self,method,params=None,timeout=9):
        self.seq+=1;id=self.seq
        await self.ws.send(json.dumps({"id":id,"method":method,"params":params or {}}))
        for _ in range(70):
            r=json.loads(await asyncio.wait_for(self.ws.recv(),timeout))
            if r.get("id")==id:
                if r.get("error"):raise RuntimeError(method+" "+str(r["error"])[:240])
                return r.get("result",{})
        raise RuntimeError("CDP_NO_RESPONSE")
    async def eval(self,expr):
        r=await self.call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
        if r.get("exceptionDetails"):raise RuntimeError("JS_EVAL_FAILED")
        return r.get("result",{}).get("value")

async def create_target():
    async with Client(debugger()) as c:
        r=await c.call("Target.createTarget",{"url":"about:blank"})
        return r["targetId"]
async def close_target(id):
    try:
        async with Client(debugger()) as c:await c.call("Target.closeTarget",{"targetId":id})
    except Exception:pass
async def wait_page(c,number,deal_id,timeout=13):
    stop=asyncio.get_running_loop().time()+timeout
    while asyncio.get_running_loop().time()<stop:
        try:
            obj=await c.eval(JS_SNAPSHOT)
            if (obj and obj.get("order_number")==str(number) and
               len(obj.get("lines",[]))>=2 and obj.get("plan_sha256") and obj.get("nonce") and
               obj.get("form_action","").endswith(f"/id/{deal_id}/part/main")):
                return obj
        except Exception:pass
        await asyncio.sleep(.4)
    raise RuntimeError("NATIVE_ORDER_READBACK_TIMEOUT")
def checked(job,obj):
    if (obj.get("host")!=HOST or obj.get("order_number")!=str(job["deal_number"]) or
       obj.get("native_status")!="Новый" or
       obj.get("form_action")!=f"/sales/control/deal/update/id/{job['deal_id']}/part/main"):
        raise RuntimeError("NATIVE_ID_OR_STATUS_MISMATCH")
    if obj.get("plan_sha256")!=job["plan_sha256"]:
        raise RuntimeError("NATIVE_REVISION_MISMATCH")
    if not obj.get("nonce") or hashlib.sha256(obj["nonce"].encode()).hexdigest()!=job["nonce_sha256"]:
        raise RuntimeError("NATIVE_NONCE_MISMATCH")
    if job.get("buyer_email_sha256"):
        if (not obj.get("buyer_email") or
           hashlib.sha256(obj["buyer_email"].encode()).hexdigest()!=job["buyer_email_sha256"]):
            raise RuntimeError("NATIVE_BUYER_MISMATCH")
    positions=obj["lines"]
    expected={x["offer_id"]:x["price_rub"] for x in job["expected_lines"]}
    if len(expected)!=len(job["expected_lines"]) or len(positions)!=len(expected):
        raise RuntimeError("NATIVE_COUNT_OR_DUPLICATE_OFFERS")
    got={x["offer_id"]:x for x in positions}
    if (set(got)!=set(expected) or any(x["quantity"]!=1 or x["currency"]!="RUB" or
        x["position_id"]<1 for x in positions)):
        raise RuntimeError("NATIVE_OFFER_OR_QUANTITY_MISMATCH")
    return all(got[k]["price_rub"]==v for k,v in expected.items()) and obj["total_rub"]==job["total_rub"]

async def native_reprice(job,dry_run=False):
    id=await create_target()
    try:
        tab=next(t for t in targets() if t.get("id")==id)
        async with Client(tab["webSocketDebuggerUrl"]) as c:
            await c.call("Page.enable");await c.call("Runtime.enable")
            await c.call("Page.navigate",{"url":f"https://{HOST}/sales/control/deal/update/id/{job['deal_id']}/part/main"})
            before=await wait_page(c,job["deal_number"],job["deal_id"])
            already=checked(job,before)
            if dry_run:
                return {"mode":"dryrun","deal":job["deal_number"],"already_correct":already,
                    "current_total":before["total_rub"],"expected_total":job["total_rub"],"offer_count":len(before["lines"])}
            owned_mutex=False
            try:
                if not already:
                    # Mutual exclusion respected by BF2026 GC UI writers.
                    try:
                        UI_LOCK.mkdir(mode=0o700)
                        owned_mutex=True
                        (UI_LOCK/"owner.json").write_text(json.dumps({
                            "owner":"BF2026_R180_PRICE_REPRICER",
                            "deal_number":job["deal_number"],
                            "started_utc":datetime.datetime.now(datetime.timezone.utc).isoformat()
                        }))
                    except FileExistsError:
                        raise RuntimeError("GC_EXCLUSIVE_UI_LOCK_BUSY")
                    targets_json=[{"offer_id":x["offer_id"],"price_rub":x["price_rub"]} for x in job["expected_lines"]]
                    expr=JS_SAVE_TEMPLATE.replace("__POSITIONS__",json.dumps(targets_json))
                    result=await c.eval(expr)
                    if not result or result.get("clicked") is not True:raise RuntimeError("NATIVE_SAVE_FAILED")
                    # Wait for the native admin POST to settle before the independent reload.
                    await asyncio.sleep(2)
                    await c.call("Page.reload",{"ignoreCache":True})
                    await asyncio.sleep(.8)
                after=await wait_page(c,job["deal_number"],job["deal_id"],timeout=22)
                if not checked(job,after):raise RuntimeError("NATIVE_POST_RELOAD_PRICE_MISMATCH")
                proof={"deal_number":job["deal_number"],"deal_id":job["deal_id"],
                    "plan_sha256":job["plan_sha256"],"native_plan_sha256":after["plan_sha256"],
                    "native_nonce_sha256":hashlib.sha256(after["nonce"].encode()).hexdigest(),
                    "buyer_email_sha256":hashlib.sha256((after.get("buyer_email") or "").encode()).hexdigest(),
                    "native_status":"new","native_paid_value":0,"native_total_rub":after["total_rub"],
                    "reloaded":True,"account_host":HOST,
                    "positions":[{"offer_id":x["offer_id"],"position_id":x["position_id"],
                        "price_rub":x["price_rub"],"quantity":x["quantity"],"currency":x["currency"]}
                        for x in after["lines"]]}
                data=base64.b64encode(json.dumps(proof,separators=(",",":")).encode()).decode()
                acknowledged=ssh("ack",str(job["deal_number"]),data)
                if acknowledged.get("ok") is not True:raise RuntimeError("NATIVE_SERVER_LEDGER_ACK_FAILED")
                return {"mode":"verified","deal":job["deal_number"],"total":after["total_rub"],
                    "count":len(after["lines"]),"changed":not already}
            finally:
                if owned_mutex:
                    try:
                        if json.loads((UI_LOCK/"owner.json").read_text()).get("owner")=="BF2026_R180_PRICE_REPRICER":
                            shutil.rmtree(UI_LOCK)
                    except Exception as e:log("MUTEX_RELEASE_FAILED",error=str(e)[:120])
    finally:
        await close_target(id)

async def work(dry=False):
    if not dry and UI_LOCK.exists():return {"state":"waiting_exclusive_GC_UI_lock"}
    jobs=ssh("list")
    if not jobs:return {"state":"queue_empty"}
    results=[]
    for job in jobs[:6]:
        if not dry and UI_LOCK.exists():break
        try:
            a=await native_reprice(job,dry_run=dry)
            results.append(a)
            log("PRICE_READBACK" if dry else "PRICE_VERIFIED",**a)
        except Exception as e:
            log("REPRICE_ERROR",deal=job.get("deal_number"),kind=str(e)[:100])
            results.append({"deal":job.get("deal_number"),"error":str(e)[:150]})
            if not dry:break
    return results

async def main():
    dry="--dry-run" in sys.argv
    once="--once" in sys.argv or dry
    SINGLETON.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(str(SINGLETON),os.O_CREAT|os.O_RDWR,0o600)
    try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:raise SystemExit("R180_ALREADY_RUNNING")
    if once:
        result=await work(dry)
        print(json.dumps(result,ensure_ascii=False))
        return
    log("R180_WORKER_STARTED")
    while True:
        try:
            result=await work(False)
            # Per-deal readback/error is logged in work(); avoid noisy idle logs.
        except Exception as e:log("POLL_ERROR",message=str(e)[:130])
        await asyncio.sleep(5)

if __name__=="__main__":
    asyncio.run(main())
