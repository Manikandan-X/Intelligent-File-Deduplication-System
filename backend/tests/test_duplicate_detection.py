from datetime import datetime
from unittest.mock import MagicMock

import pytest

from app.models.file import File
from app.models.file_hash import FileHash
from app.models.duplicate_group import DuplicateGroup
from app.services.duplicate_detection_service import (
    DuplicateDetectionService,
)
from app.utils.hashing import calculate_file_hash


def create_file(
    *,
    file_id: int,
    filename: str,
    file_size: int,
    created_at: datetime,
) -> File:
    return File(
        id=file_id,
        user_id=1,
        original_filename=filename,
        stored_filename=f"stored-{file_id}.bin",
        file_path=f"/tmp/stored-{file_id}.bin",
        mime_type="application/octet-stream",
        file_size=file_size,
        is_deleted=False,
        is_protected=False,
        created_at=created_at,
        updated_at=created_at,
    )


# ============================================================
# Hashing Tests
# ============================================================


def test_same_file_content_produces_same_hash(tmp_path):
    file_one = tmp_path / "first.txt"
    file_two = tmp_path / "second.txt"

    content = b"same file content"

    file_one.write_bytes(content)
    file_two.write_bytes(content)

    hash_one = calculate_file_hash(file_one)
    hash_two = calculate_file_hash(file_two)

    assert hash_one == hash_two


def test_different_file_content_produces_different_hash(tmp_path):
    file_one = tmp_path / "first.txt"
    file_two = tmp_path / "second.txt"

    file_one.write_bytes(b"first content")
    file_two.write_bytes(b"different content")

    hash_one = calculate_file_hash(file_one)
    hash_two = calculate_file_hash(file_two)

    assert hash_one != hash_two


def test_different_filenames_with_same_content_produce_same_hash(
    tmp_path,
):
    file_one = tmp_path / "photo.jpg"
    file_two = tmp_path / "renamed_photo.jpg"

    content = b"identical image content"

    file_one.write_bytes(content)
    file_two.write_bytes(content)

    hash_one = calculate_file_hash(file_one)
    hash_two = calculate_file_hash(file_two)

    assert hash_one == hash_two


def test_hashing_uses_chunk_based_reading(
    tmp_path,
    monkeypatch,
):
    import app.utils.hashing as hashing_module

    monkeypatch.setattr(
        hashing_module,
        "HASH_CHUNK_SIZE",
        4,
    )

    file_path = tmp_path / "large_file.bin"

    content = b"abcdefghij"
    file_path.write_bytes(content)

    actual_hash = hashing_module.calculate_file_hash(
        file_path
    )

    import hashlib

    expected_hash = hashlib.sha256(content).hexdigest()

    assert actual_hash == expected_hash


def test_unsupported_hash_algorithm_raises_error(tmp_path):
    file_path = tmp_path / "test.txt"
    file_path.write_bytes(b"test content")

    with pytest.raises(
        ValueError,
        match="Unsupported hash algorithm",
    ):
        calculate_file_hash(
            file_path,
            algorithm="invalid_algorithm",
        )


# ============================================================
# Duplicate Detection Tests
# ============================================================


def test_no_matching_hash_means_file_is_not_duplicate():
    service = DuplicateDetectionService()

    service.file_hash_repository = MagicMock()

    service.file_hash_repository.get_by_content_hash.return_value = []

    db = MagicMock()

    file = create_file(
        file_id=1,
        filename="file.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    is_duplicate, group, group_created = (
        service.detect_duplicate(
            db,
            file=file,
            content_hash="hash-123",
        )
    )

    assert is_duplicate is False
    assert group is None
    assert group_created is False


def test_same_file_hash_is_not_treated_as_duplicate():
    service = DuplicateDetectionService()

    service.file_hash_repository = MagicMock()

    existing_hash = FileHash(
        id=1,
        file_id=1,
        hash_algorithm="sha256",
        content_hash="hash-123",
    )

    service.file_hash_repository.get_by_content_hash.return_value = [
        existing_hash
    ]

    db = MagicMock()

    file = create_file(
        file_id=1,
        filename="file.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    is_duplicate, group, group_created = (
        service.detect_duplicate(
            db,
            file=file,
            content_hash="hash-123",
        )
    )

    assert is_duplicate is False
    assert group is None
    assert group_created is False


def test_duplicate_group_is_created_for_duplicate_file():
    service = DuplicateDetectionService()

    service.file_hash_repository = MagicMock()
    service.duplicate_group_repository = MagicMock()

    existing_hash = FileHash(
        id=1,
        file_id=1,
        hash_algorithm="sha256",
        content_hash="hash-123",
    )

    service.file_hash_repository.get_by_content_hash.return_value = [
        existing_hash
    ]

    original_file = create_file(
        file_id=1,
        filename="original.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    duplicate_file = create_file(
        file_id=2,
        filename="copy.txt",
        file_size=100,
        created_at=datetime(2026, 1, 2),
    )

    query = MagicMock()
    query.filter.return_value = query
    query.all.return_value = [original_file]

    db = MagicMock()
    db.query.return_value = query

    duplicate_group = DuplicateGroup(
        id=10,
        content_hash="hash-123",
        original_file_id=original_file.id,
        duplicate_count=0,
        total_size=0,
        potential_savings=0,
    )

    service.duplicate_group_repository.get_by_content_hash.return_value = (
        None
    )

    service.duplicate_group_repository.create.return_value = (
        duplicate_group
    )

    def update_statistics(
        db,
        group,
        *,
        duplicate_count,
        total_size,
        potential_savings,
    ):
        group.duplicate_count = duplicate_count
        group.total_size = total_size
        group.potential_savings = potential_savings
        return group

    service.duplicate_group_repository.update_statistics.side_effect = (
        update_statistics
    )

    (
        is_duplicate,
        group,
        group_created,
    ) = service.detect_duplicate(
        db,
        file=duplicate_file,
        content_hash="hash-123",
    )

    assert is_duplicate is True
    assert group is duplicate_group
    assert group_created is True

    assert group.original_file_id == original_file.id
    assert group.duplicate_count == 1
    assert group.total_size == 200
    assert group.potential_savings == 100

    service.duplicate_group_repository.create.assert_called_once_with(
        db,
        content_hash="hash-123",
        original_file_id=original_file.id,
    )


