import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MuseFlow"
    API_V1_STR: str = "/api/v1"
    
    # Security (legacy – kept for backward compatibility)
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super_secret_jwt_key_change_me_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Supabase – used by the JWT middleware to verify tokens issued by Supabase Auth
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://dgorxcykntoibkqsaorh.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./museflow.db"
    )

    # Redis Cache
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Stream Extraction Microservice
    STREAM_SERVICE_URL: str = os.getenv("STREAM_SERVICE_URL", "http://localhost:3001")

    # Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    class Config:
        case_sensitive = True
        env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
        extra = "ignore"

settings = Settings()

