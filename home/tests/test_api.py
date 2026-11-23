#!/usr/bin/env python3
"""Isolated, no-network LUCH Home R7 contract test. Never touches real user state."""
import importlib.util, json, pathlib, tempfile, threading, urllib.error, urllib.request
P=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("home_server",P/"app/server.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.DB=pathlib.Path(tempfile.mkdtemp(prefix="luch-home-r7-"))/"test.sqlite"
m.initialize()
real=m.check_public_website
def fake(origin):
 return {"origin":origin,"checked_at":1795200000,"http_status":200,"page_title":"Verified public page",
         "mobile_viewport":True,"page_language":"en","meta_description":True,"elapsed_ms":41,
         "content_type":"text/html","bytes_examined":130,"sha256_prefix":"deadbeef"*3,
         "observations":["Website responded successfully."],"scope":"mock for contract test ONLY"}
m.check_public_website=fake
server=m.BoundedServer(("127.0.0.1",0),m.Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
root="http://127.0.0.1:"+str(server.server_address[1])
def call(path,body=None,sid="",csrf="",origin=m.PUBLIC_ORIGIN):
 headers={"Accept":"application/json","Origin":origin,"Sec-Fetch-Site":"same-origin"}
 if body is not None:headers["Content-Type"]="application/json"
 if sid:headers["Cookie"]=sid
 if csrf:headers["X-LUCH-CSRF"]=csrf
 req=urllib.request.Request(root+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=9) as res:
   val=json.loads(res.read());return res.status,val,res.headers.get("Set-Cookie","")
 except urllib.error.HTTPError as e:
  return e.code,json.loads(e.read()),e.headers.get("Set-Cookie","")
try:
 assert call("/healthz")[0]==200
 assert call("/api/state")[1]["authenticated"] is False
 assert call("/api/register",{"username":"alphauser","password":"unique-very-long-strong-A1"})[0]==200
 status,_,set_cookie=call("/api/login",{"username":"alphauser","password":"unique-very-long-strong-A1"})
 assert status==200
 alpha=set_cookie.split(";",1)[0]
 assert alpha.startswith("luch_home_sid=")
 st,body,_=call("/api/state",sid=alpha);assert st==200 and body["authenticated"] and body["username"]=="alphauser"
 csrf_a=body["csrf"]
 st,_,_=call("/api/register",{"username":"betauser","password":"different-very-long-strong-B2"})
 assert st==200
 st,_,set_cookie=call("/api/login",{"username":"betauser","password":"different-very-long-strong-B2"})
 assert st==200;beta=set_cookie.split(";",1)[0]
 st,body,_=call("/api/state",sid=beta);assert st==200 and body["username"]=="betauser"
 csrf_b=body["csrf"]
 assert call("/api/check",{},sid=alpha,csrf=csrf_a)[0]==403
 assert call("/api/consent",{"origin":"http://example.com"},sid=alpha,csrf=csrf_a)[0]==400
 assert call("/api/consent",{"origin":"https://127.0.0.1"},sid=alpha,csrf=csrf_a)[0]==400
 assert call("/api/consent",{"origin":"https://localhost"},sid=alpha,csrf=csrf_a)[0]==400
 assert call("/api/consent",{"origin":"https://example.com"},sid=alpha,csrf="wrong")[0]==403
 assert call("/api/consent",{"origin":"https://example.com"},sid=alpha,csrf=csrf_a,origin="https://evil.invalid")[0]==403
 # Synthetic DNS resolution for offline test of public host permission.
 m.validated_ip=lambda host:["8.8.8.8"]
 assert call("/api/consent",{"origin":"https://example.com"},sid=alpha,csrf=csrf_a)[0]==200
 assert call("/api/check",{},sid=alpha,csrf=csrf_a)[0]==200
 a=call("/api/state",sid=alpha)[1]
 assert len(a["checks"])==1 and a["checks"][0]["result"]["page_title"]=="Verified public page"
 b=call("/api/state",sid=beta)[1]
 assert len(b["checks"])==0 and b["grant"] is None
 assert call("/api/check",{},sid=beta,csrf=csrf_b)[0]==403
 assert call("/api/revoke",{},sid=alpha,csrf=csrf_a)[0]==200
 assert call("/api/check",{},sid=alpha,csrf=csrf_a)[0]==403
 assert call("/api/delete-account",{"username":"betauser"},sid=beta,csrf=csrf_b)[0]==200
 assert call("/api/state",sid=beta)[1]["authenticated"] is False
 assert call("/api/logout",{},sid=alpha,csrf=csrf_a)[0]==200
 assert call("/api/state",sid=alpha)[1]["authenticated"] is False
 print(json.dumps({"status":"PASS","scenarios":17,"two_users_isolated":True,
                   "private_url_denied":True,"cors_origin_denied":True,"csrf_denied":True,
                   "after_revoke_denied":True,"post_logout_denied":True,"account_deletion":True,
                   "external_network_used":False}))
finally:
 m.check_public_website=real
 server.shutdown();server.server_close();thread.join(timeout=5)
