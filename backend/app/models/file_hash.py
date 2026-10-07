from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.file import File


class FileHash(Base, TimestampMixin):
    __tablename__ = "file_hashes"

    __table_args__ = (
        UniqueConstraint(
            "file_id",
            "hash_algorithm",
            name="uq_file_hash_file_algorithm",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    hash_algorithm: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    content_hash: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
    )

    file: Mapped["File"] = relationship(
        "File",
        back_populates="file_hash",
    )
