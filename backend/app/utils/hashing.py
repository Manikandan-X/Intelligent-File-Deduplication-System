import hashlib
from pathlib import Path


DEFAULT_HASH_ALGORITHM = "sha256"
HASH_CHUNK_SIZE = 1024 * 1024  # 1 MB


def calculate_file_hash(
    file_path: str | Path,
    algorithm: str = DEFAULT_HASH_ALGORITHM,
) -> str:
    """
    Calculate the content hash of a file using chunk-based reading.
    """

    try:
        hash_function = hashlib.new(algorithm)
    except ValueError as exc:
        raise ValueError(
            f"Unsupported hash algorithm: {algorithm}"
        ) from exc

    path = Path(file_path)

    with path.open("rb") as file:
        while chunk := file.read(HASH_CHUNK_SIZE):
            hash_function.update(chunk)

    return hash_function.hexdigest()
