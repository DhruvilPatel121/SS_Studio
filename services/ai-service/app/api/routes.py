from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import logging

from app.core.face_processor import process_photo, process_selfie

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "medo-ai"}


@router.get("/health/model")
async def model_health():
    try:
        from app.core.face_processor import get_face_app
        get_face_app()
        return {"status": "ok", "model": "buffalo_sc", "ready": True}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "error", "error": str(e)})


@router.post("/process-photo")
async def process_photo_endpoint(file: UploadFile = File(...)):
    """
    Detect faces in an event photo.
    Returns bounding boxes, embeddings, quality scores.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/heic"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        result = process_photo(data)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"process-photo error: {e}")
        raise HTTPException(status_code=500, detail=f"Face processing failed: {str(e)}")


@router.post("/process-selfie")
async def process_selfie_endpoint(file: UploadFile = File(...)):
    """
    Process a guest selfie for face search.
    Returns embedding and quality info.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        result = process_selfie(data)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"process-selfie error: {e}")
        raise HTTPException(status_code=500, detail=f"Selfie processing failed: {str(e)}")


@router.post("/compare-faces")
async def compare_faces(body: dict):
    """
    Compare two embeddings. Returns cosine similarity score.
    Used for admin verification / manual testing.
    """
    import numpy as np
    emb1 = np.array(body.get("embedding1", []))
    emb2 = np.array(body.get("embedding2", []))
    if emb1.size == 0 or emb2.size == 0:
        raise HTTPException(status_code=400, detail="Both embeddings required")

    similarity = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-10))
    return {"success": True, "similarity": round(similarity, 6)}