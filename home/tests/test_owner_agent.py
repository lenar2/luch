"""Owner-only HTTP contract. Fake transport is deliberately NOT model E2E."""
import importlib.util,json,pathlib,tempfile,threading,time,urllib.request,urllib.error
spec=importlib.util.spec_from_file_location("home",pathlib.Path(__file__).resolve().parents[1]/"app/server.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 m.DB=pathlib.Path(d)/"test.sqlite";m.initialize()
 server=m.BoundedServer(("127.0.0.1",0),m.Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 root="http://127.0.0.1:"+str(server.server_address[1])
 def call(path,data=None,session=None,csrf=None):
  h={"Origin":m.PUBLIC_ORIGIN,"Sec-Fetch-Site":"same-origin","Content-Type":"application/json"}
  if session:h["Cookie"]=session
  if csrf:h["X-LUCH-CSRF"]=csrf
  req=urllib.request.Request(root+"/api/"+path,data=None if data is None else json.dumps(data).encode(),headers=h)
  try:
   with urllib.request.urlopen(req,timeout=8) as r:return r.status,json.loads(r.read()),r.headers.get("Set-Cookie","")
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read()),""
 def user(name):
  data={"username":name,"password":"Test-only-strong-password-123"}
  assert call("register",dict(data,accepted_terms=True))[0]==200
  code,_,cookie=call("login",data);assert code==200
  sid=cookie.split(";")[0]
  return sid,call("state",session=sid)[1]["csrf"]
 try:
  a,ac=user("owneragent");b,bc=user("otheragent")
  with m.connect_db() as c:m.agent.OWNER=c.execute("SELECT id FROM users WHERE username='owneragent'").fetchone()[0]
  # Simulate only the private socket boundary; no real ChatGPT called.
  m.agent.configured=lambda uid:uid==m.agent.OWNER
  started=threading.Event();release=threading.Event();calls=[]
  def fake(message,rid):
   calls.append(rid);started.set();release.wait(5);return "SYNTHETIC TEST REPLY"
  m.agent.transport=fake
  assert call("agent")[0]==401
  assert call("agent",session=b)[1]=={"configured":False,"authorized":False,"jobs":[],"tools_connected":False}
  assert call("agent/grant",{"consent":True},b,bc)[0]==403
  assert call("agent/grant",{"consent":True},a,"wrong")[0]==403
  assert call("agent/grant",{"consent":1},a,ac)[0]==400
  rid="a"*32;data={"id":rid,"message":"test"}
  assert call("agent/send",data,a,ac)[0]==403
  assert call("agent/grant",{"consent":True},a,ac)[0]==200
  assert call("agent/send",data,a,ac)[0]==202
  assert started.wait(3)
  assert call("agent/send",data,a,ac)[1]["state"]=="pending"
  assert call("agent/send",dict(data,message="changed"),a,ac)[0]==409
  assert call("agent/send",dict(data,id="b"*32),a,ac)[0]==409
  assert call("agent",session=b)[1]["jobs"]==[]
  release.set()
  for _ in range(50):
   jobs=call("agent",session=a)[1]["jobs"]
   if jobs and jobs[0]["state"]=="done":break
   time.sleep(.05)
  assert jobs[0]["reply"]=="SYNTHETIC TEST REPLY" and calls==[rid]
  assert call("agent/send",data,a,ac)[1]["state"]=="done"
  started.clear();release.clear()
  assert call("agent/send",dict(data,id="c"*32),a,ac)[0]==202
  assert started.wait(3)
  assert call("agent/revoke",{},a,ac)[0]==200
  assert call("agent",session=a)[1]["jobs"]==[]
  assert call("agent/send",dict(data,id="d"*32),a,ac)[0]==403
  release.set();time.sleep(.2)
  with m.connect_db() as c:
   row=c.execute("SELECT state,reply FROM agent_jobs WHERE id=?",("c"*32,)).fetchone()
   assert row["state"]=="failed" and row["reply"] is None
  assert call("agent/grant",{"consent":True},a,ac)[0]==200
  with m.connect_db() as c:c.execute("INSERT INTO agent_jobs VALUES(?,?,?,'pending',NULL,?)",("e"*32,m.agent.OWNER,"interrupted",int(time.time())))
  m.initialize()
  with m.connect_db() as c:assert c.execute("SELECT state FROM agent_jobs WHERE id=?",("e"*32,)).fetchone()["state"]=="failed"
  assert call("logout",{},a,ac)[0]==200
  assert call("agent",session=a)[0]==401
  print(json.dumps({"status":"PASS","owner_only":True,"csrf":True,"duplicate_no_replay":True,"revocation_discards_late_reply":True,"interrupted_no_replay":True,"model_e2e":False,"transport":"synthetic"}))
 finally:
  release.set();server.shutdown();server.server_close()
