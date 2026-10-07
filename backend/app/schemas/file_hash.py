from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileHashResponse(BaseModel):
    id: int
    file_id: int
    hash_algorithm: str
    content_hash: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
