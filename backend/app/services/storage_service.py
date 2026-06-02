import logging
import os
import tempfile
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self._client = None
        self._bucket_ready = False

    def _get_client(self):
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

    def upload(self, content: bytes, key: str, content_type: str = "application/octet-stream") -> str:
        self._ensure_bucket()
        self._get_client().put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        logger.info(f"Uploaded {key} ({len(content)} bytes) to S3")
        return key

    def download_to_temp(self, key: str) -> str:
        """Download an S3 object to a temp file. Caller must delete the file."""
        self._ensure_bucket()
        suffix = os.path.splitext(key)[-1] or ".bin"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            obj = self._get_client().get_object(Bucket=settings.s3_bucket_name, Key=key)
            tmp.write(obj["Body"].read())
            tmp.flush()
        finally:
            tmp.close()
        return tmp.name

    def delete(self, key: str):
        try:
            self._get_client().delete_object(Bucket=settings.s3_bucket_name, Key=key)
            logger.info(f"Deleted {key} from S3")
        except ClientError as e:
            logger.warning(f"Could not delete {key} from S3: {e}")


CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "md": "text/markdown",
}


storage_service = StorageService()
