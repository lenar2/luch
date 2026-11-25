#!/usr/bin/env python3
"""P029 R11: AWS-first LUCH ingress, single owner-authorized CloudShell entrypoint.

DOES NOT MOVE api.lenarsalimov.ru. Adds AWS LUCH-only reverse proxy routes
and changes only Route 53 records in the delegated LUCH public hosted zone.

This creates an AWS PRIMARY **ingress gateway**. Beam/Browser/AgentRelay may
still use Vultr as application backend; not AWS-independent HA. Must explicitly
validate authenticated MCP, downstream device state and real client sessions.

Usage:
    python3 aws_first.py inspect
    python3 aws_first.py apply --confirm luch.lenarsalimov.ru
    python3 aws_first.py verify
    python3 aws_first.py rollback --snapshot /path/to/backup.json --confirm luch.lenarsalimov.ru
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time
import uuid

HERE = Path(__file__).resolve().parent
DOMAIN = 'luch.lenarsalimov.ru'
ZONE_DOMAIN = DOMAIN + '.'
AWS_IP = '184.194.52.166'
VULTR_IP = '136.244.82.202'
AWS_INSTANCE = 'i-0b04d742f0a624bfa'
REGION = 'us-east-1'
ROOT = Path.home()/'.p029-aws-first-r11'
EXPECTED_NS = {
    'ns-2.awsdns-00.com.',
    'ns-794.awsdns-35.net.',
    'ns-1218.awsdns-24.org.',
    'ns-1969.awsdns-54.co.uk.',
}
REPORT_TAG='P029_R11'

class Hold(RuntimeError):pass

def halt(message):raise Hold(message)

def run(argv,timeout=55,stdin=None,allow_failure=False):
    try:
        result = subprocess.run(argv,capture_output=True,text=True,input=stdin,timeout=timeout)
    except (OSError,subprocess.TimeoutExpired) as e:
        halt('command unavailable or timed out: '+argv[0]+' '+str(e)[:180])
    if result.returncode and not allow_failure:
        halt('command failed: '+' '.join(argv[:3])+' code='+str(result.returncode)+' '+result.stderr[-300:])
    return result

def aws(*args):
    result=run(['aws','--no-cli-pager','--output','json',*args],timeout=65)
    try:return json.loads(result.stdout)
    except json.JSONDecodeError as e:halt('AWS output not JSON for '+str(args[:2]))

def write_private(name,data):
    ROOT.mkdir(parents=True,exist_ok=True,mode=0o700)
    path=ROOT/name
    with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as f:
        f.write(data);f.flush();os.fsync(f.fileno())
    return path

def aws_identity():
    caller=aws('sts','get-caller-identity')
    if not caller.get('Account') or not caller.get('Arn'):
        halt('AWS STS identity is missing')
    data=aws('ec2','describe-instances','--region',REGION,'--instance-ids',AWS_INSTANCE)
    instances=[i for res in data.get('Reservations',[]) for i in res.get('Instances',[])]
    if len(instances)!=1 or instances[0].get('InstanceId')!=AWS_INSTANCE or instances[0].get('PublicIpAddress')!=AWS_IP:
        halt('wrong AWS account/EC2 instance/public IP')
    if instances[0].get('State',{}).get('Name')!='running':halt('AWS EC2 is not running')
    ssm=aws('ssm','describe-instance-information','--region',REGION,'--filters','Key=InstanceIds,Values='+AWS_INSTANCE)
    matches=[x for x in ssm.get('InstanceInformationList',[]) if x.get('InstanceId')==AWS_INSTANCE]
    if len(matches)!=1 or matches[0].get('PingStatus')!='Online':
        halt('AWS EC2 is not reachable through Systems Manager')
    return {'account':caller['Account'],'ec2':AWS_INSTANCE,'ip':AWS_IP,'region':REGION}

def zone():
    x=aws('route53','list-hosted-zones-by-name','--dns-name',ZONE_DOMAIN)
    zones=[z for z in x.get('HostedZones',[]) if z.get('Name','').lower()==ZONE_DOMAIN and not z.get('Config',{}).get('PrivateZone')]
    if len(zones)!=1:halt('need exactly one public hosted zone for '+DOMAIN)
    zid=zones[0]['Id'].split('/')[-1]
    metadata=aws('route53','get-hosted-zone','--id',zid)
    names={s.lower().rstrip('.')+'.' for s in metadata.get('DelegationSet',{}).get('NameServers',[])}
    if names!=EXPECTED_NS:halt('zone NS do not match audited delegation: '+repr(sorted(names)))
    return zid

def apex_rrsets(zid):
    # AWS CLI paginates list-resource-record-sets unless --no-paginate.
    x=aws('route53','list-resource-record-sets','--hosted-zone-id',zid)
    return [r for r in x.get('ResourceRecordSets',[]) if r.get('Name','').lower()==ZONE_DOMAIN and r.get('Type')=='A']

def record_ip(r):
    if 'AliasTarget' in r:halt('AliasTarget A requires another rollout path; refuses changes')
    values={x.get('Value') for x in r.get('ResourceRecords',[])}
    if len(values)!=1:halt('ambiguous A RRset '+repr(values))
    ip=next(iter(values))
    if ip not in (AWS_IP,VULTR_IP):halt('unexpected pre-existing public A target '+repr(ip))
    return ip

def validate_apex(old):
    if not 1<=len(old)<=2:halt('unexpected number of LUCH A RRsets: '+str(len(old)))
    for r in old:
        record_ip(r)
        if r.get('TTL',0)>300 or r.get('TTL',0)<1:halt('unexpected root A TTL')
        if r.get('Failover') not in (None,'PRIMARY','SECONDARY'):
            halt('unrecognized Route 53 failover policy')
    if len(old)==2:
        modes={r.get('Failover') for r in old}
        if modes!={'PRIMARY','SECONDARY'}:
            halt('2-record zone has unrecognized routing policy; no blind rewrite')
        vals={record_ip(r) for r in old}
        if vals!={AWS_IP,VULTR_IP}:halt('expected AWS and Vultr targets in failover pair')
    if len(old)==1 and old[0].get('Failover') is not None:
        halt('one failover RRset without counterpart')

def matching_healthcheck(ip):
    checks=aws('route53','list-health-checks').get('HealthChecks',[])
    valid=[]
    for item in checks:
        c=item.get('HealthCheckConfig',{})
        if (c.get('IPAddress')==ip and c.get('Type')=='HTTPS' and c.get('Port')==443
            and c.get('ResourcePath')=='/health' and c.get('FullyQualifiedDomainName','').rstrip('.').lower()==DOMAIN
            and not c.get('Inverted') and not c.get('Disabled')):
            valid.append(item['Id'])
    return sorted(valid)[0] if valid else None

def create_primary_healthcheck():
    existing=matching_healthcheck(AWS_IP)
    if existing:return existing,False
    config={'IPAddress':AWS_IP,'Port':443,'Type':'HTTPS','ResourcePath':'/health',
            'FullyQualifiedDomainName':DOMAIN,'RequestInterval':30,'FailureThreshold':3,'EnableSNI':True}
    tmp=write_private('healthcheck-'+uuid.uuid4().hex+'.json',json.dumps(config).encode())
    try:
        r=aws('route53','create-health-check','--caller-reference','p029-aws-first-r11-'+uuid.uuid4().hex,
              '--health-check-config','file://'+str(tmp))
    finally:tmp.unlink(missing_ok=True)
    h=r.get('HealthCheck',{}).get('Id')
    if not h:halt('AWS primary health check not created')
    return h,True

def discard_created_healthcheck(health_id):
    # Only call for a health check created during this exact attempted cutover.
    aws('route53','delete-health-check','--health-check-id',health_id)
    print('CLEANED_CREATED_HEALTHCHECK',health_id)

def desired_records(old,primary_hc):
    validate_apex(old)
    old_vultr=[r for r in old if record_ip(r)==VULTR_IP]
    old_vultr_hc=old_vultr[0].get('HealthCheckId') if old_vultr else None
    primary={'Name':ZONE_DOMAIN,'Type':'A','SetIdentifier':'P029-R11-AWS-PRIMARY',
             'Failover':'PRIMARY','TTL':30,'ResourceRecords':[{'Value':AWS_IP}],
             'HealthCheckId':primary_hc}
    secondary={'Name':ZONE_DOMAIN,'Type':'A','SetIdentifier':'P029-R11-VULTR-SECONDARY',
               'Failover':'SECONDARY','TTL':30,'ResourceRecords':[{'Value':VULTR_IP}]}
    if old_vultr_hc:secondary['HealthCheckId']=old_vultr_hc
    return [primary,secondary]

def batch_change(zid,old,new,reason):
    commands=[{'Action':'DELETE','ResourceRecordSet':r} for r in old] + [
        {'Action':'CREATE','ResourceRecordSet':r} for r in new]
    data={'Comment':REPORT_TAG+' '+reason,'Changes':commands}
    path=write_private('batch-'+uuid.uuid4().hex+'.json',json.dumps(data).encode())
    try:
        response=aws('route53','change-resource-record-sets','--hosted-zone-id',zid,
                     '--change-batch','file://'+str(path))
    finally:path.unlink(missing_ok=True)
    changeid=response.get('ChangeInfo',{}).get('Id')
    if not changeid:halt('Route 53 did not return change ID')
    # Wait on exact change. No extra changes while propagation is pending.
    run(['aws','--no-cli-pager','route53','wait','resource-record-sets-changed','--id',changeid],timeout=220)
    return changeid

def ssm_patch(mode,backup=None):
    src=(HERE/'aws_remote_patch.py').read_text()
    if len(src)>14500:halt('EC2 patch payload unexpectedly large for SSM')
    cmd='python3 -c '+shlex.quote(src)+' '+shlex.quote(mode)
    if backup:cmd+=' --backup '+shlex.quote(backup)
    payload={'commands':[cmd],'executionTimeout':['180']}
    path=write_private('ssm-'+uuid.uuid4().hex+'.json',json.dumps(payload).encode())
    try:
        send=aws('ssm','send-command','--region',REGION,'--instance-ids',AWS_INSTANCE,
                 '--document-name','AWS-RunShellScript',
                 '--comment','P029 AWS dedicated LUCH ingress '+mode,
                 '--parameters','file://'+str(path))
    finally:path.unlink(missing_ok=True)
    cid=send.get('Command',{}).get('CommandId')
    if not cid:halt('SSM did not return command ID')
    run(['aws','--no-cli-pager','ssm','wait','command-executed','--region',REGION,
        '--command-id',cid,'--instance-id',AWS_INSTANCE],timeout=225)
    rr=aws('ssm','get-command-invocation','--region',REGION,'--command-id',cid,
           '--instance-id',AWS_INSTANCE)
    output=rr.get('StandardOutputContent','')
    # Avoid printing Caddy contents, tokens, secrets. Remote script emits bounded state.
    safe='\n'.join(line[:400] for line in output.splitlines() if line.startswith('P029_'))
    if rr.get('Status')!='Success':halt('SSM '+mode+' failed: '+rr.get('Status','unknown')+' '+rr.get('StandardErrorContent','')[-250:])
    print('SSM_'+mode.upper(),safe)
    return output

def probe(ip=AWS_IP):
    tests=[
      ('GET','/health',{200}),
      ('POST','/luch/mcp',{401}),
      ('POST','/luch/core/mcp',{401}),
      ('GET','/.well-known/oauth-protected-resource/luch/core/mcp',{200}),
      ('POST','/luch/beam/mcp',{200}),
      ('GET','/.well-known/oauth-protected-resource/luch/beam/mcp',{200}),
      ('POST','/luch/browser/mcp',{401}),
      ('GET','/.well-known/oauth-protected-resource/luch/browser/mcp',{200}),
      ('GET','/agent-relay-v2/health',{200}),
      ('POST','/browser-bridge-v1/mcp',{401}),
    ]
    results=[]
    for method,path,expected in tests:
        argv=['curl','--noproxy','*','--resolve',DOMAIN+':443:'+ip,
              '--connect-timeout','4','--max-time','12','-sS','-o','/dev/null',
              '-w','%{http_code}|%{ssl_verify_result}','-X',method]
        if method=='POST':
            argv+=['-H','Content-Type: application/json','-H','Accept: application/json, text/event-stream',
                   '--data',json.dumps({'jsonrpc':'2.0','id':3,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'P029','version':'R11'}}})]
        argv+=['https://'+DOMAIN+path]
        r=run(argv,timeout=16)
        code,_,tls=r.stdout.strip().partition('|')
        if tls!='0' or not code.isdigit() or int(code) not in expected:
            halt('AWS SNI/TLS route failed '+method+' '+path+' got '+repr(r.stdout.strip()))
        results.append({'path':path,'method':method,'status':int(code)})
    print('AWS_PINNED_INGRESS_GATES_PASS',len(results))
    return results

def save_snapshot(identity,zid,old,manifest):
    now=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    file=write_private('backup-'+now+'-'+uuid.uuid4().hex[:5]+'.json',json.dumps({
        'schema':'p029.aws-first-r11.snapshot.v1','utc':now,
        'instance':AWS_INSTANCE,'instance_ip':AWS_IP,
        'domain':DOMAIN,'zone_id':zid,'account':identity['account'],
        'old_rrsets':old,'manifest':manifest,
    },ensure_ascii=False,indent=2).encode())
    print('ROLLBACK_SNAPSHOT',file)
    return file

def restore_dns(snapshot,current=None):
    x=json.loads(Path(snapshot).read_text())
    if x.get('schema')!='p029.aws-first-r11.snapshot.v1' or x.get('domain')!=DOMAIN:
        halt('wrong/untrusted snapshot schema or domain')
    identity=aws_identity()
    if identity['account']!=x['account']:halt('AWS account differs from snapshot')
    zid=zone()
    if zid!=x['zone_id']:halt('hosted zone differs from snapshot')
    present=apex_rrsets(zid)
    expected=x['manifest'].get('new_rrsets')
    if expected and present!=expected:halt('DNS was changed after original cutover; refuse blind rollback')
    if present==x['old_rrsets']:
        print('DNS_ALREADY_RESTORED');return x
    print('DNS_ROLLBACK',batch_change(zid,present,x['old_rrsets'],'restore exact pre-R11 DNS'))
    if apex_rrsets(zid)!=x['old_rrsets']:halt('DNS rollback readback mismatch')
    return x

def apply():
    identity=aws_identity()
    zid=zone();old=apex_rrsets(zid)
    validate_apex(old)
    print('IDENTITY_PASS',json.dumps(identity))
    print('ROUTE53_PRESTATE',json.dumps(old,sort_keys=True))
    # Read-only EC2 inspection first; no modification of original payment/API ingress.
    ssm_patch('inspect')
    # Apply only the AWS LUCH hostname site change. Existing Core route remains.
    remote=ssm_patch('apply')
    matched=re.search(r'P029_EC2_BACKUP\s+(\S+)',remote)
    ec2backup=matched.group(1) if matched else None
    created=False
    aws_health=None
    dns_change_durable=False
    try:
        # Hard route parity gates with correct TLS SNI against AWS IP before DNS.
        checks=probe()
        aws_health,created=create_primary_healthcheck()
        proposed=desired_records(old,aws_health)
        manifest={'ec2_backup':ec2backup,'aws_healthcheck':aws_health,
                  'created_healthcheck':created,'new_rrsets':proposed,
                  'aws_negative_tests':checks}
        snapshot=save_snapshot(identity,zid,old,manifest)
        changed=False
        try:
            before=apex_rrsets(zid)
            if before!=old:halt('Route53 changed since preflight; refusing to overwrite')
            if before==proposed:
                print('DNS_ALREADY_TARGET');return
            change=batch_change(zid,before,proposed,'AWS PRIMARY + Vultr SECONDARY')
            changed=True
            dns_change_durable=True
            if apex_rrsets(zid)!=proposed:halt('AWS DNS readback mismatch')
            print('AWS_PRIMARY_DNS_CHANGED',change,'zone',zid,'snapshot',snapshot)
            probe()
            print('CUTOVER_GATEWAY_COMPLETE_BUT_AUTHENTICATED_CLIENT_E2E_UNVERIFIED')
        except Exception:
            if changed:
                try:
                    restore_dns(snapshot)
                    dns_change_durable=False
                except Exception as rollback_error:
                    print('CRITICAL_DNS_ROLLBACK_FAILED',repr(rollback_error),file=sys.stderr)
                    raise
            raise
    except Exception:
        # If DNS rollback could not be confirmed, keep AWS routes serving traffic.
        if not dns_change_durable and ec2backup:
            try:ssm_patch('rollback',ec2backup)
            except Exception as exc:print('CRITICAL_EC2_ROLLBACK_FAILED',repr(exc),file=sys.stderr)
        if not dns_change_durable and created and aws_health:
            try:discard_created_healthcheck(aws_health)
            except Exception as exc:print('HEALTHCHECK_CLEANUP_PENDING',repr(exc),file=sys.stderr)
        raise

def inspect():
    identity=aws_identity()
    zid=zone();old=apex_rrsets(zid);validate_apex(old)
    print('IDENTITY_PASS',json.dumps(identity))
    print('DNS_READONLY',json.dumps({'zone':zid,'records':old},sort_keys=True))
    ssm_patch('inspect')
    # Only routes present before EC2 patch are checked here.
    for path,method in [('/health','GET'),('/luch/mcp','POST'),('/luch/core/mcp','POST')]:
        argv=['curl','--noproxy','*','--resolve',DOMAIN+':443:'+AWS_IP,'--connect-timeout','4',
              '--max-time','9','-sS','-o','/dev/null','-w','%{http_code}','-X',method,
              'https://'+DOMAIN+path]
        r=run(argv,timeout=13)
        print('AWS_EXISTING_ROUTE',path,method,r.stdout.strip())

def verify():
    identity=aws_identity();zid=zone();old=apex_rrsets(zid)
    validate_apex(old)
    prim=[r for r in old if r.get('Failover')=='PRIMARY']
    sec=[r for r in old if r.get('Failover')=='SECONDARY']
    if len(prim)!=1 or len(sec)!=1 or record_ip(prim[0])!=AWS_IP or record_ip(sec[0])!=VULTR_IP:
        halt('AWS primary / Vultr secondary NOT effective in Route53')
    probe()
    print('AWS_GATEWAY_VERIFY_PASS','zone',zid,'PrimaryHealthCheckId',prim[0].get('HealthCheckId'),
          'OAuth authenticated clients and AWS-independent compute STILL require live E2E verification')

def rollback(path):
    snapshot=json.loads(Path(path).read_text())
    if snapshot.get('schema')!='p029.aws-first-r11.snapshot.v1':halt('invalid snapshot')
    restore_dns(path)
    oldpath=snapshot.get('manifest',{}).get('ec2_backup')
    if oldpath:ssm_patch('rollback',oldpath)
    print('AWS_R11_ROLLBACK_COMPLETE',path)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['inspect','apply','verify','rollback'])
    p.add_argument('--confirm',default='')
    p.add_argument('--snapshot')
    args=p.parse_args()
    if args.action in ('apply','rollback') and args.confirm!=DOMAIN:
        halt('explicit --confirm '+DOMAIN+' required for production writes')
    if args.action=='rollback' and not args.snapshot:halt('--snapshot is required to rollback')
    try:
        if args.action=='inspect':inspect()
        if args.action=='apply':apply()
        if args.action=='verify':verify()
        if args.action=='rollback':rollback(args.snapshot)
    except Hold as exc:
        print('P029_HOLD',str(exc),file=sys.stderr)
        sys.exit(2)

if __name__=='__main__':main()
