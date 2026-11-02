import numpy as np
import cv2
from PIL import Image
import io
import logging
from typing import Optional
import insightface
from insightface.app import FaceAnalysis
from app.config import settings

logger = logging.getLogger(__name__)

# Singleton face analysis model
_face_app: Optional[FaceAnalysis] = None

def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        logger.info(f"Loading InsightFace model (provider: {settings.onnx_execution_provider})")
        _face_app = FaceAnalysis(
            name="buffalo_sc",
            root=settings.model_dir,
            providers=[settings.onnx_execution_provider],
        )
        _face_app.prepare(ctx_id=-1, det_size=(640, 640))
        logger.info("✅ InsightFace model loaded")
    return _face_app


def decode_image(data: bytes) -> np.ndarray:
    """Decode image bytes to BGR numpy array."""
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        # Try PIL fallback (handles HEIC etc.)
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    return img


def compute_blur_score(img: np.ndarray) -> float:
    """Laplacian variance — lower = more blurry."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_brightness(img: np.ndarray) -> float:
    """Mean brightness 0-255."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(gray.mean())


def normalize_embedding(embedding: np.ndarray) -> np.ndarray:
    """L2 normalize so cosine similarity = dot product."""
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return embedding
    return embedding / norm


def compute_quality_score(
    blur_score: float,
    brightness: float,
    face_size: float,
    det_conf: float
) -> float:
    """
    Composite quality score 0-1.
    Combines sharpness, brightness, face size, detection confidence.
    """
    # Blur: good > 100, bad < 20
    blur_norm = min(1.0, blur_score / 100.0)

    # Brightness: good 60-200, penalize extreme
    if 60 <= brightness <= 200:
        bright_norm = 1.0
    elif brightness < 60:
        bright_norm = max(0.0, brightness / 60.0)
    else:
        bright_norm = max(0.0, 1.0 - (brightness - 200) / 55.0)

    # Face size: larger = better (normalized by 200px threshold)
    size_norm = min(1.0, face_size / 200.0)

    quality = (0.35 * blur_norm + 0.25 * bright_norm + 0.20 * size_norm + 0.20 * det_conf)
    return round(float(quality), 4)


def process_photo(image_data: bytes) -> dict:
    """
    Run full face analysis pipeline on a photo.
    Returns list of detected faces with embeddings.
    """
    app = get_face_app()
    img = decode_image(image_data)
    h, w = img.shape[:2]

    faces_out = []
    try:
        faces = app.get(img)
    except Exception as e:
        logger.error(f"Face analysis failed: {e}")
        return {"faces": [], "image_width": w, "image_height": h, "error": str(e)}

    for face in faces:
        if face.det_score < settings.face_detection_threshold:
            continue

        bbox = face.bbox.tolist()  # [x1, y1, x2, y2]
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])

        # Clamp to image bounds
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        face_w = x2 - x1
        face_h = y2 - y1

        # Skip too small
        if face_w < settings.face_min_size or face_h < settings.face_min_size:
            continue

        # Crop face for quality analysis
        face_crop = img[y1:y2, x1:x2]
        blur_score = compute_blur_score(face_crop)
        brightness = compute_brightness(face_crop)
        face_size = min(face_w, face_h)

        quality_score = compute_quality_score(
            blur_score, brightness, face_size, float(face.det_score)
        )

        # Normalize embedding (512-d ArcFace)
        embedding = normalize_embedding(np.array(face.embedding)).tolist()

        # Normalize bbox to 0-1 range
        norm_bbox = [
            round(x1 / w, 6),
            round(y1 / h, 6),
            round(face_w / w, 6),
            round(face_h / h, 6),
        ]

        faces_out.append({
            "bbox": norm_bbox,
            "confidence": round(float(face.det_score), 4),
            "quality_score": quality_score,
            "is_blurry": blur_score < 20,
            "is_dark": brightness < 40,
            "embedding": embedding,
            "face_size_px": face_size,
        })

    logger.info(f"Detected {len(faces_out)} faces (of {len(faces)} raw)")
    return {
        "faces": faces_out,
        "image_width": w,
        "image_height": h,
    }


def process_selfie(image_data: bytes) -> dict:
    """
    Process selfie — expects exactly one primary face.
    Returns embedding for search, quality metrics, and face count.
    """
    app = get_face_app()
    img = decode_image(image_data)
    h, w = img.shape[:2]

    try:
        faces = app.get(img)
    except Exception as e:
        logger.error(f"Selfie analysis failed: {e}")
        return {"faces": [], "quality_score": 0.0, "error": str(e)}

    valid_faces = [f for f in faces if f.det_score >= settings.face_detection_threshold]

    if not valid_faces:
        return {"faces": [], "quality_score": 0.0, "face_count": 0}

    # Return all faces (caller enforces single-face rule for selfies)
    result_faces = []
    for face in valid_faces:
        bbox = face.bbox.tolist()
        x1, y1, x2, y2 = max(0, int(bbox[0])), max(0, int(bbox[1])), min(w, int(bbox[2])), min(h, int(bbox[3]))
        face_crop = img[y1:y2, x1:x2]
        blur_score = compute_blur_score(face_crop) if face_crop.size > 0 else 0
        brightness = compute_brightness(face_crop) if face_crop.size > 0 else 0
        face_size = min(x2 - x1, y2 - y1)
        quality = compute_quality_score(blur_score, brightness, face_size, float(face.det_score))
        embedding = normalize_embedding(np.array(face.embedding)).tolist()

        result_faces.append({
            "embedding": embedding,
            "confidence": round(float(face.det_score), 4),
            "quality_score": quality,
            "is_blurry": blur_score < 20,
            "is_dark": brightness < 40,
        })

    overall_quality = max(f["quality_score"] for f in result_faces) if result_faces else 0.0

    return {
        "faces": result_faces,
        "face_count": len(result_faces),
        "quality_score": overall_quality,
    }