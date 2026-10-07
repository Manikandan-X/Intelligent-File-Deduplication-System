from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.file import File


class FileMetadata(Base, TimestampMixin):
    __tablename__ = "file_metadata"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    file_extension: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    storage_location: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    file: Mapped["File"] = relationship(
        "File",
        back_populates="file_metadata",
    )
