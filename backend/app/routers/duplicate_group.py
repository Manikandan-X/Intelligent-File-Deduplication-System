from typing import Annotated

from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user

from app.db.session import get_db

from app.models.user import User

from app.schemas.duplicate_group import DuplicateGroupResponse
from app.schemas.file import FileResponse

from app.services.duplicate_group_service import (
DuplicateGroupService,
)

router = APIRouter(
prefix="/duplicate-groups",
tags=["Duplicate Groups"],
)

duplicate_group_service = DuplicateGroupService()

@router.get(
"/",
response_model=list[DuplicateGroupResponse],
)
def get_all_duplicate_groups(
    current_user: Annotated[
    User,
    Depends(get_current_user),
    ],
    db: Annotated[
    Session,
    Depends(get_db),
    ],
    ):
    return duplicate_group_service.get_all_duplicate_groups(
    db,
    user_id=current_user.id, 
    is_admin=current_user.role.name == "Admin",
    )

@router.get(
"/hash/{content_hash}",
response_model=DuplicateGroupResponse,
)
def get_duplicate_group_by_hash(
    content_hash: str,
    current_user: Annotated[
    User,
    Depends(get_current_user),
    ],
    db: Annotated[
    Session,
    Depends(get_db),
    ],
    ):
    return duplicate_group_service.get_duplicate_group_by_hash(
        db,
        content_hash=content_hash,
        user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
    )

@router.get(
"/{group_id}",
response_model=DuplicateGroupResponse,
)
def get_duplicate_group(
    group_id: int,
    current_user: Annotated[
    User,
    Depends(get_current_user),
    ],
    db: Annotated[
    Session,
    Depends(get_db),
    ],
    ):
    return duplicate_group_service.get_duplicate_group(
        db,
        group_id=group_id,
        user_id=current_user.id,
        is_admin=current_user.role.name == "Admin",
    )

@router.get(
    "/{group_id}/files",
    response_model=list[FileResponse],
)
def get_duplicate_group_files(
    group_id: int,
    current_user: Annotated[
        User,
        Depends(get_current_user),
    ],
    db: Annotated[
        Session,
        Depends(get_db),
    ],
):
    """
    Files in a duplicate group (original included).

    Admins see every member;
    other users only see their own files.
    """
    is_admin = current_user.role.name == "Admin"

    return duplicate_group_service.get_group_files(
        db,
        group_id=group_id,
        user_id=None if is_admin else current_user.id,
    )