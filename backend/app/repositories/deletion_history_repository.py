from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deletion_history import DeletionHistory


class DeletionHistoryRepository:

    def create(
        self,
        db: Session,
        *,
        deletion_history: DeletionHistory,
    ) -> DeletionHistory:
        db.add(deletion_history)
        db.flush()
        return deletion_history

    def get_by_file_id(
        self,
        db: Session,
        *,
        file_id: int,
    ) -> list[DeletionHistory]:
        statement = (
            select(DeletionHistory)
            .where(
                DeletionHistory.file_id == file_id,
            )
            .order_by(
                DeletionHistory.created_at.desc()
            )
        )

        return list(
            db.scalars(statement).all()
        )

    def get_by_user_id(
        self,
        db: Session,
        *,
        user_id: int,
    ) -> list[DeletionHistory]:
        statement = (
            select(DeletionHistory)
            .where(
                DeletionHistory.user_id == user_id,
            )
            .order_by(
                DeletionHistory.created_at.desc()
            )
        )

        return list(
            db.scalars(statement).all()
        )

    def get_all(
        self,
        db: Session,
    ) -> list[DeletionHistory]:
        statement = (
            select(DeletionHistory)
            .order_by(
                DeletionHistory.created_at.desc()
            )
        )

        return list(
            db.scalars(statement).all()
        )
