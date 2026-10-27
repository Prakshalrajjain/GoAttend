import base64
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

# Local storage path fallback
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LOCAL_PHOTOS_DIR = PROJECT_ROOT / "storage" / "photos"
LOCAL_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def is_cloudinary_configured() -> bool:
    return bool(
        CLOUDINARY_CLOUD_NAME
        and CLOUDINARY_API_KEY
        and CLOUDINARY_API_SECRET
        and CLOUDINARY_CLOUD_NAME.strip()
        and CLOUDINARY_API_KEY.strip()
        and CLOUDINARY_API_SECRET.strip()
    )


def save_attendance_photo(photo_data: str, employee_id: int, tag: str = "selfie") -> str:
    """
    Saves an attendance photo. Supports base64 data URLs or standard base64 strings.
    Uploads to Cloudinary if configured in .env, otherwise saves safely to local storage.
    Returns the public/accessible photo URL.
    """
    if not photo_data:
        raise ValueError("Photo data cannot be empty")

    # If already a valid http(s) URL, return directly
    if photo_data.startswith("http://") or photo_data.startswith("https://"):
        return photo_data

    # Strip data URL header if present (e.g., data:image/jpeg;base64,...)
    cleaned_data = photo_data
    file_extension = "jpg"
    match = re.match(r"^data:image/([a-zA-Z0-9\+\.\-]+);base64,(.+)$", photo_data)
    if match:
        raw_ext = match.group(1).lower()
        if raw_ext in ("jpeg", "jpg"):
            file_extension = "jpg"
        elif raw_ext in ("png", "webp"):
            file_extension = raw_ext
        cleaned_data = match.group(2)

    try:
        image_bytes = base64.b64decode(cleaned_data)
    except Exception as e:
        raise ValueError(f"Invalid base64 photo data: {e}")

    # Maximum size sanity check (e.g., 10MB)
    if len(image_bytes) > 10 * 1024 * 1024:
        raise ValueError("Photo exceeds maximum allowed size of 10MB")

    # Attempt Cloudinary upload if configured
    if is_cloudinary_configured():
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(
                cloud_name=CLOUDINARY_CLOUD_NAME,
                api_key=CLOUDINARY_API_KEY,
                api_secret=CLOUDINARY_API_SECRET,
                secure=True,
            )

            response = cloudinary.uploader.upload(
                photo_data,  # Cloudinary accepts data URI directly
                folder="geoattend/attendance",
                public_id=f"emp_{employee_id}_{tag}_{uuid.uuid4().hex[:8]}",
                resource_type="image",
            )
            return response.get("secure_url") or response.get("url")
        except Exception as cloud_err:
            # Fallback to local storage if Cloudinary fails so check-in is never blocked
            pass

    # Local fallback
    filename = f"emp_{employee_id}_{tag}_{uuid.uuid4().hex[:10]}.{file_extension}"
    file_path = LOCAL_PHOTOS_DIR / filename
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    return f"/storage/photos/{filename}"
