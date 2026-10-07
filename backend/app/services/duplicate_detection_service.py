from sqlalchemy.orm import Session

from app.models.file import File
from app.models.duplicate_group import DuplicateGroup

from app.repositories.duplicate_group_repository import (
    DuplicateGroupRepository,
)

from app.repositories.file_hash_repository import FileHashRepository


class DuplicateDetectionService:
    def __init__(self):
        self.file_hash_repository = FileHashRepository()
        self.duplicate_group_repository = DuplicateGroupRepository()

    def detect_duplicate(
        self,
        db: Session,
        *,
        file: File,
        content_hash: str,
        hash_algorithm: str = "sha256",
    ) -> tuple[bool, DuplicateGroup | None, bool]:
        existing_hashes = (
            self.file_hash_repository.get_by_content_hash(
                db,
                content_hash=content_hash,
                hash_algorithm=hash_algorithm,
            )
        )

        # The current file's hash may already exist in the session,
        # so exclude the current file from duplicate candidates.
        existing_hashes = [
            file_hash
            for file_hash in existing_hashes
            if file_hash.file_id != file.id
        ]

        if not existing_hashes:
            return False, None, False

        existing_file_ids = [
            file_hash.file_id
            for file_hash in existing_hashes
        ]

        existing_files = list(
            db.query(File)
            .filter(
                File.id.in_(existing_file_ids),
                File.is_deleted.is_(False),
            )
            .all()
        )

        if not existing_files:
            return False, None, False

        duplicate_group = (
            self.duplicate_group_repository.get_by_content_hash(
                db,
                content_hash=content_hash,
            )
        )

        group_created = False

        if duplicate_group is None:
            original_file = self._select_original_file(
                existing_files
            )

            duplicate_group = (
                self.duplicate_group_repository.create(
                    db,
                    content_hash=content_hash,
                    original_file_id=original_file.id,
                )
            )

            group_created = True

        self._update_group_statistics(
            db,
            duplicate_group=duplicate_group,
            current_file=file,
            existing_files=existing_files,
        )

        return True, duplicate_group, group_created

    @staticmethod
    def _select_original_file(
        files: list[File],
    ) -> File:
        """
        Select the oldest non-deleted file as the original.
        """
        return min(
            files,
            key=lambda file: file.created_at,
        )

    def _update_group_statistics(
        self,
        db: Session,
        *,
        duplicate_group: DuplicateGroup,
        current_file: File,
        existing_files: list[File],
    ) -> None:
        all_files = [
            *existing_files,
            current_file,
        ]

        original_file = min(
            all_files,
            key=lambda file: file.created_at,
        )

        duplicate_count = max(
            len(all_files) - 1,
            0,
        )

        total_size = sum(
            file.file_size
            for file in all_files
        )

        potential_savings = sum(
            file.file_size
            for file in all_files
            if file.id != original_file.id
        )

        duplicate_group.original_file_id = original_file.id

        self.duplicate_group_repository.update_statistics(
            db,
            duplicate_group,
            duplicate_count=duplicate_count,
            total_size=total_size,
            potential_savings=potential_savings,
        )
