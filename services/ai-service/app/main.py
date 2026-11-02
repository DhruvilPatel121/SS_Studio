from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from app.config import settings
from app.api.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Medo AI Service",
    description="Face detection and embedding service for Medo.dev",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Medo AI Service starting up...")
    # Pre-warm the model
    try:
        from app.core.face_processor import get_face_app
        get_face_app()
        logger.info("✅ Face recognition model ready")
    except Exception as e:
        logger.warning(f"⚠️  Model pre-warm failed (will retry on first request): {e}")