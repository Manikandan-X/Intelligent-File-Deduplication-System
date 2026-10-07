from pathlib import Path

from sqlalchemy.orm import Session

from app.repositories.file_hash_repository import FileHashRepository
from app.utils.hashing import calculate_file_hash


class FileHashService:
    def __init__(self):
        self.file_hash_repository = FileHashRepository()

    def calculate_and_store_hash(
        self,
        db: Session,
        *,
        file_id: int,
        file_path: str | Path,
        hash_algorithm: str = "sha256",
    ):
        content_hash = calculate_file_hash(
            file_path=file_path,
            algorithm=hash_algorithm,
        )

        existing_hash = self.file_hash_repository.get_by_file_id(
            db,
            file_id=file_id,
            hash_algorithm=hash_algorithm,
        )

        if existing_hash:
            existing_hash.content_hash = content_hash
            db.flush()
            return existing_hash

        return self.file_hash_repository.create(
            db,
            file_id=file_id,
            hash_algorithm=hash_algorithm,
            content_hash=content_hash,
        )

    def get_file_hash(
        self,
        db: Session,
        *,
        file_id: int,
        hash_algorithm: str = "sha256",
    ):
        return self.file_hash_repository.get_by_file_id(
            db,
            file_id=file_id,
            hash_algorithm=hash_algorithm,
        )

    def find_duplicate_hashes(
        self,
        db: Session,
        *,
        content_hash: str,
        hash_algorithm: str = "sha256",
    ):
        return self.file_hash_repository.get_by_content_hash(
            db,
            content_hash=content_hash,
            hash_algorithm=hash_algorithm,
        )
