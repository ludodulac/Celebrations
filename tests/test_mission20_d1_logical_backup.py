"""M20 offline checks: D1 snapshot restore/encryption, no real network or secrets."""
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
import mission20_d1_logical_backup as m20


def sample():
    return {
        "schema": [
            {"type": "table", "name": "parents", "tbl_name": "parents",
             "sql": "CREATE TABLE parents (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"},
            {"type": "table", "name": "children", "tbl_name": "children",
             "sql": "CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parents(id))"},
            {"type": "index", "name": "idx_children_parent", "tbl_name": "children",
             "sql": "CREATE INDEX idx_children_parent ON children(parent_id)"},
        ],
        "tables": {
            "parents": {"columns": ["id", "name"], "values": [[1, "test"], [2, "test deux"]]},
            "children": {"columns": ["id", "parent_id"], "values": [[10, 1], [11, 2]]},
        },
        "counts": {"parents": 2, "children": 2},
        "total_rows": 4
    }


class TestM20(unittest.TestCase):
    def test_restore_in_ram_full_referential(self):
        self.assertEqual(m20.restore_in_ram(sample()),
                         {"tables": 2, "rows": 4, "integrity": "ok", "foreign_key_violations": 0})

    def test_foreign_key_violation_rejected(self):
        x = sample()
        x["tables"]["children"]["values"][1][1] = 999
        with self.assertRaises(ValueError):
            m20.restore_in_ram(x)

    def test_row_count_missing_rejected(self):
        x = sample()
        x["tables"]["parents"]["values"].pop()
        with self.assertRaises(ValueError):
            m20.restore_in_ram(x)

    def test_encrypt_decrypt_and_tampering(self):
        phrase = os.urandom(40)
        raw = b'private data' * 160
        package = m20.encrypt(raw, phrase)
        self.assertEqual(m20.decrypt(package, phrase), raw)
        altered = bytearray(package)
        altered[-1] ^= 1
        with self.assertRaises(Exception):
            m20.decrypt(bytes(altered), phrase)
        with self.assertRaises(Exception):
            m20.decrypt(package, os.urandom(40))

    def test_bad_identifiers_rejected(self):
        self.assertEqual(m20.quote("public_media"), '"public_media"')
        for value in ("anything; DROP TABLE data", "public-media", "", None):
            with self.assertRaises(ValueError):
                m20.quote(value)

    def test_blob_refused_to_avoid_loss(self):
        with self.assertRaises(ValueError):
            m20.require_scalar([1, 2, 3])

if __name__ == "__main__":
    unittest.main()
