#!/usr/bin/env python3
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import aws_first as cf
import aws_remote_patch as rp

AWS_CADDY = '''{
    email admin@example.org
}

luch.lenarsalimov.ru {
    handle /luch/core/mcp {
        uri strip_prefix /luch/core
        reverse_proxy 127.0.0.1:9254
    }
    handle /luch/mcp {
        uri strip_prefix /luch
        reverse_proxy 127.0.0.1:9253
    }
    handle /health {
        respond "ok" 200
    }
    handle {
        respond "fallback" 404
    }
}

# api hostname is a completely separate service and MUST remain unchanged
api.lenarsalimov.ru {
    tls /some/existing/cert.pem /some/existing/key.pem
    handle /luch/core/mcp { reverse_proxy 127.0.0.1:9254 }
    handle { respond "Not migrated to AWS" 404 }
}
'''

class RemotePatchTests(unittest.TestCase):
    def test_patch_only_luch_site(self):
        after,changed=rp.patch_caddy(AWS_CADDY)
        self.assertTrue(changed)
        a,b=rp.site_span(AWS_CADDY,'api.lenarsalimov.ru')
        c,d=rp.site_span(after,'api.lenarsalimov.ru')
        self.assertEqual(AWS_CADDY[a:b],after[c:d])
        self.assertEqual(after.count(rp.MARKER+' BEGIN'),1)
        for path in rp.GATEWAY_PATHS:
            self.assertIn('handle '+path+' {',after)
        self.assertIn('header_up Host api.lenarsalimov.ru',after)
        self.assertIn('handle /luch/core/mcp {',after)
        self.assertIn('handle /luch/mcp {',after)
        after2,changed2=rp.patch_caddy(after)
        self.assertFalse(changed2)
        self.assertEqual(after,after2)
    def test_existing_route_conflict_halts(self):
        src=AWS_CADDY.replace('    handle /luch/mcp {', '    handle /luch/browser/* { respond 404 }\n    handle /luch/mcp {')
        with self.assertRaisesRegex(ValueError,'existing route'):
            rp.patch_caddy(src)
    def test_missing_core_or_canonical_halts(self):
        for keyword in ['handle /luch/core/mcp {','handle /luch/mcp {']:
            src=AWS_CADDY.replace(keyword, 'handle /other {' )
            with self.assertRaisesRegex(ValueError,'must already exist'):
                rp.patch_caddy(src)
    def test_missing_luch_site_halts(self):
        with self.assertRaisesRegex(ValueError,'exactly one'):
            rp.patch_caddy('api.lenarsalimov.ru {\n handle { respond 200 }\n}')
    def test_extra_other_host_before_luch_is_preserved(self):
        src='payments.example.org {\n handle { respond "payment" 200 }\n}\n'+AWS_CADDY
        after,_=rp.patch_caddy(src)
        self.assertEqual(src[:src.index('luch.lenarsalimov.ru {')],after[:after.index('luch.lenarsalimov.ru {')])

