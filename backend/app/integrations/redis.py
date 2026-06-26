import json
from typing import Any, Optional
import redis.asyncio as redis
from app.core.config import settings

# Global redis client instance
redis_client: Optional[redis.Redis] = None

async def init_redis() -> None:
    """Initialize the Redis connection pool."""
    global redis_client
    redis_client = redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )

async def close_redis() -> None:
    """Close the Redis connection pool."""
    global redis_client
    if redis_client:
        await redis_client.close()

def get_redis() -> redis.Redis:
    """Dependency to get the Redis client."""
    if not redis_client:
        raise RuntimeError("Redis client is not initialized")
    return redis_client

async def cache_set(key: str, value: Any, expire_secs: int = 300) -> None:
    """Set a value in cache with expiration."""
    client = get_redis()
    await client.set(key, json.dumps(value), ex=expire_secs)

async def cache_get(key: str) -> Optional[Any]:
    """Get a value from cache."""
    client = get_redis()
    data = await client.get(key)
    if data:
        return json.loads(data)
    return None

async def cache_delete(key: str) -> None:
    """Delete a specific key from cache."""
    client = get_redis()
    await client.delete(key)

async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a pattern."""
    client = get_redis()
    keys = await client.keys(pattern)
    if keys:
        await client.delete(*keys)
