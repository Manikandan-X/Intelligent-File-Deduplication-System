from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.duplicate_group import DuplicateGroup
from app.models.file import File
from app.repositories.duplicate_group_repository import (
DuplicateGroupRepository,
)

class DuplicateGroupService:

    def __init__(self) -> None:
        self.duplicate_group_repository = DuplicateGroupRepository()

    def get_all_duplicate_groups(
        self,
        db: Session,
    ) -> list[DuplicateGroup]:
        return self.duplicate_group_repository.get_all(
            db,
        )

    def get_duplicate_group(
        self,
        db: Session,
        *,
        group_id: int,
    ) -> DuplicateGroup:
        duplicate_group = (
            self.duplicate_group_repository.get_by_id(
                db,
                group_id=group_id,
            )
        )

        if duplicate_group is None:
            raise NotFoundException(
                "Duplicate group not found"
            )

        return duplicate_group

    def get_duplicate_group_by_hash(
        self,
        db: Session,
        *,
        content_hash: str,
    ) -> DuplicateGroup:
        duplicate_group = (
            self.duplicate_group_repository.get_by_content_hash(
                db,
                content_hash=content_hash,
            )
        )

        if duplicate_group is None:
            raise NotFoundException(
                "Duplicate group not found"
            )

        return duplicate_group

    def get_group_files(
        self,
        db: Session,
        *,
        group_id: int,
        user_id: int | None = None,
    ) -> list[File]:
        """user_id=None (admin) returns all members; otherwise only the caller's files."""
        duplicate_group = self.get_duplicate_group(db, group_id=group_id)
        return self.duplicate_group_repository.get_member_files(
            db,
            content_hash=duplicate_group.content_hash,
            user_id=user_id,
        )