class Route53Tests(unittest.TestCase):
    def setUp(self):
        self.simple=[{'Name':cf.ZONE_DOMAIN,'Type':'A','TTL':30,'ResourceRecords':[{'Value':cf.VULTR_IP}]}]
        self.failover=[{'Name':cf.ZONE_DOMAIN,'Type':'A','TTL':30,'SetIdentifier':'vultr_primary','Failover':'PRIMARY','HealthCheckId':'HC-V','ResourceRecords':[{'Value':cf.VULTR_IP}]},
                       {'Name':cf.ZONE_DOMAIN,'Type':'A','TTL':30,'SetIdentifier':'aws_secondary','Failover':'SECONDARY','HealthCheckId':'HC-A','ResourceRecords':[{'Value':cf.AWS_IP}]}]
    def test_simple_to_primary_secondary(self):
        x=cf.desired_records(self.simple,'HC-A')
        self.assertEqual(len(x),2)
        self.assertEqual(x[0]['Failover'],'PRIMARY')
        self.assertEqual(x[0]['HealthCheckId'],'HC-A')
        self.assertEqual(cf.record_ip(x[0]),cf.AWS_IP)
        self.assertEqual(cf.record_ip(x[1]),cf.VULTR_IP)
        self.assertNotIn('HealthCheckId',x[1])
    def test_swap_preserves_vultr_health_check(self):
        x=cf.desired_records(self.failover,'HC-A')
        self.assertEqual(x[0]['HealthCheckId'],'HC-A')
        self.assertEqual(x[1]['HealthCheckId'],'HC-V')
    def test_reject_unknown_targets_and_alias(self):
        for item in [dict(self.simple[0],ResourceRecords=[{'Value':'8.8.8.8'}]),
                     dict(self.simple[0],AliasTarget={'DNSName':'other.example'})]:
            with self.assertRaises(cf.Hold):cf.validate_apex([item])
    def test_reject_partial_ha(self):
        r=dict(self.simple[0],Failover='PRIMARY',SetIdentifier='only')
        with self.assertRaises(cf.Hold):cf.validate_apex([r])
    def test_reject_ambiguous_two_simple(self):
        with self.assertRaises(cf.Hold):cf.validate_apex(self.simple*2)
    def test_apply_happy_path_writes_only_luch_dns(self):
        primary='HC-A'
        desired=cf.desired_records(self.failover,primary)
        with patch.object(cf,'aws_identity',return_value={'account':'123'}),\
             patch.object(cf,'zone',return_value='Z123'),\
             patch.object(cf,'apex_rrsets',side_effect=[self.failover,self.failover,desired]) as rr,\
             patch.object(cf,'ssm_patch',side_effect=['P029_EC2_PREFLIGHT_OK','P029_EC2_BACKUP /etc/caddy/.p029-aws-first-backups/test']),\
             patch.object(cf,'probe',return_value=[]),\
             patch.object(cf,'create_primary_healthcheck',return_value=(primary,False)),\
             patch.object(cf,'save_snapshot',return_value=pathlib.Path('/tmp/p029-mock-snapshot')) as save,\
             patch.object(cf,'batch_change',return_value='C123') as changes,\
             patch.object(cf,'restore_dns',side_effect=AssertionError('unexpected rollback')):
            cf.apply()
            calls=changes.call_args.args
            self.assertEqual(calls[0],'Z123')
            self.assertEqual(calls[1],self.failover)
            self.assertEqual(calls[2],desired)
            self.assertEqual([cf.record_ip(x) for x in calls[2]],[cf.AWS_IP,cf.VULTR_IP])
            self.assertEqual(save.call_args.args[3]['ec2_backup'],'/etc/caddy/.p029-aws-first-backups/test')
    def test_apply_probe_failure_restores_aws_caddy_without_dns_change(self):
        with patch.object(cf,'aws_identity',return_value={'account':'123'}),\
             patch.object(cf,'zone',return_value='Z123'),\
             patch.object(cf,'apex_rrsets',return_value=self.failover),\
             patch.object(cf,'ssm_patch',side_effect=['OK','P029_EC2_BACKUP /etc/caddy/.p029-aws-first-backups/test','ROLLED_BACK']) as remote,\
             patch.object(cf,'probe',side_effect=cf.Hold('bad Beam')),\
             patch.object(cf,'batch_change',side_effect=AssertionError('DNS mutated after failing probe')):
            with self.assertRaises(cf.Hold):cf.apply()
            self.assertEqual(remote.call_args.args,('rollback','/etc/caddy/.p029-aws-first-backups/test'))
    def test_apply_dns_readback_failure_restores_dns_and_aws_caddy(self):
        with patch.object(cf,'aws_identity',return_value={'account':'123'}),\
             patch.object(cf,'zone',return_value='Z123'),\
             patch.object(cf,'apex_rrsets',side_effect=[self.failover,self.failover,self.failover]),\
             patch.object(cf,'ssm_patch',side_effect=['OK','P029_EC2_BACKUP /etc/caddy/.p029-aws-first-backups/test','ROLLED_BACK']) as remote,\
             patch.object(cf,'probe',return_value=[]),\
             patch.object(cf,'create_primary_healthcheck',return_value=('HC-A',True)),\
             patch.object(cf,'save_snapshot',return_value=pathlib.Path('/tmp/p029-snapshot')),\
             patch.object(cf,'batch_change',return_value='C123'),\
             patch.object(cf,'restore_dns',return_value={}) as dns_back,\
             patch.object(cf,'discard_created_healthcheck',return_value=None) as health_back:
            with self.assertRaises(cf.Hold):cf.apply()
            dns_back.assert_called_once()
            health_back.assert_called_once_with('HC-A')
            self.assertEqual(remote.call_args.args,('rollback','/etc/caddy/.p029-aws-first-backups/test'))
    def test_rollback_backup_guard(self):
        with tempfile.TemporaryDirectory() as d:
            fn=pathlib.Path(d)/'bad.json'
            fn.write_text(json.dumps({'schema':'different'}))
            with self.assertRaises(cf.Hold):cf.restore_dns(fn)

    def test_no_route53_mutation_in_inspect(self):
        with patch.object(cf,'aws_identity',return_value={'account':'123','ip':cf.AWS_IP}),\
             patch.object(cf,'zone',return_value='Z123'),\
             patch.object(cf,'apex_rrsets',return_value=self.simple),\
             patch.object(cf,'ssm_patch',return_value='P029_EC2_PREFLIGHT_OK') as ssm,\
             patch.object(cf,'run') as cmd,\
             patch.object(cf,'batch_change',side_effect=AssertionError('DNS MUST NOT CHANGE')):
            cmd.return_value.stdout='401'
            cf.inspect()
            ssm.assert_called_once_with('inspect')

if __name__=='__main__':unittest.main(verbosity=2)
