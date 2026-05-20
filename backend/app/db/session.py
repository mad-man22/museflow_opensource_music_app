from sqlmodel import create_engine, Session
from sqlalchemy.pool import NullPool
import redis
from app.core.config import settings

# Create database engine
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL, 
        echo=False,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        settings.DATABASE_URL, 
        echo=False,
        poolclass=NullPool
    )

def get_db():
    """Dependency to get a database session."""
    with Session(engine) as session:
        yield session

# Initialize Redis client with safe wrapper to handle offline state gracefully
import logging
logger = logging.getLogger("museflow.redis")

class SafeRedisClient:
    def __init__(self, client):
        self.client = client
        self.is_functional = True

    def get(self, key):
        if not self.is_functional:
            return None
        try:
            return self.client.get(key)
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            logger.warning(f"[Redis Wrapper] Service offline or timed out. Bypassing cache: {e}")
            self.is_functional = False
            return None
        except Exception as e:
            logger.error(f"[Redis Wrapper] Get error: {e}")
            return None

    def setex(self, key, time, value):
        if not self.is_functional:
            return False
        try:
            return self.client.setex(key, time, value)
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            logger.warning(f"[Redis Wrapper] Service offline or timed out. Skipping cache write: {e}")
            self.is_functional = False
            return False
        except Exception as e:
            logger.error(f"[Redis Wrapper] Setex error: {e}")
            return False

_raw_redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
redis_client = SafeRedisClient(_raw_redis_client)

def get_redis():
    """Dependency to get the safe Redis client wrapper."""
    return redis_client
