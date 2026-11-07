#!/usr/bin/env python3
"""Pure offline regression tests for Mission 03 private backups."""
import json
import unittest
from scripts.mission03_editor_private_backup import (
    MAGIC, decrypt, encrypt, validate_editor_snapshot,
)


def fixture():
    page = {"id": "mercredi-101", "name": "Mercredi",
            "visibility": "published",
            "blocks": [{"id": 1, "kind": "heading", "text": "exemple fictif"}]}
    return {
        "version": 32,
        "drafts": {"101": {"pages": [page]}},
        "plans": [],
        "shared": {"pages": [{"id": "neutral-accueil-general", "blocks": []}]},
        "published": {"drafts": {"101": {"pages": [page]}},
                      "shared": {"pages": [{"id": "neutral-accueil-general", "blocks": []}]}},
        "mediaCatalogue": [{"id": "pdf|/media/exemple.pdf", "src": "/media/exemple.pdf"}]
    }


def source_bytes(doc=None):
    return json.dumps(fixture() if doc is None else doc, ensure_ascii=False).encode("utf-8")


class Mission03Tests(unittest.TestCase):
    KEY = b"long-test-only-passphrase-never-used-in-prod-2026"

    def test_validate_realistic_document_counts(self):
        document, counts = validate_editor_snapshot(source_bytes())
        self.assertEqual(document["version"], 32)
        self.assertEqual(counts["draft_and_existing_page_count"], 1)
        self.assertEqual(counts["published_celebration_pages"], 1)
        self.assertEqual(counts["general_pages"], 1)
        self.assertEqual(counts["published_general_pages"], 1)
        self.assertEqual(counts["catalogue_items"], 1)

    def test_encrypt_decrypt_exact_bytes(self):
        plaintext = source_bytes()
        package = encrypt(plaintext, self.KEY)
        self.assertTrue(package.startswith(MAGIC))
        self.assertNotIn(b"exemple fictif", package)
        self.assertEqual(decrypt(package, self.KEY), plaintext)
        self.assertEqual(validate_editor_snapshot(decrypt(package, self.KEY))[0],
                         fixture())

    def test_randomized_keys_do_not_reuse_nonce(self):
        plaintext = source_bytes()
        a, b = encrypt(plaintext, self.KEY), encrypt(plaintext, self.KEY)
        self.assertNotEqual(a, b)
        self.assertEqual(decrypt(a, self.KEY), decrypt(b, self.KEY))

    def test_wrong_secret_fails_closed(self):
        package = encrypt(source_bytes(), self.KEY)
        with self.assertRaises(Exception):
            decrypt(package, b"another-long-test-only-passphrase-secret")

    def test_tampered_ciphertext_fails_closed(self):
        package = bytearray(encrypt(source_bytes(), self.KEY))
        package[-7] ^= 1
        with self.assertRaises(Exception):
            decrypt(bytes(package), self.KEY)

    def test_truncated_package_fails_closed(self):
        with self.assertRaises(ValueError):
            decrypt(MAGIC + b"bad", self.KEY)

    def test_invalid_or_empty_documents_fail_closed(self):
        invalid = fixture()
        invalid["drafts"]["101"]["pages"] = []
        with self.assertRaises(ValueError):
            validate_editor_snapshot(source_bytes(invalid))
        invalid = fixture()
        invalid["drafts"]["101"]["pages"].append(invalid["drafts"]["101"]["pages"][0])
        with self.assertRaises(ValueError):
            validate_editor_snapshot(source_bytes(invalid))
        invalid = fixture()
        del invalid["published"]
        with self.assertRaises(ValueError):
            validate_editor_snapshot(source_bytes(invalid))
        with self.assertRaises(ValueError):
            validate_editor_snapshot(b"short")

    def test_backup_code_cannot_replace_live_object(self):
        # Explicitly protect the critical invariant with a static source guard.
        from pathlib import Path
        src = Path("scripts/mission03_editor_private_backup.py").read_text()
        self.assertIn('PREFIX = "private-backups/mission03-editor/"', src)
        self.assertIn('IfNoneMatch="*"', src)
        self.assertIn('current = client.head_object(Bucket=BUCKET, Key=KEY)', src)
        self.assertNotIn("delete_object(", src)
        self.assertNotIn("delete_objects(", src)
        self.assertNotIn("put_object(Bucket=BUCKET, Key=KEY", src)
        self.assertNotIn("put_object(\n        Bucket=BUCKET, Key=KEY", src)


if __name__ == "__main__":
    unittest.main(verbosity=2)
