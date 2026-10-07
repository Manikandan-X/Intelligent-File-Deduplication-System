from datetime import datetime

from pydantic import BaseModel, ConfigDict

class DuplicateGroupResponse(BaseModel):
    id: int
    content_hash: str
    original_file_id: int
    duplicate_count: int
    total_size: int
    potential_savings: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
