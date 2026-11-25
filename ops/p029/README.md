# P029 · R11 AWS-first LUCH ingress — deployment kit

**Status 2026-11-25: code and offline tests ready; no AWS account changes executed.**

The goal is AWS as the **public ingress** for `luch.lenarsalimov.ru` with Vultr
as Route 53 secondary. Do **not** change the REG.RU `api.lenarsalimov.ru` A
record, its Caddy route block, or payment/GetCourse containers.

## One CloudShell workflow (after AWS owner login)

The `lenar2/luch` repo is intended as the distribution point for this
non-secret deployment kit. Use a known reviewed commit rather than an unpinned
branch. From authenticated AWS CloudShell in **us-east-1**:

```bash
# Pin <REVIEWED_SHA> to the published git commit containing this reviewed kit.
git clone --depth 1 --branch p029/r11-aws-first-ingress-20261125 https://github.com/lenar2/luch.git ~/luch-p029-r11
cd ~/luch-p029-r11
git checkout --detach <REVIEWED_SHA>
python3 ops/p029/aws_first.py inspect
python3 ops/p029/aws_first.py apply --confirm luch.lenarsalimov.ru
python3 ops/p029/aws_first.py verify
```

Or after the `git checkout` step, **one actual apply command** handles AWS
EC2/SSM route deployment, Route 53, route smoke tests and failure rollback:
`python3 ops/p029/aws_first.py apply --confirm luch.lenarsalimov.ru`.

Required AWS permissions: `sts:GetCallerIdentity`, `ec2:DescribeInstances`,
`ssm:DescribeInstanceInformation`, `ssm:SendCommand`,
`ssm:GetCommandInvocation`, `route53:ListHostedZonesByName`,
`route53:GetHostedZone`, `route53:ListResourceRecordSets`,
`route53:ListHealthChecks`, `route53:CreateHealthCheck` (if missing),
`route53:ChangeResourceRecordSets`, `route53:GetChange`, and
`route53:DeleteHealthCheck` for failed cleanup.

## Scope of changes

1. Verify the **specific** pre-existing AWS EC2 instance and expected public
   IP, live SSM agent, correct account and Route 53 delegated hosted zone.
2. Through authenticated SSM, read and back up `/etc/caddy/Caddyfile` on AWS.
   Add only missing dedicated LUCH hostname reverse-proxy handlers for Beam,
   Browser Companion, legacy OAuth metadata, Agent Relay, GitHub Governor push,
   and pairing claim. **Preserve existing AWS canonical MCP and Core MCP.**
3. Check the Caddyfile using `caddy validate`, reload Caddy, run SNI-pinned
   negative-auth and routing tests directly against AWS without changing DNS.
   AWS ingress routes for certain downstream workloads proxy to
   `api.lenarsalimov.ru` on Vultr to preserve the existing data and permissions.
4. Inspect and back up all Route 53 A RRsets for the delegated
   `luch.lenarsalimov.ru` zone. Reuse or create a *separate AWS IP-specific*
   HTTPS `/health` health check and install **AWS PRIMARY + Vultr SECONDARY**
   Route 53 failover A records. Do not modify any other domain.
5. Wait for Route 53 `INSYNC`, verify A record readback and repeat SNI-pinned
   route probes. Record a time-stamped snapshot under
   `~/.p029-aws-first-r11/backup-*.json` in AWS CloudShell.

## Explicit limitations and acceptance gates

- This package can be fully developed and tested offline, but **no real AWS
  SSM, IAM, Route 53 write or authenticated MCP client E2E can be proven** until
  owner AWS access exists. The AWS Caddyfile may have drifted, so the installer
  refuses conflicting routes rather than overwriting them.
- **Ingress ≠ independent AWS backend.** The AWS gateway still relies on
  Vultr for Beam, Browser Companion, Agent Relay and other shared state.
  A Vultr outage can therefore still interrupt those features. Moving the
  actual services/data to AWS is a separate backend migration.
- OAuth protected-resource metadata currently reports legacy `api` URLs for
  Core/Beam/Browser. Because the issuer, audience and installed host tokens
  have not been authenticated end to end on AWS, the kit intentionally proxies
  existing metadata and does **not** fabricate a new OAuth audience or weaken
  authentication. Changing client manifests should happen only after real
  authenticated `tools/list` and read-only `tools/call` for each host pass.
- The SNI-pinned probes intentionally confirm OAuth-protected **401** on
  canonical/Core/Browser; a 401 is **not an authenticated E2E success**.
  The final live acceptance must separately exercise ChatGPT, Claude, Cursor,
  Gemini CLI and P002 Beam over AWS (then merge/publish existing client draft
  PRs). Native Browser Companion extension pairing must also be verified.
- The installer never prints or copies user tokens, credentials or private keys.
  It requires an **already authenticated, authorized** AWS CloudShell session.

## Rollback

If the installer encounters an error after a DNS change, it attempts immediate
Route 53 restoration from the exact snapshot before reverting Caddy. If it
cannot restore DNS, it leaves the AWS Caddy routes in place to maintain service
and prints an explicit critical error.

For an explicit later rollback use the exact backup path emitted during apply:

```bash
python3 ops/p029/aws_first.py rollback \
  --snapshot "$HOME/.p029-aws-first-r11/backup-<EXACT_VALUE>.json" \
  --confirm luch.lenarsalimov.ru
```

This restores the original delegated-zone RRsets and the original AWS Caddyfile
from `/etc/caddy/.p029-aws-first-backups/`. It will refuse to restore if the
records have been altered by someone else in the meantime. Separate app-level
OAuth revocation is **not** attempted.

## Offline QA

```bash
python3 ops/p029/test_offline.py
python3 -m py_compile ops/p029/aws_first.py ops/p029/aws_remote_patch.py
```

All offline tests are non-destructive mocks and cannot replace AWS IAM/SSM,
Caddy-on-EC2, OAuth or real multi-host tests. The AWS source and CloudShell
bundle contain no private `.env`, certificate keys, S3 transfer URL or JWT.

## Existing consumer source candidates (do not merge before authenticated AWS E2E)

- Claude: https://github.com/lenar2/luch-claude-plugin/pull/5
- Cursor: https://github.com/lenar2/luch-cursor/pull/1
- Gemini CLI: https://github.com/lenar2/luch-gemini/pull/1
- ChatGPT LUCH Core / HA Canary source already uses `https://luch.lenarsalimov.ru/luch/mcp`.
- Private P002 Beam plugin `luch-beam-p002` v0.2.7 currently uses the old
  `https://api.lenarsalimov.ru/luch/beam/mcp`; stage the replacement for this
  plugin before promoting it. Changing AWS DNS alone **will not** rewrite it.

Canonical evidence thread: https://github.com/lenar2/ai-factory-evidence/issues/3938
