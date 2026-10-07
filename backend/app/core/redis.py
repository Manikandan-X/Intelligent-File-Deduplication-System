import uuid
from contextlib import contextmanager
from typing import Iterator

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.logging import get_logger


logger = get_logger(__name__)


redis_client = Redis.from_url(
    settings.redis_url,
    decode_responses=True,
)


REDIS_LOCK_PREFIX = "file_dedup:lock:"
REDIS_LOCK_TIMEOUT_SECONDS = 30


class RedisLockUnavailable(Exception):
    """
    Raised when Redis is available but the requested lock
    is already held by another process.
    """


class RedisLock:
    """
    Represents a Redis distributed lock.

    The lock has a unique token so that one process cannot
    accidentally release another process's lock.
    """

    def __init__(
        self,
        client: Redis,
        key: str,
        timeout: int = REDIS_LOCK_TIMEOUT_SECONDS,
    ) -> None:
        self.client = client
        self.key = key
        self.timeout = timeout
        self.token = str(uuid.uuid4())
        self.acquired = False

    def acquire(self) -> bool:
        """
        Try to acquire the Redis lock.

        Returns:
            True  -> lock acquired
            False -> lock already exists

        Redis connection errors are allowed to propagate so
        the caller can decide how to handle Redis failure.
        """

        self.acquired = self.client.set(
            self.key,
            self.token,
            nx=True,
            ex=self.timeout,
        )

        return bool(self.acquired)

    def release(self) -> None:
        """
        Release the lock only if this process owns it.

        Uses a Lua script so that checking the token and
        deleting the key happen atomically.
        """

        if not self.acquired:
            return

        release_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """

        try:
            self.client.eval(
                release_script,
                1,
                self.key,
                self.token,
            )
        finally:
            self.acquired = False


@contextmanager
def try_file_lock(
    lock_id: str,
) -> Iterator[bool]:
    """
    Attempt to acquire a Redis lock for file processing.

    Redis available + lock acquired:
        yields True

    Redis available + lock already held:
        raises RedisLockUnavailable

    Redis unavailable:
        logs the failure and yields False

    The caller can decide how to handle processing when Redis
    is unavailable.
    """

    lock = RedisLock(
        client=redis_client,
        key=f"{REDIS_LOCK_PREFIX}{lock_id}",
    )

    try:
        try:
            acquired = lock.acquire()

        except RedisError as exc:
            logger.warning(
                "Redis unavailable while acquiring file lock: "
                "lock_id=%s error=%s",
                lock_id,
                str(exc),
            )

            yield False
            return

        if not acquired:
            raise RedisLockUnavailable(
                f"File operation '{lock_id}' is already being processed"
            )

        logger.debug(
            "Redis file lock acquired: lock_id=%s",
            lock_id,
        )

        yield True

    finally:
        if lock.acquired:
            try:
                lock.release()

                logger.debug(
                    "Redis file lock released: lock_id=%s",
                    lock_id,
                )

            except RedisError as exc:
                logger.warning(
                    "Failed to release Redis file lock: "
                    "lock_id=%s error=%s",
                    lock_id,
                    str(exc),
                )