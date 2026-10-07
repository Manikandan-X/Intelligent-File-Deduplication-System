from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.duplicate_group import DuplicateGroup
from app.models.file import File
from app.models.file_hash import FileHash

class DuplicateGroupRepository:


    def create(
        self,
        db: Session,
        *,
        content_hash: str,
        original_file_id: int,
        duplicate_count: int = 0,
        total_size: int = 0,
        potential_savings: int = 0,
    ) -> DuplicateGroup:
        duplicate_group = DuplicateGroup(
            content_hash=content_hash,
            original_file_id=original_file_id,
            duplicate_count=duplicate_count,
            total_size=total_size,
            potential_savings=potential_savings,
        )

        db.add(duplicate_group)
        db.flush()

        return duplicate_group

    def get_all(
        self,
        db: Session,
    ) -> list[DuplicateGroup]:
        statement = (
            select(DuplicateGroup)
            .order_by(DuplicateGroup.created_at.desc())
        )

        return list(
            db.scalars(statement).all()
        )

    def get_by_content_hash(
        self,
        db: Session,
        *,
        content_hash: str,
    ) -> DuplicateGroup | None:
        statement = select(DuplicateGroup).where(
            DuplicateGroup.content_hash == content_hash,
        )

        return db.scalar(statement)

    def get_by_id(
        self,
        db: Session,
        *,
        group_id: int,
    ) -> DuplicateGroup | None:
        statement = select(DuplicateGroup).where(
            DuplicateGroup.id == group_id,
        )

        return db.scalar(statement)

    def update_statistics(
        self,
        db: Session,
        duplicate_group: DuplicateGroup,
        *,
        duplicate_count: int,
        total_size: int,
        potential_savings: int,
    ) -> DuplicateGroup:
        duplicate_group.duplicate_count = duplicate_count
        duplicate_group.total_size = total_size
        duplicate_group.potential_savings = potential_savings

        db.flush()

        return duplicate_group

    def get_member_files(
        self,
        db: Session,
        *,
        content_hash: str,
        user_id: int | None = None,
    ) -> list[File]:
        """
        Active files whose SHA-256 matches the group's content hash.
        user_id=None returns every member (admin); otherwise only that user's files.
        """
        statement = (
            select(File)
            .join(FileHash, FileHash.file_id == File.id)
            .where(
                FileHash.content_hash == content_hash,
                FileHash.hash_algorithm == "sha256",
                File.is_deleted.is_(False),
            )
            .order_by(File.created_at.asc())
        )
        if user_id is not None:
            statement = statement.where(File.user_id == user_id)
        return list(db.scalars(statement).all())
