from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file_hash import FileHash


class FileHashRepository:
    def create(
        self,
        db: Session,
        *,
        file_id: int,
        hash_algorithm: str,
        content_hash: str,
    ) -> FileHash:
        file_hash = FileHash(
            file_id=file_id,
            hash_algorithm=hash_algorithm,
            content_hash=content_hash,
        )

        db.add(file_hash)
        db.flush()

        return file_hash

    def get_by_file_id(
        self,
        db: Session,
        *,
        file_id: int,
        hash_algorithm: str,
    ) -> FileHash | None:
        statement = select(FileHash).where(
            FileHash.file_id == file_id,
            FileHash.hash_algorithm == hash_algorithm,
        )

        return db.scalar(statement)

    def get_by_content_hash(
        self,
        db: Session,
        *,
        content_hash: str,
        hash_algorithm: str,
    ) -> list[FileHash]:
        statement = (
            select(FileHash)
            .where(
                FileHash.content_hash == content_hash,
                FileHash.hash_algorithm == hash_algorithm,
            )
            .order_by(FileHash.created_at.asc())
        )

        return list(db.scalars(statement).all())

    def exists_by_content_hash(
        self,
        db: Session,
        *,
        content_hash: str,
        hash_algorithm: str,
    ) -> bool:
        statement = select(FileHash.id).where(
            FileHash.content_hash == content_hash,
            FileHash.hash_algorithm == hash_algorithm,
        )

        return db.scalar(statement) is not None
