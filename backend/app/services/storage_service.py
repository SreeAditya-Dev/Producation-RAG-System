import logging
import os
import tempfile
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self._client = None
        self._bucket_ready = False
        self._local_root = Path(settings.local_storage_path)

    def is_configured(self) -> bool:
        return all(
            [
                settings.s3_endpoint_url,
                settings.s3_access_key_id,
                settings.s3_secret_access_key,
                settings.s3_bucket_name,
            ]
        )

    def _local_path(self, key: str) -> Path:
        path = self._local_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _get_client(self):
        if not self.is_configured():
            raise RuntimeError("S3 storage is not configured.")
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region,
            )
        return self._client

    def _ensure_bucket(self):
        if not self.is_configured():
            return
        if self._bucket_ready:
            return
        client = self._get_client()
        bucket = settings.s3_bucket_name
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("404", "NoSuchBucket"):
                client.create_bucket(Bucket=bucket)
                logger.info(f"Created S3 bucket: {bucket}")
            else:
                raise
        self._bucket_ready = True

    def _upload_local(self, content: bytes, key: str) -> str:
        path = self._local_path(key)
        path.write_bytes(content)
        logger.info(f"Stored {key} ({len(content)} bytes) locally at {path}")
        return key

    def upload(self, content: bytes, key: str, content_type: str = "application/octet-stream") -> str:
        if self.is_configured():
            try:
                self._ensure_bucket()
                self._get_client().put_object(
                    Bucket=settings.s3_bucket_name,
                    Key=key,
                    Body=content,
                    ContentType=content_type,
                )
                logger.info(f"Uploaded {key} ({len(content)} bytes) to S3")
                return key
            except Exception as e:
                logger.warning(f"S3 upload failed for {key}, falling back to local storage: {e}")

        return self._upload_local(content, key)

    def download_to_temp(self, key: str) -> str:
        """Download an S3 object to a temp file. Caller must delete the file."""
        suffix = os.path.splitext(key)[-1] or ".bin"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            if self.is_configured():
                try:
                    self._ensure_bucket()
                    obj = self._get_client().get_object(Bucket=settings.s3_bucket_name, Key=key)
                    tmp.write(obj["Body"].read())
                    tmp.flush()
                    return tmp.name
                except Exception as e:
                    logger.warning(f"S3 download failed for {key}, trying local storage: {e}")

            local_path = self._local_path(key)
            if not local_path.exists():
                raise FileNotFoundError(f"Stored file not found for key '{key}'")
            tmp.write(local_path.read_bytes())
            tmp.flush()
        finally:
            tmp.close()
        return tmp.name

    def delete(self, key: str):
        if self.is_configured():
            try:
                self._get_client().delete_object(Bucket=settings.s3_bucket_name, Key=key)
                logger.info(f"Deleted {key} from S3")
            except ClientError as e:
                logger.warning(f"Could not delete {key} from S3: {e}")

        local_path = self._local_path(key)
        if local_path.exists():
            local_path.unlink()
            logger.info(f"Deleted {key} from local storage")


CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "md": "text/markdown",
}


storage_service = StorageService()
