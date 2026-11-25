# Private owner binding; no public provider credentials or arbitrary commands.
import http.client, json, os, pathlib, re, socket, threading, time
OWNER=os.environ.get("LUCH_HOME_AGENT_OWNER_ID","")
SOCKET=os.environ.get("LUCH_HOME_AGENT_SOCKET","")
KEY=os.environ.get("LUCH_AGENT_BRIDGE_KEY","")
THREAD="https://chatgpt.com/c/6afc1671-390c-83ed-909d-a2858c1526ef"
lock=threading.RLock()
def configured(uid):
    return bool(OWNER and uid==OWNER and SOCKET and len(KEY)>=32 and pathlib.Path(SOCKET).is_socket())
def initialize(c):
    c.executescript("""
    CREATE TABLE IF NOT EXISTS agent_grants(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, active INTEGER NOT NULL, generation INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_jobs(id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,message TEXT NOT NULL,state TEXT NOT NULL,reply TEXT,created INTEGER NOT NULL,PRIMARY KEY(user_id,id));
    """)
    c.execute("UPDATE agent_jobs SET state='failed' WHERE state='pending'")
class UnixHTTP(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(SOCKET)
def transport(message,rid):
    h=UnixHTTP("localhost",timeout=125)
    try:
        h.request("POST","/chat",json.dumps({"message":message,"request_id":rid}),{"Content-Type":"application/json","X-Bridge-Key":KEY})
        r=h.getresponse(); b=json.loads(r.read(32000))
        if (r.status==200 and b.get("ok") is True and b.get("provider")=="chatgpt_browser_bridge" and b.get("thread_url")==THREAD and b.get("request_id")==rid and b.get("verified_browser_receipt") is True and isinstance(b.get("text"),str) and b["text"].strip()):
            return b["text"][:3500]
    finally:
        h.close()
def view(c,uid):
    setup=configured(uid)
    g=c.execute("SELECT active FROM agent_grants WHERE user_id=?",(uid,)).fetchone()
    active=bool(setup and g and g["active"])
    rows=c.execute("SELECT id,message,state,reply FROM agent_jobs WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 20",(uid,)).fetchall() if active else []
    return {"configured":setup,"authorized":active,"jobs":[dict(r) for r in reversed(rows)],"tools_connected":False}
def execute(connect,uid,rid,message,generation):
    try:
        with lock,connect() as c:
            g=c.execute("SELECT active,generation FROM agent_grants WHERE user_id=?",(uid,)).fetchone()
            admitted=bool(configured(uid) and g and g["active"] and g["generation"]==generation)
        reply=transport(message,rid) if admitted else None
    except Exception:
        reply=None
    with lock,connect() as c:
        c.execute("UPDATE agent_jobs SET state=?,reply=? WHERE user_id=? AND id=? AND state='pending' AND EXISTS(SELECT 1 FROM agent_grants WHERE user_id=? AND active=1 AND generation=?)",("done" if reply else "failed",reply,uid,rid,uid,generation))
def post(c,uid,path,data,connect,limited):
    def err(status,msg):return status,{"ok":False,"error":msg}
    if not OWNER or uid!=OWNER:return err(403,"Personal agent not bound to this account.")
    with lock:
        if path.endswith("/revoke"):
            if data:return err(400,"Unexpected fields.")
            c.execute("UPDATE agent_grants SET active=0,generation=generation+1 WHERE user_id=?",(uid,))
            c.execute("UPDATE agent_jobs SET state='failed',reply=NULL WHERE user_id=? AND state='pending'",(uid,))
            c.commit();return 200,{"ok":True}
        if not configured(uid):return err(503,"Personal model connection not configured.")
        if path.endswith("/grant"):
            if set(data)!={"consent"} or data["consent"] is not True:return err(400,"Explicit consent required.")
            c.execute("INSERT INTO agent_grants VALUES(?,1,1) ON CONFLICT(user_id) DO UPDATE SET active=1,generation=generation+1 WHERE active=0",(uid,))
            c.commit();return 200,{"ok":True}
        g=c.execute("SELECT active,generation FROM agent_grants WHERE user_id=?",(uid,)).fetchone()
        if not g or not g["active"]:return err(403,"Authorize personal agent first.")
        rid=data.get("id");message=data.get("message")
        if set(data)!={"id","message"} or not isinstance(rid,str) or not re.fullmatch(r"[a-f0-9]{32}",rid) or not isinstance(message,str) or not 1<=len(message)<=450 or message!=message.strip():return err(400,"Invalid request.")
        old=c.execute("SELECT message,state FROM agent_jobs WHERE user_id=? AND id=?",(uid,rid)).fetchone()
        if old:
            if old["message"]!=message:return err(409,"Request ID conflict.")
            return 200,{"ok":True,"id":rid,"state":old["state"]}
        if c.execute("SELECT 1 FROM agent_jobs WHERE user_id=? AND state='pending'",(uid,)).fetchone():return err(409,"Previous request pending.")
        if limited("agent:"+uid,10,3600):return err(429,"Message limit reached.")
        c.execute("INSERT INTO agent_jobs VALUES(?,?,?,'pending',NULL,?)",(rid,uid,message,int(time.time())))
        c.commit()
        threading.Thread(target=execute,args=(connect,uid,rid,message,g["generation"]),daemon=True).start()
        return 202,{"ok":True,"id":rid,"state":"pending"}
