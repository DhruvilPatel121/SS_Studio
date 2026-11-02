import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = ""
    ai_service_port: int = 8000
    model_dir: str = "/app/models"
    onnx_execution_provider: str = "CPUExecutionProvider"
    face_detection_threshold: float = 0.5
    face_quality_threshold: float = 0.5
    face_min_size: int = 40
    max_faces_per_photo: int = 100

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()