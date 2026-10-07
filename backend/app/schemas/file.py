from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FileResponse(BaseModel):
    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    mime_type: str | None
    file_size: int
    is_deleted: bool
    is_protected: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class FileSearchParams(BaseModel):
    filename: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    mime_type: str | None = Field(
        default=None,
        max_length=255,
    )
    min_size: int | None = Field(
        default=None,
        ge=0,
    )
    max_size: int | None = Field(
        default=None,
        ge=0,
    )
    is_deleted: bool | None = None
    is_protected: bool | None = None
    page: int = Field(
        default=1,
        ge=1,
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
    )
