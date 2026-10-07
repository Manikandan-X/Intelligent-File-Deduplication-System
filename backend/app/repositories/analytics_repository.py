from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.duplicate_group import DuplicateGroup
from app.models.file import File
from app.models.file_hash import FileHash


class AnalyticsRepository:

    def get_total_file_count(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> int:
        conditions = [
            File.is_deleted.is_(False),
        ]

        if user_id is not None:
            conditions.append(
                File.user_id == user_id
            )

        statement = select(
            func.count(File.id)
        ).where(*conditions)

        return int(
            db.scalar(statement) or 0
        )

    def get_total_storage(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> int:
        conditions = [
            File.is_deleted.is_(False),
        ]

        if user_id is not None:
            conditions.append(
                File.user_id == user_id
            )

        statement = select(
            func.coalesce(
                func.sum(File.file_size),
                0,
            )
        ).where(*conditions)

        return int(
            db.scalar(statement) or 0
        )

    def get_duplicate_file_count(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> int:
        """
        Return the number of duplicate files.

        For system-wide analytics, the existing
        DuplicateGroup.duplicate_count values are used.

        For user-specific analytics, duplicate files are
        calculated by joining FileHash and DuplicateGroup
        because one duplicate group can contain files
        belonging to multiple users.
        """

        if user_id is None:
            statement = select(
                func.coalesce(
                    func.sum(
                        DuplicateGroup.duplicate_count
                    ),
                    0,
                )
            )

            return int(
                db.scalar(statement) or 0
            )

        statement = (
            select(
                func.count(File.id)
            )
            .select_from(File)
            .join(
                FileHash,
                and_(
                    FileHash.file_id == File.id,
                    FileHash.hash_algorithm == "sha256",
                ),
            )
            .join(
                DuplicateGroup,
                DuplicateGroup.content_hash
                == FileHash.content_hash,
            )
            .where(
                File.is_deleted.is_(False),
                File.user_id == user_id,
                File.id != DuplicateGroup.original_file_id,
            )
        )

        return int(
            db.scalar(statement) or 0
        )

    def get_duplicate_storage(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> int:
        """
        Return storage currently consumed by duplicate files.

        For system-wide analytics, the existing duplicate
        group potential_savings value is used.

        For user-specific analytics, the sizes of the user's
        duplicate files are summed directly.
        """

        if user_id is None:
            statement = select(
                func.coalesce(
                    func.sum(
                        DuplicateGroup.potential_savings
                    ),
                    0,
                )
            )

            return int(
                db.scalar(statement) or 0
            )

        statement = (
            select(
                func.coalesce(
                    func.sum(File.file_size),
                    0,
                )
            )
            .select_from(File)
            .join(
                FileHash,
                and_(
                    FileHash.file_id == File.id,
                    FileHash.hash_algorithm == "sha256",
                ),
            )
            .join(
                DuplicateGroup,
                DuplicateGroup.content_hash
                == FileHash.content_hash,
            )
            .where(
                File.is_deleted.is_(False),
                File.user_id == user_id,
                File.id != DuplicateGroup.original_file_id,
            )
        )

        return int(
            db.scalar(statement) or 0
        )

    def get_potential_savings(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> int:
        """
        Return the storage that can potentially be saved
        by removing duplicate files.

        For system-wide analytics, DuplicateGroup already
        stores the potential_savings value.

        For user-specific analytics, potential savings are
        the total size of that user's duplicate files.
        """

        if user_id is None:
            statement = select(
                func.coalesce(
                    func.sum(
                        DuplicateGroup.potential_savings
                    ),
                    0,
                )
            )

            return int(
                db.scalar(statement) or 0
            )

        return self.get_duplicate_storage(
            db,
            user_id=user_id,
        )

    def get_largest_files(
        self,
        db: Session,
        *,
        user_id: int | None = None,
        limit: int = 10,
    ) -> list[File]:
        conditions = [
            File.is_deleted.is_(False),
        ]

        if user_id is not None:
            conditions.append(
                File.user_id == user_id
            )

        statement = (
            select(File)
            .where(*conditions)
            .order_by(
                File.file_size.desc(),
                File.created_at.desc(),
            )
            .limit(limit)
        )

        return list(
            db.scalars(statement).all()
        )

    def get_recent_uploads(
        self,
        db: Session,
        *,
        user_id: int | None = None,
        limit: int = 10,
    ) -> list[File]:
        conditions = [
            File.is_deleted.is_(False),
        ]

        if user_id is not None:
            conditions.append(
                File.user_id == user_id
            )

        statement = (
            select(File)
            .where(*conditions)
            .order_by(
                File.created_at.desc()
            )
            .limit(limit)
        )

        return list(
            db.scalars(statement).all()
        )

    def get_duplicate_group_count(
        self,
        db: Session,
    ) -> int:
        statement = select(
            func.count(DuplicateGroup.id)
        )

        return int(
            db.scalar(statement) or 0
        )
