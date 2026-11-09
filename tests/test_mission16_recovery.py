"""M16: synthetic isolated D1/SQLite + R2 bytes rehearsal, entirely in RAM.

This is a verification of the *procedure*, not a claim to have backed up
or restored the real Cloudflare D1 or R2 buckets.
"""
import hashlib
import io
import sqlite3
import unittest

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE celebrations(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE pages(id INTEGER PRIMARY KEY, celebration_id INTEGER NOT NULL
 REFERENCES celebrations(id), title TEXT NOT NULL);
CREATE INDEX pages_by_celebration ON pages(celebration_id);
INSERT INTO celebrations VALUES(101,'Michaël');
INSERT INTO pages VALUES(1,101,'Préparation');
INSERT INTO pages VALUES(2,101,'Mercredi');
"""


def synthetic_d1_recovery(sql_text=SCHEMA):
    src = sqlite3.connect(":memory:")
    src.executescript(SCHEMA)
    src.commit()
    original_counts = {}
    for table in ("celebrations", "pages"):
        original_counts[table] = src.execute(
            "SELECT COUNT(*) FROM " + table
        ).fetchone()[0]
    # Whole-schema SQL dump, not the currently published data.
    exported = "\n".join(src.iterdump()).encode("utf-8")
    src.close()
    digest = hashlib.sha256(exported).hexdigest()
    target = sqlite3.connect(":memory:")
    target.execute("PRAGMA foreign_keys=ON")
    target.executescript(sql_text if sql_text != SCHEMA else exported.decode())
    integrity = target.execute("PRAGMA integrity_check").fetchone()[0]
    broken_keys = target.execute("PRAGMA foreign_key_check").fetchall()
    expected_schema = {"celebrations", "pages"}
    restored_schema = {
        row[0] for row in target.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }
    restored_counts = {
        name: target.execute("SELECT COUNT(*) FROM " + name).fetchone()[0]
        for name in expected_schema
    }
    indexes = {
        row[0] for row in target.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        )
    }
    target.close()
    if integrity != "ok" or broken_keys or expected_schema != restored_schema:
        raise AssertionError("D1 isolated integrity/schema recovery incomplete")
    if original_counts != restored_counts:
        raise AssertionError("D1 row counts mismatch after isolated recovery")
    if "pages_by_celebration" not in indexes:
        raise AssertionError("D1 index was lost")
    if hashlib.sha256(exported).hexdigest() != digest:
        raise AssertionError("D1 export altered")
    return digest, original_counts


def verify_media_copy(original, recovered):
    # Byte-level comparison; HEAD success and catalogue names are not enough.
    if not original or set(original) != set(recovered):
        raise AssertionError("media inventory incomplete")
    manifest = []
    for key in sorted(original):
        if not (
            key.startswith("media/") or key.startswith("letter/")
            or key.startswith("editor-trials/uploads/")
        ):
            raise AssertionError("unexpected historical media key")
        before, after = original[key], recovered[key]
        if not before or hashlib.sha256(before).digest() != hashlib.sha256(after).digest():
            raise AssertionError("binary media changed during restoration")
        manifest.append(key + " " + hashlib.sha256(after).hexdigest())
    return hashlib.sha256("\n".join(manifest).encode()).hexdigest()


class IsolatedRecoveryContract(unittest.TestCase):
    def setUp(self):
        self.original = {
            "media/media/historic-image.jpg": b"JPEG sample \xff\xd8\xff\xdb",
            "letter/old-program.pdf": b"%PDF-1.7 example",
            "editor-trials/uploads/sample-new.png": b"\x89PNG\r\n\x1a\n"
        }

    def test_complete_sqlite_schema_and_rows_restored_in_ram(self):
        digest, counts = synthetic_d1_recovery()
        self.assertEqual(len(digest), 64)
        self.assertEqual(counts, {"celebrations": 1, "pages": 2})

    def test_d1_recovery_detects_missing_index(self):
        without_index = SCHEMA.replace(
            "CREATE INDEX pages_by_celebration ON pages(celebration_id);", ""
        )
        with self.assertRaisesRegex(AssertionError, "index"):
            synthetic_d1_recovery(without_index)

    def test_d1_recovery_detects_missing_row(self):
        without_page = SCHEMA.replace(
            "INSERT INTO pages VALUES(2,101,'Mercredi');", ""
        )
        with self.assertRaisesRegex(AssertionError, "counts"):
            synthetic_d1_recovery(without_page)

    def test_d1_recovery_detects_broken_foreign_key(self):
        broken_key = SCHEMA.replace(
            "INSERT INTO pages VALUES(2,101,'Mercredi');",
            "PRAGMA foreign_keys=OFF; INSERT INTO pages VALUES(2,999,'Mercredi');"
        )
        with self.assertRaisesRegex(AssertionError, "integrity"):
            synthetic_d1_recovery(broken_key)

    def test_historical_and_new_media_identical_across_copy(self):
        result = verify_media_copy(self.original, dict(self.original))
        self.assertEqual(len(result), 64)

    def test_media_missing_historic_pdf_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, "inventory"):
            verify_media_copy(self.original, {
                key: val for key, val in self.original.items()
                if not key.startswith("letter/")
            })

    def test_media_missing_new_upload_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, "inventory"):
            verify_media_copy(self.original, {
                key: val for key, val in self.original.items()
                if not key.startswith("editor-trials/uploads/")
            })

    def test_byte_corruption_fails_even_with_same_file_size(self):
        corrupt = dict(self.original)
        corrupt["letter/old-program.pdf"] = b"%PDF-1.7 xamplex"
        with self.assertRaisesRegex(AssertionError, "binary media changed"):
            verify_media_copy(self.original, corrupt)

    def test_empty_and_wrong_key_rejected(self):
        with self.assertRaises(AssertionError):
            verify_media_copy({}, {})
        corrupt = dict(self.original)
        corrupt["other/private"] = b"secret"
        with self.assertRaisesRegex(AssertionError, "unexpected"):
            verify_media_copy(corrupt, corrupt)


if __name__ == "__main__":
    unittest.main()
