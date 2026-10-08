from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File as FastAPIFile, Query, Response, UploadFile
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.file import FileResponse, DeletionHistoryResponse
from app.services.file_service import FileService


router = APIRouter(
    prefix="/files",
    tags=["Files"],
)

file_service = FileService()


@router.post(
    "/upload",
    response_model=FileResponse,
    status_code=201,
)
async def upload_file(
    file: Annotated[UploadFile, FastAPIFile(...)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return await file_service.upload_file(
        db,
        file=file,
        user_id=current_user.id,
    )


@router.get(
    "/",
    response_model=list[FileResponse],
)
def list_files(
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    filename: str | None = Query(
        default=None,
        min_length=1,
        max_length=255,
    ),
    mime_type: str | None = Query(
        default=None,
        max_length=255,
    ),
    min_size: int | None = Query(
        default=None,
        ge=0,
    ),
    max_size: int | None = Query(
        default=None,
        ge=0,
    ),
    is_duplicate: bool | None = Query(
        default=None,
    ),
    is_protected: bool | None = Query(
        default=None,
    ),
    from_date: datetime | None = Query(
        default=None,
    ),
    to_date: datetime | None = Query(
        default=None,
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    sort_by: str = Query(
        default="created_at",
    ),
    sort_order: str = Query(
        default="desc",
    ),
):
    files, total = file_service.search_files(
        db,
        current_user_id=current_user.id,
        filename=filename,
        mime_type=mime_type,
        min_size=min_size,
        max_size=max_size,
        is_duplicate=is_duplicate,
        is_protected=is_protected,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        is_admin=current_user.role.name == "Admin",
    )

    response.headers["X-Total-Count"] = str(total)

    return files


@router.get(
    "/deletion-history",
    response_model=list[DeletionHistoryResponse],
)
def get_deletion_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return file_service.get_deletion_history(
        db,
        current_user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
    )


@router.get(
    "/{file_id}",
    response_model=FileResponse,
)
def get_file(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    return file_service.get_file(
        db,
        file_id=file_id,
        current_user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
    )


@router.get(
    "/{file_id}/download",
)
def download_file(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    file_record = file_service.get_download_path(
        db,
        file_id=file_id,
        current_user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
    )

    return FastAPIFileResponse(
        path=file_record.file_path,
        filename=file_record.original_filename,
        media_type=file_record.mime_type or "application/octet-stream",
    )


@router.delete(
    "/{file_id}",
    response_model=FileResponse,
)
def delete_file(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    deletion_reason: str | None = Query(
        default=None,
        max_length=255,
    ),
):
    return file_service.delete_file(
        db,
        file_id=file_id,
        current_user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
        deletion_reason=deletion_reason,
    )


@router.patch(
    "/{file_id}/protection",
    response_model=FileResponse,
)
def update_file_protection(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    is_protected: bool = Query(...),
):
    return file_service.set_file_protection(
        db,
        file_id=file_id,
        current_user_id=current_user.id,
        is_protected=is_protected,
        is_admin=current_user.role.name == "Admin",
    )