import logging
from pathlib import Path

from app.celery_app import celery_app
from app.constants.audit import AuditAction, AuditEntity
from app.core.redis import (
    RedisLockUnavailable,
    try_file_lock,
)
from app.db.session import SessionLocal
from app.models.file import File
from app.services.audit_log_service import AuditLogService
from app.services.duplicate_detection_service import (
    DuplicateDetectionService,
)
from app.services.file_hash_service import FileHashService


logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="file_processing.process_file",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    retry_kwargs={"max_retries": 3},
)
def process_file(
    self,
    file_id: int,
    user_id: int,
) -> dict:
    """
    Calculate the file hash and detect duplicates
    asynchronously using Celery.

    The task automatically retries when an unexpected
    exception occurs.

    A Redis distributed lock prevents the same file
    from being processed by multiple workers at the
    same time.
    """

    try:
        with try_file_lock(
            lock_id=f"process:{file_id}",
        ) as lock_acquired:

            if not lock_acquired:
                logger.warning(
                    "Redis unavailable while processing file: "
                    "file_id=%s",
                    file_id,
                )

                raise RuntimeError(
                    "Redis unavailable while acquiring "
                    "file processing lock"
                )

            db = SessionLocal()

            file_hash_service = FileHashService()
            duplicate_detection_service = (
                DuplicateDetectionService()
            )
            audit_log_service = AuditLogService()

            try:
                file = (
                    db.query(File)
                    .filter(
                        File.id == file_id,
                        File.is_deleted.is_(False),
                    )
                    .first()
                )

                if file is None:
                    logger.error(
                        "File not found while processing: "
                        "file_id=%s",
                        file_id,
                    )

                    return {
                        "status": "failed",
                        "file_id": file_id,
                        "message": "File not found",
                    }

                file_path = Path(file.file_path)

                if not file_path.exists():
                    logger.error(
                        "Physical file not found: "
                        "file_id=%s, path=%s",
                        file_id,
                        file_path,
                    )

                    return {
                        "status": "failed",
                        "file_id": file_id,
                        "message": "Physical file not found",
                    }

                file_hash = (
                    file_hash_service.calculate_and_store_hash(
                        db,
                        file_id=file.id,
                        file_path=file_path,
                        hash_algorithm="sha256",
                    )
                )

                (
                    is_duplicate,
                    duplicate_group,
                    group_created,
                ) = (
                    duplicate_detection_service.detect_duplicate(
                        db,
                        file=file,
                        content_hash=file_hash.content_hash,
                        hash_algorithm=file_hash.hash_algorithm,
                    )
                )

                if is_duplicate:
                    audit_log_service.create_log(
                        db,
                        user_id=user_id,
                        action=AuditAction.DUPLICATE_DETECTED,
                        entity_type=AuditEntity.FILE,
                        entity_id=str(file.id),
                        details=(
                            f"Duplicate file detected: "
                            f"{file.original_filename}, "
                            f"hash={file_hash.content_hash}"
                        ),
                    )

                    if duplicate_group:
                        group_action = (
                            AuditAction.DUPLICATE_GROUP_CREATED
                            if group_created
                            else AuditAction.DUPLICATE_GROUP_UPDATED
                        )

                        group_details = (
                            (
                                f"Duplicate group created for "
                                f"hash={file_hash.content_hash}"
                            )
                            if group_created
                            else (
                                f"Duplicate group updated for "
                                f"hash={file_hash.content_hash}"
                            )
                        )

                        audit_log_service.create_log(
                            db,
                            user_id=user_id,
                            action=group_action,
                            entity_type=AuditEntity.DUPLICATE_GROUP,
                            entity_id=str(duplicate_group.id),
                            details=group_details,
                        )

                db.commit()

                logger.info(
                    "File processing completed: "
                    "file_id=%s is_duplicate=%s "
                    "duplicate_group_id=%s",
                    file.id,
                    is_duplicate,
                    (
                        duplicate_group.id
                        if duplicate_group
                        else None
                    ),
                )

                return {
                    "status": "completed",
                    "file_id": file.id,
                    "hash_algorithm": file_hash.hash_algorithm,
                    "content_hash": file_hash.content_hash,
                    "is_duplicate": is_duplicate,
                    "duplicate_group_id": (
                        duplicate_group.id
                        if duplicate_group
                        else None
                    ),
                    "group_created": group_created,
                }

            except Exception:
                db.rollback()

                logger.exception(
                    "File processing failed: file_id=%s",
                    file_id,
                )

                raise

            finally:
                db.close()

    except RedisLockUnavailable as exc:
        logger.warning(
            "File is already being processed: "
            "file_id=%s",
            file_id,
        )

        return {
            "status": "skipped",
            "file_id": file_id,
            "message": str(exc),
        }


