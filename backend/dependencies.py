
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt.exceptions import InvalidTokenError

from backend.auth import JWT_SECRET_KEY, JWT_ALGORITHM

bearer_scheme = HTTPBearer()


def get_current_employee(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="JWT secret is not configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        employee_id = payload.get("sub")
        role = payload.get("role")

        if employee_id is None or role not in ("employee", "admin"):
            raise InvalidTokenError("Invalid token payload")

        return {
            "id": int(employee_id),
            "role": role,
        }

    except (InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
