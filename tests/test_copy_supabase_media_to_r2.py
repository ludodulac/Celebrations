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
        module.session.post = MagicMock()
        module.r2 = MagicMock()
        module.r2.head_object.side_effect = [
            {"ContentLength": len(self.data)}]
        module.r2.get_object.return_value = {"Body": Body(self.data)}

    def test_existing_verified_resumes_without_upload(self):
        self.assertEqual(module.copy_one("dir/a", {"metadata": {"size": len(self.data)}}), "skipped_verified")
        module.r2.put_object.assert_not_called()

    def test_existing_same_size_different_content_rejected(self):
        module.r2.get_object.return_value = {"Body": Body(b"x" * len(self.data))}
        with self.assertRaisesRegex(RuntimeError, "CONTENT CONFLICT"):
            module.copy_one("dir/a", {"metadata": {"size": len(self.data)}})
        module.r2.put_object.assert_not_called()

    def test_existing_different_size_rejected(self):
        module.r2.head_object.side_effect = [{"ContentLength": 1}]
        with self.assertRaisesRegex(RuntimeError, "SIZE CONFLICT"):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.put_object.assert_not_called()

    def test_interrupted_download_never_uploads(self):
        module.r2.head_object.side_effect = [None]
        module.session.get.return_value = Download(self.data, interrupted=True)
        with self.assertRaises(ConnectionError):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.put_object.assert_not_called()

    def test_new_object_and_retry_after_upload_interruption(self):
        module.r2.head_object.side_effect = [None, None, {"ContentLength": len(self.data)}]
        module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.r2.put_object.assert_called_once()
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

    def test_upload_failure_and_resume(self):
        module.r2.head_object.side_effect = [None, None]
        module.r2.put_object.side_effect = OSError("upload failed")
        with self.assertRaises(OSError):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        module.seen.clear()
        module.r2.put_object.side_effect = None
        module.r2.head_object.side_effect = [{"ContentLength": len(self.data)}]
        self.assertEqual(module.copy_one("a", {"metadata": {"size": len(self.data)}}), "skipped_verified")

    def test_corrupt_new_upload_detected(self):
        module.r2.head_object.side_effect = [None, None]
        module.r2.get_object.return_value = {"Body": Body(b"z" * len(self.data))}
        with self.assertRaisesRegex(RuntimeError, "CONTENT CONFLICT"):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})

    def test_secret_not_logged_on_failure(self):
        import contextlib
        import io
        module.session.post.return_value = MagicMock()
        module.session.post.return_value.json.return_value = [{"name": "a", "id": "1", "metadata": {"size": len(self.data)}}]
        module.r2.head_object.side_effect = RuntimeError("fake-secret-token")
        stderr = io.StringIO()
        with patch.object(sys, "stderr", stderr), self.assertRaises(SystemExit):
            module.main()
        self.assertNotIn("fake-secret-token", stderr.getvalue())

    def test_atomic_precondition_refuses_concurrent_writer(self):
        from botocore.exceptions import ClientError
        module.r2.head_object.side_effect = [None, None]
        module.r2.put_object.side_effect = ClientError(
            {"Error": {"Code": "PreconditionFailed", "Message": "condition failed"}},
            "PutObject")
        with self.assertRaisesRegex(RuntimeError, "CONCURRENT DESTINATION WRITE REFUSED"):
            module.copy_one("a", {"metadata": {"size": len(self.data)}})
        self.assertEqual(module.r2.put_object.call_args.kwargs["IfNoneMatch"], "*")

    def test_single_put_no_multipart_and_large_object_guard(self):
        module.r2.head_object.side_effect = [None, None]
        module.copy_one("a", {"metadata": {"size": len(self.data)}})
        self.assertEqual(module.r2.put_object.call_args.kwargs["IfNoneMatch"], "*")
        module.r2.create_multipart_upload.assert_not_called()
        module.seen.clear()
        with self.assertRaisesRegex(RuntimeError, "TOO LARGE"):
            module.copy_one("huge", {"metadata": {"size": module.MAX_SINGLE_PUT + 1}})
        module.r2.put_object.assert_called_once()

    def test_no_delete_methods_in_copy_code(self):
        import inspect
        source = inspect.getsource(module)
        self.assertNotIn("delete_object(", source)
        self.assertNotIn("session.delete(", source)


if __name__ == "__main__":
    unittest.main()
