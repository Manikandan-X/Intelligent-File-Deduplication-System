from pathlib import Path
from urllib.parse import quote_plus
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.role import Role
from app.models.user import User


# ============================================================
# Test Database Configuration
# ============================================================

TEST_DATABASE_NAME = "file_dedup_test_db"

MYSQL_ROOT_USER = "root"
MYSQL_ROOT_PASSWORD = settings.mysql_root_password
MYSQL_HOST = settings.mysql_host
MYSQL_PORT = settings.mysql_port


def build_mysql_url(
    *,
    username: str,
    password: str,
    database: str,
) -> str:
    return (
        "mysql+pymysql://"
        f"{quote_plus(username)}:"
        f"{quote_plus(password)}@"
        f"{MYSQL_HOST}:{MYSQL_PORT}/"
        f"{database}"
    )


ROOT_DATABASE_URL = build_mysql_url(
    username=MYSQL_ROOT_USER,
    password=MYSQL_ROOT_PASSWORD,
    database="mysql",
)

TEST_DATABASE_URL = build_mysql_url(
    username=settings.mysql_user,
    password=settings.mysql_password,
    database=TEST_DATABASE_NAME,
)


# ============================================================
# Test Database
# ============================================================

@pytest.fixture(scope="session")
def test_database():
    """
    Create a separate MySQL database for integration tests.

    The normal application database is never used.
    """

    root_engine = create_engine(
        ROOT_DATABASE_URL,
        pool_pre_ping=True,
    )

    with root_engine.connect() as connection:
        connection.execution_options(
            isolation_level="AUTOCOMMIT"
        )

        connection.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS "
                f"`{TEST_DATABASE_NAME}` "
                "CHARACTER SET utf8mb4 "
                "COLLATE utf8mb4_unicode_ci"
            )
        )

    root_engine.dispose()

    engine = create_engine(
        TEST_DATABASE_URL,
        pool_pre_ping=True,
    )

    Base.metadata.create_all(bind=engine)

    yield engine

    engine.dispose()

    cleanup_engine = create_engine(
        ROOT_DATABASE_URL,
        pool_pre_ping=True,
    )

    with cleanup_engine.connect() as connection:
        connection.execution_options(
            isolation_level="AUTOCOMMIT"
        )

        connection.execute(
            text(
                f"DROP DATABASE IF EXISTS "
                f"`{TEST_DATABASE_NAME}`"
            )
        )

    cleanup_engine.dispose()


# ============================================================
# Database Session
# ============================================================

@pytest.fixture
def db_session(test_database):
    """
    Create a database session for the current test.

    All application tables are cleared before each test so
    every test starts with a clean database.
    """

    TestSessionLocal = sessionmaker(
        bind=test_database,
        autoflush=False,
        autocommit=False,
    )

    db = TestSessionLocal()

    try:
        # Delete data from all tables in dependency-safe order.
        tables = [
            "audit_logs",
            "deletion_history",
            "file_metadata",
            "file_hashes",
            "duplicate_groups",
            "files",
            "users",
            "roles",
        ]

        for table in tables:
            db.execute(
                text(f"DELETE FROM `{table}`")
            )

        db.commit()

        yield db

    finally:
        db.rollback()
        db.close()


# ============================================================
# Override FastAPI Database Dependency
# ============================================================

@pytest.fixture
def override_database(test_database):
    """
    Make FastAPI endpoints use the test database instead
    of the application's normal database.
    """

    TestSessionLocal = sessionmaker(
        bind=test_database,
        autoflush=False,
        autocommit=False,
    )

    from app.db.session import get_db

    def override_get_db():
        db = TestSessionLocal()

        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.pop(get_db, None)


# ============================================================
# FastAPI Client
# ============================================================

@pytest.fixture
def client(override_database):
    """
    Real FastAPI TestClient using the test database.
    """

    with TestClient(app) as test_client:
        yield test_client


# ============================================================
# Mock Celery
# ============================================================

@pytest.fixture(autouse=True)
def mock_celery_task():
    """
    Prevent uploads from sending jobs to the real Celery worker.

    Celery processing is tested separately in Phase 3.
    """

    with patch(
        "app.services.file_service.process_file.apply_async"
    ) as mock_apply_async:

        mock_apply_async.return_value = None

        yield mock_apply_async


# ============================================================
# Temporary Storage
# ============================================================

