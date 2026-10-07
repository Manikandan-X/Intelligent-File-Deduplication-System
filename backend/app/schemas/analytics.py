from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnalyticsOverviewResponse(BaseModel):
    total_files: int
    total_storage: int
    duplicate_files: int
    duplicate_storage: int
    potential_savings: int


class AnalyticsFileResponse(BaseModel):
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


class AnalyticsFileListResponse(BaseModel):
    files: list[AnalyticsFileResponse]
    count: int


class AnalyticsLimitParams(BaseModel):
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
    )
