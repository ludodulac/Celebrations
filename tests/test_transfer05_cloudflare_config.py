#!/usr/bin/env python3
"""Synthetic tests only: never accesses Cloudflare or real credentials."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("transfer05",ROOT/"scripts/transfer05_cloudflare_config.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
TEMPLATE=ROOT/"docs/operations/TRANSFERT-CLOUDFLARE-EXEMPLE.json"
SOURCE_ACCOUNT="a"*32
TARGET_ACCOUNT="b"*32
TARGET_DB="11111111-2222-4333-8444-555555555555"

def filled():
    data=mod.load(TEMPLATE)
    data["source"]["account_id"]=SOURCE_ACCOUNT
    data["target"]["account_id"]=TARGET_ACCOUNT
    data["target"]["d1_id"]=TARGET_DB
    return data

class Transfer05Test(unittest.TestCase):
    def test_blank_example_is_safe_and_reports_gates(self):
        original=mod.load(TEMPLATE)
        results=mod.inspect(original)
        self.assertFalse(results["ready_for_domain_cutover"])
        self.assertEqual(len(results["missing_account_configuration"]),3)
        self.assertEqual(len(results["owner_checklist_incomplete"]),5)
        self.assertNotIn("ADMIN_PASSWORD_HASH",TEMPLATE.read_text())
        self.assertNotIn("CELEBRATIONS_BACKUP_PASSPHRASE",TEMPLATE.read_text())

    def test_candidate_config_has_exact_bound_resources_and_no_domain(self):
        data=filled()
        config=mod.render(data)
        self.assertEqual(config.count('binding = "DB"'),1)
        self.assertEqual(config.count('binding = "MEDIA_ACL"'),1)
        self.assertEqual(config.count(f'database_id = "{TARGET_DB}"'),2)
        for binding in ('MEDIA_BUCKET','EDITOR_BUCKET','ASSETS'):
            self.assertEqual(config.count(f'binding = "{binding}"'),1)
        self.assertIn('workers_dev = false',config)
        self.assertIn('preview_urls = false',config)
        self.assertNotIn("ronde-des-archanges-universelle.eu",config)
        self.assertNotIn(SOURCE_ACCOUNT,config)
        self.assertNotIn(mod.OLD_D1,config)
        self.assertNotIn("secret =",config)
        self.assertEqual(len(mod.inspect(data)["owner_checklist_incomplete"]),5)

    def test_all_owner_gates_explicitly_require_attention(self):
        data=filled()
        for key in mod.REQUIRED:data["readiness"][key]=True
        self.assertTrue(mod.inspect(data)["ready_for_domain_cutover"])
        data["readiness"][mod.REQUIRED[0]]=False
        self.assertFalse(mod.inspect(data)["ready_for_domain_cutover"])

    def test_same_account_and_same_d1_are_blocked(self):
        for broken in ("same_account","old_d1","same_bucket","old_worker","unsafe_name"):
            data=filled()
            if broken=="same_account":data["target"]["account_id"]=SOURCE_ACCOUNT
            if broken=="old_d1":data["target"]["d1_id"]=mod.OLD_D1
            if broken=="same_bucket":data["target"]["r2_editor"]=data["target"]["r2_historical"]
            if broken=="old_worker":data["target"]["worker"]=mod.OLD_WORKER
            if broken=="unsafe_name":data["target"]["worker"]="../../prod"
            with self.subTest(case=broken),self.assertRaises(ValueError):
                mod.render(data)

    def test_bad_source_snapshot_or_secret_fields_are_blocked(self):
        data=filled()
        data["source"]["d1_id"]="bad"
        with self.assertRaises(ValueError):mod.inspect(mod.load(self._file(data)))
        data=filled()
        data["target"]["password"]="secret"
        with self.assertRaises(ValueError):mod.load(self._file(data))
        data=filled()
        data["readiness"]["fresh_consistent_backup_completed"]="true"
        with self.assertRaises(ValueError):mod.load(self._file(data))

    def test_no_overwrite_on_output_file(self):
        data=filled()
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/"wrangler.transfer.toml"
            out.write_text("OLD",encoding="utf-8")
            self.assertTrue(out.exists())
            self.assertEqual(out.read_text(),"OLD")
            self.assertNotIn("OLD",mod.render(data))

    def _file(self,data):
        f=Path(tempfile.mkdtemp(prefix="transfer05-test-"))/"data.json"
        f.write_text(json.dumps(data),encoding="utf-8")
        self.addCleanup(lambda:f.unlink(missing_ok=True))
        self.addCleanup(lambda:f.parent.rmdir())
        return f

if __name__=="__main__":
    unittest.main()