@pytest.fixture
def temporary_storage(tmp_path, monkeypatch):
    """
    Redirect application file storage to pytest's temporary
    directory.
    """

    storage_directory = (
        tmp_path / "storage" / "files"
    )

    storage_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    # IMPORTANT:
    # file_service is the singleton imported into app.routers.file
    # so patch the singleton through that module.
    monkeypatch.setattr(
        "app.routers.file.file_service._get_storage_directory",
        lambda: storage_directory,
    )

    return storage_directory


# ============================================================
# Test Users
# ============================================================

@pytest.fixture
def test_users(db_session: Session):
    """
    Create:
        - normal user
        - second normal user
        - admin user
    """

    user_role = Role(
        name="User",
        description="Normal application user",
    )

    admin_role = Role(
        name="Admin",
        description="Application administrator",
    )

    db_session.add_all(
        [
            user_role,
            admin_role,
        ]
    )

    db_session.flush()

    user = User(
        first_name="Test",
        last_name="User",
        email="testuser_file_api@example.com",
        hashed_password=hash_password(
            "TestPassword123!"
        ),
        is_active=True,
        role_id=user_role.id,
    )

    second_user = User(
        first_name="Second",
        last_name="User",
        email="seconduser_file_api@example.com",
        hashed_password=hash_password(
            "TestPassword123!"
        ),
        is_active=True,
        role_id=user_role.id,
    )

    admin = User(
        first_name="Test",
        last_name="Admin",
        email="testadmin_file_api@example.com",
        hashed_password=hash_password(
            "AdminPassword123!"
        ),
        is_active=True,
        role_id=admin_role.id,
    )

    db_session.add_all(
        [
            user,
            second_user,
            admin,
        ]
    )

    db_session.commit()

    db_session.refresh(user)
    db_session.refresh(second_user)
    db_session.refresh(admin)

    # Make sure relationships are loaded before returning.
    db_session.refresh(user)
    db_session.refresh(second_user)
    db_session.refresh(admin)

    return {
        "user": user,
        "second_user": second_user,
        "admin": admin,
    }


# ============================================================
# JWT
# ============================================================

def get_auth_headers(user: User) -> dict[str, str]:
    """
    Generate a real JWT using the application's security code.
    """

    token = create_access_token(
        subject=str(user.id),
        role=user.role.name,
    )

    return {
        "Authorization": f"Bearer {token}",
    }


# ============================================================
# UPLOAD
# ============================================================

def test_upload_file_success(
    client,
    test_users,
    temporary_storage,
):
    content = b"Hello file deduplication system!"

    response = client.post(
        "/files/upload",
        headers=get_auth_headers(
            test_users["user"]
        ),
        files={
            "file": (
                "hello.txt",
                content,
                "text/plain",
            )
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["original_filename"] == "hello.txt"
    assert data["mime_type"] == "text/plain"
    assert data["file_size"] == len(content)
    assert data["user_id"] == test_users["user"].id
    assert data["is_deleted"] is False
    assert data["is_protected"] is False

    stored_filename = data["stored_filename"]

    physical_file = (
        temporary_storage / stored_filename
    )

    assert physical_file.exists()
    assert physical_file.read_bytes() == content


def test_upload_file_without_authentication(
    client,
    temporary_storage,
):
    response = client.post(
        "/files/upload",
        files={
            "file": (
                "hello.txt",
                b"Hello",
                "text/plain",
            )
        },
    )

    assert response.status_code == 401


def test_upload_video_file_is_rejected(
    client,
    test_users,
    temporary_storage,
):
    response = client.post(
        "/files/upload",
        headers=get_auth_headers(
            test_users["user"]
        ),
        files={
            "file": (
                "video.mp4",
                b"fake video",
                "video/mp4",
            )
        },
    )

    assert response.status_code == 400


def test_upload_audio_file_is_rejected(
    client,
    test_users,
    temporary_storage,
):
    response = client.post(
        "/files/upload",
        headers=get_auth_headers(
            test_users["user"]
        ),
        files={
            "file": (
                "audio.mp3",
                b"fake audio",
                "audio/mpeg",
            )
        },
    )

    assert response.status_code == 400


def test_upload_file_exceeding_maximum_size(
    client,
    test_users,
    temporary_storage,
    monkeypatch,
):
    original_max_size = settings.max_file_size

    monkeypatch.setattr(
        settings,
        "max_file_size",
        5,
    )

    try:
        response = client.post(
            "/files/upload",
            headers=get_auth_headers(
                test_users["user"]
            ),
            files={
                "file": (
                    "large.txt",
                    b"123456",
                    "text/plain",
                )
            },
        )

        assert response.status_code == 400

    finally:
        monkeypatch.setattr(
            settings,
            "max_file_size",
            original_max_size,
        )


# ============================================================
# LIST / SEARCH
# ============================================================

def test_list_files_returns_current_users_files(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    response1 = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "first.txt",
                b"first file",
                "text/plain",
            )
        },
    )

    response2 = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "second.txt",
                b"second file",
                "text/plain",
            )
        },
    )

    assert response1.status_code == 201
    assert response2.status_code == 201

    response = client.get(
        "/files/",
        headers=headers,
    )

    assert response.status_code == 200

    data = response.json()

    filenames = {
        item["original_filename"]
        for item in data
    }

    assert filenames == {
        "first.txt",
        "second.txt",
    }


