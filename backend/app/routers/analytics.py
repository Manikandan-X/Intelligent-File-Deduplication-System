from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsFileListResponse,
    AnalyticsOverviewResponse,
)
from app.services.analytics_service import AnalyticsService


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)

analytics_service = AnalyticsService()


def get_analytics_user_id(
    current_user: User,
) -> int | None:
    """
    Determine the analytics scope.

    Admin users receive system-wide analytics.

    Normal users receive analytics for their own files.
    """
    if current_user.role.name == "Admin":
        return None

    return current_user.id


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
)
def get_analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return overall file storage and duplicate statistics.

    Admin:
        Returns system-wide statistics.

    User:
        Returns statistics for the authenticated user's files.
    """
    user_id = get_analytics_user_id(
        current_user
    )

    return analytics_service.get_overview(
        db,
        user_id=user_id,
    )


@router.get(
    "/largest-files",
    response_model=AnalyticsFileListResponse,
)
def get_largest_files(
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the largest active files.

    Admin:
        Returns the largest files in the system.

    User:
        Returns the largest files belonging to the
        authenticated user.
    """
    user_id = get_analytics_user_id(
        current_user
    )

    files = analytics_service.get_largest_files(
        db,
        user_id=user_id,
        limit=limit,
    )

    return {
        "files": files,
        "count": len(files),
    }


@router.get(
    "/recent-uploads",
    response_model=AnalyticsFileListResponse,
)
def get_recent_uploads(
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the most recently uploaded active files.

    Admin:
        Returns recent uploads from the entire system.

    User:
        Returns recent uploads belonging to the
        authenticated user.
    """
    user_id = get_analytics_user_id(
        current_user
    )

    files = analytics_service.get_recent_uploads(
        db,
        user_id=user_id,
        limit=limit,
    )

    return {
        "files": files,
        "count": len(files),
    }


@router.get(
    "/duplicate-groups/count",
)
def get_duplicate_group_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the total number of duplicate groups.

    Duplicate groups are system-wide because a group can
    contain files belonging to multiple users.
    """
    count = analytics_service.get_duplicate_group_count(
        db,
    )

    return {
        "duplicate_groups": count,
    }