def test_existing_duplicate_group_is_updated():
    service = DuplicateDetectionService()

    service.file_hash_repository = MagicMock()
    service.duplicate_group_repository = MagicMock()

    existing_hash = FileHash(
        id=1,
        file_id=1,
        hash_algorithm="sha256",
        content_hash="hash-123",
    )

    service.file_hash_repository.get_by_content_hash.return_value = [
        existing_hash
    ]

    original_file = create_file(
        file_id=1,
        filename="original.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    second_duplicate = create_file(
        file_id=2,
        filename="copy-1.txt",
        file_size=100,
        created_at=datetime(2026, 1, 2),
    )

    third_duplicate = create_file(
        file_id=3,
        filename="copy-2.txt",
        file_size=100,
        created_at=datetime(2026, 1, 3),
    )

    query = MagicMock()
    query.filter.return_value = query
    query.all.return_value = [
        original_file,
        second_duplicate,
    ]

    db = MagicMock()
    db.query.return_value = query

    duplicate_group = DuplicateGroup(
        id=10,
        content_hash="hash-123",
        original_file_id=original_file.id,
        duplicate_count=1,
        total_size=200,
        potential_savings=100,
    )

    service.duplicate_group_repository.get_by_content_hash.return_value = (
        duplicate_group
    )

    def update_statistics(
        db,
        group,
        *,
        duplicate_count,
        total_size,
        potential_savings,
    ):
        group.duplicate_count = duplicate_count
        group.total_size = total_size
        group.potential_savings = potential_savings
        return group

    service.duplicate_group_repository.update_statistics.side_effect = (
        update_statistics
    )

    (
        is_duplicate,
        group,
        group_created,
    ) = service.detect_duplicate(
        db,
        file=third_duplicate,
        content_hash="hash-123",
    )

    assert is_duplicate is True
    assert group is duplicate_group
    assert group_created is False

    assert group.original_file_id == original_file.id
    assert group.duplicate_count == 2
    assert group.total_size == 300
    assert group.potential_savings == 200

    service.duplicate_group_repository.create.assert_not_called()


def test_oldest_file_is_selected_as_original():
    service = DuplicateDetectionService()

    oldest_file = create_file(
        file_id=1,
        filename="oldest.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    newer_file = create_file(
        file_id=2,
        filename="newer.txt",
        file_size=100,
        created_at=datetime(2026, 1, 5),
    )

    selected = service._select_original_file(
        [newer_file, oldest_file]
    )

    assert selected.id == oldest_file.id


def test_deleted_files_are_not_considered_duplicates():
    service = DuplicateDetectionService()

    service.file_hash_repository = MagicMock()

    existing_hash = FileHash(
        id=1,
        file_id=1,
        hash_algorithm="sha256",
        content_hash="hash-123",
    )

    service.file_hash_repository.get_by_content_hash.return_value = [
        existing_hash
    ]

    deleted_file = create_file(
        file_id=1,
        filename="deleted.txt",
        file_size=100,
        created_at=datetime(2026, 1, 1),
    )

    deleted_file.is_deleted = True

    query = MagicMock()
    query.filter.return_value = query
    query.all.return_value = []

    db = MagicMock()
    db.query.return_value = query

    current_file = create_file(
        file_id=2,
        filename="current.txt",
        file_size=100,
        created_at=datetime(2026, 1, 2),
    )

    is_duplicate, group, group_created = (
        service.detect_duplicate(
            db,
            file=current_file,
            content_hash="hash-123",
        )
    )

    assert is_duplicate is False
    assert group is None
    assert group_created is False


def test_potential_savings_excludes_original_file():
    service = DuplicateDetectionService()

    original_file = create_file(
        file_id=1,
        filename="original.txt",
        file_size=500,
        created_at=datetime(2026, 1, 1),
    )

    duplicate_one = create_file(
        file_id=2,
        filename="copy-one.txt",
        file_size=500,
        created_at=datetime(2026, 1, 2),
    )

    duplicate_two = create_file(
        file_id=3,
        filename="copy-two.txt",
        file_size=500,
        created_at=datetime(2026, 1, 3),
    )

    duplicate_group = DuplicateGroup(
        id=10,
        content_hash="hash-123",
        original_file_id=original_file.id,
    )

    service.duplicate_group_repository = MagicMock()

    def update_statistics(
        db,
        group,
        *,
        duplicate_count,
        total_size,
        potential_savings,
    ):
        group.duplicate_count = duplicate_count
        group.total_size = total_size
        group.potential_savings = potential_savings
        return group

    service.duplicate_group_repository.update_statistics.side_effect = (
        update_statistics
    )

    db = MagicMock()

    service._update_group_statistics(
        db,
        duplicate_group=duplicate_group,
        current_file=duplicate_two,
        existing_files=[
            original_file,
            duplicate_one,
        ],
    )

    assert duplicate_group.original_file_id == original_file.id
    assert duplicate_group.duplicate_count == 2
    assert duplicate_group.total_size == 1500
    assert duplicate_group.potential_savings == 1000