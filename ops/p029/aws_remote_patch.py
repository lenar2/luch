#!/usr/bin/env python3
"""P029 AWS EC2 Caddy patch worker. Delivered via authenticated SSM, not public ingress.
Only changes the dedicated luch.lenarsalimov.ru site. No DNS, secrets or api virtual host changes.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

MARKER = 'P029_AWS_FIRST_INGRESS_R11'
HOST = 'luch.lenarsalimov.ru'
UPSTREAM = 'api.lenarsalimov.ru'
DEFAULT_CONFIG = '/etc/caddy/Caddyfile'
DEFAULT_BACKUP = '/etc/caddy/.p029-aws-first-backups'

# NOTE: This is an AWS GATEWAY to some services still hosted on Vultr.
# No assertion of backend independence from Vultr is made.
GATEWAY_PATHS = [
    '/.well-known/oauth-protected-resource/luch/beam/mcp',
    '/luch/beam/mcp',
    '/.well-known/oauth-protected-resource/luch/browser/mcp',
    '/luch/browser/*',
    '/.well-known/oauth-protected-resource/browser-bridge-v1/mcp',
    '/agent-relay-v2/*',
    '/governor-github-push/*',
    '/luch/core/v1/pairing/claim',
]


def site_span(text, hostname=HOST):
    # Position from full-line site label; lexical Caddy braces in JSON strings
    # inside other hosts do not matter because we start at a unique exact header.
    pat = re.compile(r'(?m)^' + re.escape(hostname) + r'\s*\{\s*$')
    found = list(pat.finditer(text))
    if len(found) != 1:
        raise ValueError('exactly one LUCH site required, found ' + str(len(found)))
    open_at = text.find('{', found[0].start())
    depth = 0
    quote = None
    escape = False
    for i in range(open_at, len(text)):
        c = text[i]
        if quote:
            if escape: escape = False
            elif c == '\\': escape = True
            elif c == quote: quote = None
            continue
        if c in ('"', "'", '`'):
            quote = c
        elif c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: return found[0].start(), i + 1
    raise ValueError('unclosed Caddy LUCH site')


def render_routes():
    lines = ['    # ' + MARKER + ' BEGIN: dedicated hostname gateway, no api or payment edits']
    for path in GATEWAY_PATHS:
        # `handle` (not `handle_path`) intentionally retains the full path sent
        # to the legacy api vhost. The upstream itself strips its own prefixes.
        lines += [
            '    handle ' + path + ' {',
            '        reverse_proxy https://' + UPSTREAM + ' {',
            '            header_up Host ' + UPSTREAM,
            '            transport http {',
            '                tls_server_name ' + UPSTREAM,
            '            }',
            '        }',
            '    }',
        ]
    lines.append('    # ' + MARKER + ' END')
    return '\n'.join(lines) + '\n'


def patch_caddy(text):
    start, end = site_span(text)
    site = text[start:end]
    if MARKER in site:
        return text, False
    if 'handle /luch/mcp {' not in site or 'handle /luch/core/mcp {' not in site:
        raise ValueError('AWS canonical and Core routes must already exist; refusing to replace them')
    for path in GATEWAY_PATHS:
        # No competing route with the same path can be silently shadowed.
        needle = r'(?m)^\s*handle(?:_path)?\s+' + re.escape(path) + r'\s*\{'
        if re.search(needle, site):
            raise ValueError('existing route requires manual reconciliation: ' + path)
    # Place within the site before existing main MCP; Caddy path handles take precedence.
    match = re.search(r'(?m)^[ \t]*handle[ \t]+/luch/mcp[ \t]*\{', site)
    if not match: raise ValueError('canonical handle missing in AWS Caddy site')
    at = match.start()
    new_site = site[:at] + render_routes() + site[at:]
    result = text[:start] + new_site + text[end:]
    # Require unrelated api host bytes untouched (stronger than a string count).
    api_start = re.search(r'(?m)^api\.lenarsalimov\.ru\s*\{\s*$', text)
    if api_start:
        # AWS may have an isolated api TLS SNI stub; preserve its exact bytes.
        a, b = site_span(text, 'api.lenarsalimov.ru')
        c, d = site_span(result, 'api.lenarsalimov.ru')
        if text[a:b] != result[c:d]:
            raise ValueError('api config was modified')
    return result, True


def sh(*argv, timeout=30):
    x = subprocess.run(list(argv), capture_output=True, text=True, timeout=timeout)
    if x.returncode != 0:
        raise RuntimeError('command failed: ' + argv[0] + ' [' + str(x.returncode) + ']: ' + x.stderr[-300:])
    return x.stdout


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['inspect','apply','rollback'])
    parser.add_argument('--backup')
    args = parser.parse_args(argv)
    p = Path(os.environ.get('P029_CADDY_PATH', DEFAULT_CONFIG))
    backupdir = Path(os.environ.get('P029_BACKUP_DIR', DEFAULT_BACKUP))
    original = p.read_bytes()
    original_sha = hashlib.sha256(original).hexdigest()
    original_text = original.decode('utf-8')
    before_marker = MARKER in original_text[site_span(original_text)[0]:site_span(original_text)[1]]
    print('P029_CURRENT', json.dumps({'sha256':original_sha,'marker_present':before_marker},sort_keys=True))
    if args.action == 'inspect':
        _ = patch_caddy(original_text) if not before_marker else None
        sh('systemctl','is-active','--quiet','caddy')
        sh('caddy','validate','--config',str(p),'--adapter','caddyfile')
        print('P029_EC2_PREFLIGHT_OK')
        return
    if args.action == 'rollback':
        if not args.backup or not Path(args.backup).resolve().is_relative_to(backupdir.resolve()):
            raise ValueError('rollback backup must be inside audited AWS backup directory')
        bp=Path(args.backup)
        old=bp.read_bytes()
        if not before_marker: raise ValueError('rollback refused: R11 marker absent from current config')
        if MARKER in old.decode('utf8'): raise ValueError('backup unexpectedly contains R11 marker')
        _replace_checked(p,old, original_sha)
        print('P029_EC2_ROLLBACK_DONE',json.dumps({'backup':str(bp),'sha256':hashlib.sha256(old).hexdigest()}))
        return
    sh('systemctl','is-active','--quiet','caddy')
    # Force known network egress and still preserve existing AWS main/Core routes.
    sh('curl','--noproxy','*','-fsS','--connect-timeout','4','--max-time','8',
       'https://'+UPSTREAM+'/agent-relay-v2/health')
    changed, needed = patch_caddy(original_text)
    if not needed:
        print('P029_EC2_ALREADY_APPLIED');return
    backupdir.mkdir(parents=True,exist_ok=True,mode=0o700)
    bp = backupdir/('Caddyfile-before-R11-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    fd = os.open(bp, os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'wb') as f: f.write(original); f.flush();os.fsync(f.fileno())
    print('P029_EC2_BACKUP',str(bp))
    _replace_checked(p,changed.encode(),original_sha)
    print('P029_EC2_PATCH_APPLIED',json.dumps({'before':original_sha,'after':hashlib.sha256(changed.encode()).hexdigest(),'backup':str(bp)},sort_keys=True))


def _replace_checked(path:Path,new_bytes:bytes,expected_sha:str):
    current=path.read_bytes()
    if hashlib.sha256(current).hexdigest()!=expected_sha:raise RuntimeError('concurrent Caddy config modification')
    tmp=path.parent/('.p029-aws-first-candidate-'+str(os.getpid()))
    try:
        with tmp.open('xb') as f:f.write(new_bytes);f.flush();os.fsync(f.fileno())
        st=path.stat();os.chmod(tmp,st.st_mode & 0o777);os.chown(tmp,st.st_uid,st.st_gid)
        sh('caddy','validate','--config',str(tmp),'--adapter','caddyfile')
        os.replace(tmp,path)
        try:
            sh('systemctl','reload','caddy')
        except Exception:
            # Restore previous config, preserve evidence and fail loudly.
            with path.open('wb') as f: f.write(current);f.flush();os.fsync(f.fileno())
            os.chmod(path,st.st_mode & 0o777);os.chown(path,st.st_uid,st.st_gid)
            sh('systemctl','reload','caddy')
            raise
    finally:
        if tmp.exists():tmp.unlink()

if __name__=='__main__':
    main()
