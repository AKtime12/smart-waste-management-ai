# backend/app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Waste Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./waste_management.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Points System
    POINTS_PER_CORRECT_SEGREGATION: int = 10
    BONUS_POINTS_HAZARDOUS: int = 5
    PENALTY_POINTS: int = -5
    
    # Bin thresholds
    BIN_FULL_THRESHOLD: float = 80.0
    BIN_CRITICAL_THRESHOLD: float = 95.0
    
    class Config:
        env_file = ".env"

settings = Settings()