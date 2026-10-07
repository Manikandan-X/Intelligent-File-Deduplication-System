import logging
import uuid
from datetime import datetime
from pathlib import Path
from app.core.config import settings
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.constants.audit import AuditAction, AuditEntity
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.deletion_history import DeletionHistory
from app.models.file import File
from app.models.file_metadata import FileMetadata
from app.repositories.deletion_history_repository import (
    DeletionHistoryRepository,
)
from app.repositories.file_repository import FileRepository
from app.services.audit_log_service import AuditLogService
from app.tasks.file_processing import process_file


logger = logging.getLogger(__name__)


class FileService:
    def __init__(self) -> None:
        self.file_repository = FileRepository()
        self.deletion_history_repository = DeletionHistoryRepository()
        self.audit_log_service = AuditLogService()

    def _get_storage_directory(self) -> Path:
        storage_directory = Path("storage") / "files"
        storage_directory.mkdir(parents=True, exist_ok=True)
        return storage_directory

    def _generate_stored_filename(
        self,
        original_filename: str,
    ) -> str:
        extension = Path(original_filename).suffix
        return f"{uuid.uuid4().hex}{extension}"

    def _validate_file(
        self,
        file: UploadFile,
    ) -> None:
        if not file.filename:
            raise BadRequestException(
                "Filename is required"
            )

        if len(file.filename) > 255:
            raise BadRequestException(
                "Filename cannot exceed 255 characters"
            )

        content_type = (
            file.content_type or ""
        ).lower()

        if content_type.startswith("video/"):
            raise BadRequestException(
                "Video files are not allowed"
            )

        if content_type.startswith("audio/"):
            raise BadRequestException(
                "Audio files are not allowed"
            )

    async def upload_file(
        self,
        db: Session,
        *,
        file: UploadFile,
        user_id: int,
    ) -> File:
        self._validate_file(file)

        original_filename = Path(file.filename).name

        stored_filename = self._generate_stored_filename(
            original_filename
        )

        storage_directory = self._get_storage_directory()

        file_path = storage_directory / stored_filename

        file_size = 0

        try:
            with file_path.open("wb") as destination:
                while chunk := await file.read(1024 * 1024):
                    file_size += len(chunk)

                    if file_size > settings.max_file_size:
                        raise BadRequestException(
                            "File size cannot exceed 88 MB"
                        )

                    destination.write(chunk)

            file_record = self.file_repository.create(
                db,
                user_id=user_id,
                original_filename=original_filename,
                stored_filename=stored_filename,
                file_path=str(file_path),
                mime_type=file.content_type,
                file_size=file_size,
            )

            extension = Path(
                original_filename
            ).suffix.lower()

            metadata = FileMetadata(
                file_id=file_record.id,
                file_extension=extension or None,
                storage_location=str(file_path),
            )

            db.add(metadata)

            self.audit_log_service.create_log(
                db,
                user_id=user_id,
                action=AuditAction.FILE_UPLOADED,
                entity_type=AuditEntity.FILE,
                entity_id=str(file_record.id),
                details=(
                    f"File uploaded: {original_filename}, "
                    f"size={file_size}"
                ),
            )

            db.commit()
            db.refresh(file_record)

        except Exception:
            db.rollback()

            if file_path.exists():
                file_path.unlink()

            raise

        try:
            process_file.apply_async(
                kwargs={
                    "file_id": file_record.id,
                    "user_id": user_id,
                },
                retry=True,
                retry_policy={
                    "max_retries": 3,
                    "interval_start": 1,
                    "interval_step": 2,
                    "interval_max": 10,
                },
            )

        except Exception:
            logger.exception(
                "File uploaded successfully but Celery task "
                "could not be queued: file_id=%s",
                file_record.id,
            )
            raise

        return file_record

    def get_file(
        self,
        db: Session,
        *,
        file_id: int,
        current_user_id: int,
        is_admin: bool = False,
    ) -> File:
        if is_admin:
            file_record = self.file_repository.get_by_id(
                db,
                file_id,
            )
        else:
            file_record = self.file_repository.get_by_id_for_user(
                db,
                file_id=file_id,
                user_id=current_user_id,
            )

        if file_record is None:
            raise NotFoundException("File not found")

        return file_record

    def get_download_path(
        self,
        db: Session,
        *,
        file_id: int,
        current_user_id: int,
        is_admin: bool = False,
    ) -> File:
        file_record = self.get_file(
            db,
            file_id=file_id,
            current_user_id=current_user_id,
            is_admin=is_admin,
        )

        file_path = Path(file_record.file_path)

        if not file_path.exists():
            raise NotFoundException("Physical file not found")

        self.audit_log_service.create_log(
            db,
            user_id=current_user_id,
            action=AuditAction.FILE_DOWNLOADED,
            entity_type=AuditEntity.FILE,
            entity_id=str(file_record.id),
            details=(
                f"File downloaded: "
                f"{file_record.original_filename}"
            ),
        )

        db.commit()

        return file_record

    def search_files(
        self,
        db: Session,
        *,
        current_user_id: int,
        filename: str | None = None,
        mime_type: str | None = None,
        min_size: int | None = None,
        max_size: int | None = None,
        is_deleted: bool | None = False,
        is_protected: bool | None = None,
        is_duplicate: bool | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        is_admin: bool = False,
    ) -> tuple[list[File], int]:
        user_id = None if is_admin else current_user_id

        return self.file_repository.search(
            db,
            filename=filename,
            mime_type=mime_type,
            min_size=min_size,
            max_size=max_size,
            is_deleted=is_deleted,
            is_protected=is_protected,
            is_duplicate=is_duplicate,
            from_date=from_date,
            to_date=to_date,
            user_id=user_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def delete_file(
        self,
        db: Session,
        *,
        file_id: int,
        current_user_id: int,
        is_admin: bool = False,
        deletion_reason: str | None = None,
    ) -> File:
        file_record = self.get_file(
            db,
            file_id=file_id,
            current_user_id=current_user_id,
            is_admin=is_admin,
        )

        if file_record.is_protected:
            raise ForbiddenException(
                "Protected files cannot be deleted"
            )

        try:
            deletion_history = DeletionHistory(
                file_id=file_record.id,
                user_id=current_user_id,
                original_filename=file_record.original_filename,
                file_size=file_record.file_size,
                deletion_reason=deletion_reason,
            )

            self.deletion_history_repository.create(
                db,
                deletion_history=deletion_history,
            )

            self.file_repository.mark_as_deleted(
                db,
                file_record,
            )

            self.audit_log_service.create_log(
                db,
                user_id=current_user_id,
                action=AuditAction.FILE_DELETED,
                entity_type=AuditEntity.FILE,
                entity_id=str(file_record.id),
                details=(
                    f"File deleted: "
                    f"{file_record.original_filename}, "
                    f"size={file_record.file_size}"
                ),
            )

            db.commit()
            db.refresh(file_record)

        except Exception:
            db.rollback()
            raise

        return file_record

    def set_file_protection(
        self,
        db: Session,
        *,
        file_id: int,
        current_user_id: int,
        is_protected: bool,
        is_admin: bool = False,
    ) -> File:
        if not is_admin:
            raise ForbiddenException(
                "Only administrators can change file protection"
            )

        file_record = self.get_file(
            db,
            file_id=file_id,
            current_user_id=current_user_id,
            is_admin=True,
        )

        self.file_repository.update_protection(
            db,
            file_record,
            is_protected=is_protected,
        )

        action = (
            AuditAction.FILE_PROTECTED
            if is_protected
            else AuditAction.FILE_UNPROTECTED
        )

        self.audit_log_service.create_log(
            db,
            user_id=current_user_id,
            action=action,
            entity_type=AuditEntity.FILE,
            entity_id=str(file_record.id),
            details=(
                f"File protection changed: "
                f"is_protected={is_protected}"
            ),
        )

        db.commit()
        db.refresh(file_record)

        return file_record
