from sqlalchemy.orm import Session

from app.models.file import File
from app.repositories.analytics_repository import (
    AnalyticsRepository,
)


class AnalyticsService:

    def __init__(
        self,
        analytics_repository: AnalyticsRepository | None = None,
    ):
        self.analytics_repository = (
            analytics_repository
            or AnalyticsRepository()
        )

    def get_overview(
        self,
        db: Session,
        *,
        user_id: int | None = None,
    ) -> dict[str, int]:
        """
        Return storage and duplicate statistics.

        user_id=None:
            System-wide analytics.

        user_id=<id>:
            Analytics for that specific user.
        """

        total_files = (
            self.analytics_repository.get_total_file_count(
                db,
                user_id=user_id,
            )
        )

        total_storage = (
            self.analytics_repository.get_total_storage(
                db,
                user_id=user_id,
            )
        )

        duplicate_files = (
            self.analytics_repository.get_duplicate_file_count(
                db,
                user_id=user_id,
            )
        )

        duplicate_storage = (
            self.analytics_repository.get_duplicate_storage(
                db,
                user_id=user_id,
            )
        )

        potential_savings = (
            self.analytics_repository.get_potential_savings(
                db,
                user_id=user_id,
            )
        )

        return {
            "total_files": total_files,
            "total_storage": total_storage,
            "duplicate_files": duplicate_files,
            "duplicate_storage": duplicate_storage,
            "potential_savings": potential_savings,
        }

    def get_largest_files(
        self,
        db: Session,
        *,
        user_id: int | None = None,
        limit: int = 10,
    ) -> list[File]:
        """
        Return the largest active files.

        user_id=None:
            System-wide results.

        user_id=<id>:
            Only files belonging to that user.
        """

        return self.analytics_repository.get_largest_files(
            db,
            user_id=user_id,
            limit=limit,
        )

    def get_recent_uploads(
        self,
        db: Session,
        *,
        user_id: int | None = None,
        limit: int = 10,
    ) -> list[File]:
        """
        Return the most recently uploaded active files.

        user_id=None:
            System-wide results.

        user_id=<id>:
            Only files belonging to that user.
        """

        return self.analytics_repository.get_recent_uploads(
            db,
            user_id=user_id,
            limit=limit,
        )

    def get_duplicate_group_count(
        self,
        db: Session,
    ) -> int:
        """
        Return the total number of duplicate groups.

        This metric is system-wide because duplicate groups
        can contain files belonging to multiple users.
        """

        return (
            self.analytics_repository.get_duplicate_group_count(
                db,
            )
        )
