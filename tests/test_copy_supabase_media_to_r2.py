import importlib.util
import io
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# All network clients are mocked before import; no production requests.
os.environ.update(SUPABASE_URL="https://example.invalid", SUPABASE_SERVICE_ROLE_KEY="fake",
                  R2_ENDPOINT="https://example.invalid", R2_ACCESS_KEY_ID="fake",
                  R2_SECRET_ACCESS_KEY="fake", DRY_RUN="false", CONFIRM_COPY="COPY")
spec = importlib.util.spec_from_file_location("copy", "scripts/copy_supabase_media_to_r2.py")
module = importlib.util.module_from_spec(spec)
with patch("boto3.client"):
    spec.loader.exec_module(module)


class Body:
    def __init__(self, data):
        self.data = data
    def iter_chunks(self, chunk_size):
        for i in range(0, len(self.data), chunk_size):
            yield self.data[i:i + chunk_size]
    def close(self):
        pass


class Download:
    def __init__(self, data, interrupted=False):
        self.data = data
        self.interrupted = interrupted
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def raise_for_status(self):
        pass
    def iter_content(self, chunk_size):
        yield self.data[:len(self.data)//2]
        if self.interrupted:
            raise ConnectionError("interrupted")
        yield self.data[len(self.data)//2:]


class CopyTests(unittest.TestCase):
    def setUp(self):
        module.seen.clear()
        self.data = b"abcdefgh" * 1024
        module.session.get = MagicMock(return_value=Download(self.data))
        module.r2 = MagicMock()
        module.r2.head_object.side_effect = [
            {"ContentLength": len(self.data)}]
        module.r2.get_object.return_value = {"Body": Body(self.data)}

    def test_existing_verified_resumes_without_upload(self):
        self.assertEqual(module.copy_one("dir/a", {"metadata": {"size": len(self.data)}}), "skipped_verified")
        module.r2.upload_fileobj.assert_not_called()

    def test_existing_same_size_different_content_rejected(self):
        module.r2.get_object.return_value = {"Body": Body(b"x" * len(self.data))}
        with self.assertRaisesRegex(RuntimeError, "CONTENT CONFLICT"):
            module.copy_one("dir/a", {"metadata": {"size": len(self.data)}})
        module.r2.upload_fileobj.assert_not_called()

    def test_existing_different_size_rejected(self):
        module.r2.head_object.side_effect = [{"ContentLength": 1}]
        with self.assertRaisesRegex(RuntimeError, "SIZE CONFLICT"):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.upload_fileobj.assert_not_called()

    def test_interrupted_download_never_uploads(self):
        module.r2.head_object.side_effect = [None]
        module.session.get.return_value = Download(self.data, interrupted=True)
        with self.assertRaises(ConnectionError):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.upload_fileobj.assert_not_called()

    def test_new_object_and_retry_after_upload_interruption(self):
        module.r2.head_object.side_effect = [None, None, {"ContentLength": len(self.data)}]
        module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.upload_fileobj.assert_called_once()
        module.seen.clear()
        module.r2.head_object.side_effect = [{"ContentLength": len(self.data)}]
        self.assertEqual(module.copy_one("a", {"metadata": {"size": len(self.data)}}), "skipped_verified")

    def test_large_file_and_special_name(self):
        self.data = b"x" * (9 * 1024 * 1024)
        module.session.get.return_value = Download(self.data)
        module.r2.head_object.side_effect = [None, None]
        module.r2.get_object.return_value = {"Body": Body(self.data)}
        self.assertEqual(module.copy_one("d/été + #.jpg", {"metadata": {"size": len(self.data)}}), "copied")
        self.assertIn("%C3%A9", module.session.get.call_args.args[0])

    def test_pagination_and_nested_folder(self):
        def response(entries):
            x = MagicMock()
            x.json.return_value = entries
            return x
        page = [{"name": "a", "id": "1", "metadata": {"size": 1}}] * 100
        module.session.post.side_effect = [
            response([{"name": "dir", "id": None}]),
            response([{"name": "nested", "id": "1"}])]
        self.assertEqual([p for p, _ in module.objects()], ["dir/nested"])
        module.session.post.reset_mock()
        module.session.post.side_effect = [response(page), response([])]
        self.assertEqual(len(list(module.objects())), 100)

    def test_no_delete_methods_in_copy_code(self):
        import inspect
        source = inspect.getsource(module)
        self.assertNotIn("delete_object(", source)
        self.assertNotIn("session.delete(", source)


if __name__ == "__main__":
    unittest.main()
