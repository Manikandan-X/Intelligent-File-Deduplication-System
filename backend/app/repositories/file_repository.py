from datetime import datetime

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.duplicate_group import DuplicateGroup
from app.models.file import File
from app.models.file_hash import FileHash


class FileRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: int,
        original_filename: str,
        stored_filename: str,
        file_path: str,
        mime_type: str | None,
        file_size: int,
    ) -> File:
        file = File(
            user_id=user_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=file_path,
            mime_type=mime_type,
            file_size=file_size,
        )

        db.add(file)
        db.flush()

        return file

    def get_by_id(
        self,
        db: Session,
        file_id: int,
    ) -> File | None:
        statement = select(File).where(
            File.id == file_id,
            File.is_deleted.is_(False),
        )

        return db.scalar(statement)

    def get_by_id_for_user(
        self,
        db: Session,
        *,
        file_id: int,
        user_id: int,
    ) -> File | None:
        statement = select(File).where(
            File.id == file_id,
            File.user_id == user_id,
            File.is_deleted.is_(False),
        )

        return db.scalar(statement)

    def get_by_stored_filename(
        self,
        db: Session,
        stored_filename: str,
    ) -> File | None:
        statement = select(File).where(
            File.stored_filename == stored_filename,
        )

        return db.scalar(statement)

    def search(
        self,
        db: Session,
        *,
        filename: str | None = None,
        mime_type: str | None = None,
        min_size: int | None = None,
        max_size: int | None = None,
        is_deleted: bool | None = False,
        is_protected: bool | None = None,
        is_duplicate: bool | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        user_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[File], int]:
        conditions = []

        if filename:
            search_value = f"%{filename}%"

            conditions.append(
                or_(
                    File.original_filename.ilike(search_value),
                    File.stored_filename.ilike(search_value),
                )
            )

        if mime_type:
            conditions.append(
                File.mime_type == mime_type
            )

        if min_size is not None:
            conditions.append(
                File.file_size >= min_size
            )

        if max_size is not None:
            conditions.append(
                File.file_size <= max_size
            )

        if is_deleted is not None:
            conditions.append(
                File.is_deleted == is_deleted
            )

        if is_protected is not None:
            conditions.append(
                File.is_protected == is_protected
            )

        if user_id is not None:
            conditions.append(
                File.user_id == user_id
            )

        if from_date is not None:
            conditions.append(
                File.created_at >= from_date
            )

        if to_date is not None:
            conditions.append(
                File.created_at <= to_date
            )

        duplicate_exists = exists(
            select(1)
            .select_from(FileHash)
            .join(
                DuplicateGroup,
                DuplicateGroup.content_hash
                == FileHash.content_hash,
            )
            .where(
                FileHash.file_id == File.id,
                FileHash.hash_algorithm == "sha256",
                DuplicateGroup.original_file_id != File.id,
            )
        )

        if is_duplicate is True:
            conditions.append(duplicate_exists)

        elif is_duplicate is False:
            conditions.append(~duplicate_exists)

        count_statement = select(
            func.count(File.id)
        ).where(*conditions)

        total = db.scalar(count_statement) or 0

        sort_columns = {
            "created_at": File.created_at,
            "updated_at": File.updated_at,
            "file_size": File.file_size,
            "original_filename": File.original_filename,
        }

        sort_column = sort_columns.get(
            sort_by,
            File.created_at,
        )

        if sort_order.lower() == "asc":
            order_by = sort_column.asc()
        else:
            order_by = sort_column.desc()

        offset = (page - 1) * page_size

        statement = (
            select(File)
            .where(*conditions)
            .order_by(order_by)
            .offset(offset)
            .limit(page_size)
        )

        files = list(
            db.scalars(statement).all()
        )

        return files, total

    def mark_as_deleted(
        self,
        db: Session,
        file: File,
    ) -> File:
        file.is_deleted = True

        db.flush()

        return file

    def update_protection(
        self,
        db: Session,
        file: File,
        *,
        is_protected: bool,
    ) -> File:
        file.is_protected = is_protected

        db.flush()

        return file

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

    def get_count(
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
