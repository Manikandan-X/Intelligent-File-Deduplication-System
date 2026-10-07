from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.file import File


class DuplicateGroup(Base, TimestampMixin):
    __tablename__ = "duplicate_groups"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    content_hash: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
    )

    original_file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id"),
        nullable=False,
        index=True,
    )

    duplicate_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    total_size: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )

    potential_savings: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )

    original_file: Mapped["File"] = relationship(
        "File",
        foreign_keys=[original_file_id],
    )