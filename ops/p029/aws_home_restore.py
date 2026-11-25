#!/usr/bin/env python3
"""Restore only existing public website/Home on AWS ingress; no DNS or MCP edits.
Run on authorized AWS EC2 via existing SSM. Vultr origin must be healthy.
"""
import argparse, datetime, hashlib, os, re, subprocess, tempfile
from pathlib import Path
HOST='luch.lenarsalimov.ru'
ORIGIN='136.244.82.202'
MARK='P029_EXISTING_SITE_HOME_AWS_R1'
PATHS=['/','/en','/en/*','/ru','/ru/*','/home','/home/*','/assets/*','/docs','/docs/*','/privacy','/privacy/*','/terms','/terms/*','/security','/security/*','/support','/support/*','/favicon.ico']
def span(text):
    matches=list(re.finditer(r'(?m)^'+re.escape(HOST)+r'[ \t]*\{[ \t]*$',text))
    if len(matches)!=1: raise ValueError('expected one canonical site block')
    i=text.index('{',matches[0].start()); level=0; quote=None; escaped=False; comment=False
    for n in range(i,len(text)):
        c=text[n]
        if comment:
            if c=='\n':comment=False
            continue
        if quote:
            if escaped:escaped=False
            elif c=='\\':escaped=True
            elif c==quote:quote=None
            continue
        if c=='#':comment=True;continue
        if c in '"\x60':quote=c;continue
        if c=='{':level+=1
        elif c=='}':
            level-=1
            if level==0:return matches[0].start(),n+1
    raise ValueError('unclosed site block')
def patch(text):
    a,b=span(text);site=text[a:b]
    if MARK in site: raise ValueError('already installed; inspect, do not replay')
    if 'P029_AWS_FIRST_INGRESS_R11' not in site or not re.search(r'(?m)^\s*handle\s+/luch/mcp\s*\{',site):raise ValueError('AWS R11 source mismatch')
    # Refuse an already configured website route rather than shadow it.
    for line in site.splitlines():
        if re.search(r'^\s*handle(?:_path)?\s+(?:/|/home(?:/\*)?|/en(?:/\*)?|/ru(?:/\*)?|/assets/\*)\s*\{',line):raise ValueError('existing website route requires reconciliation')
    if re.search(r'(?m)^\s*@existing_luch_site\b',site):raise ValueError('matcher collision')
    anchor=re.search(r'(?m)^[ \t]*handle[ \t]+/luch/mcp[ \t]*\{',site)
    route='\n    # '+MARK+'\n    @existing_luch_site path '+' '.join(PATHS)+'\n    handle @existing_luch_site {\n        reverse_proxy https://'+ORIGIN+' {\n            header_up Host '+HOST+'\n            transport http {\n                tls_server_name '+HOST+'\n            }\n        }\n    }\n'
    return text[:a]+site[:anchor.start()]+route+site[anchor.start():]+text[b:]
def sh(*cmd):
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=30,check=True);return p.stdout.strip()
def digest(b):return hashlib.sha256(b).hexdigest()
def probe(ip,path,expected):
    result=sh('curl','--noproxy','*','--resolve',HOST+':443:'+ip,'--connect-timeout','5','--max-time','10','-sS','-o','/dev/null','-w','%{http_code}','https://'+HOST+path)
    if result not in expected:raise RuntimeError(f'{ip} {path}: {result}, wanted {expected}')
    print(ip,path,result,flush=True)
def checks(ip):
    for path in ('/','/en/','/ru/','/home/','/home/healthz','/home/app.js','/en/platform/','/en/clients/','/privacy/','/terms/'):
        probe(ip,path,('200',))
def mcp_checks(ip):
    for path,code in [('/health','200'),('/luch/mcp','405'),('/luch/core/mcp','401'),('/luch/browser/mcp','401')]:probe(ip,path,(code,))
def atomic(path,data,expected):
    if digest(path.read_bytes())!=expected:raise RuntimeError('concurrent config modification')
    st=path.stat()
    fd,tmp=tempfile.mkstemp(prefix='.p029-home-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.chmod(tmp,st.st_mode&0o777);os.chown(tmp,st.st_uid,st.st_gid)
        sh('caddy','validate','--config',tmp,'--adapter','caddyfile')
        if digest(path.read_bytes())!=expected:raise RuntimeError('concurrent config modification')
        os.replace(tmp,path);sh('systemctl','reload','caddy')
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['inspect','apply']);p.add_argument('--confirm');a=p.parse_args()
    config=Path('/etc/caddy/Caddyfile');old=config.read_bytes();new=patch(old.decode()).encode()
    checks(ORIGIN);mcp_checks('127.0.0.1')
    print('CURRENT_SHA',digest(old),'CANDIDATE_SHA',digest(new),flush=True)
    if a.action=='inspect':return
    if a.confirm!=HOST:raise ValueError('explicit canonical host confirmation required')
    backup=Path('/etc/caddy/.p029-aws-first-backups')/('Caddyfile-before-HOME-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as f:f.write(old);f.flush();os.fsync(f.fileno())
    print('BACKUP',backup,flush=True)
    try:
        atomic(config,new,digest(old));checks('127.0.0.1');mcp_checks('127.0.0.1')
    except Exception:
        if digest(config.read_bytes())==digest(new):atomic(config,old,digest(new))
        raise
    print('RESTORE_APPLIED',digest(new),flush=True)
if __name__=='__main__':main()