def test_user_cannot_see_another_users_file(
    client,
    test_users,
    temporary_storage,
):
    owner_headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=owner_headers,
        files={
            "file": (
                "private.txt",
                b"private file",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    second_user_headers = get_auth_headers(
        test_users["second_user"]
    )

    response = client.get(
        f"/files/{file_id}",
        headers=second_user_headers,
    )

    assert response.status_code == 404


def test_admin_can_see_files_from_all_users(
    client,
    test_users,
    temporary_storage,
):
    user_headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=user_headers,
        files={
            "file": (
                "user_file.txt",
                b"user file",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    admin_headers = get_auth_headers(
        test_users["admin"]
    )

    response = client.get(
        "/files/",
        headers=admin_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert any(
        item["original_filename"]
        == "user_file.txt"
        for item in data
    )


def test_search_files_by_filename(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "important_report.txt",
                b"report",
                "text/plain",
            )
        },
    )

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "photo.txt",
                b"photo",
                "text/plain",
            )
        },
    )

    response = client.get(
        "/files/",
        headers=headers,
        params={
            "filename": "important",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert (
        data[0]["original_filename"]
        == "important_report.txt"
    )


def test_filter_files_by_mime_type(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "text.txt",
                b"text",
                "text/plain",
            )
        },
    )

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "json.json",
                b'{"name": "test"}',
                "application/json",
            )
        },
    )

    response = client.get(
        "/files/",
        headers=headers,
        params={
            "mime_type": "application/json",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert (
        data[0]["original_filename"]
        == "json.json"
    )


def test_filter_files_by_minimum_size(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    small_content = b"12345"
    large_content = b"12345678901234567890"

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "small.txt",
                small_content,
                "text/plain",
            )
        },
    )

    client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "large.txt",
                large_content,
                "text/plain",
            )
        },
    )

    response = client.get(
        "/files/",
        headers=headers,
        params={
            "min_size": len(large_content),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert (
        data[0]["original_filename"]
        == "large.txt"
    )


# ============================================================
# GET FILE
# ============================================================

def test_get_file_success(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "get_me.txt",
                b"get file test",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    response = client.get(
        f"/files/{file_id}",
        headers=headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == file_id
    assert data["original_filename"] == "get_me.txt"


def test_get_nonexistent_file_returns_404(
    client,
    test_users,
):
    response = client.get(
        "/files/999999",
        headers=get_auth_headers(
            test_users["user"]
        ),
    )

    assert response.status_code == 404


# ============================================================
# DOWNLOAD
# ============================================================

def test_download_file_success(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    content = b"Download this file."

    upload_response = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "download.txt",
                content,
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    response = client.get(
        f"/files/{file_id}/download",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.content == content


def test_download_missing_physical_file_returns_404(
    client,
    test_users,
    temporary_storage,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "missing.txt",
                b"this file will be removed",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    data = upload_response.json()

    file_id = data["id"]
    stored_filename = data["stored_filename"]

    physical_file = (
        temporary_storage / stored_filename
    )

    assert physical_file.exists()

    physical_file.unlink()

    response = client.get(
        f"/files/{file_id}/download",
        headers=headers,
    )

    assert response.status_code == 404


# ============================================================
# DELETE
# ============================================================


def test_delete_file_success(
    client,
    test_users,
    temporary_storage,
    test_database,
):
    headers = get_auth_headers(
        test_users["user"]
    )

    content = b"delete me"

    upload_response = client.post(
        "/files/upload",
        headers=headers,
        files={
            "file": (
                "delete_me.txt",
                content,
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    data = upload_response.json()

    file_id = data["id"]
    stored_filename = data["stored_filename"]

    response = client.delete(
        f"/files/{file_id}",
        headers=headers,
        params={
            "deletion_reason": "Test deletion",
        },
    )

    assert response.status_code == 200

    deleted_data = response.json()

    assert deleted_data["id"] == file_id
    assert deleted_data["is_deleted"] is True

    # The current application implementation keeps
    # the physical file after logical deletion.
    assert (
        temporary_storage / stored_filename
    ).exists()

    # --------------------------------------------------------
    # Verify deleted file is excluded from normal listing
    # --------------------------------------------------------

    list_response = client.get(
        "/files/",
        headers=headers,
    )

    assert list_response.status_code == 200

    assert not any(
        item["id"] == file_id
        for item in list_response.json()
    )

    # --------------------------------------------------------
    # Verify deletion history
    # --------------------------------------------------------

    from app.models.deletion_history import (
        DeletionHistory,
    )

    TestSessionLocal = sessionmaker(
        bind=test_database,
        autoflush=False,
        autocommit=False,
    )

    verification_db = TestSessionLocal()

    try:
        history = verification_db.query(
            DeletionHistory
        ).filter(
            DeletionHistory.file_id == file_id
        ).first()

        assert history is not None

        assert (
            history.original_filename
            == "delete_me.txt"
        )

        assert history.file_size == len(content)

        assert (
            history.deletion_reason
            == "Test deletion"
        )

    finally:
        verification_db.close()




def test_protected_file_cannot_be_deleted(
    client,
    test_users,
    temporary_storage,
):
    admin_headers = get_auth_headers(
        test_users["admin"]
    )

    user_headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=user_headers,
        files={
            "file": (
                "protected.txt",
                b"protected file",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    protection_response = client.patch(
        f"/files/{file_id}/protection",
        headers=admin_headers,
        params={
            "is_protected": True,
        },
    )

    assert protection_response.status_code == 200
    assert (
        protection_response.json()["is_protected"]
        is True
    )

    delete_response = client.delete(
        f"/files/{file_id}",
        headers=user_headers,
    )

    assert delete_response.status_code == 403


# ============================================================
# PROTECTION
# ============================================================

def test_admin_can_protect_file(
    client,
    test_users,
    temporary_storage,
):
    user_headers = get_auth_headers(
        test_users["user"]
    )

    admin_headers = get_auth_headers(
        test_users["admin"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=user_headers,
        files={
            "file": (
                "protect_me.txt",
                b"protect me",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    response = client.patch(
        f"/files/{file_id}/protection",
        headers=admin_headers,
        params={
            "is_protected": True,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == file_id
    assert data["is_protected"] is True


def test_admin_can_unprotect_file(
    client,
    test_users,
    temporary_storage,
):
    user_headers = get_auth_headers(
        test_users["user"]
    )

    admin_headers = get_auth_headers(
        test_users["admin"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=user_headers,
        files={
            "file": (
                "unprotect_me.txt",
                b"unprotect me",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    protect_response = client.patch(
        f"/files/{file_id}/protection",
        headers=admin_headers,
        params={
            "is_protected": True,
        },
    )

    assert protect_response.status_code == 200

    unprotect_response = client.patch(
        f"/files/{file_id}/protection",
        headers=admin_headers,
        params={
            "is_protected": False,
        },
    )

    assert unprotect_response.status_code == 200

    assert (
        unprotect_response.json()["is_protected"]
        is False
    )


def test_normal_user_cannot_change_file_protection(
    client,
    test_users,
    temporary_storage,
):
    user_headers = get_auth_headers(
        test_users["user"]
    )

    upload_response = client.post(
        "/files/upload",
        headers=user_headers,
        files={
            "file": (
                "normal.txt",
                b"normal file",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 201

    file_id = upload_response.json()["id"]

    response = client.patch(
        f"/files/{file_id}/protection",
        headers=user_headers,
        params={
            "is_protected": True,
        },
    )

    assert response.status_code == 403


def test_delete_nonexistent_file_returns_404(
    client,
    test_users,
):
    response = client.delete(
        "/files/999999",
        headers=get_auth_headers(
            test_users["user"]
        ),
    )

    assert response.status_code == 404
